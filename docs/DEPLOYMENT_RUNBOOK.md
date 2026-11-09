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
    PublicDNS["DNS: Staging: lms.staging.zealosh.com / media.staging.zealosh.com<br/>(Prod: lms.zealosh.com / media.zealosh.com)"] --> CloudflareTLS[TLS Termination / CDN]
    
    subgraph Core_Host["Zealosh Application Host (Server 1: Ubuntu 22.04 LTS: 4 vCPU, 16GB RAM)"]
        NginxGateway["Nginx Reverse Proxy Gateway (:80 / :443)"]
        NextApp["Zealosh Core Hub (Next.js 14 Container :3000)"]
        MoodleEngine["Zealosh Learning Engine (Moodle 5.3 LTS Container :80)"]
        RedisStore[(Redis 7 Cache :6379)]
    end

    subgraph Supabase_Cloud["Managed Supabase Cloud (Strictly Isolated Projects)"]
        Supabase1[("Supabase Project 1: Core Hub DB (Cloud PostgreSQL)")]
        Supabase2[("Supabase Project 2: Moodle Engine DB (PostgreSQL 17 :5432)")]
    end
    
    subgraph Media_Host["Zealosh Live Classroom Host (Server 2: Ubuntu 24.04 LTS: 8 vCPU, 16GB RAM, 500GB SSD)"]
        BBBNode["BigBlueButton 4.0 Media Node (Ubuntu 24.04 LTS)"]
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

## 2. Controlled Staging Deployment Runbook (Phases 1 through 8)

To prevent accidental data loss, secret leakage, or uncontrolled overwrites, all two-server deployments must follow this sequential, gated runbook across Server 1 (`lms.staging.zealosh.com`) and Server 2 (`media.staging.zealosh.com`).

---

### Phase 1 — Local LMS Artifact Packaging & Verification (Workstation)
*Classification: Local Automated Build & Verification*

1. **Verify Local Repository Integrity & Tests:**
   ```bash
   npm test
   npx tsc --noEmit
   ```

2. **Package Deterministic LMS Deployment Artifact:**
   ```bash
   # Generates build/artifacts/zealosh-lms-staging-v<version>-<timestamp>.tar.gz
   # Generates .sha256 digest and artifact-manifest.json
   # Strictly excludes .git/, .env*, secrets/, data/zealosh-store.json, node_modules/, .next/, tests/
   node deploy/package-deployment-artifact.mjs
   ```

3. **Verify Generated LMS Artifact Integrity Locally:**
   ```bash
   node deploy/verify-deployment-artifact.mjs build/artifacts/zealosh-lms-staging-*.tar.gz
   ```

---

### Phase 2 — Local Classroom Artifact Packaging & Verification (Workstation)
*Classification: Local Automated Build & Verification*

1. **Verify Customized BigBlueButton 4.0 HTML5 Client Build:**
   ```bash
   # Ensure HTML5 client production bundle is built in zealosh-classroom
   cd ../zealosh-classroom/bigbluebutton-html5
   npm run tscheck
   # Ensure dist/ contains index.html, locales/en.json, bundle.*.js, wasm/
   ls -la dist/
   cd ../../zealosh-lms
   ```

2. **Package Deterministic Classroom Deployment Artifact:**
   ```bash
   # Generates build/artifacts/zealosh-classroom-staging-v<version>-<timestamp>.tar.gz
   # Packages html5-client/ assets and bbb-custom/ branding into a single verified bundle
   node deploy/package-classroom-artifact.mjs
   ```

3. **Verify Generated Classroom Artifact Integrity Locally:**
   ```bash
   node deploy/verify-classroom-artifact.mjs build/artifacts/zealosh-classroom-staging-*.tar.gz
   ```

---

### Phase 3 — Secure Artifact Transfer to Server 1 (LMS Core Hub)
*Classification: Secure File Transfer*

