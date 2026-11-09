#!/usr/bin/env bash
# ==============================================================================
# Zealosh Live Classroom — Server 2 BigBlueButton Media Host Automated Setup
# Target OS: Clean, Dedicated Ubuntu 24.04 LTS 64-bit (x86_64)
# Hardware Baseline: Dedicated 6C/12T or 8 vCPUs, 32GB RAM, 500GB NVMe, Dedicated Public IP
# Must be executed as root on a clean, dedicated server (No Next.js or unrelated proxies)
# ==============================================================================

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: This script must be run as root (use sudo)." >&2
    exit 1
fi

DOMAIN="${1:-media.staging.zealosh.com}"
ADMIN_EMAIL="${2:-admin@zealosh.com}"
BBB_RELEASE_VERSION="${BBB_RELEASE_VERSION:-noble-400}"
WEBHOOK_CALLBACK_URL="${3:-https://app.zealosh.com/api/webhooks/bbb/recording}"
WEBHOOK_SECRET="${4:-${BBB_WEBHOOK_SECRET:-}}"

# 0. Validate Domain Format (RFC 1123 compliant FQDN)
if ! [[ "$DOMAIN" =~ ^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$ ]]; then
    echo "ERROR: Invalid Fully Qualified Domain Name (FQDN): '$DOMAIN'" >&2
    exit 1
fi

echo "=========================================================="
echo " Starting BigBlueButton 4.0 Media Host Automated Setup"
echo " Target FQDN:     $DOMAIN"
echo " Admin Email:     $ADMIN_EMAIL"
echo " Release Target:  $BBB_RELEASE_VERSION (Ubuntu 24.04 LTS 64-bit)"
echo " Webhook Target:  $WEBHOOK_CALLBACK_URL"
echo "=========================================================="

# 1. System Requirements & Dedicated Media Host Verification
echo "[1/6] Verifying dedicated media server baseline..."

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
if [ "$CPU_CORES" -lt 6 ]; then
    echo "  [WARNING] Server has $CPU_CORES cores. Production baseline is 6+ dedicated cores (8 vCPUs recommended)."
fi

# Memory (RAM)
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
echo "  Total Memory:     ${TOTAL_RAM_MB}MB"
if [ "$TOTAL_RAM_MB" -lt 15000 ]; then
    echo "  [WARNING] Server has ${TOTAL_RAM_MB}MB RAM. Production baseline is 16GB minimum, 32GB recommended."
fi

# Disk Space
FREE_DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
echo "  Free Disk:        ${FREE_DISK_GB}GB"
if [ "$FREE_DISK_GB" -lt 50 ]; then
    echo "  [WARNING] Less than 50GB free disk. 250GB+ NVMe SSD recommended when recordings are enabled."
fi

# Dedicated Host Check: Ensure ports 80 & 443 are not occupied by Next.js or generic proxies
BOUND_PORTS=$(ss -tuln 2>/dev/null | grep -E ':(80|443|3000) ' || true)
if [ -n "$BOUND_PORTS" ]; then
    echo "  [NOTICE] Ports 80, 443, or 3000 are currently bound. Ensure no conflicting applications occupy these ports."
fi

# 2. Update OS and Install Core Prerequisites
echo "[2/6] Updating base system packages..."
apt-get update -y
apt-get install -y wget curl git ufw ca-certificates gnupg lsb-release ruby-json

# 3. Configure Dedicated Media Firewall Ports
echo "[3/6] Configuring firewall ports for BigBlueButton WebRTC & TURN..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3478/tcp
ufw allow 3478/udp
ufw allow 16384:32768/udp
ufw allow 49152:65535/udp
ufw --force enable

# 4. Retrieve and Execute Inspected BigBlueButton 4.0 Installer
echo "[4/6] Downloading official BigBlueButton installer script..."
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
# SECURITY INVARIANT:
# -w configures UFW firewall rules inside the installer.
# -s specifies canonical public domain.
# -e configures Let's Encrypt TLS certificates.
# -a (API demo pages) is STRICTLY EXCLUDED to prevent unauthenticated meeting creation.
bash "$BBB_INSTALLER_PATH" \
  -v "$BBB_RELEASE_VERSION" \
  -s "$DOMAIN" \
  -e "$ADMIN_EMAIL" \
  -w

rm -f "$BBB_INSTALLER_PATH"

# 5. Install & Configure Event Webhooks and Recording Pipeline
echo "[5/6] Configuring BigBlueButton webhooks and post-publish recording dispatcher..."
if apt-get install -y bbb-webhooks 2>/dev/null; then
    systemctl enable --now bbb-webhooks || true
    echo "  bbb-webhooks service installed and enabled."
