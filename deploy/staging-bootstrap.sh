#!/usr/bin/env bash
# ==============================================================================
# Zealosh LMS — Staging Application Host Automated Bootstrap Script
# Target OS: Ubuntu 22.04 LTS (x86_64, 4 vCPU, 16GB RAM recommended) or any Docker-enabled host
# ==============================================================================
# DO NOT execute via piped curl: 'curl ... | bash' is strictly prohibited.
#
# Safe local execution procedure:
#   1. Retrieve approved immutable revision from trusted remote or local transfer:
#      git clone <approved-repo-url> /opt/zealosh
#      cd /opt/zealosh
#      git checkout <approved-commit-sha-or-tag>
#   2. Operator inspects bootstrap script and docker compose manifests:
#      less deploy/staging-bootstrap.sh
#      less docker-compose.zealosh-platform.yml
#   3. Execute script locally from checked-out repository root:
#      bash deploy/staging-bootstrap.sh
# ==============================================================================

set -euo pipefail

# Determine script and repository root dynamically
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"

echo "=========================================================="
echo " Starting Zealosh LMS Staging Application Host Bootstrap"
echo "=========================================================="

# Privilege determination
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        echo "[FATAL ERROR] This script requires root privileges or sudo." >&2
        exit 1
    fi
fi

# Repository identity and integrity check
if [ ! -f "docker-compose.zealosh-platform.yml" ] || [ ! -f ".env.staging.example" ]; then
    echo "[FATAL ERROR] Must be executed from within a checked-out zealosh-lms repository." >&2
    echo "Missing docker-compose.zealosh-platform.yml or .env.staging.example in ${REPO_DIR}" >&2
    exit 1
fi

if [ -d ".git" ] && command -v git &>/dev/null; then
    CURRENT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo 'UNKNOWN')"
    CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'UNKNOWN')"
    GIT_ORIGIN="$(git config --get remote.origin.url 2>/dev/null || echo 'LOCAL_CHECKOUT')"
    echo "Repository Identity:"
    echo "  Workspace: ${REPO_DIR}"
    echo "  Remote:    ${GIT_ORIGIN}"
    echo "  Branch:    ${CURRENT_BRANCH}"
    echo "  Commit:    ${CURRENT_COMMIT}"
else
    echo "Repository Identity:"
    echo "  Workspace: ${REPO_DIR} (Verified source checkout without .git directory)"
fi

# 1. Update OS Packages & Prerequisites
echo "[1/6] Updating OS packages and installing prerequisites..."
$SUDO apt-get update -y
$SUDO apt-get install -y ca-certificates curl gnupg lsb-release git ufw wget

# 2. Install Official Docker Engine & Docker Compose Plugin
if ! command -v docker &> /dev/null; then
    echo "[2/6] Installing official Docker Engine..."
    $SUDO install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    $SUDO chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null

    $SUDO apt-get update -y
    $SUDO apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    $SUDO systemctl enable --now docker
    if [ -n "${USER:-}" ] && [ "$(id -u)" -ne 0 ]; then
        $SUDO usermod -aG docker "$USER" || true
    fi
    echo "Docker installed successfully: $(docker --version)"
else
    echo "[2/6] Docker already installed: $(docker --version)"
fi

# 3. Configure Firewall (UFW)
echo "[3/6] Configuring firewall rules (SSH, HTTP, HTTPS)..."
$SUDO ufw allow OpenSSH
$SUDO ufw allow 80/tcp
$SUDO ufw allow 443/tcp
$SUDO ufw --force enable

# 4. Storage Directories and Ingress Activation
echo "[4/6] Initializing storage directories and staging Nginx configuration..."
mkdir -p data moodle-custom/theme_zealosh deploy/nginx
chmod 755 data
cp -f deploy/nginx/nginx.staging.conf deploy/nginx/nginx.conf

# 5. Environment Secrets Initialization & File-Based Secret Delivery
echo "[5/7] Checking staging environment configuration and file secrets..."
mkdir -p secrets
chmod 700 secrets

# Provision administrator secret as isolated file (mode 0600) for Compose secret mount
if [ ! -f "secrets/moodle_admin_password.txt" ]; then
    echo "Generating isolated Moodle administrator secret in secrets/moodle_admin_password.txt (mode 0600)..."
    MOODLE_ADMIN_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
    printf "%s" "$MOODLE_ADMIN_PASS" > secrets/moodle_admin_password.txt
    chmod 600 secrets/moodle_admin_password.txt
else
    echo "Existing secrets/moodle_admin_password.txt detected. Enforcing restrictive 0600 permissions..."
    chmod 600 secrets/moodle_admin_password.txt
