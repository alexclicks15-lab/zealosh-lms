#!/usr/bin/env bash
# ==============================================================================
# Zealosh LMS — Application Stack Deployment Script (Server 1)
# Deploys Next.js Core Hub, Moodle 5.3 Engine, Redis 7, and Nginx Gateway
# Database: Supabase Project 1 (Core Hub) & Dedicated PostgreSQL / Supabase Project 2 (Moodle)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$REPO_DIR"

TARGET_ENV="${ZEALOSH_ENVIRONMENT:-${1:-staging}}"
COMPOSE_FILE="docker-compose.zealosh-platform.yml"

echo "=========================================================="
echo " Deploying Zealosh LMS Application & Learning Engine Stack"
echo " Environment:      $TARGET_ENV"
echo " Working Directory: $REPO_DIR"
echo " Compose Manifest:  $COMPOSE_FILE"
echo "=========================================================="

# 1. Validate Environment Configuration
if [ "$TARGET_ENV" = "production" ]; then
    ENV_FILE=".env.production"
    ENV_EXAMPLE=".env.production.example"
else
    ENV_FILE=".env.staging"
    ENV_EXAMPLE=".env.staging.example"
fi

if [ ! -f "$ENV_FILE" ]; then
    if [ -f ".env.production" ] && [ "$TARGET_ENV" = "staging" ]; then
        echo "Notice: .env.staging not found; falling back to existing .env.production."
        ENV_FILE=".env.production"
    else
        echo "ERROR: Environment file $ENV_FILE not found in $REPO_DIR." >&2
        echo "Please copy $ENV_EXAMPLE to $ENV_FILE and configure your database and secrets." >&2
        exit 1
    fi
fi

echo "[1/4] Validating environment configuration ($ENV_FILE)..."
chmod 0600 "$ENV_FILE"

# Check for unconfigured database credentials
if grep -q "CHANGE_ME_SECURE_MOODLE" "$ENV_FILE"; then
    echo "ERROR: $ENV_FILE contains unconfigured placeholder for MOODLE_DATABASE_PASSWORD." >&2
    echo "Please set your real dedicated PostgreSQL or Supabase Project 2 password before deploying." >&2
    exit 1
fi

# Ensure secrets directory and file secret exist for Moodle admin
mkdir -p secrets && chmod 0700 secrets
if [ ! -f "secrets/moodle_admin_password.txt" ]; then
    echo "Generating isolated Moodle administrator secret in secrets/moodle_admin_password.txt (mode 0600)..."
    openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' > secrets/moodle_admin_password.txt
    chmod 0600 secrets/moodle_admin_password.txt
else
    chmod 0600 secrets/moodle_admin_password.txt
fi

# 2. Ensure Volume Directories and Secure Permissions
echo "[2/4] Setting up volume directories with restrictive permissions..."
mkdir -p data moodle-custom/theme_zealosh deploy/nginx
chmod 755 data
chmod -R 755 moodle-custom

# Ensure active Nginx config exists
if [ ! -f "deploy/nginx/nginx.conf" ]; then
    if [ "$TARGET_ENV" = "production" ] && [ -f "deploy/nginx/nginx.production.conf" ]; then
        cp -f deploy/nginx/nginx.production.conf deploy/nginx/nginx.conf
    elif [ -f "deploy/nginx/nginx.staging.conf" ]; then
        cp -f deploy/nginx/nginx.staging.conf deploy/nginx/nginx.conf
    fi
fi

# 3. Build & Launch Container Stack
echo "[3/4] Validating and launching containers with Docker Compose..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config -q

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build

# 4. Wait for Health-Gated Readiness (Polling Real Containers)
echo "[4/4] Polling container health status..."
MAX_RETRIES=24
RETRY_COUNT=0

while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
    HUB_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' zealosh-hub 2>/dev/null || echo '"starting"')
    REDIS_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' zealosh-redis 2>/dev/null || echo '"starting"')
    MOODLE_STATUS=$(docker inspect --format='{{json .State.Health.Status}}' zealosh-moodle 2>/dev/null || echo '"starting"')

    if [[ "$HUB_STATUS" == '"healthy"' && "$REDIS_STATUS" == '"healthy"' && "$MOODLE_STATUS" == '"healthy"' ]]; then
        echo "All core services reported HEALTHY!"
        break
    fi

    echo "Waiting for services to become healthy... (Hub: $HUB_STATUS, Redis: $REDIS_STATUS, Moodle: $MOODLE_STATUS, attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
    sleep 5
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "WARNING: One or more containers did not report healthy within $((MAX_RETRIES * 5)) seconds." >&2
    echo "Current container status:" >&2
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps >&2
    echo "Tail of Moodle logs (secrets redacted):" >&2
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=40 zealosh-moodle 2>&1 | \
      sed -E 's/([Pp]assword|[Ss]ecret|[Kk]ey)[=:][^ ]+/\1=[REDACTED]/g' >&2
    exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo "=========================================================="
echo " Zealosh Application Stack Deployment COMPLETE!"
echo " Public Ingress: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo " Zealosh Hub:    / (Port 80/443 via Nginx Gateway)"
echo " Moodle Engine:  /learn-engine/"
echo "=========================================================="
