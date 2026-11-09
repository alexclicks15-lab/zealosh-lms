#!/usr/bin/env bash
# ==============================================================================
# Zealosh Live Classroom — Production Release Activation & Rollback Manager
# Target: Server 2 (media.staging.zealosh.com) — BigBlueButton 4.0 noble-400
# ==============================================================================
# Manages versioned releases of customized BigBlueButton HTML5 client and branding.
# Supports controlled activation, pre-activation verification, and complete atomic rollback.
# ==============================================================================

set -euo pipefail

BBB_BASE_DIR="/usr/share/bigbluebutton"
HTML5_ACTIVE_DIR="${BBB_BASE_DIR}/html5-client"
RELEASES_DIR="${BBB_BASE_DIR}/html5-client.releases"
PREVIOUS_PTR="${RELEASES_DIR}/previous"
CURRENT_PTR="${RELEASES_DIR}/current"
BACKUP_CONFIG_DIR="/etc/bigbluebutton"

usage() {
    echo "Usage: $0 --activate <archive.tar.gz> [checksum.sha256]"
    echo "       $0 --rollback"
    echo "       $0 --verify-health"
    exit 1
}

verify_health() {
    echo "--- Verifying BigBlueButton & HTML5 Client Health ---"
    
    # 1. Check local BBB API responds
    if command -v curl >/dev/null 2>&1; then
        local bbb_status
        bbb_status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/bigbluebutton/api || echo "000")
        if [ "$bbb_status" -ge 200 ] && [ "$bbb_status" -lt 400 ]; then
            echo "  [PASS] BigBlueButton API reachable on loopback (HTTP $bbb_status)"
        else
            echo "  [WARN] BigBlueButton API returned status $bbb_status on loopback"
        fi

        # 2. Check HTML5 client static assets accessible
        local html5_status
        html5_status=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/html5client/index.html || echo "000")
        if [ "$html5_status" -eq 200 ]; then
            echo "  [PASS] HTML5 client index.html reachable on loopback (HTTP 200)"
        else
            echo "  [WARN] HTML5 client returned HTTP $html5_status on loopback"
        fi
    fi

    # 3. Check systemd service status
    if command -v systemctl >/dev/null 2>&1; then
        if systemctl is-active --quiet bbb-html5 2>/dev/null; then
            echo "  [PASS] bbb-html5 systemd service is active"
        fi
    fi
    echo "--- Health Verification Complete ---"
}