1. **Transfer Only Verified LMS Artifact & Companion Checksum:**
   ```bash
   # DO NOT use broad rsync. Transfer only verified, immutable packages:
   ssh deployer@<SERVER_1_IP> "mkdir -p /opt/zealosh/incoming /opt/zealosh/releases /opt/zealosh/shared/secrets /opt/zealosh/shared/data"
   scp build/artifacts/zealosh-lms-staging-*.tar.gz* deployer@<SERVER_1_IP>:/opt/zealosh/incoming/
   ```

---

### Phase 4 — Secure Artifact Transfer to Server 2 (Classroom Media Node)
*Classification: Secure File Transfer*

1. **Transfer Only Verified Classroom Artifact, Checksum, & Activation Script:**
   ```bash
   ssh root@<SERVER_2_IP> "mkdir -p /opt/zealosh/incoming /usr/share/bigbluebutton/html5-client.releases"
   scp build/artifacts/zealosh-classroom-staging-*.tar.gz* deploy/activate-classroom-release.sh deploy/verify-classroom-artifact.mjs root@<SERVER_2_IP>:/opt/zealosh/incoming/
   ```

---

### Phase 5 — Server 2 Pre-Activation Verification & Controlled Activation (Media Node)
*Classification: Server 2 Release Activation*

1. **Dedicated Host Baseline:**
   - Operating System: Clean Ubuntu 24.04 LTS 64-bit (`noble`).
   - Hardware: 8 Dedicated vCPUs, 16 GB RAM with 8GB swap, 500 GB NVMe SSD.
   - Dedicated Public IPv4 with A record: `media.staging.zealosh.com`.
   - Inbound Firewall Ports: strictly TCP `22` (restricted SSH), TCP `80`, TCP `443`, and UDP `16384-32768` (WebRTC RTP streams). Internal ports (FreeSWITCH 5066, LiveKit 7880/8443) are proxied over HTTPS port 443 and NOT exposed publicly.

2. **Execute Automated BigBlueButton 4.0 Media Host Setup (First-Time Only):**
   ```bash
   ssh root@<SERVER_2_IP> "cd /opt/zealosh/incoming && bash deploy/bbb-staging-setup.sh media.staging.zealosh.com admin@zealosh.com"
   ```

3. **Verify Artifact Integrity & Activate Versioned Classroom Release:**
   ```bash
   ssh root@<SERVER_2_IP> "cd /opt/zealosh/incoming && \
       node verify-classroom-artifact.mjs zealosh-classroom-staging-*.tar.gz && \
       bash activate-classroom-release.sh --activate zealosh-classroom-staging-*.tar.gz zealosh-classroom-staging-*.tar.gz.sha256"
   ```
   *(Note: The activation script unpacks into versioned `/usr/share/bigbluebutton/html5-client.releases/<timestamp>`, backs up `/etc/bigbluebutton/bbb-html5.yml`, switches the active release symlink, applies custom branding, and restarts `bbb-html5` services).*

4. **Verify Media Host Status & Loopback Health:**
   ```bash
   ssh root@<SERVER_2_IP> "bbb-conf --check && bash /opt/zealosh/incoming/activate-classroom-release.sh --verify-health"
   ```

5. **Securely Retrieve Server 2 API Secret (Zero Console / Terminal Exposure):**
   ```bash
   # Stream securely directly into a restricted temporary file without terminal stdout echo:
   ssh deployer@<SERVER_2_IP> "sudo cat /etc/bigbluebutton/zealosh-secret.env" > /tmp/zealosh-media-secret.tmp
   chmod 0600 /tmp/zealosh-media-secret.tmp
   ```

---

### Phase 6 — Server 1 Pre-Activation Verification & Controlled Activation (LMS Core Hub)
*Classification: Server 1 Release Activation*

1. **Verify Checksum and Artifact Safety on Server 1:**
   ```bash
   ssh deployer@<SERVER_1_IP> "cd /opt/zealosh/incoming && node verify-deployment-artifact.mjs zealosh-lms-staging-*.tar.gz"
   ```

