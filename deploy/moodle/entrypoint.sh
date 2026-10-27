#!/usr/bin/env bash
# ==============================================================================
# Zealosh Learning Engine — Moodle 5.3 LTS Production Container Entrypoint
# Connects to Dedicated Supabase PostgreSQL 17 (Session Mode Port 5432)
# ==============================================================================

set -eo pipefail

echo "=== Initializing Zealosh Learning Engine (Moodle 5.3 LTS) ==="

MOODLE_DIR="/var/www/html"
DATA_DIR="/var/moodledata"

# Helper function for safe, non-interpolating privilege-dropped execution as www-data
# Bypasses shell string parsing so special characters in credentials are never re-evaluated
run_as_moodle_user() {
    if command -v runuser >/dev/null 2>&1; then
        runuser -u www-data -- "$@"
    else
        su -s /bin/bash www-data -c 'exec "$0" "$@"' -- "$@"
    fi
}

# Ephemeral working secret file path on writable tmpfs
DISPOSABLE_SECRET_FILE="/run/moodle-installer/moodle_admin_pass.tmp"

# Trap for ephemeral secret cleanup on exit, interruption, or failure
# Preserves original read-only Docker Compose secret; wipes ONLY the disposable working copy
cleanup_ephemeral_secrets() {
    local exit_code=$?
    if [ -f "$DISPOSABLE_SECRET_FILE" ]; then
        if [ -w "$DISPOSABLE_SECRET_FILE" ]; then
            dd if=/dev/zero of="$DISPOSABLE_SECRET_FILE" bs=1k count=1 2>/dev/null || true
            rm -f "$DISPOSABLE_SECRET_FILE" 2>/dev/null || true
        fi
    fi
    rm -rf /run/moodle-installer 2>/dev/null || true
    unset MOODLE_ADMIN_PASSWORD
    return $exit_code
}
trap cleanup_ephemeral_secrets EXIT INT TERM ERR

# Ensure tmpfs runtime directory exists with restrictive permissions (0700 www-data:www-data)
mkdir -p /run/moodle-installer
chown www-data:www-data /run/moodle-installer
chmod 0700 /run/moodle-installer

# 1. Enforce restrictive permissions on moodledata directory (0770 www-data:www-data)
mkdir -p "$DATA_DIR"
chown -R www-data:www-data "$DATA_DIR"
chmod 0770 "$DATA_DIR"