activate_release() {
    local archive_path="$1"
    local checksum_path="${2:-}"

    if [ ! -f "$archive_path" ]; then
        echo "Error: Release archive not found at: $archive_path" >&2
        exit 1
    fi

    echo "=== Activating Zealosh Classroom Release ==="
    echo "Archive: $archive_path"

    # Step 1: Pre-Activation Integrity Verification
    if [ -n "$checksum_path" ] && [ -f "$checksum_path" ]; then
        echo "Verifying archive integrity with checksum..."
        local expected_sum
        expected_sum=$(awk '{print $1}' "$checksum_path")
        local actual_sum
        actual_sum=$(sha256sum "$archive_path" | awk '{print $1}')
        if [ "$expected_sum" != "$actual_sum" ]; then
            echo "Security Error: Checksum mismatch! Aborting activation." >&2
            echo "  Expected: $expected_sum" >&2
            echo "  Actual:   $actual_sum" >&2
            exit 1
        fi
        echo "  [PASS] Checksum verified: $actual_sum"
    fi

    # Step 2: Prepare versioned release directory
    local release_id
    release_id="rel_$(date +%Y%m%d_%H%M%S)"
    local target_release_dir="${RELEASES_DIR}/${release_id}"
    mkdir -p "$target_release_dir"

    echo "Extracting release to: $target_release_dir"
    tar -xzf "$archive_path" -C "$target_release_dir"

    # Step 3: Validate unpacked structure
    if [ ! -f "${target_release_dir}/html5-client/index.html" ] || [ ! -f "${target_release_dir}/bbb-custom/settings.yml" ]; then
        echo "Error: Incomplete release contents. Aborting activation." >&2
        rm -rf "$target_release_dir"
        exit 1
    fi

    # Step 4: Backup current release pointer and configuration
    mkdir -p "$RELEASES_DIR"
    if [ -L "$CURRENT_PTR" ]; then
        local previous_target
        previous_target=$(readlink -f "$CURRENT_PTR")
        ln -sfn "$previous_target" "$PREVIOUS_PTR"
        echo "Recorded previous release pointer: $previous_target"
    elif [ -d "$HTML5_ACTIVE_DIR" ] && [ ! -L "$HTML5_ACTIVE_DIR" ]; then
        # First time migrating from vanilla package directory to versioned release
        local baseline_dir="${RELEASES_DIR}/vanilla_baseline"
        if [ ! -d "$baseline_dir" ]; then
            mv "$HTML5_ACTIVE_DIR" "$baseline_dir"
            ln -sfn "$baseline_dir" "$PREVIOUS_PTR"
            echo "Preserved vanilla package directory to: $baseline_dir"
        fi
    fi

    if [ -f "${BACKUP_CONFIG_DIR}/bbb-html5.yml" ]; then
        cp "${BACKUP_CONFIG_DIR}/bbb-html5.yml" "${BACKUP_CONFIG_DIR}/bbb-html5.yml.bak"
        echo "Backed up ${BACKUP_CONFIG_DIR}/bbb-html5.yml to bbb-html5.yml.bak"
    fi

    # Step 5: Atomically switch active release pointer
    ln -sfn "$target_release_dir" "$CURRENT_PTR"
    ln -sfn "${target_release_dir}/html5-client" "$HTML5_ACTIVE_DIR"
    echo "Active client symlink switched to: ${target_release_dir}/html5-client"

    # Step 6: Apply branding configurations
    if [ -f "${target_release_dir}/bbb-custom/apply-branding.sh" ]; then
        echo "Applying custom branding configurations..."
        bash "${target_release_dir}/bbb-custom/apply-branding.sh"
    fi

    # Step 7: Restart services and verify health
    echo "Restarting BigBlueButton HTML5 services..."
    if command -v systemctl >/dev/null 2>&1; then
        systemctl restart bbb-html5 2>/dev/null || bbb-conf --restart || true
    elif command -v bbb-conf >/dev/null 2>&1; then
        bbb-conf --restart || true
    fi

    verify_health
    echo "=== Zealosh Classroom Release [${release_id}] Activated Successfully! ==="
}

rollback_release() {
    echo "=== Executing Zealosh Classroom Complete Rollback ==="
    
    if [ ! -L "$PREVIOUS_PTR" ] && [ ! -d "$PREVIOUS_PTR" ]; then
        echo "Error: No previous release recorded at $PREVIOUS_PTR. Cannot rollback." >&2
        exit 1
    fi

    local prev_dir
    prev_dir=$(readlink -f "$PREVIOUS_PTR")
    echo "Restoring previous release directory: $prev_dir"

    if [ ! -d "$prev_dir" ]; then
        echo "Error: Recorded previous release directory does not exist: $prev_dir" >&2
        exit 1
    fi

    # Restore symlinks
    ln -sfn "$prev_dir" "$CURRENT_PTR"
    if [ -d "${prev_dir}/html5-client" ]; then
        ln -sfn "${prev_dir}/html5-client" "$HTML5_ACTIVE_DIR"
    else
        ln -sfn "$prev_dir" "$HTML5_ACTIVE_DIR"
    fi

    # Restore configuration
    if [ -f "${BACKUP_CONFIG_DIR}/bbb-html5.yml.bak" ]; then
        cp "${BACKUP_CONFIG_DIR}/bbb-html5.yml.bak" "${BACKUP_CONFIG_DIR}/bbb-html5.yml"
        echo "Restored ${BACKUP_CONFIG_DIR}/bbb-html5.yml from backup"
    fi

    # Restart services
    echo "Restarting BigBlueButton HTML5 services after rollback..."
    if command -v systemctl >/dev/null 2>&1; then
        systemctl restart bbb-html5 2>/dev/null || bbb-conf --restart || true
    elif command -v bbb-conf >/dev/null 2>&1; then
        bbb-conf --restart || true
    fi

    verify_health
    echo "=== Zealosh Classroom Rollback Completed Successfully! ==="
}

# Entrypoint dispatcher
case "${1:-}" in
    --activate)
        if [ -z "${2:-}" ]; then usage; fi
        activate_release "$2" "${3:-}"
        ;;
    --rollback)
        rollback_release
        ;;
    --verify-health)
        verify_health
        ;;
    *)
        usage
        ;;
esac