2. **Unpack into Versioned Release Directory:**
   ```bash
   RELEASE_TAG="release_$(date +%Y%m%d_%H%M%S)"
   ssh deployer@<SERVER_1_IP> "mkdir -p /opt/zealosh/releases/${RELEASE_TAG} && \
       tar -xzf /opt/zealosh/incoming/zealosh-lms-staging-*.tar.gz -C /opt/zealosh/releases/${RELEASE_TAG}"
   ```

3. **Configure Staging Environment & Validate Secrets:**
   ```bash
   ssh deployer@<SERVER_1_IP> << 'EOF'
   cd "/opt/zealosh/releases/${RELEASE_TAG}"
   cp .env.staging.example .env.staging
   chmod 0600 .env.staging

   # Safely inject Media Node secret from temporary restricted file:
   if [ -f /tmp/zealosh-media-secret.tmp ]; then
       grep -E '^(BBB_SECURITY_SALT|BBB_BASE_URL)=' /tmp/zealosh-media-secret.tmp >> .env.staging
       rm -f /tmp/zealosh-media-secret.tmp
   fi

   # Provision Moodle administrator secret file (mode 0600) in shared storage
   mkdir -p /opt/zealosh/shared/secrets && chmod 0700 /opt/zealosh/shared/secrets
   if [ ! -f /opt/zealosh/shared/secrets/moodle_admin_password.txt ]; then
       openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' > /opt/zealosh/shared/secrets/moodle_admin_password.txt
       chmod 0600 /opt/zealosh/shared/secrets/moodle_admin_password.txt
   fi
   ln -sfn /opt/zealosh/shared/secrets secrets

   # Execute Preflight Environment Validator (Asserts zero placeholders, verifies Session Pooler port 5432, zero secret leakage)
   node deploy/validate-staging-env.mjs .env.staging staging
   EOF
   ```

4. **Atomic Symlink Switch to New Release & Service Launch:**
   ```bash
   ssh deployer@<SERVER_1_IP> << 'EOF'
   # Record previous release for atomic rollback
   if [ -L /opt/zealosh/current ]; then
       PREV_RELEASE=$(readlink -f /opt/zealosh/current)
       ln -sfn "$PREV_RELEASE" /opt/zealosh/previous
   fi

   # Switch active release pointer
   ln -sfn "/opt/zealosh/releases/${RELEASE_TAG}" /opt/zealosh/current
   cd /opt/zealosh/current

   # Validate compose config without leaking secrets
   docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml config -q

   # Launch containers
   docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml up -d --build

   # Verify container health & loopback ingress
   docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml ps
   bash infra/scripts/health-diagnostics.sh http://localhost
   EOF
   ```

---

### Phase 7 — Cross-Server Functional Acceptance
*Classification: End-to-End Acceptance Verification*

1. **Verify Next.js Core Hub Ingress:**
   - Open `https://lms.staging.zealosh.com` in browser.
   - Verify green brand palette (`#4f8c4c`), courses catalog, and student login.

2. **Verify Moodle Learning Engine & OIDC SSO:**
   - Open `https://lms.staging.zealosh.com/learn-engine/`.
   - Verify `theme_zealosh` renders with header link back to Core Hub.
   - Click "Log in with Zealosh Core" and verify seamless OIDC single sign-on via `/api/oauth/authorize`, `/api/oauth/token`, and `/api/oauth/userinfo`.

3. **Verify Live Classroom Launch & WebRTC Media (Server 1 $\leftrightarrow$ Server 2):**
   - Instructor launches assigned session from instructor workplace.
   - Student enters live classroom via `/live/[sessionId]`.
   - Verify two-way microphone audio, speaker output, webcam video, and presentation upload on `media.staging.zealosh.com`.

