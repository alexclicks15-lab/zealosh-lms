# Zealosh LMS — Deployment Runbook: Self-Hosted Production Platform

**Document Version:** 4.1.0 (Staging & Production Architecture Validated)  
**Date:** October 25, 2026  
**Status:** **OPERATIONAL DEPLOYMENT RUNBOOK**  
**Target Environments:** Local Containerized Stack, Ubuntu Staging Cloud, Dedicated Production Media Node

---

## 1. Production Architecture Overview

The Zealosh production deployment consists of two distinct tiers:

```mermaid
graph TD
    PublicDNS["DNS: lms.zealosh.com / classroom.zealosh.com"] --> CloudflareTLS[TLS Termination / CDN]
    
    subgraph Core_Host["Zealosh Application Host (Docker Host / Cloud VM: 4 vCPU, 16GB RAM)"]
        NginxGateway["Nginx Reverse Proxy Gateway (:80 / :443)"]
        NextApp["Zealosh Core Hub (Next.js 14 Container :3000)"]
        MoodleEngine["Zealosh Learning Engine (Moodle 5.3 LTS Container :80)"]
        RedisStore[(Redis 7 Cache :6379)]
    end

    subgraph Supabase_Cloud["Managed Supabase Cloud (Isolated Databases)"]
        Supabase1[("Supabase Project 1: Core Hub DB (Cloud PostgreSQL)")]
        Supabase2[("Supabase Project 2: Moodle Engine DB (PostgreSQL 17 :5432)")]
    end
    
    subgraph Media_Host["Zealosh Live Classroom Host (Dedicated Bare-Metal / VPS: 8 vCPU, 16GB RAM)"]
        BBBNode["BigBlueButton 2.7+ Cluster (Ubuntu 22.04 LTS)"]
        Kurento_MediaSoup["WebRTC mediasoup / FreeSWITCH Audio SFU"]
        RecordingWorker["Recording Processing Worker"]
    end

    CloudflareTLS --> NginxGateway
    NginxGateway -->|/ | /courses | /student | /admin| NextApp
    NginxGateway -->|/learn-engine/*| MoodleEngine
    NginxGateway -->|/.well-known/* | /api/oauth/*| NextApp
    NextApp -->|REST / RPC (TLS)| Supabase1
    MoodleEngine -->|TCP Port 5432 (Session Mode / TLS)| Supabase2
    NextApp --> RedisStore
    MoodleEngine --> RedisStore
    
    CloudflareTLS --> BBBNode
    NextApp -->|Signed Join APIs| BBBNode
```

---

## 2. Containerized Platform Deployment (`docker-compose.zealosh-platform.yml`)

The platform stack is managed via Docker Compose. Always explicitly supply the environment file flag (`--env-file`) to guarantee deterministic variable loading:

```bash
# 1. Transfer or clone repository on target Linux Docker host
# Option A (Git clone):
git clone <approved-repo-url> /opt/zealosh
cd /opt/zealosh

# Option B (Local transfer with ordered filter preserving .env.staging.example):
# rsync -avz \
#   --exclude='node_modules/' \
#   --exclude='.next/' \
#   --include='/.env.staging.example' \
#   --exclude='.env*' \
#   --exclude='/secrets/*.txt' \
#   ./ ubuntu@<SERVER_1_PUBLIC_IP>:/opt/zealosh/

# 2. Configure staging secrets directly on the host from template
cp .env.staging.example .env.staging
chmod 0600 .env.staging
nano .env.staging

# Generate administrator file secret (mode 0600)
mkdir -p secrets && chmod 0700 secrets
openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' > secrets/moodle_admin_password.txt
chmod 0600 secrets/moodle_admin_password.txt

# 3. Validate Compose configuration without exposing secrets
docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml config -q

# 4. Launch stack with health-based startup order
docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml up -d --build

# 5. Verify running health status of all containers
docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml ps

# 6. Inspect logs with sensitive values redacted
docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml logs --tail=50 zealosh-moodle 2>&1 | \
  sed -E 's/([Pp]assword|[Ss]ecret|[Kk]ey)[=:][^ ]+/\1=[REDACTED]/g'
```

