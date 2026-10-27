#!/usr/bin/env bash
# ==============================================================================
# Zealosh Live Classroom — Server 2 BigBlueButton Media Host Automated Setup
# Target OS: Clean, Dedicated Ubuntu 24.04 LTS 64-bit (x86_64)
# Hardware Baseline: 8 Dedicated vCPUs, 16GB RAM, 500GB Disk (for recordings), Dedicated Public IP
# Must be executed as root on a clean, dedicated server (No Next.js or unrelated proxies)
# ==============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (use sudo)." >&2
    exit 1
fi

DOMAIN="${1:-classroom.staging.zealosh.com}"
ADMIN_EMAIL="${2:-admin@zealosh.com}"
BBB_RELEASE_VERSION="${BBB_RELEASE_VERSION:-noble-400}"

echo "=========================================================="
echo " Starting BigBlueButton 4.0 Media Host Automated Setup"
echo " Target FQDN:     $DOMAIN"
echo " Admin Email:     $ADMIN_EMAIL"
echo " Release Target:  $BBB_RELEASE_VERSION (Ubuntu 24.04 LTS 64-bit)"
echo "=========================================================="

# 1. System Requirements & Dedicated Media Host Verification
echo "[1/5] Verifying dedicated media server baseline..."

# Operating System Verification
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "  Operating System: $NAME $VERSION_ID ($VERSION_CODENAME)"
    if [ "$ID" != "ubuntu" ] || [ "${VERSION_ID:0:2}" -lt 24 ]; then
        echo "  [WARNING] Official BigBlueButton 4.0 baseline requires clean Ubuntu 24.04 LTS 64-bit."
    fi
fi

# CPU Core Count
CPU_CORES=$(nproc)
echo "  CPU Cores:        $CPU_CORES"
if [ "$CPU_CORES" -lt 8 ]; then
    echo "  [WARNING] Server has $CPU_CORES vCPUs. Production baseline is 8 dedicated vCPUs."
fi

# Memory (RAM)
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
echo "  Total Memory:     ${TOTAL_RAM_MB}MB"
if [ "$TOTAL_RAM_MB" -lt 15000 ]; then
    echo "  [WARNING] Server has ${TOTAL_RAM_MB}MB RAM. Production baseline is 16GB RAM."
fi

# Disk Space
FREE_DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
echo "  Free Disk:        ${FREE_DISK_GB}GB"
if [ "$FREE_DISK_GB" -lt 50 ]; then
    echo "  [WARNING] Less than 50GB free disk. 500GB SSD recommended when recordings are enabled."
fi

# Dedicated Host Check: Ensure ports 80 & 443 are not occupied by Next.js or generic proxies
if ss -tuln | grep -E ':(80|443|3000) ' | grep -qv "systemd"; then
    echo "  [NOTICE] Ports 80 or 443 are currently bound. Ensure no unrelated applications occupy these ports."
fi

# 2. Update OS and Install Core Prerequisites
echo "[2/5] Updating base system packages..."
apt-get update -y
apt-get install -y wget curl git ufw ca-certificates gnupg lsb-release

# 3. Configure Dedicated Media Firewall Ports
echo "[3/5] Configuring firewall ports for BigBlueButton WebRTC..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 16384:32768/udp
ufw --force enable

# 4. Retrieve and Execute Inspected BigBlueButton 4.0 Installer
echo "[4/5] Downloading official BigBlueButton installer script..."
BBB_INSTALLER_PATH="/tmp/bbb-install.sh"
wget -O "$BBB_INSTALLER_PATH" https://ubuntu.bigbluebutton.org/bbb-install.sh

# Verify download integrity (non-empty file with valid shell header)
if [ ! -s "$BBB_INSTALLER_PATH" ] || ! head -n 1 "$BBB_INSTALLER_PATH" | grep -q "sh"; then
    echo "ERROR: Downloaded BigBlueButton installer is empty or invalid." >&2
    rm -f "$BBB_INSTALLER_PATH"
    exit 1
fi

chmod 0700 "$BBB_INSTALLER_PATH"
echo "Installer downloaded and verified at $BBB_INSTALLER_PATH. Executing installation..."
bash "$BBB_INSTALLER_PATH" \
  -v "$BBB_RELEASE_VERSION" \
  -s "$DOMAIN" \
  -e "$ADMIN_EMAIL" \
  -a -w

rm -f "$BBB_INSTALLER_PATH"

# 5. Apply Custom Zealosh Live Classroom Branding Skin
echo "[5/5] Applying Zealosh Live Classroom branding overlay..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

if [ -f "$REPO_DIR/bbb-custom/apply-branding.sh" ]; then
    bash "$REPO_DIR/bbb-custom/apply-branding.sh"
else
    echo "Notice: bbb-custom directory not found in current path. Standard branding preserved."
fi

# Securely extract and isolate API salt (ZERO stdout secret leakage)
SECRET_CONFIG_DIR="/etc/bigbluebutton"
SECRET_CONFIG_FILE="${SECRET_CONFIG_DIR}/zealosh-secret.env"
mkdir -p "$SECRET_CONFIG_DIR"

if command -v bbb-conf >/dev/null 2>&1; then
    echo "Capturing BigBlueButton API credentials securely into restricted file..."
    BBB_SALT=$(bbb-conf --secret 2>/dev/null | grep -i "Secret:" | head -n 1 | awk '{print $2}' || echo "")
    
    cat <<EOF > "$SECRET_CONFIG_FILE"
# ==============================================================================
# Zealosh Live Classroom — BigBlueButton API Secret Configuration
# RESTRICTED: Mode 0600 — Root & Deployer Only
# DO NOT COMMIT TO SOURCE CONTROL OR PRINT IN LOGS
# ==============================================================================
BBB_BASE_URL=https://${DOMAIN}/bigbluebutton/api
BBB_SECURITY_SALT=${BBB_SALT}
EOF
    chmod 0600 "$SECRET_CONFIG_FILE"
    
    echo "=========================================================="
    echo " BigBlueButton Media Host Setup COMPLETE!"
    echo " Server URL: https://$DOMAIN/bigbluebutton/api"
    echo " Secret stored securely at: $SECRET_CONFIG_FILE (mode 0600)"
    echo " NOTICE: API Secret has NOT been printed to stdout to prevent log exposure."
    echo " Retrieve on host: sudo cat $SECRET_CONFIG_FILE"
    echo "=========================================================="
    bbb-conf --check || true
else
    echo "Notice: bbb-conf not found in path (dry-run or pre-installation environment)."
fi