else
    echo "  Notice: bbb-webhooks package repository not yet synchronized; will rely on post_publish script."
fi

# Deploy Zealosh Recording Post-Publish Dispatcher Script
POST_PUBLISH_DIR="/usr/local/bigbluebutton/core/scripts/post_publish"
POST_PUBLISH_SCRIPT="${POST_PUBLISH_DIR}/zealosh_post_publish.rb"
mkdir -p "$POST_PUBLISH_DIR"

cat <<'EOF' > "$POST_PUBLISH_SCRIPT"
#!/usr/bin/env ruby
# Zealosh LMS — Recording Ingestion Dispatcher
# Invoked by BigBlueButton core after session recording is processed and published

require 'net/http'
require 'uri'
require 'json'
require 'openssl'

meeting_id = ARGV[0]
puts "Zealosh Recording Dispatcher: Processing meeting #{meeting_id}..."

config_file = '/etc/bigbluebutton/zealosh-secret.env'
webhook_url = 'https://app.zealosh.com/api/webhooks/bbb/recording'
webhook_secret = ''

if File.exist?(config_file)
  File.readlines(config_file).each do |line|
    if line.start_with?('BBB_WEBHOOK_CALLBACK_URL=')
      webhook_url = line.split('=', 2)[1].strip
    elsif line.start_with?('BBB_WEBHOOK_SECRET=')
      webhook_secret = line.split('=', 2)[1].strip
    end
  end
end

payload = {
  meetingId: meeting_id,
  status: 'PUBLISHED',
  timestamp: Time.now.to_i,
  recordingUrl: "https://#{`hostname -f`.strip}/playback/presentation/2.3/#{meeting_id}"
}.to_json

uri = URI.parse(webhook_url)
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = (uri.scheme == 'https')

req = Net::HTTP::Post.new(uri.request_uri, { 'Content-Type' => 'application/json' })
if !webhook_secret.empty?
  signature = OpenSSL::HMAC.hexdigest('sha256', webhook_secret, payload)
  req['x-zealosh-signature'] = "sha256=#{signature}"
end
req.body = payload

begin
  res = http.request(req)
  puts "Zealosh Recording Dispatcher: HTTP #{res.code} response from LMS Core."
rescue => e
  warn "Zealosh Recording Dispatcher: Failed to dispatch webhook: #{e.message}"
end
EOF

chmod 0755 "$POST_PUBLISH_SCRIPT"

# 6. Apply Custom Zealosh Live Classroom Branding Skin & Extract Secrets
echo "[6/6] Applying Zealosh Live Classroom branding overlay & securing API credentials..."
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
    if [ -z "$BBB_SALT" ]; then
        echo "ERROR: Failed to extract non-empty BigBlueButton secret from bbb-conf." >&2
        exit 1
    fi
    
    cat <<EOF > "$SECRET_CONFIG_FILE"
# ==============================================================================
# Zealosh Live Classroom — BigBlueButton API Secret Configuration
# RESTRICTED: Mode 0600 — Root & Deployer Only
# DO NOT COMMIT TO SOURCE CONTROL OR PRINT IN LOGS
# ==============================================================================
BBB_BASE_URL=https://${DOMAIN}/bigbluebutton/api
BBB_SECURITY_SALT=${BBB_SALT}
BBB_WEBHOOK_CALLBACK_URL=${WEBHOOK_CALLBACK_URL}
BBB_WEBHOOK_SECRET=${WEBHOOK_SECRET}
EOF
    chmod 0600 "$SECRET_CONFIG_FILE"
    
    echo "=========================================================="
    echo " BigBlueButton Media Host Setup COMPLETE!"
    echo " Server URL: https://$DOMAIN/bigbluebutton/api"
    echo " Secret stored securely at: $SECRET_CONFIG_FILE (mode 0600)"
    echo " NOTICE: API Secret has NOT been printed to stdout to prevent log exposure."
    echo " Secure transfer: pipe directly into Server 1's .env.staging without terminal echo:"
    echo "   ssh deployer@<SERVER_2_IP> \"sudo cat $SECRET_CONFIG_FILE\" | grep -E '^(BBB_SECURITY_SALT|BBB_BASE_URL)=' >> /opt/zealosh/.env.staging"
    echo "=========================================================="
    bbb-conf --check || true
else
    echo "Notice: bbb-conf not found in path (dry-run or pre-installation environment)."
fi