### Container Health Checks & Network Isolation:
- `zealosh-hub`: Probes `http://localhost:3000/api/health/liveness` every 10s inside container. Connected to Supabase Project 1 via HTTPS/TLS.
- `zealosh-moodle`: Probes internal loopback Apache `http://127.0.0.1:80/` via `deploy/moodle/moodle-healthcheck.sh` every 15s. Connected to Supabase Project 2 via TCP 5432 Session Mode (`MOODLE_DATABASE_HOST`, `MOODLE_DATABASE_PORT=5432`).
- `nginx-gateway`: Ingress reverse proxy listening on host ports `80` (HTTP) and `443` (HTTPS). Proxies `/learn-engine/` to `zealosh-moodle:80` and `/` to `zealosh-hub:3000`. (Note: Port 8080 is not used in this architecture).
- `zealosh-redis`: Isolated inside `zealosh-internal` bridge; health check probes `redis-cli ping`.

> [!NOTE]
> **Container Restart Policy:** Containers are configured with `restart: unless-stopped`. If a process crashes or exits with a non-zero code, Docker Engine automatically restarts it. If a container becomes `unhealthy` while its primary process remains alive, Docker records the unhealthy status in `docker compose ps` without a forceful kill, allowing operators to inspect diagnostic logs before restarting.

---

## 3. Moodle Theme & OIDC SSO Configuration Protocol

### A. Activating Custom Zealosh Theme:
1. The theme package `./moodle-custom/theme_zealosh` is automatically synchronized into `/var/www/html/public/theme/zealosh` (with root symlink) by the container entrypoint.
2. Log in to Moodle Admin: `https://lms.zealosh.com/learn-engine/admin/`.
3. Navigate to: **Site administration** > **Appearance** > **Themes** > **Theme selector**.
4. Set default theme to **Zealosh Learning Engine Theme** (`zealosh`).
5. Run **Purge all caches** to compile SCSS assets.

### B. Configuring OpenID Connect SSO:
1. Navigate to: **Site administration** > **Server** > **OAuth 2 services**.
2. Click **Create custom service**:
   - **Name:** `Zealosh Core Hub`
   - **Client ID:** `zealosh-moodle`
   - **Client Secret:** *(Matches JWT_SECRET / OAUTH_CLIENT_SECRET)*
   - **Service Base URL:** `https://lms.zealosh.com`
   - **Show on login page:** **Yes**
3. Endpoints auto-discovered via `/.well-known/openid-configuration`:
   - `authorization_endpoint`: `/api/oauth/authorize`
   - `token_endpoint`: `/api/oauth/token`
   - `userinfo_endpoint`: `/api/oauth/userinfo`
4. Field Mappings:
   - `sub` -> `idnumber`
   - `email` -> `email`
   - `name` -> `firstname`
   - `preferred_username` -> `username`
5. Enable **OAuth 2** plugin in **Site administration** > **Plugins** > **Authentication** > **Manage authentication**.

---

## 4. BigBlueButton Dedicated Server Requirements & Installation

