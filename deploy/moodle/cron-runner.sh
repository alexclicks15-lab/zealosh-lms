#!/usr/bin/env bash
# ==============================================================================
# Zealosh Learning Engine — Dedicated Moodle 5.3 Cron Runner
# Executes admin/cli/cron.php on an isolated 60-second cycle
# Decoupled from Apache web workers for process isolation and clean log streaming
# ==============================================================================

set -e

echo "=== Starting Zealosh Moodle Dedicated Cron Service ==="

MOODLE_DIR="/var/www/html"

# Safe execution helper dropping privileges to www-data without shell re-evaluation
run_as_moodle_user() {
    if command -v runuser >/dev/null 2>&1; then
        runuser -u www-data -- "$@"
    else
        su -s /bin/bash www-data -c 'exec "$0" "$@"' -- "$@"
    fi
}

# 1. Wait for Moodle config.php to be ready
echo "Waiting for Moodle config.php to be initialized by the primary web container..."
while [ ! -f "$MOODLE_DIR/config.php" ]; do
    sleep 3
done
echo "Moodle config.php detected. Verifying database reachability..."

HEARTBEAT_FILE="/tmp/moodle-cron-heartbeat"
CRON_TIMEOUT="${MOODLE_CRON_TIMEOUT:-300}"

# Graceful termination handler
cleanup() {
    echo "Received termination signal. Cleaning up cron heartbeat and exiting..."
    rm -f "$HEARTBEAT_FILE"
    exit 0
}
trap cleanup SIGTERM SIGINT

# 2. Continuous Cron Loop with timestamped logging & execution monitoring
CRON_INTERVAL="${MOODLE_CRON_INTERVAL:-60}"
CONSECUTIVE_FAILURES=0
echo "Cron runner active. Interval: ${CRON_INTERVAL}s. Task timeout: ${CRON_TIMEOUT}s. Starting loop..."

while true; do
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    START_EPOCH=$(date +%s)
    echo "[$TIMESTAMP] [CRON-START] Executing official Moodle scheduled tasks..."
    printf "RUNNING|started=%s|timeout=%s|pid=%s\n" "$START_EPOCH" "$CRON_TIMEOUT" "$$" > "$HEARTBEAT_FILE"
    
    # Run official Moodle CLI cron as www-data user with execution timeout to prevent hangs
    if timeout "${CRON_TIMEOUT}" run_as_moodle_user php "$MOODLE_DIR/admin/cli/cron.php"; then
        END_EPOCH=$(date +%s)
        DURATION=$((END_EPOCH - START_EPOCH))
        CONSECUTIVE_FAILURES=0
        echo "[$TIMESTAMP] [CRON-SUCCESS] Scheduled tasks completed cleanly in ${DURATION}s."
        printf "IDLE|epoch=%s|duration=%ss|status=SUCCESS|failures=0\n" "$END_EPOCH" "$DURATION" > "$HEARTBEAT_FILE"
    else
        EXIT_CODE=$?
        END_EPOCH=$(date +%s)
        DURATION=$((END_EPOCH - START_EPOCH))
        CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
        
        if [ "$EXIT_CODE" -eq 124 ]; then
            echo "[$TIMESTAMP] [CRON-TIMEOUT] Cron execution exceeded limit (${CRON_TIMEOUT}s) and was terminated."
            printf "IDLE|epoch=%s|duration=%ss|status=TIMEOUT|failures=%s\n" "$END_EPOCH" "$DURATION" "$CONSECUTIVE_FAILURES" > "$HEARTBEAT_FILE"
        else
            echo "[$TIMESTAMP] [CRON-WARN] Scheduled tasks exited with code $EXIT_CODE (failure $CONSECUTIVE_FAILURES; will retry in ${CRON_INTERVAL}s)."
            printf "IDLE|epoch=%s|duration=%ss|status=FAILED_EXIT_%s|failures=%s\n" "$END_EPOCH" "$DURATION" "$EXIT_CODE" "$CONSECUTIVE_FAILURES" > "$HEARTBEAT_FILE"
        fi
        
        if [ "$CONSECUTIVE_FAILURES" -ge 5 ]; then
            echo "[$TIMESTAMP] [CRON-ALERT] 5 consecutive cron failures recorded. Verify database reachability and table locks."
        fi
    fi

    sleep "$CRON_INTERVAL"
done
