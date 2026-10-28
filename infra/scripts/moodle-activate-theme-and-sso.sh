#!/usr/bin/env bash
# ==============================================================================
# Zealosh Learning Engine — Moodle Theme & OIDC SSO CLI Configuration Script
# Executes inside running 'zealosh-moodle' container to automate setup
# ==============================================================================

set -euo pipefail

CONTAINER_NAME="zealosh-moodle"

echo "=========================================================="
echo " Configuring Zealosh Theme & OIDC SSO on Moodle Container"
echo " Target Container: $CONTAINER_NAME"
echo "=========================================================="

# 1. Verify container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running."
    echo "Please start the stack first using deploy-app-stack.sh."
    exit 1
fi

# 2. Check if custom theme directory is mounted
echo "[1/4] Verifying theme_zealosh mount..."
docker exec -u www-data "$CONTAINER_NAME" sh -c 'test -f /var/www/html/theme/zealosh/config.php || test -f /var/www/html/public/theme/zealosh/config.php' || {
    echo "ERROR: theme_zealosh is not mounted at /var/www/html/theme/zealosh or /var/www/html/public/theme/zealosh."
    exit 1
}
echo "theme_zealosh verified in container."

# 3. Set default theme to 'zealosh' via Moodle CLI
echo "[2/4] Activating theme_zealosh as default theme..."
docker exec -u www-data "$CONTAINER_NAME" php /var/www/html/admin/cli/cfg.php --name=theme --set=zealosh
echo "Moodle default theme successfully set to 'zealosh'."

# 4. Enable OAuth 2 Authentication Plugin
echo "[3/4] Enabling Moodle OAuth 2 authentication plugin..."
docker exec -u www-data "$CONTAINER_NAME" php /var/www/html/admin/cli/cfg.php --name=auth --set=manual,oauth2
echo "OAuth 2 authentication enabled."

# 5. Purge Moodle Caches to compile SCSS assets
echo "[4/4] Purging Moodle compiled theme and string caches..."
docker exec -u www-data "$CONTAINER_NAME" php /var/www/html/admin/cli/purge_caches.php
echo "Moodle caches successfully purged."

echo "=========================================================="
echo " Moodle Theme & SSO CLI Configuration COMPLETE!"
echo " Next Step: Complete OAuth 2 service creation in Moodle Admin"
echo " according to instructions in moodle-custom/README.md"
echo "=========================================================="