4. **Verify Session Termination Lifecycle & Webhook Ingestion:**
   - Instructor clicks "End Class" in workplace $\rightarrow$ session transitions through `ENDING` to `ENDED` only after provider confirms meeting is not running.
   - BigBlueButton `rap-process-worker` processes recording and dispatches webhook callback to `https://lms.staging.zealosh.com/api/webhooks/bbb/recording`.
   - Verify recording status transitions to `AVAILABLE` on `/learn/[courseId]`.

---

### Phase 8 — Complete Rollback Procedures (Server 1 & Server 2)
*Classification: Emergency Recovery & Rollback*

1. **Server 1 (LMS Core Hub) Complete Rollback:**
   ```bash
   # Execute on Server 1 if health probes fail or regression is detected:
   ssh deployer@<SERVER_1_IP> << 'EOF'
   if [ -L /opt/zealosh/previous ]; then
       PREV=$(readlink -f /opt/zealosh/previous)
       echo "Rolling back Server 1 to: $PREV"
       ln -sfn "$PREV" /opt/zealosh/current
       cd /opt/zealosh/current
       docker compose --env-file .env.staging -f docker-compose.zealosh-platform.yml up -d
       bash infra/scripts/health-diagnostics.sh http://localhost
   else
       echo "No previous release recorded at /opt/zealosh/previous" >&2
       exit 1
   fi
   EOF
   ```

2. **Server 2 (Classroom Media Node) Complete Rollback:**
   ```bash
   # Execute on Server 2 if classroom frontend or media service encounters failure:
   ssh root@<SERVER_2_IP> "bash /opt/zealosh/incoming/activate-classroom-release.sh --rollback"
   ```
   *(Note: This restores the complete previous known-good `/usr/share/bigbluebutton/html5-client` release directory, restores `/etc/bigbluebutton/bbb-html5.yml.bak`, restarts `bbb-html5`, and verifies BBB health).*

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
   - **Client Secret:** `placeholder-not-validated-in-current-build` *(See Security Note below)*
   - **Service Base URL:** `https://lms.staging.zealosh.com` *(Prod: `https://lms.zealosh.com`)*
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

> [!CAUTION]
> **OAuth Secret Model & Security Isolation Invariant:**
> - **Current Runtime Behavior:** The Core Hub token endpoint (`/api/oauth/token`) currently enforces RFC 7636 PKCE (`code_verifier`) and **does NOT validate `client_secret` at runtime**.
> - **Never Use `JWT_SECRET`:** Under no circumstances should `JWT_SECRET` ever be supplied to Moodle or configured as Moodle's client secret. `JWT_SECRET` is the private symmetric key used to sign HTTP session cookies and internal tokens; leaking it to Moodle or entering it in Moodle's database/UI would severely compromise platform session security.
> - **Step B Operational Fix:** Adding dedicated `OAUTH_CLIENT_SECRET` validation (with a separate, dedicated secret completely decoupled from `JWT_SECRET`) is queued for **Step B — Operational Fixes**. Documenting this behavior accurately describes the current codebase and does NOT imply that client-secret validation has been implemented.

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

# 2. Execute installer locally with BBB 4.0 target on Ubuntu 24.04 LTS
chmod 0700 /tmp/bbb-install.sh
sudo bash /tmp/bbb-install.sh \
  -v noble-400 \
  -s media.staging.zealosh.com \
  -e admin@zealosh.com \
  -w
rm -f /tmp/bbb-install.sh
# (Note: deploy/bbb-staging-setup.sh defaults canonically to media.staging.zealosh.com and noble-400; API demo flag -a is excluded for security).

# 3. Apply Zealosh Live Classroom Custom Branding Overlay
cd /opt/zealosh/bbb-custom
sudo bash apply-branding.sh