fi

ENV_FILE=".env.staging"
COMPOSE_FILE="docker-compose.zealosh-platform.yml"
COMPOSE_CMD="docker compose --env-file ${ENV_FILE} -f ${COMPOSE_FILE}"

if [ ! -f "${ENV_FILE}" ]; then
    echo "Initializing staging configuration from template .env.staging.example into ${ENV_FILE}..."
    cp .env.staging.example "${ENV_FILE}"
    
    # Auto-generate secure random secrets for initial boot
    JWT_SECRET=$(openssl rand -base64 32)
    REDIS_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
    
    sed -i "s|CHANGE_ME_STAGING_SECURE_JWT_SECRET_2026|$JWT_SECRET|g" "${ENV_FILE}"
    sed -i "s|CHANGE_ME_SECURE_REDIS_PASSWORD_2026|$REDIS_PASS|g" "${ENV_FILE}"
    
    chmod 600 "${ENV_FILE}"
    echo "Created ${ENV_FILE} with restrictive 0600 permissions."
    echo "NOTICE: Please configure your Supabase Project 2 (Moodle) credentials in ${ENV_FILE}:"
    echo "  - MOODLE_DATABASE_HOST (e.g. aws-0-ap-south-1.pooler.supabase.com from Supabase Connect dialog)"
    echo "  - MOODLE_DATABASE_PORT (5432 for Session Mode)"
    echo "  - MOODLE_DATABASE_USER (postgres.<project-ref>)"
    echo "  - MOODLE_DATABASE_PASSWORD (Dedicated Moodle DB password; enclose in single quotes: '...')";
    echo "  - Canonical Staging URL: https://lms.staging.zealosh.com";
fi

# Check if staging credentials are still placeholders
if grep -q "CHANGE_ME_SECURE_MOODLE_STAGING_PASSWORD" "${ENV_FILE}"; then
    echo "[IMPORTANT] MOODLE_DATABASE_PASSWORD is still set to placeholder in ${ENV_FILE}." >&2
    echo "Please edit ${ENV_FILE} with your real Supabase Project 2 credentials before starting containers." >&2
    echo "Run: nano ${ENV_FILE} && ${COMPOSE_CMD} up -d --build" >&2
    exit 1
fi

# 6. Validate Docker Compose Configuration Without Printing Secrets
echo "[6/7] Validating Docker Compose configuration without exposing secrets..."
if ! ${COMPOSE_CMD} config -q; then
    echo "[FATAL ERROR] Docker Compose configuration validation failed." >&2
    echo "Inspect syntax and variables in ${ENV_FILE} and ${COMPOSE_FILE}." >&2
    exit 1
fi
echo "Docker Compose configuration is valid."

# 7. Launch Container Stack with Docker Compose
echo "[7/7] Launching Zealosh Platform Docker Compose stack (Next.js 14 + Moodle 5.3 LTS + Redis)..."
${COMPOSE_CMD} up -d --build

echo "Waiting for services to become healthy..."
sleep 15
${COMPOSE_CMD} ps

# Post-launch container health check
FAILED_CONTAINERS=$(${COMPOSE_CMD} ps --format '{{.Name}} {{.State}} {{.Status}}' 2>/dev/null | grep -E '(exited|unhealthy|dead)' || true)
if [ -n "$FAILED_CONTAINERS" ]; then
    echo "[FATAL ERROR] One or more containers failed healthcheck or exited prematurely:" >&2
    echo "$FAILED_CONTAINERS" >&2
    echo "Displaying redacted tail of zealosh-moodle logs:" >&2
    ${COMPOSE_CMD} logs --tail=40 zealosh-moodle 2>&1 | sed -E 's/([Pp]assword|[Ss]ecret|[Kk]ey)[=:][^ ]+/\1=[REDACTED]/g' >&2
    exit 1
fi

echo "Testing Nginx reverse proxy ingress on loopback port 80..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: lms.staging.zealosh.com" http://127.0.0.1/ || echo "000")
echo "Loopback ingress HTTP status: ${HTTP_STATUS}"

echo "=========================================================="
echo " Zealosh LMS Staging Application Host Bootstrap COMPLETE! "
echo " Public Ingress: http://$(curl -s ifconfig.me || echo 'YOUR_SERVER_IP')"
echo " Zealosh Hub:    / (Port 80/443 via Nginx Gateway)"
echo " Moodle Engine:  /learn-engine/ (Moodle 5.3 LTS on Supabase)"
echo " OIDC Discovery: /.well-known/openid-configuration"
echo "=========================================================="

