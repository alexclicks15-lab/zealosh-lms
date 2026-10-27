#!/usr/bin/env bash
# ==============================================================================
# Zealosh LMS — Full Stack Health Diagnostics & Connectivity Probe Script
# Tests HTTP endpoints, container statuses, and integration health
# ==============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost}"
FAILED=0

echo "=========================================================="
echo " Running Zealosh LMS End-to-End Health Diagnostics"
echo " Target Base URL: $BASE_URL"
echo "=========================================================="

# Helper function
check_endpoint() {
    local name="$1"
    local url="$2"
    local expected_code="$3"

    echo -n "Checking $name ($url)... "
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")

    if [ "$http_code" -eq "$expected_code" ]; then
        echo "[PASS] (HTTP $http_code)"
    else
        echo "[FAIL] (Expected HTTP $expected_code, got $http_code)"
        FAILED=1
    fi
}

# 1. Next.js Core Hub Liveness Probe
check_endpoint "Next.js Liveness Probe" "${BASE_URL}/api/health/liveness" 200

# 2. Next.js Core Hub Readiness Probe
check_endpoint "Next.js Readiness Probe" "${BASE_URL}/api/health/readiness" 200

# 3. OpenID Connect Discovery Endpoint
check_endpoint "OIDC Discovery Endpoint" "${BASE_URL}/.well-known/openid-configuration" 200

# 4. OAuth2 Authorization Endpoint (expects 302 redirect on valid query)
check_endpoint "OAuth2 Authorize Endpoint" "${BASE_URL}/api/oauth/authorize?client_id=zealosh-moodle&redirect_uri=https%3A%2F%2Flms.zealosh.com%2Flearn-engine%2Fadmin%2Foauth2callback.php&response_type=code" 302

# 5. Public Course Catalog
check_endpoint "Public Course Catalog" "${BASE_URL}/courses" 200

# 6. Progressive Web App Service Worker
check_endpoint "PWA Service Worker" "${BASE_URL}/sw.js" 200

# 7. Moodle Learning Engine Ingress
echo -n "Checking Moodle Learning Engine Ingress (${BASE_URL}/learn-engine/)... "
MOODLE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/learn-engine/" || echo "000")
if [[ "$MOODLE_CODE" == "200" || "$MOODLE_CODE" == "303" || "$MOODLE_CODE" == "302" ]]; then
    echo "[PASS] (HTTP $MOODLE_CODE)"
else
    echo "[FAIL] (Expected HTTP 200/302/303, got $MOODLE_CODE)"
    FAILED=1
fi

# 8. Docker Containers Overview (if docker available)
if command -v docker &> /dev/null; then
    echo ""
    echo "Container Status Overview:"
    docker compose -f docker-compose.zealosh-platform.yml ps 2>/dev/null || docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
fi

echo "=========================================================="
if [ "$FAILED" -eq 0 ]; then
    echo " [SUCCESS] All health diagnostics passed cleanly!"
    exit 0
else
    echo " [WARNING] Some diagnostics failed. Please inspect container logs."
    exit 1
fi
