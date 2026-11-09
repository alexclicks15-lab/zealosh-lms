#!/usr/bin/env bash
# Zealosh Live Classroom — BigBlueButton Automated Branding Deployer
# Run as root on target Ubuntu 24.04 LTS (BigBlueButton 4.0 noble-400) or 22.04 LTS server

set -euo pipefail

echo "=== Applying Zealosh Live Classroom Custom Branding ==="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BBB_ETC_DIR="/etc/bigbluebutton"
BBB_HTML5_BASE="/usr/share/bigbluebutton-html5"
BBB_PRESENTATION_DIR="/var/bigbluebutton/playback/presentation/2.3"
BBB_PRESENTATION_20_DIR="/var/bigbluebutton/playback/presentation/2.0"

# 1. Deploy YAML configuration override for BigBlueButton 3.x / 4.0 (noble-400 standard)
mkdir -p "$BBB_ETC_DIR"
if [ -f "$SCRIPT_DIR/settings.yml" ]; then
    echo "Deploying BigBlueButton 4.0 settings override to $BBB_ETC_DIR/bbb-html5.yml..."
    cp "$SCRIPT_DIR/settings.yml" "$BBB_ETC_DIR/bbb-html5.yml"
    chmod 0644 "$BBB_ETC_DIR/bbb-html5.yml"
fi

# 2. Deploy JSON settings for backwards compatibility if assets/config exists
if [ -d "$BBB_HTML5_BASE/assets/config" ]; then
    echo "Deploying legacy settings.json to $BBB_HTML5_BASE/assets/config/settings.json..."
    cp "$SCRIPT_DIR/settings.json" "$BBB_HTML5_BASE/assets/config/settings.json"
fi

if [ -d "$BBB_HTML5_BASE/private/config" ]; then
    echo "Deploying settings.yml to $BBB_HTML5_BASE/private/config/settings.yml..."
    cp "$SCRIPT_DIR/settings.yml" "$BBB_HTML5_BASE/private/config/settings.yml" 2>/dev/null || true
fi

# 3. Deploy custom branding CSS
echo "Deploying custom CSS overrides..."
mkdir -p "$BBB_HTML5_BASE/assets/css" 2>/dev/null || true
cp "$SCRIPT_DIR/custom-theme.css" "$BBB_HTML5_BASE/assets/css/zealosh.css" 2>/dev/null || true

if [ -d "$BBB_HTML5_BASE/public/stylesheets" ]; then
    cp "$SCRIPT_DIR/custom-theme.css" "$BBB_HTML5_BASE/public/stylesheets/zealosh.css" 2>/dev/null || true
fi

# 4. Deploy authentic Zealosh logo and favicon
echo "Deploying official Zealosh logo and round icon..."
mkdir -p "$BBB_PRESENTATION_DIR" "$BBB_PRESENTATION_20_DIR" 2>/dev/null || true
cp "$SCRIPT_DIR/logo.png" "$BBB_PRESENTATION_DIR/logo.png" 2>/dev/null || true
cp "$SCRIPT_DIR/logo-round.png" "$BBB_PRESENTATION_DIR/favicon.png" 2>/dev/null || true
cp "$SCRIPT_DIR/logo.png" "$BBB_PRESENTATION_20_DIR/logo.png" 2>/dev/null || true
cp "$SCRIPT_DIR/logo-round.png" "$BBB_PRESENTATION_20_DIR/favicon.png" 2>/dev/null || true

mkdir -p "$BBB_HTML5_BASE/assets/resources/images" 2>/dev/null || true
cp "$SCRIPT_DIR/logo.png" "$BBB_HTML5_BASE/assets/resources/images/logo.png" 2>/dev/null || true
cp "$SCRIPT_DIR/logo-round.png" "$BBB_HTML5_BASE/assets/resources/images/favicon.png" 2>/dev/null || true

# 5. Restart BigBlueButton HTML5 services to reload skin
echo "Reloading BigBlueButton services..."
if command -v systemctl >/dev/null 2>&1; then
    systemctl restart bbb-html5 2>/dev/null || bbb-conf --restart || true
elif command -v bbb-conf >/dev/null 2>&1; then
    bbb-conf --restart || true
fi

echo "=== Zealosh Live Classroom Branding Successfully Applied! ==="
