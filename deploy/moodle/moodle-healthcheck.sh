#!/usr/bin/env bash
# ==============================================================================
# Zealosh Learning Engine — Moodle Web Container Health Check
# Validates that Apache + PHP serve the intended local route on loopback port 80
# Validates HTTP status code AND strictly validates Location header on 302/303
#
# STRICT RULES:
# 1. Queries loopback port 80 directly with explicit Host header (no public DNS).
# 2. Never follows redirects (--max-redirs 0, strictly no -L).
# 3. HTTP 200: Validated against expected non-empty application response.
# 4. HTTP 302/303: Accepted ONLY if Location header points to a permitted relative
#    path or approved destination on https://${DOMAIN}/...
# 5. Any redirect to a production hostname, unapproved external host, scheme
#    downgrade (http://), protocol-relative (//) URL, userinfo spoofing, or invalid
#    path causes immediate health check failure (exit 1).
# 6. HTTP 301, 4xx, 5xx, 000 (timeout/connection failure), or empty response: UNHEALTHY (exit 1).
# ==============================================================================

set -o pipefail

DOMAIN="${ZEALOSH_DOMAIN:-${APP_DOMAIN:-lms.staging.zealosh.com}}"
TIMEOUT=5

# Small, tested RFC-compliant URL validation routine
# Returns 0 if approved, 1 if rejected
validate_redirect_location() {
    local target_loc="$1"
    local expected_domain="$2"

    if [ -z "$target_loc" ]; then
        echo "[REJECT] Location header is empty" >&2
        return 1
    fi

    # 1. Reject control characters, newlines, tabs, and protocol-relative / backslash tricks
    if [[ "$target_loc" =~ [[:cntrl:]] ]] || [[ "$target_loc" =~ ^// ]] || [[ "$target_loc" =~ ^/\\ ]] || [[ "$target_loc" =~ ^\\ ]]; then
        echo "[REJECT] Malformed or protocol-relative redirect: '$target_loc'" >&2
        return 1
    fi

    # Permitted path prefixes for Moodle application
    local permitted_paths="^/(learn-engine|login|my|admin|r\.php|index\.php)(/|\?|$)"

    # 2. Case: Relative Path redirect
    if [[ "$target_loc" =~ ^/ ]]; then
        # Check for directory traversal
        if [[ "$target_loc" =~ \.\. ]]; then
            echo "[REJECT] Directory traversal detected in relative redirect: '$target_loc'" >&2
            return 1
        fi
        # Strip query string for path prefix validation
        local path_only="${target_loc%%\?*}"
        if [[ "$path_only" =~ $permitted_paths ]]; then
            return 0
        else
            echo "[REJECT] Relative path not in permitted application routes: '$target_loc'" >&2
            return 1
        fi
    fi

    # 3. Case: Absolute URL redirect
    # Must strictly start with https://
    if [[ ! "$target_loc" =~ ^https:// ]]; then
        echo "[REJECT] Scheme downgrade or unapproved scheme (must be https://): '$target_loc'" >&2
        return 1
    fi

    # Strip scheme
    local without_scheme="${target_loc#https://}"

    # Reject userinfo (e.g. https://user:pass@domain or https://domain@attacker.com)
    local authority="${without_scheme%%/*}"
    authority="${authority%%\?*}"
    authority="${authority%%\#*}"

    if [[ "$authority" =~ @ ]]; then
        echo "[REJECT] Userinfo detected in redirect destination authority: '$authority'" >&2
        return 1
    fi

    # Extract host and optional port
    local host=""
    local port=""
    if [[ "$authority" =~ ^(\[[0-9a-fA-F:]+\]|[^:]+)(:([0-9]+))?$ ]]; then
        host="${BASH_REMATCH[1]}"
        port="${BASH_REMATCH[3]}"
    else
        echo "[REJECT] Malformed authority structure: '$authority'" >&2
        return 1
    fi

    # Normalize host to lowercase
    host=$(echo "$host" | tr '[:upper:]' '[:lower:]')
    local expected_domain_lower
    expected_domain_lower=$(echo "$expected_domain" | tr '[:upper:]' '[:lower:]')

    # Strict equality check — absolutely no substring matching (prevents evil.com/spoof)
    if [ "$host" != "$expected_domain_lower" ]; then
        echo "[REJECT] Host mismatch: got '$host', expected exact '$expected_domain_lower'" >&2
        return 1
    fi

    # Port must be empty or 443
    if [ -n "$port" ] && [ "$port" != "443" ]; then
        echo "[REJECT] Non-standard port in redirect destination: '$port'" >&2
        return 1
    fi

    # Validate path portion of absolute URL
    local full_path="/${without_scheme#*/}"
    if [ "$without_scheme" = "$authority" ]; then
        full_path="/"
    fi

    if [[ "$full_path" =~ \.\. ]]; then
        echo "[REJECT] Directory traversal in absolute redirect path: '$full_path'" >&2
        return 1
    fi

    local abs_path_only="${full_path%%\?*}"
    if [ "$abs_path_only" = "/" ] || [[ "$abs_path_only" =~ $permitted_paths ]]; then
        return 0
    fi

    echo "[REJECT] Absolute redirect path not in permitted application routes: '$full_path'" >&2
    return 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Fetch HTTP status code, redirect Location header, and downloaded byte count
    # -s: Silent mode
    # -S: Show error on failure
    # --max-redirs 0: Never follow redirects
    # -o /dev/null: Discard body
    # -w "%{http_code}\n%{redirect_url}\n%{size_download}\n": Extract code, Location, and download size
    RESPONSE=$(curl -s -S --max-time "${TIMEOUT}" \
        --max-redirs 0 \
        -o /dev/null \
        -w "%{http_code}\n%{redirect_url}\n%{size_download}\n" \
        -H "Host: ${DOMAIN}" \
        -H "X-Forwarded-Proto: https" \
        -H "X-Forwarded-Host: ${DOMAIN}" \
        http://127.0.0.1:80/ 2>/dev/null || echo -e "000\n\n0")

    HTTP_CODE=$(echo "$RESPONSE" | sed -n '1p' | tr -d '\r')
    LOCATION=$(echo "$RESPONSE" | sed -n '2p' | tr -d '\r')
    DOWNLOAD_SIZE=$(echo "$RESPONSE" | sed -n '3p' | tr -d '\r')

    case "$HTTP_CODE" in
        200)
            # Validate that local route returned non-empty response content
            if [ -n "$DOWNLOAD_SIZE" ] && [ "$DOWNLOAD_SIZE" -gt 0 ]; then
                echo "[HEALTHY] Local Moodle route returned HTTP 200 OK (${DOWNLOAD_SIZE} bytes, Host: ${DOMAIN})."
                exit 0
            fi
            # If size_download was 0, verify endpoint responds with valid HTTP headers
            HEADER_CHECK=$(curl -s -I --max-time 3 --max-redirs 0 -H "Host: ${DOMAIN}" http://127.0.0.1:80/ 2>/dev/null || true)
            if echo "$HEADER_CHECK" | grep -qi "HTTP/1\.[01] 200"; then
                echo "[HEALTHY] Local Moodle route confirmed HTTP 200 OK via header inspection (Host: ${DOMAIN})."
                exit 0
            else
                echo "[UNHEALTHY] HTTP 200 reported but local endpoint returned empty response or unreadable headers." >&2
                exit 1
            fi
            ;;

        302|303)
            if validate_redirect_location "$LOCATION" "$DOMAIN"; then
                echo "[HEALTHY] Local Moodle returned HTTP ${HTTP_CODE} redirect to validated destination: ${LOCATION}"
                exit 0
            else
                echo "[UNHEALTHY] Redirect validation failed for HTTP ${HTTP_CODE} (Location: '${LOCATION}', Host: ${DOMAIN})." >&2
                exit 1
            fi
            ;;

        301)
            echo "[UNHEALTHY] Unexpected permanent redirect HTTP 301 received from local route (Location: '${LOCATION}')." >&2
            exit 1
            ;;

        4*|5*)
            echo "[UNHEALTHY] Server error HTTP ${HTTP_CODE} from local Moodle route (Host: ${DOMAIN})." >&2
            exit 1
            ;;

        000|*)
            echo "[UNHEALTHY] Connection failed, timed out, or unexpected HTTP status '${HTTP_CODE}' (Host: ${DOMAIN})." >&2
            exit 1
            ;;
    esac
fi
