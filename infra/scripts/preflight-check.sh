#!/usr/bin/env bash
# ==============================================================================
# Zealosh LMS — Infrastructure Preflight System Audit Script
# Validates CPU, RAM, Disk, OS, Ports, and Tooling before deployment
# ==============================================================================

set -euo pipefail

echo "=========================================================="
echo " Running Zealosh LMS Infrastructure Preflight Verification"
echo "=========================================================="

FAILED=0

# 1. Operating System Check
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "[PASS] Operating System: $NAME $VERSION_ID ($ID)"
    if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
        echo "[WARN] Recommended OS is Ubuntu 22.04 LTS."
    fi
else
    echo "[FAIL] Cannot determine OS distribution."
    FAILED=1
fi

# 2. CPU Architecture & Core Count
ARCH=$(uname -m)
CPU_CORES=$(nproc)
echo "[INFO] Architecture: $ARCH | CPU Cores: $CPU_CORES"
if [ "$CPU_CORES" -lt 4 ]; then
    echo "[WARN] Server has fewer than 4 CPU cores ($CPU_CORES). 4+ vCPU recommended for App/LMS host, 8+ for BBB."
else
    echo "[PASS] CPU core requirements satisfied ($CPU_CORES cores)."
fi

# 3. Available Memory (RAM)
TOTAL_RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
echo "[INFO] Total RAM: ${TOTAL_RAM_MB}MB"
if [ "$TOTAL_RAM_MB" -lt 7500 ]; then
    echo "[WARN] Server has less than 8GB RAM (${TOTAL_RAM_MB}MB). 16GB recommended for production."
else
    echo "[PASS] RAM requirements satisfied (${TOTAL_RAM_MB}MB)."
fi

# 4. Free Disk Space
FREE_DISK_GB=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
echo "[INFO] Free Disk Space on /: ${FREE_DISK_GB}GB"
if [ "$FREE_DISK_GB" -lt 20 ]; then
    echo "[FAIL] Less than 20GB free disk space available (${FREE_DISK_GB}GB)."
    FAILED=1
else
    echo "[PASS] Disk space requirement satisfied (${FREE_DISK_GB}GB available)."
fi

# 5. Tooling Availability
for tool in git curl openssl; do
    if command -v "$tool" &> /dev/null; then
        echo "[PASS] Command available: $tool"
    else
        echo "[FAIL] Required command missing: $tool"
        FAILED=1
    fi
done

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VER=$(docker --version)
    echo "[PASS] Docker Engine active: $DOCKER_VER"
else
    echo "[WARN] Docker Engine not installed. Run staging-bootstrap.sh to install."
fi

# Check Docker Compose
if docker compose version &> /dev/null; then
    COMPOSE_VER=$(docker compose version)
    echo "[PASS] Docker Compose plugin active: $COMPOSE_VER"
else
    echo "[WARN] Docker Compose plugin not detected."
fi

# 6. Network Port Conflict Audit
for port in 80 443; do
    if ss -tuln | grep -q ":$port "; then
        echo "[WARN] Port $port is currently in use. Existing web server may conflict with Nginx gateway."
    else
        echo "[PASS] Port $port is available."
    fi
done

echo "=========================================================="
if [ "$FAILED" -eq 0 ]; then
    echo " [SUCCESS] Preflight checks passed! Server is ready for deployment."
    exit 0
else
    echo " [ERROR] Preflight checks failed. Please resolve the issues above."
    exit 1
fi
