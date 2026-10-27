#!/usr/bin/env bash
# Zealosh Live Classroom — BigBlueButton Automated Branding Deployer
# Run as root on target Ubuntu 22.04 LTS BigBlueButton server

set -e

echo "=== Applying Zealosh Live Classroom Custom Branding ==="

BBB_HTML5_CONFIG="/usr/share/bigbluebutton-html5/assets/config"
BBB_PRESENTATION_DIR="/var/bigbluebutton/playback/presentation/2.3"

# 1. Verify target directories exist
if [ ! -d "$BBB_HTML5_CONFIG" ]; then
    echo "ERROR: BigBlueButton HTML5 client directory not found at $BBB_HTML5_CONFIG"
    exit 1
fi

# 2. Deploy custom settings.json
echo "Deploying custom settings.json..."
cp "$(dirname "$0")/settings.json" "$BBB_HTML5_CONFIG/settings.json"

# 3. Deploy custom branding CSS
echo "Deploying custom CSS overrides..."
cp "$(dirname "$0")/custom-theme.css" "/usr/share/bigbluebutton-html5/assets/css/zealosh.css"

# 4. Deploy authentic Zealosh logo and favicon
echo "Deploying official Zealosh logo and round icon..."
mkdir -p "$BBB_PRESENTATION_DIR"
cp "$(dirname "$0")/logo.png" "$BBB_PRESENTATION_DIR/logo.png"
cp "$(dirname "$0")/logo-round.png" "$BBB_PRESENTATION_DIR/favicon.png"
cp "$(dirname "$0")/logo.png" "/usr/share/bigbluebutton-html5/assets/resources/images/logo.png" 2>/dev/null || true
cp "$(dirname "$0")/logo-round.png" "/usr/share/bigbluebutton-html5/assets/resources/images/favicon.png" 2>/dev/null || true

# 5. Restart BigBlueButton HTML5 services to reload skin
echo "Restarting bbb-html5 service..."
systemctl restart bbb-html5

echo "=== Zealosh Live Classroom Branding Successfully Applied! ==="