According to official BigBlueButton administration guidelines ([https://docs.bigbluebutton.org/administration/install/](https://docs.bigbluebutton.org/administration/install/)):

### Target Host Baseline (BigBlueButton 4.0):
- Clean, dedicated server running **Ubuntu 24.04 LTS 64-bit** (`noble`) with Linux 6.8+ kernel.
- **Hardware baseline:** 8 dedicated CPU cores (x86_64), 16 GB RAM with 8GB swap, 500 GB+ NVMe SSD free disk when session recordings are enabled.
- **Dedicated Host Invariant:** Server 2 must remain dedicated strictly to BigBlueButton media and recording workers. Do not place the Next.js application, Moodle, or unrelated reverse proxies on Server 2 or on ports 80/443.
- **Networking:** Dedicated public IPv4 address, appropriate IPv6 connectivity, TCP ports 80 and 443 open, and UDP ports 16384–32768 open for WebRTC RTP streams.
- **FQDN & TLS:** Valid public hostname with Let's Encrypt TLS certificate provisioned during installation.

### Installation & Branding Commands:
```bash
# 1. Download official installer for local inspection
wget -O /tmp/bbb-install.sh https://ubuntu.bigbluebutton.org/bbb-install.sh
head -n 25 /tmp/bbb-install.sh # inspect header & version

# 2. Execute installer locally with BBB 4.0 target
chmod 0700 /tmp/bbb-install.sh
sudo bash /tmp/bbb-install.sh \
  -v noble-400 \
  -s classroom.staging.zealosh.com \
  -e admin@zealosh.com \
  -a -w
rm -f /tmp/bbb-install.sh

# 3. Apply Zealosh Live Classroom Custom Branding Overlay
cd /opt/zealosh/bbb-custom
sudo bash apply-branding.sh

# 4. Isolate API Secret (Zero Log Leakage)
# The setup script writes the secret to /etc/bigbluebutton/zealosh-secret.env (mode 0600)
# Retrieve on host without echoing to stdout or deployment logs:
sudo cat /etc/bigbluebutton/zealosh-secret.env
```

---

## 5. Authoritative Disaster Recovery & Backup Protocol

The platform implements a 4-tier decoupled backup strategy fully detailed in [docs/BACKUP_AND_RESTORE_RUNBOOK.md](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/BACKUP_AND_RESTORE_RUNBOOK.md):

1. **Tier 1: Cloud-Managed Supabase Snapshots:**
   - Both Supabase projects (Core Hub and Moodle Engine) maintain independent daily cloud snapshots.
   - Point-in-Time Recovery (PITR) requires an active paid add-on on the specific project plan and is managed through the Supabase Dashboard.
2. **Tier 2: Cold Logical SQL Dumps (`pg_dump`):**
   ```bash
   # Moodle Engine (Supabase Project 2) logical export via Session Pooler:
   PGPASSWORD="$MOODLE_DATABASE_PASSWORD" pg_dump \
       -h "$MOODLE_DATABASE_HOST" -p 5432 -U "$MOODLE_DATABASE_USER" -d postgres \
       --no-owner --no-privileges --format=custom \
       --file="/opt/zealosh/backups/zealosh_moodle_$(date +%Y%m%d_%H%M%S).dump"
   ```
3. **Tier 3: Moodle Persistent File Assets (`moodledata`):**
   ```bash
   docker run --rm -v moodledata_data:/var/moodledata:ro -v /opt/zealosh/backups:/backup \
       alpine tar -czf "/backup/moodledata_$(date +%Y%m%d_%H%M%S).tar.gz" \
       --exclude="cache" --exclude="localcache" --exclude="temp" --exclude="trashdir" \
       -C /var/moodledata .
   ```
4. **Tier 4: Secrets & Configuration:**
   - `.env.production` backed up to encrypted, access-restricted cold storage.
5. **Non-Destructive Staging Restore Verification:**
   - When staging infrastructure is provisioned, disaster recovery sign-off requires restoring the dump into a disposable test database (`zealosh_moodle_drill`) and validating table row counts (`mdl_course`, `mdl_user`) and retrieval of an uploaded learning file asset.

---

## 6. Moodle 5.3 CLI Installer, Routing, Schema Gates & Shell Safety Specifications

### A. Canonical External URLs: Staging vs Production Isolation
- **Staging Domain:** `lms.staging.zealosh.com`
  - Staging Hub: `https://lms.staging.zealosh.com`
  - Staging Learning Engine ($CFG->wwwroot): `https://lms.staging.zealosh.com/learn-engine`
  - Staging Media Cluster: `https://media.staging.zealosh.com/bigbluebutton/api`
  - Environment Template: `.env.staging.example`
- **Production Domain:** `lms.zealosh.com`
  - Production Hub: `https://lms.zealosh.com`
  - Production Learning Engine ($CFG->wwwroot): `https://lms.zealosh.com/learn-engine`
  - Environment Template: `.env.production.example`
- **Domain Invariant:** No staging traffic is ever routed or redirected to production. OIDC redirect URIs and Nginx ingress explicitly validate staging hosts.

### B. Pinned Moodle 5.3 CLI Installer & Secret Exposure Protection:
- **Installer Script:** `admin/cli/install_database.php` (used when `config.php` has been generated by the entrypoint).
- **Supported Flags (Verified against Pinned Source):**
  `--lang=en`, `--adminuser=USERNAME`, `--adminpass=PASSWORD`, `--adminemail=EMAIL`, `--fullname=STRING`, `--shortname=STRING`, `--agree-license`, `--summary=STRING`, `--supportemail=EMAIL`, `--noreplyemail=EMAIL`, `-h/--help`.
- **Strict Rejection of `--non-interactive`:** `install_database.php` in Moodle 5.3 does NOT recognize `--non-interactive`. Passing it triggers a fatal `cliunknowoption` error. The script is inherently unattended and fails immediately via `cli_error()` if required arguments are missing.
- **5-Tier Secret Exposure Defense (Moodle Administrator Secret):**
  1. **Host File Isolation:** Administrator credentials originate in an isolated host file (`./secrets/moodle_admin_password.txt`, mode `0600`), completely decoupled from `.env.staging` or `.env.production`.
  2. **Compose & Container Metadata Isolation:** The secret is provisioned exclusively via Docker Compose file secrets (`secrets: [ moodle_admin_pass ]`) and granted only to the `zealosh-moodle` container. Non-installer services (`zealosh-hub`, `zealosh-redis`, `zealosh-moodle-cron`, `zealosh-moodle-upgrade`) have zero access to the secret. The password is never defined in Compose `environment:`, preventing visibility in `docker inspect <container>` under `Config.Env` or `docker compose config`.
  3. **Process Environment Protection:** Neither the container's root process nor Apache/PHP child processes carry `MOODLE_ADMIN_PASSWORD` in `/proc/<pid>/environ`.
  4. **Process Argument Protection (`moodle-installer-wrapper.php`):** The installer wrapper reads the secret directly from `/run/secrets/moodle_admin_pass`, sets up in-memory `$_SERVER['argv']`, and invokes Moodle's `install_database.php` without command-line arguments. The kernel process table (`ps aux` / `/proc/<pid>/cmdline`) exposes zero passwords.
  5. **Ephemeral File & Memory Hygiene:** The wrapper zero-wipes its memory buffer (`str_repeat("\0", 1024)`) and unlinks the ephemeral secret file if writable. Shell traps in `entrypoint.sh` wipe `/run/secrets/moodle_admin_pass` with `/dev/zero` upon exit, signal interruption, or failure. Exact password bytes (including spaces and symbols) are preserved without destructive `trim()`.

### C. Explicit 3-State Database Schema Gate:
During container preflight, the dedicated Supabase PostgreSQL database is evaluated against the configured prefix (`MOODLE_DATABASE_PREFIX`, validated against `^[a-z][a-z0-9_]*_$`):
1. **`CLEAN` (0 tables in `public` schema):** Safe for initial automated installation. If public contains non-Moodle tables (e.g. Core Hub Project 1 tables like `courses`, `batches`, `enrollments`), the gate detects the collision and classifies as `PARTIAL_OR_UNEXPECTED` to prevent data corruption.
2. **`INSTALLED` (All 10 required core tables present, >= 150 prefix tables, and readable numeric core version in `mdl_config`):** Installation skipped. Ordinary container restarts are strictly READ-ONLY and do not run schema upgrades automatically.
3. **`PARTIAL_OR_UNEXPECTED` (any incomplete/ambiguous state):** Container **FAILS CLOSED** immediately with exit code 1 and outputs a secret-free diagnostic and recovery runbook. Automatic installation is blocked to prevent data corruption.

#### Authoritative Safe Recovery Runbook (Replacing routine DROP SCHEMA CASCADE):
If an installation or container boot halts in `PARTIAL_OR_UNEXPECTED` state:
1. **Stop the affected Moodle service:** `docker compose stop zealosh-moodle`.
2. **Confirm target project, database, and configured prefix:** Verify that `MOODLE_DATABASE_HOST` points to Supabase Project 2 (Moodle), not Project 1 (Core Hub), and verify `MOODLE_DATABASE_PREFIX` (`mdl_`).
3. **Capture a backup or snapshot:** Run `pg_dump` via Session Pooler or capture a cloud snapshot before inspecting or altering schema objects.
4. **Identify affected objects without modifying them:** Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';` in Supabase SQL Editor.
5. **Prefer restoring into a disposable target:** Restore into a disposable test database (`zealosh_drill_target`) or recreate a dedicated staging test project when a fresh database is required.
6. **Allow destructive cleanup only after explicit confirmation:** Destructive drops (`DROP TABLE`) are permitted only after explicit operator sign-off and a verified backup, with the exact object list and impact documented. Never execute `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` as a routine recovery action.

### D. Controlled One-Time Database Upgrade Architecture:
- Ordinary web container startup (`zealosh-moodle`) is strictly READ-ONLY with respect to schema migrations. Passing `MOODLE_TRIGGER_UPGRADE=1` to the web container logs a warning and is ignored to prevent repeating upgrades across ordinary container restarts or replicas.
- Upgrades are executed deliberately via a dedicated one-time upgrade runner service:
  ```bash
  docker compose run --rm zealosh-moodle-upgrade
  ```
- **Upgrade Runner Invariants (`moodle-upgrade-runner.sh`):**
  - **Single Execution:** Enforces an advisory file lock (`/var/moodledata/.moodle_upgrade.lock`) to prevent concurrent execution.
  - **Privilege Separation:** Runs under application user `www-data`.
  - **Target Verification:** Validates `INSTALLED` schema state, checks current database version against target code version (`version.php`), and skips if already current.
  - **Standard Flags:** Runs official `admin/cli/upgrade.php --non-interactive` without unstable flags.
  - **Fail-Closed:** Halts on any non-zero exit status.
  - **Post-Upgrade Verification:** Queries `mdl_config` to verify resulting database version matches or exceeds target version before releasing traffic.

### E. Moodle 5.3 Web-Root Security, Routing & Redirect-Aware Health Check:
- **Apache DocumentRoot:** Strictly pointed to `/var/www/html/public`.
- **Security Boundary:** Protects `config.php`, core libraries (`/var/www/html/lib`), CLI tools (`/var/www/html/admin/cli`), Composer metadata, and `/var/moodledata` (at `/var/moodledata`, permissions 0770) from direct HTTP access.
- **Front-Controller Router (`r.php`):** Apache is configured with `DirectoryIndex index.php` and `FallbackResource /r.php`. All non-matching routes are passed directly to Moodle's modern routing engine.
- **Nginx Subpath Handling:** `location /learn-engine/` passes traffic to Apache with `X-Forwarded-Host $host` and `X-Forwarded-Prefix /learn-engine`, coordinating with `$CFG->wwwroot = 'https://lms.staging.zealosh.com/learn-engine'`, `$CFG->reverseproxy = true`, and `$CFG->sslproxy = true`.
- **Redirect-Aware Container Health Check (`moodle-healthcheck.sh`):**
  - Directly queries `http://127.0.0.1:80/` with explicit Host header (`Host: ${ZEALOSH_DOMAIN}`).
  - **Redirects are never followed** (`--max-redirs 0`, no `-L`).
  - **HTTP 200:** Validated against non-empty application response.
  - **HTTP 302/303:** Evaluated using a strict RFC-compliant URL validator. Only permitted relative paths (`/learn-engine*`, `/login*`, etc.) or absolute HTTPS URLs matching the exact current environment hostname (`https://${ZEALOSH_DOMAIN}/...`) are accepted.
  - **Fails Unconditionally On:** Production redirects from staging, scheme downgrade (`http://`), external hostnames, userinfo spoofing (`@`), protocol-relative URLs (`//`), directory traversal (`..`), unexpected 301, 4xx/5xx errors, timeouts, or empty responses.

---

## 7. Staging Infrastructure Prerequisites & Readiness Matrix

| Prerequisite Domain | Requirement & Specification | Current Status / Source of Truth | Verification Command / Check |
| :--- | :--- | :--- | :--- |
| **1. Cloud Account & Provider** | DigitalOcean (or AWS/Hetzner/GCP) account with VPC networking and Droplet quota | **Account access pending operator provision.** Terraform manifests prepared in `infra/terraform/`. | `doctl account get` |
| **2. Application Hostname & DNS** | `lms.staging.zealosh.com` A-record pointing to Server 1 Public IP | **DNS configuration pending server IP assignment.** Cloudflare/Route53 management. | `dig +short lms.staging.zealosh.com` |
| **3. Moodle Hostname & Routing** | Subpath `/learn-engine/` on `lms.staging.zealosh.com` reverse-proxied to `zealosh-moodle:80` | **Configured & Validated** in `deploy/nginx/nginx.staging.conf`. | `curl -sI -H "Host: lms.staging.zealosh.com" http://127.0.0.1/learn-engine/` |
| **4. BigBlueButton Hostname & DNS** | `classroom.staging.zealosh.com` A-record pointing to Server 2 Public IP | **DNS configuration pending media server IP.** | `dig +short classroom.staging.zealosh.com` |
| **5. TLS Certificates & DNS Validation** | Public Let's Encrypt certificates for `lms.staging.zealosh.com` & `classroom.staging.zealosh.com` | Automated via Certbot / Cloudflare Edge TLS / `bbb-install.sh`. | `openssl s_client -connect lms.staging.zealosh.com:443 -servername lms.staging.zealosh.com` |
| **6. Local SSH Access** | Operator SSH key pair configured locally (`~/.ssh/id_ed25519` or `~/.ssh/id_rsa`) | Public key fingerprinted in `infra/terraform/variables.tf`. | `ssh -i ~/.ssh/id_ed25519 root@<SERVER_IP>` |
| **7. Supabase & PostgreSQL 17** | **Project 1:** `https://yeegsljnjwxdhgzfdnyg.supabase.co` (Active)<br/>**Project 2:** Dedicated PostgreSQL 17 for Moodle (Port 5432 Session Mode) | Project 1 active & verified (206/206 tests green). Project 2 pending operator provisioning approval. | Session Mode port 5432 TCP handshake probe. |
| **8. Secret Isolation & Environment** | Isolated `.env.staging` (0600) + Docker secret `secrets/moodle_admin_password.txt` (0600) | Templates prepared in `.env.staging.example`. Zero passwords printed in logs or committed. | `test -f secrets/moodle_admin_password.txt && stat -c %a secrets/moodle_admin_password.txt` |
| **9. Firewall & Network Ports** | **Server 1:** TCP 22 (SSH), TCP 80 (HTTP), TCP 443 (HTTPS)<br/>**Server 2:** TCP 22, TCP 80, TCP 443, UDP 16384-32768 (WebRTC) | Defined in `infra/terraform/firewalls.tf` and cloud-init manifests. | `ufw status verbose` on target hosts |
| **10. Estimated Infrastructure Cost** | **Server 1:** $84/mo (4 vCPU, 16GB RAM)<br/>**Server 2:** $84/mo (c-8: 8 vCPU, 16GB RAM) + $50/mo (500GB NVMe)<br/>**Database:** $25/mo (Supabase Pro) or $15-30/mo (Managed Postgres) | **Estimated Total: ~$193 - $243 / month** for full dual-node staging cluster. | Cloud billing dashboard |
| **11. Backup Storage & Destination** | Local directory `/opt/zealosh/backups` + offsite S3/R2 bucket with 7-day daily retention | Scripted in `infra/scripts/backup-restore-test.sh`. Documented in `BACKUP_AND_RESTORE_RUNBOOK.md`. | `ls -la /opt/zealosh/backups` |
| **12. Deployment Access Privileges** | Root / sudo access on Ubuntu hosts; deployer user in docker group | Defined in `infra/cloud-init/app-server.cloud-init.yaml`. | `id deployer` |

---

## 8. Safe Ordered Staging Deployment Procedure

Follow these sequential steps when deploying onto real staging infrastructure:

### Phase 1: Pre-Deployment Account & DNS Setup
1. Verify cloud provider quota (at least 12 vCPUs, 32GB RAM across 2 Droplets/VMs).
2. Provision DNS A-records in DNS management console:
   - `lms.staging.zealosh.com` -> `[Server 1 Planned Public IP]`
   - `classroom.staging.zealosh.com` -> `[Server 2 Planned Public IP]`
3. Ensure domain names propagate before attempting Let's Encrypt TLS issuance.

## 8. Authoritative Operator-Controlled Staging Deployment Sequence

Follow this rigorous, operator-controlled 10-step sequence when deploying onto real staging infrastructure.

> [!IMPORTANT]
> **Execution Status:** **Steps 1–10 are UNEXECUTED.** They require explicit operator authorization, account access, and real cloud resource provisioning. No paid servers or databases have been created.

### Step 1: Review Project & Compute Cost
- **Action:** Review the incremental cost model ($10–$20/mo compute for Project 2 within existing Pro organization + $84/mo for Server 1 + $134/mo for Server 2 with 500GB SSD).
- **Status:** `[PENDING OPERATOR BUDGET APPROVAL]`

### Step 2: Create Dedicated Supabase Project 2 (PostgreSQL 17+)
- **Action:** In the Supabase Dashboard, create a new project in the approved organization:
  - **Project Name:** `zealosh-moodle-staging`
  - **Database Engine:** **PostgreSQL 17 or later** (Mandatory for Moodle 5.3 LTS).
  - **Region:** Match Server 1 region (e.g. `ap-south-1` for Mumbai / Bangalore).
  - **Password:** Generate a 24+ character alphanumeric secret. Do NOT commit or share.
- **Status:** `[UNEXECUTED — REQUIRES OPERATOR CLOUD ACTION]`

### Step 3: Disable Data API on Project 2 (Security Boundary)
- **Action:** Immediately navigate to **Project Settings** > **API** in Project 2:
  - Toggle **Data API** to **OFF** (Disabled).
  - Confirm `https://[moodle-ref].supabase.co/rest/v1/` returns 404/503.
  - **CRITICAL INVARIANT:** **DO NOT disable the Data API on Project 1 (Core Hub).**
  - Execute privilege revocation in Project 2 SQL Editor:
    ```sql
    REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
    ```
- **Status:** `[UNEXECUTED — REQUIRES OPERATOR CLOUD ACTION]`

### Step 4: Configure Moodle Database Role & Session-Mode Connection
- **Action:** In Supabase Dashboard -> **Connect** -> **Connection string** -> Select **Session mode**:
  - Endpoint: `aws-0-[region].pooler.supabase.com`
  - Port: `5432`
  - Username: `postgres.[project-ref]` (tenant suffix required)
  - SSL: `require`
- **Status:** `[UNEXECUTED — REQUIRES OPERATOR CLOUD ACTION]`

### Step 5: Store Credentials Exclusively in Approved Server-Side Environment
- **Action:** On Server 1 host, populate `.env.staging` (mode `0600`) and `./secrets/moodle_admin_password.txt` (mode `0600`):
  ```bash
  cp .env.staging.example .env.staging
  chmod 0600 .env.staging
  # Populate MOODLE_DATABASE_HOST, MOODLE_DATABASE_USER, MOODLE_DATABASE_PASSWORD
  mkdir -p secrets && chmod 0700 secrets
  openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' > secrets/moodle_admin_password.txt
  chmod 0600 secrets/moodle_admin_password.txt
  ```
- **Status:** `[UNEXECUTED — REQUIRES SERVER PROVISIONING]`

### Step 6: Test Connection Securely
- **Action:** Perform non-leaking network probe from Server 1 host to Supabase Session Pooler:
  ```bash
  PGPASSWORD="$MOODLE_DATABASE_PASSWORD" psql \
    -h "$MOODLE_DATABASE_HOST" -p 5432 -U "$MOODLE_DATABASE_USER" -d postgres \
    -c "SELECT version();"
  ```
  Verify PostgreSQL 17.x returns cleanly. Never echo password to console or shell history.
- **Status:** `[UNEXECUTED — REQUIRES HOST PROVISIONING]`

### Step 7: Run Moodle Installation & Database Upgrade Checks
- **Action:** Launch the container stack via Compose. The container entrypoint executes `moodle-installer-wrapper.php` using the 3-state database schema gate (`CLEAN` -> initial unattended installation -> `INSTALLED`):
  ```bash
  docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml up -d --build
  ```
  Verify that all 450+ `mdl_*` tables are populated in Project 2, and that ordinary restarts remain strictly read-only.
- **Status:** `[UNEXECUTED — REQUIRES STAGING DEPLOYMENT]`

### Step 8: Perform Disposable-Database Backup & Restore Drill
- **Action:** Execute the automated backup & verification drill script:
  ```bash
  bash infra/scripts/backup-restore-test.sh
  ```
  Verifies cold logical dump, test restore into disposable `zealosh_drill_[timestamp]`, table count verification, and automatic retention cleanup.
- **Status:** `[UNEXECUTED — REQUIRES STAGING DEPLOYMENT]`

### Step 9: Prepare Staging Deployment (Server 1 & Server 2)
- **Action:** Execute `deploy/staging-bootstrap.sh` on Server 1 and `deploy/bbb-staging-setup.sh` on Server 2 (BigBlueButton 4.0 on Ubuntu 24.04 LTS). Connect Nginx gateway routes and verify DNS.
- **Status:** `[UNEXECUTED — REQUIRES CLOUD VM PROVISIONING]`

### Step 10: Complete Real Browser OIDC & BigBlueButton Acceptance Tests
- **Action:** Execute the 12-point live integration test protocol defined in Section 9 below in a real browser session.
- **Status:** `[UNEXECUTED — AWAITING DEPLOYED STAGING PLATFORM]`

---

## 9. Live Integration Acceptance Test Protocol (12-Point Checklist)

> [!IMPORTANT]
> **Status: UNEXECUTED — PENDING REAL CLOUD INFRASTRUCTURE PROVISIONING.**
> The following 12 integration tests must be executed live against the provisioned staging servers before platform sign-off. None of these tests are marked complete until verified in a real browser and live network session.

| # | Acceptance Test Flow | Live Execution Procedure | Expected Outcome & Verification Invariant | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Open Zealosh Core Hub over HTTPS** | Open `https://lms.staging.zealosh.com/` in an external browser. | Valid TLS certificate (TLS 1.3), 200 OK, brand header and course catalog render correctly. | `[PENDING PROVISIONING]` |
| **2** | **Sign in with permitted test account** | Sign in as test student (`student@zealosh.com`) or test instructor. | Session JWT generated, stored in HTTP-only cookie, redirected to `/student` or `/instructor`. | `[PENDING PROVISIONING]` |
| **3** | **Verify authorized course & enrollment data** | Navigate to `/student/courses`. Observe loaded courses. | 4 seeded masterclasses and student's active cohorts load from Supabase PostgreSQL Project 1. | `[PENDING PROVISIONING]` |
| **4** | **Verify unauthorized & cross-tenant rejection** | Attempt to access `/admin` with student token; attempt cross-user coursework submission via API. | HTTP 403 Forbidden on `/admin`; API returns `{ error: "FORBIDDEN" }`. Cross-tenant data shielded. | `[PENDING PROVISIONING]` |
| **5** | **Open Moodle through intended Zealosh route** | Navigate to `https://lms.staging.zealosh.com/learn-engine`. | Moodle front-page renders through Nginx gateway with `theme_zealosh` branding and zero mixed-content errors. | `[PENDING PROVISIONING]` |
| **6** | **Verify real browser OIDC sign-in into Moodle** | Click "Log in with Zealosh Core Hub" on Moodle login page. | Authenticates via `/.well-known/openid-configuration` & `/api/oauth/authorize`; Moodle user auto-provisioned. | `[PENDING PROVISIONING]` |
| **7** | **Verify Moodle session & logout behavior** | Navigate Moodle courses; click Logout in Moodle header. | Active session preserved across pages via Redis DB 1; logout terminates Moodle session and returns to Hub. | `[PENDING PROVISIONING]` |
| **8** | **Join real BigBlueButton room (Mic/Cam/Screen)** | Launch live class from `/live/[sessionId]`; enter BigBlueButton. | WebRTC audio connects (FreeSWITCH echo test passes); camera and screen share stream successfully over UDP. | `[PENDING PROVISIONING]` |
| **9** | **Verify attendance sync & recording metadata** | Conclude meeting; check `/api/live/[sessionId]/attendance` and recordings. | Participant joined/left timestamps recorded in Supabase; recording metadata indexed in `class_recordings`. | `[PENDING PROVISIONING]` |
| **10** | **Verify health checks & service recovery** | Run `docker compose restart zealosh-moodle`; poll `/api/health/readiness`. | Healthcheck reports starting -> healthy; Nginx gateway routes recover automatically with zero orphaned processes. | `[PENDING PROVISIONING]` |
| **11** | **Perform backup & restore drills on staging data** | Execute `bash infra/scripts/backup-restore-test.sh` on Server 1. | Logical dump created in `/opt/zealosh/backups/`; restored into disposable DB `zealosh_drill_*`; cleaned up. | `[PENDING PROVISIONING]` |
| **12** | **Test firewall exposure & secret isolation** | Run external port scan (`nmap -sS -p- <SERVER_1_IP>`); inspect logs. | Only ports 22, 80, 443 open on Server 1; media UDP open only on Server 2; zero plaintext secrets in logs. | `[PENDING PROVISIONING]` |