# 4. Securely Transfer API Secret (Zero Console / Log Leakage)
# The setup script writes the secret to /etc/bigbluebutton/zealosh-secret.env (mode 0600) on Server 2.
# Do NOT run `sudo cat` directly in an interactive shell, which prints the plaintext salt to the terminal and scrollback logs.
# Instead, append it directly into Server 1's /opt/zealosh/.env.staging via SSH pipe without terminal stdout echo:
ssh deployer@<SERVER_2_IP> "sudo cat /etc/bigbluebutton/zealosh-secret.env" | grep -E '^(BBB_SECURITY_SALT|BBB_BASE_URL)=' >> /opt/zealosh/.env.staging
chmod 0600 /opt/zealosh/.env.staging
```

---

## 5. Authoritative Disaster Recovery & Backup Protocol

The platform implements an authoritative decoupled backup strategy across both Supabase cloud databases, host file systems, and media storage:

### A. Dual-Project PostgreSQL Database Backups (`pg_dump`):
Native PostgreSQL logical backups (`pg_dump`) must be performed using direct connections where available, or Session Mode poolers (port 5432). Never use Transaction Mode poolers (port 6543) for backup tools.

1. **Secure Credential Handling via `~/.pgpass`:**
   To guarantee zero password exposure in process lists (`ps aux`), shell history, or logs, credentials are provisioned in an access-restricted `~/.pgpass` file:
   ```bash
   # Create protected .pgpass (mode 0600)
   cat << 'EOF' > ~/.pgpass
   # hostname:port:database:username:password
   db.<project-1-ref>.supabase.co:5432:postgres:postgres:<project-1-db-password>
   db.<project-2-ref>.supabase.co:5432:postgres:postgres:<project-2-db-password>
   # If using Supavisor Session Pooler (port 5432):
   # aws-0-<region>.pooler.supabase.com:5432:postgres:postgres.<project-2-ref>:<project-2-db-password>
   EOF
   chmod 0600 ~/.pgpass
   ```

2. **Project 1: Zealosh LMS Core Database Backup:**
   ```bash
   mkdir -p /opt/zealosh/backups && chmod 0700 /opt/zealosh/backups
   LMS_DUMP="/opt/zealosh/backups/zealosh_lms_core_$(date +%Y%m%d_%H%M%S).dump"

   # Execute pg_dump using direct connection (or session pooler port 5432):
   pg_dump -h "db.<project-1-ref>.supabase.co" -p 5432 -U postgres -d postgres \
       --no-owner --no-privileges --format=custom \
       --file="$LMS_DUMP"

   # Verify dump readability and archive integrity:
   pg_restore --list "$LMS_DUMP" >/dev/null && echo "[PASS] LMS Core backup dump verified"
   sha256sum "$LMS_DUMP" > "${LMS_DUMP}.sha256"
   chmod 0600 "$LMS_DUMP" "${LMS_DUMP}.sha256"
   ```

3. **Project 2: Moodle 5.3 PostgreSQL Database Backup:**
   ```bash
   MOODLE_DUMP="/opt/zealosh/backups/zealosh_moodle_$(date +%Y%m%d_%H%M%S).dump"

   # Put Moodle in maintenance mode before backup to ensure transactional write consistency:
   docker exec zealosh-moodle php /var/www/html/admin/cli/maintenance.php --enable

   pg_dump -h "$MOODLE_DATABASE_HOST" -p 5432 -U "$MOODLE_DATABASE_USER" -d "$MOODLE_DATABASE_NAME" \
       --no-owner --no-privileges --format=custom \
       --file="$MOODLE_DUMP"

   # Disable maintenance mode immediately after dump:
   docker exec zealosh-moodle php /var/www/html/admin/cli/maintenance.php --disable

   # Verify dump readability:
   pg_restore --list "$MOODLE_DUMP" >/dev/null && echo "[PASS] Moodle database backup dump verified"
   sha256sum "$MOODLE_DUMP" > "${MOODLE_DUMP}.sha256"
   chmod 0600 "$MOODLE_DUMP" "${MOODLE_DUMP}.sha256"
   ```

### B. Moodle Persistent File Assets (`moodledata`):
Moodle file assets are stored in Docker volume `moodledata_data` mounted at `/var/moodledata` inside the container. Ephemeral directories (`cache`, `localcache`, `temp`, `trashdir`) are explicitly excluded to maintain consistency and prevent bloated backups.
```bash
MOODLEDATA_BACKUP="/opt/zealosh/backups/moodledata_$(date +%Y%m%d_%H%M%S).tar.gz"