# 2. Synchronize theme_zealosh if mounted (Moodle 5.3 public theme directory)
if [ -d "/opt/theme_zealosh" ]; then
    echo "Installing Zealosh custom brand theme into Moodle 5.3 public theme directory..."
    mkdir -p "$MOODLE_DIR/public/theme/zealosh"
    cp -r /opt/theme_zealosh/* "$MOODLE_DIR/public/theme/zealosh/"
    chown -R www-data:www-data "$MOODLE_DIR/public/theme/zealosh"
    # Maintain root symlink for any legacy/CLI scripts
    mkdir -p "$MOODLE_DIR/theme"
    ln -sfn "$MOODLE_DIR/public/theme/zealosh" "$MOODLE_DIR/theme/zealosh" || true
fi

# 3. Validate environment and enforce strict Apache VirtualHost isolation
ZEALOSH_ENV="${ZEALOSH_ENVIRONMENT:-staging}"
if [ "$ZEALOSH_ENV" = "staging" ]; then
    if [ -n "$ZEALOSH_DOMAIN" ] && [ "$ZEALOSH_DOMAIN" != "lms.staging.zealosh.com" ]; then
        echo "[FATAL ERROR] Environment is 'staging', but ZEALOSH_DOMAIN is set to '$ZEALOSH_DOMAIN' (expected 'lms.staging.zealosh.com'). Halting to prevent cross-environment traffic leakage." >&2
        exit 1
    fi
    echo "[CONFIG] Activating staging Apache VirtualHost for lms.staging.zealosh.com..."
    if [ -f "/etc/apache2/sites-available/apache-moodle-staging.conf" ]; then
        cp -f /etc/apache2/sites-available/apache-moodle-staging.conf /etc/apache2/sites-available/000-default.conf
    fi
elif [ "$ZEALOSH_ENV" = "production" ]; then
    if [ -n "$ZEALOSH_DOMAIN" ] && [ "$ZEALOSH_DOMAIN" != "lms.zealosh.com" ]; then
        echo "[FATAL ERROR] Environment is 'production', but ZEALOSH_DOMAIN is set to '$ZEALOSH_DOMAIN' (expected 'lms.zealosh.com'). Halting to prevent cross-environment traffic leakage." >&2
        exit 1
    fi
    echo "[CONFIG] Activating production Apache VirtualHost for lms.zealosh.com..."
    if [ -f "/etc/apache2/sites-available/apache-moodle-production.conf" ]; then
        cp -f /etc/apache2/sites-available/apache-moodle-production.conf /etc/apache2/sites-available/000-default.conf
    fi
else
    echo "[FATAL ERROR] Unrecognized ZEALOSH_ENVIRONMENT '$ZEALOSH_ENV'. Must be 'staging' or 'production'." >&2
    exit 1
fi

# 4. Generate Moodle config.php using PHP var_export for syntax safety against special characters
if [ ! -f "$MOODLE_DIR/config.php" ]; then
    echo "Generating production config.php with dedicated Supabase PostgreSQL connection..."
    
    php -r '
    $env = getenv("ZEALOSH_ENVIRONMENT") ?: "staging";
    $expectedDomain = ($env === "production") ? "lms.zealosh.com" : "lms.staging.zealosh.com";
    $domain = getenv("ZEALOSH_DOMAIN") ?: $expectedDomain;
    if ($domain !== $expectedDomain) {
        fwrite(STDERR, "[FATAL ERROR] ZEALOSH_DOMAIN \x27{$domain}\x27 does not match environment \x27{$env}\x27 (expected \x27{$expectedDomain}\x27).\n");
        exit(1);
    }
    $www = getenv("MOODLE_WWWROOT") ?: "https://{$domain}/learn-engine";
    $parsedWww = parse_url($www);
    if (!isset($parsedWww["host"]) || $parsedWww["host"] !== $domain) {
        fwrite(STDERR, "[FATAL ERROR] MOODLE_WWWROOT \x27{$www}\x27 host does not match expected domain \x27{$domain}\x27.\n");
        exit(1);
    }
    if (!isset($parsedWww["path"]) || rtrim($parsedWww["path"], "/") !== "/learn-engine") {
        fwrite(STDERR, "[FATAL ERROR] MOODLE_WWWROOT \x27{$www}\x27 must use \x27/learn-engine\x27 subpath.\n");
        exit(1);
    }

    $host = getenv("MOODLE_DATABASE_HOST") ?: (getenv("MOODLE_DB_HOST") ?: "aws-0-ap-south-1.pooler.supabase.com");
    $port = getenv("MOODLE_DATABASE_PORT") ?: (getenv("MOODLE_DB_PORT") ?: "5432");
    $name = getenv("MOODLE_DATABASE_NAME") ?: (getenv("MOODLE_DB_NAME") ?: "postgres");
    $user = getenv("MOODLE_DATABASE_USER") ?: (getenv("MOODLE_DB_USER") ?: "postgres");
    $pass = getenv("MOODLE_DATABASE_PASSWORD") ?: (getenv("MOODLE_DB_PASSWORD") ?: "");
    $prefix = getenv("MOODLE_DATABASE_PREFIX") ?: (getenv("MOODLE_DB_PREFIX") ?: "mdl_");
    $ssl  = getenv("MOODLE_DATABASE_SSLMODE") ?: (getenv("MOODLE_DB_SSLMODE") ?: "require");
    $sslroot = getenv("MOODLE_DATABASE_SSLROOTCERT") ?: (getenv("MOODLE_DB_SSLROOTCERT") ?: "");
    $redisHost = getenv("REDIS_HOST");
    $redisPort = getenv("REDIS_PORT") ?: 6379;
    $redisPass = getenv("REDIS_PASSWORD") ?: "";

    $config = "<?php\n"
        . "// Zealosh Learning Engine Authoritative Configuration (Moodle 5.3 LTS on Supabase)\n"
        . "unset(\$CFG);\n"
        . "global \$CFG;\n"
        . "\$CFG = new stdClass();\n\n"
        . "// Database configuration for Supabase PostgreSQL 17\n"
        . "\$CFG->dbtype    = \"pgsql\";\n"
        . "\$CFG->dblibrary = \"native\";\n"
        . "\$CFG->dbhost    = " . var_export($host, true) . ";\n"
        . "\$CFG->dbname    = " . var_export($name, true) . ";\n"
        . "\$CFG->dbuser    = " . var_export($user, true) . ";\n"
        . "\$CFG->dbpass    = " . var_export($pass, true) . ";\n"
        . "\$CFG->prefix    = " . var_export($prefix, true) . ";\n"
        . "\$CFG->dboptions = array(\n"
        . "    \"dbpersist\" => false,\n"
        . "    \"dbport\"    => " . var_export($port, true) . ",\n"
        . "    \"dbsocket\"  => false,\n"
        . "    \"dbhandlesoptions\" => false,\n"
        . "    \"sslmode\"   => " . var_export($ssl, true) . ",\n";
    if (!empty($sslroot)) {
        $config .= "    \"sslrootcert\" => " . var_export($sslroot, true) . ",\n";
    }
    $config .= ");\n\n"
        . "// Web routing and directory root\n"
        . "\$CFG->wwwroot   = " . var_export($www, true) . ";\n"
        . "\$CFG->dataroot  = \"/var/moodledata\";\n"
        . "\$CFG->admin     = \"admin\";\n\n"
        . "// Security hardening, reverse proxy settings, and upload limits\n"
        . "\$CFG->directorypermissions = 0770;\n"
        . "\$CFG->sslproxy     = true;\n"
        . "\$CFG->reverseproxy = true;\n"
        . "\$CFG->preventexecpath = true;\n"
        . "\$CFG->maxbytes    = 268435456; // 256MB site upload limit (aligned with Nginx and PHP)\n"
        . "\$CFG->theme       = \"zealosh\";\n\n";

    if ($redisHost) {
        $config .= "// High-performance isolated Redis session caching (Database 1)\n"
            . "\$CFG->session_handler_class = \"\\\\core\\\\session\\\\redis\";\n"
            . "\$CFG->session_redis_host = " . var_export($redisHost, true) . ";\n"
            . "\$CFG->session_redis_port = " . (int)$redisPort . ";\n";
        if ($redisPass) {
            $config .= "\$CFG->session_redis_auth = " . var_export($redisPass, true) . ";\n";
        }
        $config .= "\$CFG->session_redis_database = 1; // Dedicated DB index for sessions\n"
            . "\$CFG->session_redis_prefix = \"zealosh_moodle_sess_\";\n"
            . "\$CFG->session_redis_acquire_lock_timeout = 120;\n"
            . "\$CFG->session_redis_lock_expire = 7200;\n\n";
    }

    $config .= "require_once(__DIR__ . \"/lib/setup.php\");\n";

    file_put_contents("/var/www/html/config.php", $config);
    '
    chown www-data:www-data "$MOODLE_DIR/config.php"
    chmod 640 "$MOODLE_DIR/config.php"
    echo "Production config.php generated with secure parameter escaping and isolated Redis DB 1."
fi

# 5. Pre-flight database connectivity probe & exact 3-state schema detection
MOODLE_DB_EFF_HOST="${MOODLE_DATABASE_HOST:-${MOODLE_DB_HOST:-}}"
MOODLE_DB_EFF_PASS="${MOODLE_DATABASE_PASSWORD:-${MOODLE_DB_PASSWORD:-}}"
if [ -n "$MOODLE_DB_EFF_HOST" ] && [ -n "$MOODLE_DB_EFF_PASS" ]; then
    echo "Testing database reachability at ${MOODLE_DB_EFF_HOST}:${MOODLE_DATABASE_PORT:-${MOODLE_DB_PORT:-5432}}..."
    php -r '
    $host = getenv("MOODLE_DATABASE_HOST") ?: getenv("MOODLE_DB_HOST");
    $port = getenv("MOODLE_DATABASE_PORT") ?: (getenv("MOODLE_DB_PORT") ?: "5432");
    $name = getenv("MOODLE_DATABASE_NAME") ?: (getenv("MOODLE_DB_NAME") ?: "postgres");
    $user = getenv("MOODLE_DATABASE_USER") ?: (getenv("MOODLE_DB_USER") ?: "postgres");
    $pass = getenv("MOODLE_DATABASE_PASSWORD") ?: getenv("MOODLE_DB_PASSWORD");
    $prefix = getenv("MOODLE_DATABASE_PREFIX") ?: (getenv("MOODLE_DB_PREFIX") ?: "mdl_");
    $ssl  = getenv("MOODLE_DATABASE_SSLMODE") ?: (getenv("MOODLE_DB_SSLMODE") ?: "require");
    $sslroot = getenv("MOODLE_DATABASE_SSLROOTCERT") ?: getenv("MOODLE_DB_SSLROOTCERT");

    // 1. Validate configured table prefix using supported SQL identifier rules (lowercase alphanumeric + underscore)
    if (!preg_match("/^[a-z][a-z0-9_]*_$/", $prefix)) {
        fwrite(STDERR, "[FATAL ERROR] Invalid MOODLE_DATABASE_PREFIX \x27{$prefix}\x27. Must start with a lowercase letter, contain only lowercase alphanumeric/underscore, and end in \x27_\x27.\n");
        file_put_contents("/run/moodle_schema_state", "INVALID_PREFIX");
        exit(1);
    }
    
    $dsn = "pgsql:host={$host};port={$port};dbname={$name};sslmode={$ssl}";
    if (!empty($sslroot)) {
        $dsn .= ";sslrootcert={$sslroot}";
    }
    try {
        $pdo = new PDO($dsn, $user, $pass, [PDO::ATTR_TIMEOUT => 5, PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        echo "[PASS] Successfully connected to dedicated Supabase PostgreSQL database.\n";
        
        // 2. Query ALL base tables in public schema to detect unexpected objects or project collisions
        $stmtAll = $pdo->query("SELECT table_name FROM information_schema.tables WHERE table_schema = \x27public\x27 AND table_type = \x27BASE TABLE\x27");
        $allTables = $stmtAll->fetchAll(PDO::FETCH_COLUMN);
        $totalPublicTables = count($allTables);

        // 3. Query tables matching exact prefix using escaped pattern with ESCAPE clause
        $escapedPrefix = str_replace(["\\", "%", "_"], ["\\\\", "\\%", "\\_"], $prefix);
        $stmtPrefix = $pdo->prepare("SELECT table_name FROM information_schema.tables WHERE table_schema = \x27public\x27 AND table_type = \x27BASE TABLE\x27 AND table_name LIKE :pat ESCAPE \x27\\\x27");
        $stmtPrefix->execute([":pat" => $escapedPrefix . "%"]);
        $prefixTables = $stmtPrefix->fetchAll(PDO::FETCH_COLUMN);
        $totalPrefixTables = count($prefixTables);

        $nonPrefixTables = array_values(array_diff($allTables, $prefixTables));
        $totalNonPrefixTables = count($nonPrefixTables);

        // Required core Moodle tables
        $requiredCoreTables = [
            $prefix . "config",
            $prefix . "config_plugins",
            $prefix . "course",
            $prefix . "course_categories",
            $prefix . "user",
            $prefix . "modules",
            $prefix . "context",
            $prefix . "role",
            $prefix . "capabilities",
            $prefix . "event",
        ];

        $missingCore = [];
        foreach ($requiredCoreTables as $req) {
            if (!in_array($req, $prefixTables, true)) {
                $missingCore[] = $req;
            }
        }

        $configTable = $prefix . "config";

        // A. State: CLEAN (Genuinely clean database with 0 tables in public schema)
        if ($totalPublicTables === 0) {
            echo "[SCHEMA-STATE] CLEAN: Database contains 0 tables in public schema. Safe for initial automated installation.\n";
            file_put_contents("/run/moodle_schema_state", "CLEAN");
        }
        // B. Collision Warning: Non-prefix tables exist in public schema, but 0 prefix tables found!
        // (Indicates pointing to wrong database, e.g. Supabase Project 1 Core Hub)
        elseif ($totalPrefixTables === 0 && $totalNonPrefixTables > 0) {
            $sample = implode(", ", array_slice($nonPrefixTables, 0, 5));
            echo "[SCHEMA-STATE] PARTIAL_OR_UNEXPECTED: Public schema contains {$totalNonPrefixTables} non-Moodle tables ({$sample}...) but 0 matching \x27{$prefix}\x27.\n";
            echo "[FATAL ERROR] Collision Warning: Target database contains non-Moodle application objects (likely Core Hub Project 1). Halting to prevent data corruption.\n";
            file_put_contents("/run/moodle_schema_state", "PARTIAL_OR_UNEXPECTED");
        }
        // C. State: INSTALLED (Required core tables exist, >= 150 prefix tables, and valid version record in config)
        elseif ($totalPrefixTables >= 150 && empty($missingCore)) {
            $verStmt = $pdo->prepare("SELECT name, value FROM \"{$configTable}\" WHERE name IN (\x27version\x27, \x27release\x27)");
            $verStmt->execute();
            $configMap = $verStmt->fetchAll(PDO::FETCH_KEY_PAIR);
            $dbVer = $configMap["version"] ?? null;
            $dbRel = $configMap["release"] ?? null;

            if ($dbVer !== null && $dbVer !== "" && is_numeric($dbVer) && (int)$dbVer > 0) {
                echo "[SCHEMA-STATE] INSTALLED: Verified complete Moodle schema ({$totalPrefixTables} prefix tables, version {$dbVer}, release " . ($dbRel ?: "5.3 LTS") . "). Skipping initial installation.\n";
                file_put_contents("/run/moodle_schema_state", "INSTALLED");
            } else {
                echo "[SCHEMA-STATE] PARTIAL_OR_UNEXPECTED: Core tables present ({$totalPrefixTables} tables) but {$configTable} contains no valid numeric version record.\n";
                file_put_contents("/run/moodle_schema_state", "PARTIAL_OR_UNEXPECTED");
            }
        }
        // D. State: PARTIAL_OR_UNEXPECTED (Incomplete install, missing core tables, ambiguous objects)
        else {
            $missingStr = empty($missingCore) ? "none" : implode(", ", $missingCore);
            echo "[SCHEMA-STATE] PARTIAL_OR_UNEXPECTED: Incomplete or ambiguous Moodle schema ({$totalPrefixTables} prefix tables; missing core: {$missingStr}; non-prefix tables: {$totalNonPrefixTables}).\n";
            file_put_contents("/run/moodle_schema_state", "PARTIAL_OR_UNEXPECTED");
        }
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        if (!empty($pass)) {
            $msg = str_replace($pass, "[REDACTED]", $msg);
        }
        echo "[WARN] Database connection probe failed at {$host}:{$port}: " . $msg . "\n";
        echo "[INFO] Verify DNS resolution, Supavisor IPv4 session pooler hostname, and port 5432.\n";
        file_put_contents("/run/moodle_schema_state", "CONNECTION_FAILED");
    }
    ' || true
fi

# 6. Fail-Closed Schema State Handling, Installation & MUC Redis Configuration
if [ -f "/run/moodle_schema_state" ]; then
    SCHEMA_STATE=$(cat /run/moodle_schema_state)
else
    SCHEMA_STATE="UNKNOWN"
fi

echo "Evaluated Database Schema State: $SCHEMA_STATE"

case "$SCHEMA_STATE" in
    CLEAN)
        echo "Confirmed CLEAN database. Initializing Moodle 5.3 schema as www-data..."
        if [ ! -f "$MOODLE_DIR/admin/cli/install_database.php" ]; then
            echo "[FATAL ERROR] Expected installer $MOODLE_DIR/admin/cli/install_database.php does not exist." >&2
            exit 1
        fi

        # Provision disposable working secret file on writable tmpfs for installer
        # Preserves original Docker Compose secret at /run/secrets/moodle_admin_pass as strictly read-only
        mkdir -p /run/moodle-installer
        chown www-data:www-data /run/moodle-installer
        chmod 0700 /run/moodle-installer

        SECRET_FOUND=0
        if [ -f "/run/secrets/moodle_admin_pass" ] && [ -s "/run/secrets/moodle_admin_pass" ]; then
            echo "[SECRETS] Preserving read-only Compose secret; copying into disposable tmpfs working file..."
            cat /run/secrets/moodle_admin_pass > "$DISPOSABLE_SECRET_FILE"
            chown www-data:www-data "$DISPOSABLE_SECRET_FILE"
            chmod 0600 "$DISPOSABLE_SECRET_FILE"
            SECRET_FOUND=1
        elif [ -n "${MOODLE_ADMIN_PASSWORD:-}" ]; then
            echo "[SECRETS] Writing fallback secret from MOODLE_ADMIN_PASSWORD into disposable tmpfs working file..."
            printf "%s" "$MOODLE_ADMIN_PASSWORD" > "$DISPOSABLE_SECRET_FILE"
            chown www-data:www-data "$DISPOSABLE_SECRET_FILE"
            chmod 0600 "$DISPOSABLE_SECRET_FILE"
            SECRET_FOUND=1
        fi

        if [ "$SECRET_FOUND" -eq 0 ]; then
            echo "[FATAL ERROR] Clean database detected, but administrator password is empty or unset." >&2
            echo "[FATAL ERROR] Provide Docker Compose secret at /run/secrets/moodle_admin_pass or MOODLE_ADMIN_PASSWORD." >&2
            exit 1
        fi

        INSTALL_SUCCESS=0
        if [ -f "/usr/local/bin/moodle-installer-wrapper.php" ]; then
            echo "Invoking protected installer wrapper (preventing /proc process argument password exposure)..."
            if run_as_moodle_user env -u MOODLE_ADMIN_PASSWORD php /usr/local/bin/moodle-installer-wrapper.php; then
                INSTALL_SUCCESS=1
            fi
        else
            echo "Invoking direct CLI installer as www-data with safe argv vector passing..."
            if run_as_moodle_user php "$MOODLE_DIR/admin/cli/install_database.php" \
                "--lang=en" \
                "--adminuser=${MOODLE_ADMIN_USER:-admin}" \
                "--adminpass=${MOODLE_ADMIN_PASSWORD}" \
                "--adminemail=${MOODLE_ADMIN_EMAIL:-admin@zealosh.com}" \
                "--fullname=${MOODLE_SITE_FULLNAME:-Zealosh Learning Engine}" \
                "--shortname=${MOODLE_SITE_SHORTNAME:-Zealosh LMS}" \
                "--agree-license"; then
                INSTALL_SUCCESS=1
            fi
        fi

        # Immediate cleanup of temporary secret file and unsetting password variable
        cleanup_ephemeral_secrets

        if [ "$INSTALL_SUCCESS" -eq 1 ]; then
            echo "INSTALLED" > /run/moodle_schema_state
            echo "[PASS] Moodle 5.3 database installation completed successfully."
        else
            echo "[FATAL ERROR] CLI install_database failed during first installation. Halting container startup to prevent traffic to broken schema." >&2
            exit 1
        fi
        ;;

    INSTALLED)
        echo "[INFO] Existing verified Moodle schema detected. Skipping initial installation."
        cleanup_ephemeral_secrets

        # Normal container boot is strictly read-only with respect to migrations.
        if [ "${MOODLE_TRIGGER_UPGRADE:-0}" = "1" ]; then
            echo "[WARN] MOODLE_TRIGGER_UPGRADE=1 detected in main web container."
            echo "[WARN] Web container boot is strictly read-only with respect to schema upgrades."
            echo "[WARN] Upgrades must be executed deliberately via the dedicated upgrade runner:"
            echo "[WARN]   docker compose run --rm zealosh-moodle-upgrade"
            echo "[WARN] Skipping upgrade in web service to prevent repeating across restarts and replicas."
        fi
        ;;

    PARTIAL_OR_UNEXPECTED)
        echo "[FATAL ERROR] Ambiguous or partial Moodle database state detected: PARTIAL_OR_UNEXPECTED." >&2
        echo "[FATAL ERROR] Dedicated database contains incomplete or conflicting tables. Automated installation is blocked to prevent data loss." >&2
        echo "=== Safe Recovery Protocol ===" >&2
        echo " 1. Stop the affected Moodle service: 'docker compose stop zealosh-moodle'." >&2
        echo " 2. Confirm target project (Supabase Project 2), database, configured prefix (${MOODLE_DATABASE_PREFIX:-mdl_}), and schema state." >&2
        echo " 3. Capture a backup or snapshot of the existing database state where feasible." >&2
        echo " 4. Identify affected objects without modifying them (e.g., inspect tables in Supabase SQL editor)." >&2
        echo " 5. Prefer restoring into a disposable target or recreating a dedicated test project when a fresh database is required." >&2
        echo " 6. Allow destructive cleanup only after explicit operator confirmation and a verified backup, with exact objects and consequences documented." >&2
        echo " NEVER execute routine 'DROP SCHEMA public CASCADE' without following this protocol." >&2
        echo "==============================" >&2
        exit 1
        ;;

    INVALID_PREFIX)
        echo "[FATAL ERROR] Configured table prefix is invalid. Halting container startup." >&2
        exit 1
        ;;

    CONNECTION_FAILED)
        echo "[FATAL ERROR] Database reachability probe failed. Halting container startup." >&2
        exit 1
        ;;

    *)
        echo "[FATAL ERROR] Unrecognized schema state '$SCHEMA_STATE'. Halting container startup." >&2
        exit 1
        ;;
esac

# Configure Moodle Universal Cache (MUC) to use Redis DB 2 if Redis is configured and Moodle is installed
if [ -f "/run/moodle_schema_state" ] && [ "$(cat /run/moodle_schema_state)" = "INSTALLED" ] && [ -n "$REDIS_HOST" ] && [ -f "/usr/local/bin/configure-redis-muc.php" ]; then
    echo "Configuring Moodle Universal Cache (MUC) store on Redis DB 2..."
    run_as_moodle_user php /usr/local/bin/configure-redis-muc.php || true
fi

# Note: Moodle scheduled cron is handled by the dedicated zealosh-moodle-cron service

echo "=== Zealosh Learning Engine Ready. Starting Apache Web Service ==="
exec apache2-foreground "$@"
