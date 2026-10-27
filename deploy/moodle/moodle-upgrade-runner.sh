#!/usr/bin/env bash
# ==============================================================================
# Zealosh Learning Engine — Dedicated Controlled One-Time Upgrade Runner
# Service: zealosh-moodle-upgrade (Docker Compose profile: maintenance)
# Triggered deliberately via: docker compose run --rm zealosh-moodle-upgrade
# ==============================================================================

set -eo pipefail

echo "=== Zealosh Learning Engine: Dedicated Controlled Upgrade Runner ==="

MOODLE_DIR="/var/www/html"
DATA_DIR="/var/moodledata"
LOCK_FILE="${DATA_DIR}/.moodle_upgrade.lock"

# Helper function for safe execution as www-data
run_as_moodle_user() {
    if command -v runuser >/dev/null 2>&1; then
        runuser -u www-data -- "$@"
    else
        su -s /bin/bash www-data -c 'exec "$0" "$@"' -- "$@"
    fi
}

# Cleanup lock on exit, interruption, or failure
cleanup_upgrade_lock() {
    local exit_code=$?
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        echo "[LOCK] Removed upgrade concurrency lock."
    fi
    return $exit_code
}
trap cleanup_upgrade_lock EXIT INT TERM ERR

# 1. Enforce strict single-execution concurrency lock
if [ -f "$LOCK_FILE" ]; then
    LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "unknown")
    echo "[FATAL ERROR] An upgrade operation is already active or stale lock exists at $LOCK_FILE (PID: $LOCK_PID)." >&2
    echo "[FATAL ERROR] Concurrent upgrades are strictly forbidden to prevent database corruption." >&2
    exit 1
fi

echo "$$" > "$LOCK_FILE"
chown www-data:www-data "$LOCK_FILE" || true
chmod 0640 "$LOCK_FILE" || true
echo "[LOCK] Concurrency lock acquired (PID: $$)."

# 2. Verify target Moodle code and CLI upgrade script exist
if [ ! -f "$MOODLE_DIR/admin/cli/upgrade.php" ]; then
    echo "[FATAL ERROR] Upgrade CLI script not found at $MOODLE_DIR/admin/cli/upgrade.php." >&2
    exit 1
fi

if [ ! -f "$MOODLE_DIR/version.php" ]; then
    echo "[FATAL ERROR] Target Moodle version manifest not found at $MOODLE_DIR/version.php." >&2
    exit 1
fi

# 3. Verify database reachability, credentials, and INSTALLED schema state
echo "Verifying database pre-conditions and schema state before upgrade..."

UPGRADE_PREFLIGHT_STATUS=$(php -r '
$host = getenv("MOODLE_DATABASE_HOST");
$port = getenv("MOODLE_DATABASE_PORT") ?: "5432";
$name = getenv("MOODLE_DATABASE_NAME") ?: "postgres";
$user = getenv("MOODLE_DATABASE_USER") ?: "postgres";
$pass = getenv("MOODLE_DATABASE_PASSWORD");
$prefix = getenv("MOODLE_DATABASE_PREFIX") ?: "mdl_";
$ssl  = getenv("MOODLE_DATABASE_SSLMODE") ?: "require";
$sslroot = getenv("MOODLE_DATABASE_SSLROOTCERT");

if (!preg_match("/^[a-z][a-z0-9_]*_$/", $prefix)) {
    echo "INVALID_PREFIX";
    exit(0);
}

$dsn = "pgsql:host={$host};port={$port};dbname={$name};sslmode={$ssl}";
if (!empty($sslroot)) {
    $dsn .= ";sslrootcert={$sslroot}";
}

try {
    $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $configTable = $prefix . "config";
    $verStmt = $pdo->prepare("SELECT value FROM \"{$configTable}\" WHERE name = \x27version\x27");
    $verStmt->execute();
    $dbVer = $verStmt->fetchColumn();

    if ($dbVer === false || $dbVer === null || !is_numeric($dbVer)) {
        echo "SCHEMA_NOT_INSTALLED";
        exit(0);
    }

    // Read target code version from version.php
    require("/var/www/html/version.php");
    $codeVer = $version ?? 0;

    echo "OK:{$dbVer}:{$codeVer}";
} catch (Exception $e) {
    echo "DB_FAILED";
}
' || echo "CHECK_FAILED")

case "$UPGRADE_PREFLIGHT_STATUS" in
    OK:*)
        IFS=':' read -r _ DB_VERSION CODE_VERSION <<< "$UPGRADE_PREFLIGHT_STATUS"
        echo "[PREFLIGHT] Database Version: $DB_VERSION | Code Version: $CODE_VERSION"
        ;;
    SCHEMA_NOT_INSTALLED)
        echo "[FATAL ERROR] Database is not in INSTALLED state. Cannot run upgrade on an uninitialized or broken schema." >&2
        exit 1
        ;;
    INVALID_PREFIX)
        echo "[FATAL ERROR] Invalid MOODLE_DATABASE_PREFIX. Halting upgrade." >&2
        exit 1
        ;;
    DB_FAILED|CHECK_FAILED|*)
        echo "[FATAL ERROR] Could not establish database connection during upgrade preflight ($UPGRADE_PREFLIGHT_STATUS)." >&2
        exit 1
        ;;