docker run --rm \
    -v moodledata_data:/var/moodledata:ro \
    -v /opt/zealosh/backups:/backup \
    alpine tar -czf "/backup/$(basename "$MOODLEDATA_BACKUP")" \
    --exclude="cache" --exclude="localcache" --exclude="temp" --exclude="trashdir" \
    -C /var/moodledata .

# Verify archive integrity:
tar -tzf "$MOODLEDATA_BACKUP" >/dev/null && echo "[PASS] moodledata backup verified"
sha256sum "$MOODLEDATA_BACKUP" > "${MOODLEDATA_BACKUP}.sha256"
chmod 0600 "$MOODLEDATA_BACKUP" "${MOODLEDATA_BACKUP}.sha256"
```

### C. BigBlueButton Recording Storage (Server 2):
During staging, live classroom recordings are preserved on Server 2 under `/var/bigbluebutton/published/` and `/var/bigbluebutton/recording/raw/`. S3 private storage sync remains explicitly deferred to milestone CP-8.15.

### D. Comprehensive Backup Coverage Matrix:

| Data Source | Project / Host | Primary Path / Endpoint | Backup Method | Retention | Encryption | Integrity & Restore Validation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **LMS Core Database** | Supabase Project 1 | `db.<ref>.supabase.co:5432` | `pg_dump -F c` via direct connection / `.pgpass` | 7 daily / 4 weekly | TLS in transit, AES-256 at rest | `pg_restore --list` validation; disposable schema drill |
| **Moodle Database** | Supabase Project 2 | `db.<ref>.supabase.co:5432` (or Session Pooler `:5432`) | `pg_dump -F c` with Moodle maintenance mode | 7 daily / 4 weekly | TLS in transit, AES-256 at rest | `pg_restore --list` validation; `zealosh_moodle_drill` schema import |
| **Moodle File Data** | Server 1 | Volume `moodledata_data` (`/var/moodledata`) | Read-only tar.gz excluding `cache/temp` | 7 daily | Server-side disk encryption | `tar -tzf` archive integrity check; staging extract test |
| **Classroom Recordings** | Server 2 | `/var/bigbluebutton/published/` | Native BBB local recording storage | Host retention policy | Host volume encryption | Webhook callback playback check; S3 sync deferred (CP-8.15) |
| **Canonical JSON Fallback**| `zealosh-lms` | `data/zealosh-store.json` | Protected local immutable reference | Permanent baseline | Workspace access control | SHA-256 exact byte match assertion (`F1CB59D0...`) |

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
| **4. BigBlueButton Hostname & DNS** | `media.staging.zealosh.com` A-record pointing to Server 2 Public IP | Canonical media hostname. (DNS pending IP assignment; script and template alignment queued in Step B). | `dig +short media.staging.zealosh.com` |
| **5. TLS Certificates & DNS Validation** | Public Let's Encrypt certificates for `lms.staging.zealosh.com` & `media.staging.zealosh.com` | Automated via Certbot / Cloudflare Edge TLS / `bbb-install.sh`. | `openssl s_client -connect lms.staging.zealosh.com:443 -servername lms.staging.zealosh.com` |
| **6. Local SSH Access** | Operator SSH key pair configured locally (`~/.ssh/id_ed25519` or `~/.ssh/id_rsa`) | Public key fingerprinted in `infra/terraform/variables.tf`. | `ssh -i ~/.ssh/id_ed25519 root@<SERVER_IP>` |
| **7. Supabase & PostgreSQL 17** | **Project 1:** `https://yeegsljnjwxdhgzfdnyg.supabase.co` (Active)<br/>**Project 2:** Dedicated PostgreSQL 17 for Moodle (Port 5432 Session Mode) | Project 1 active & verified (206/206 tests green). Project 2 pending operator provisioning approval. | Session Mode port 5432 TCP handshake probe. |
| **8. Secret Isolation & Environment** | Isolated `.env.staging` (0600) + Docker secret `secrets/moodle_admin_password.txt` (0600) | Templates prepared in `.env.staging.example`. Zero passwords printed in logs or committed. | `test -f secrets/moodle_admin_password.txt && stat -c %a secrets/moodle_admin_password.txt` |
| **9. Firewall & Network Ports** | **Server 1:** TCP 22 (SSH), TCP 80 (HTTP), TCP 443 (HTTPS)<br/>**Server 2:** TCP 22, TCP 80, TCP 443, UDP 16384-32768 (WebRTC) | Defined in `infra/terraform/firewalls.tf` and cloud-init manifests. | `ufw status verbose` on target hosts |
| **10. Estimated Infrastructure Cost** | **Server 1 (App):** $84/mo (DigitalOcean `s-4vcpu-16gb`: 4 vCPU, 16GB RAM)<br/>**Server 2 (Media):** $84/mo (DigitalOcean `c-8`: 8 vCPU, 16GB RAM) + $50/mo (500GB NVMe Volume @ $0.10/GB) = $134/mo<br/>**Database (Project 2):** $10–$20/mo (Compute add-on in existing Pro Org) or $0/mo (Free Tier for smoke testing)<br/>**Storage (Cloudflare R2):** ~$0.75/mo (50GB storage, $0 egress) | **Staging Total (Paid DB): ~$228.75 – $238.75 / month**<br/>*(With Free DB smoke test: ~$218.75/mo; +18% GST if applicable: ~$269.93 – $281.73/mo)* | Cloud billing dashboard |
| **11. Backup Storage & Destination** | Local directory `/opt/zealosh/backups` + offsite S3/R2 bucket with 7-day daily retention | Scripted in `infra/scripts/backup-restore-test.sh`. Documented in `BACKUP_AND_RESTORE_RUNBOOK.md`. | `ls -la /opt/zealosh/backups` |
| **12. Deployment Access Privileges** | Root / sudo access on Ubuntu hosts; deployer user in docker group | Defined in `infra/cloud-init/app-server.cloud-init.yaml`. | `id deployer` |

---

## 8. Authoritative Operator-Controlled Staging Deployment Sequence

Follow this rigorous, operator-controlled sequence when deploying onto real staging infrastructure:

### Phase 1: Pre-Deployment Account & DNS Setup
1. Verify cloud provider quota (at least 12 vCPUs, 32GB RAM across 2 Droplets/VMs).
2. Provision DNS A-records in DNS management console:
   - `lms.staging.zealosh.com` -> `[Server 1 Planned Public IP]`
   - `media.staging.zealosh.com` -> `[Server 2 Planned Public IP]`
3. Ensure domain names propagate before attempting Let's Encrypt TLS issuance.

### Phase 2: 10-Step Staging Execution Procedure

> [!IMPORTANT]
> **Execution Status:** **Steps 1–10 are UNEXECUTED.** They require explicit operator authorization, account access, and real cloud resource provisioning. No paid servers or databases have been created.

### Step 1: Review Project & Compute Cost
- **Action:** Review the reconciled cost model ($10–$20/mo compute for Project 2 within existing Pro organization + $84/mo for Server 1 + $134/mo for Server 2 with 500GB SSD NVMe volume; total ~$228.75–$238.75/mo, or ~$218.75/mo with Free DB smoke test).
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


