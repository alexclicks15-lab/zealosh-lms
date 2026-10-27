#!/usr/bin/env bash
# ==============================================================================
# Zealosh Learning Engine — Moodle Dedicated Cron Health Check
# State-Aware Verification: Distinguishes Active Execution from Idle Schedule
# ==============================================================================

HEARTBEAT_FILE="/tmp/moodle-cron-heartbeat"
MAX_IDLE_SECONDS=150 # Schedule is 60s; allow up to 150s idle between task launches

# 1. Verify heartbeat file exists
if [ ! -f "$HEARTBEAT_FILE" ]; then
    echo "[UNHEALTHY] Heartbeat file $HEARTBEAT_FILE does not exist. Cron runner has not started or was stopped." >&2
    exit 1
fi

HEARTBEAT_CONTENT=$(cat "$HEARTBEAT_FILE" 2>/dev/null || echo "")
NOW=$(date +%s)

# 2. State-Aware Evaluation
case "$HEARTBEAT_CONTENT" in
    RUNNING*)
        # Parse fields: RUNNING|started=<epoch>|timeout=<timeout>|pid=<pid>
        STARTED=$(echo "$HEARTBEAT_CONTENT" | cut -d'|' -f2 | cut -d'=' -f2)
        TIMEOUT=$(echo "$HEARTBEAT_CONTENT" | cut -d'|' -f3 | cut -d'=' -f2)
        PID=$(echo "$HEARTBEAT_CONTENT" | cut -d'|' -f4 | cut -d'=' -f2)
        
        [ -z "$STARTED" ] && STARTED=$NOW
        [ -z "$TIMEOUT" ] && TIMEOUT=300

        ELAPSED=$((NOW - STARTED))
        MAX_PERMITTED=$((TIMEOUT + 30)) # 300s timeout + 30s SIGTERM/SIGKILL grace window

        if [ "$ELAPSED" -le "$MAX_PERMITTED" ]; then
            echo "[HEALTHY] Cron task actively executing (running for ${ELAPSED}s <= timeout ${TIMEOUT}s; runner PID ${PID})."
            exit 0
        else
            echo "[UNHEALTHY] Cron task execution hung (running for ${ELAPSED}s > limit ${MAX_PERMITTED}s)." >&2
            exit 1
        fi
        ;;

    IDLE*)
        # Parse fields: IDLE|epoch=<epoch>|...
        LAST_EPOCH=$(echo "$HEARTBEAT_CONTENT" | cut -d'|' -f2 | cut -d'=' -f2)
        [ -z "$LAST_EPOCH" ] && LAST_EPOCH=$(stat -c %Y "$HEARTBEAT_FILE" 2>/dev/null || echo "$NOW")
        
        IDLE_TIME=$((NOW - LAST_EPOCH))
        if [ "$IDLE_TIME" -le "$MAX_IDLE_SECONDS" ]; then
            echo "[HEALTHY] Cron runner idle between cycles (idle for ${IDLE_TIME}s <= limit ${MAX_IDLE_SECONDS}s; ${HEARTBEAT_CONTENT})."
            exit 0
        else
            echo "[UNHEALTHY] Cron runner stalled between scheduled cycles (idle for ${IDLE_TIME}s > limit ${MAX_IDLE_SECONDS}s)." >&2
            exit 1
        fi
        ;;

    *)
        # Fallback to simple file modification age
        LAST_MOD=$(stat -c %Y "$HEARTBEAT_FILE" 2>/dev/null || echo 0)
        AGE=$((NOW - LAST_MOD))
        if [ "$AGE" -le 360 ]; then
            echo "[HEALTHY] Cron runner alive (heartbeat age: ${AGE}s; raw status: $HEARTBEAT_CONTENT)."
            exit 0
        else
            echo "[UNHEALTHY] Cron heartbeat stale (age: ${AGE}s > 360s)." >&2
            exit 1
        fi
        ;;
esac