esac

# Check if database is already up to date
if [ "$DB_VERSION" -ge "$CODE_VERSION" ]; then
    echo "[INFO] Database version ($DB_VERSION) is already up-to-date with code version ($CODE_VERSION)."
    echo "[INFO] No database schema migration needed. Exiting cleanly."
    exit 0
fi

# 4. Execute official non-interactive Moodle CLI upgrade as application user www-data
echo "[UPGRADE] Starting Moodle 5.3 CLI upgrade ($DB_VERSION -> $CODE_VERSION)..."

# Run upgrade without suppressing errors and without unstable flags
if run_as_moodle_user php "$MOODLE_DIR/admin/cli/upgrade.php" --non-interactive; then
    echo "[PASS] Moodle CLI upgrade executed successfully."
else
    UPGRADE_EXIT=$?
    echo "[FATAL ERROR] Moodle upgrade script failed with exit code $UPGRADE_EXIT." >&2
    exit "$UPGRADE_EXIT"
fi

# 5. Verify resulting database version matches code version
echo "[VERIFY] Verifying post-upgrade database schema version..."

POST_UPGRADE_VERSION=$(php -r '
$host = getenv("MOODLE_DATABASE_HOST");
$port = getenv("MOODLE_DATABASE_PORT") ?: "5432";
$name = getenv("MOODLE_DATABASE_NAME") ?: "postgres";
$user = getenv("MOODLE_DATABASE_USER") ?: "postgres";
$pass = getenv("MOODLE_DATABASE_PASSWORD");
$prefix = getenv("MOODLE_DATABASE_PREFIX") ?: "mdl_";
$ssl  = getenv("MOODLE_DATABASE_SSLMODE") ?: "require";
$sslroot = getenv("MOODLE_DATABASE_SSLROOTCERT");

$dsn = "pgsql:host={$host};port={$port};dbname={$name};sslmode={$ssl}";
if (!empty($sslroot)) {
    $dsn .= ";sslrootcert={$sslroot}";
}
$pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$configTable = $prefix . "config";
$verStmt = $pdo->prepare("SELECT value FROM \"{$configTable}\" WHERE name = \x27version\x27");
$verStmt->execute();
echo (string)$verStmt->fetchColumn();
' || echo "QUERY_FAILED")

echo "[VERIFY] Post-upgrade database version: $POST_UPGRADE_VERSION (Target: $CODE_VERSION)"

if [ "$POST_UPGRADE_VERSION" = "QUERY_FAILED" ] || [ -z "$POST_UPGRADE_VERSION" ]; then
    echo "[FATAL ERROR] Could not verify post-upgrade database version." >&2
    exit 1
fi

if [ "$POST_UPGRADE_VERSION" -lt "$CODE_VERSION" ]; then
    echo "[FATAL ERROR] Post-upgrade database version ($POST_UPGRADE_VERSION) is lower than code version ($CODE_VERSION)." >&2
    exit 1
fi

echo "[SUCCESS] Upgrade completed and verified! Database version $POST_UPGRADE_VERSION is ready for application traffic."
exit 0
