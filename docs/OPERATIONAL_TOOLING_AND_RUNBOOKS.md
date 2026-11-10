# Zealosh LMS — Operational Tooling, Release Management & Runbooks

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Institution:** Zealosh Training & Consultants, Kollam, Kerala, India  
**Milestone:** ZM-IMPL-09 — Stage B-Prep: Deployment Automation, Infrastructure Tooling & Operational Engineering  
**Classification:** Operational Engineering Runbook & Architecture Reference  
**Deployment Status:** PROHIBITED — Local Engineering & Verification Only  
**Authoritative Store:** PostgreSQL / Supabase Core (`data/zealosh-store.json` canonical protected store)  

---

## 1. Overview & Architecture of Operational Tooling

The Zealosh LMS platform includes a complete, deterministic, zero-external-dependency suite of operational and release automation utilities located in [`deploy/`](file:///c:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/deploy). These tools enable fully verifiable release staging, atomic zero-downtime deployments, instantaneous rollbacks, encrypted backups, migration concurrency locks, security compliance audits, and system service supervision without requiring third-party SaaS agents or paid cloud services.

```
deploy/
├── cloud-init/
│   ├── server1-app.cloud-init.yaml       # Ubuntu 24.04 LTS bootstrap for Application Server
│   └── server2-media.cloud-init.yaml     # Ubuntu 22.04 LTS bootstrap for BigBlueButton Media Server
├── nginx/
│   ├── zealosh-lms.nginx.conf            # Server 1 Reverse Proxy with Cloudflare IP & Rate Limiting
│   └── zealosh-vc.nginx.conf             # Server 2 BigBlueButton & WebRTC Reverse Proxy
├── systemd/
│   ├── zealosh-lms.service               # Systemd service unit for Next.js standalone server
│   ├── zealosh-worker.service            # Systemd service unit for outbox dispatch worker
│   └── zealosh-worker.timer              # Systemd timer unit (30s recurring execution)
├── package-deployment-artifact.mjs       # Deterministic TAR/GZ packager with SHA-256 manifest
├── verify-deployment-artifact.mjs        # Deployment artifact validator
├── release-manager.mjs                   # Atomic release deployment, symlink switch & rollback engine
├── backup-manager.mjs                    # Encrypted AES-256-GCM backup, verify, restore & prune engine
├── audit-security-config.mjs             # Pre-flight security headers, CSP, and secret hygiene auditor
├── ecosystem.config.js                   # PM2 cluster/fork supervisor configuration
├── worker-runner.mjs                     # Outbox worker CLI entry point
└── simulate-local-deployment.mjs         # End-to-end local deployment and rollback simulation runner
```

---

## 2. Release Lifecycle & Deployment Automation

### 2.1 Artifact Packaging
The deployment packager collects the standalone Next.js build output, public static assets, database migrations (`supabase/migrations`), systemd service templates, and deployment scripts into a deterministic tarball:

```bash
# Package a release bundle
node deploy/package-deployment-artifact.mjs
```

**Packager Guarantees:**
- Deterministic file ordering and standardized Unix timestamps (epoch 0) for byte-identical checksum reproducibility.
- Inclusions: `.next/standalone`, `.next/static`, `public/`, `supabase/migrations/`, `deploy/systemd/`, `package.json`.
- Output: `artifacts/zealosh-lms-<version>-<timestamp>.tar.gz` and accompanying `.sha256` checksum file.

### 2.2 Release Staging & Deployment
The release manager (`deploy/release-manager.mjs`) executes zero-downtime releases on the target server:

```bash
# Programmatic deployment via Node.js
import { deployRelease } from './deploy/release-manager.mjs';

const result = deployRelease({
  artifactPath: '/var/www/zealosh/artifacts/zealosh-lms-v1.0.0.tar.gz',
  baseDir: '/var/www/zealosh',
  targetVersion: '1.0.0',
  expectedChecksum: 'sha256_hash_here',
  sharedEnvPath: '/etc/zealosh/staging-secrets.env',
  skipEnvValidation: false
});
```

**Step-by-Step Execution Sequence:**
1. **Concurrency Lock Acquisition:** Acquires an exclusive file lock (`shared/release.lock`) with a 3-minute TTL to prevent concurrent or interleaved deployments.
2. **Checksum & Integrity Verification:** Re-hashes the artifact and validates against the provided `.sha256` manifest.
3. **Extraction to Isolated Directory:** Unpacks into `/var/www/zealosh/releases/release-<version>-<timestamp>`.
4. **Shared Environment & Uploads Symlinking:** Creates symbolic links from `shared/.env` and `shared/uploads/` into the newly extracted release directory.
5. **Environment Configuration Validation:** Invokes typed environment loader (`src/lib/config.ts`) to ensure all critical keys (`JWT_SECRET >= 32 chars`, valid URLs, proper database mode) are verified before switching traffic.
6. **Atomic Symlink Switching:** Uses `setAtomicSymlink` to update `/var/www/zealosh/current` atomically (via junction/rename on Linux and cross-platform fallback pointer on Windows).
7. **Audit Trail Logging:** Appends a structured `DEPLOYMENT_SUCCESS` record to `/var/www/zealosh/shared/deployment-history.json`.

---

## 3. Automated Rollback Procedures

If post-deployment synthetic probes, smoke tests, or canary health monitors detect degraded performance or errors, the release manager supports instant, one-command rollback to the prior verified release:

```bash
import { rollbackRelease } from './deploy/release-manager.mjs';

const rollback = rollbackRelease({
  baseDir: '/var/www/zealosh'
});
console.log(`Rolled back to release: ${rollback.previousRelease}`);
```

**Rollback Characteristics:**
- **Zero Build Time:** Points the atomic symlink back to the previously active release directory in `< 50ms`.
- **Pre-Rollback Validation:** Verifies that the previous release directory exists and contains valid application files.
- **Audit Logging:** Records a `ROLLBACK_SUCCESS` event in `deployment-history.json` containing the initiating user/process, timestamp, and target release identifier.

---

## 4. Database Migration Governance & Concurrency Locks

To prevent concurrent deployment pipelines or out-of-order DDL execution against PostgreSQL / Supabase, the deployment tooling enforces file-level and database-level migration governance:

### 4.1 Migration Lock
```bash
import { acquireMigrationLock, releaseMigrationLock } from './deploy/release-manager.mjs';

const lock = acquireMigrationLock('/var/www/zealosh/shared/migration.lock', 300000);
if (!lock.acquired) {
  console.error(`Blocked: ${lock.reason}`);
  process.exit(1);
}

try {
  // Execute database migrations
} finally {
  releaseMigrationLock('/var/www/zealosh/shared/migration.lock');
}
```

### 4.2 Pending Migration Detection
Before applying any migration or switching traffic, `checkPendingMigrations` inspects `supabase/migrations/` and reconciles against applied migrations recorded in PostgreSQL:

```bash
import { checkPendingMigrations } from './deploy/release-manager.mjs';

const audit = checkPendingMigrations('supabase/migrations', appliedMigrationList);
if (audit.pendingCount > 0) {
  console.log(`Pending migrations detected: ${audit.pending.join(', ')}`);
}
```

---

## 5. Background Worker & Concurrency Management

Zealosh LMS executes asynchronous transactional events (email outbox notifications, admission workflows, exam status transitions) using an idempotent outbox pattern.

### 5.1 Authoritative Supervisor Operating Model
To eliminate process duplication and guarantee that competing supervisors can never run overlapping dispatchers:
- **Authoritative Supervisor:** **Systemd** (`zealosh-worker.service` triggered by `zealosh-worker.timer` every 30 seconds) is the **authoritative host supervisor** on Ubuntu 24.04 LTS. It enforces kernel-level cgroups, strict sandboxing (`ProtectSystem=strict`, `NoNewPrivileges=true`), and auto-restart on boot.
- **Alternative Supervisor:** **PM2** (`deploy/ecosystem.config.js`) is retained strictly as an optional developer/local process supervisor.
- **Mutual Exclusion & Conflict Preflight Check:** `deploy/worker-runner.mjs` enforces an atomic PID lockfile (`acquireWorkerProcessLock`). If another supervisor or background process is already running, the new process logs a preflight conflict notice and exits cleanly with code 0 without racing.
- **Signal Handling & Graceful Shutdown:** `worker-runner.mjs` traps `SIGTERM` and `SIGINT`, completes in-flight work, cooperatively releases claimed jobs, removes the PID lockfile, and exits cleanly.
- **Self-Healing Stale Lease Recovery:** At the start of every dispatch batch, `EmailDispatchWorker.claimAndDispatchBatch` automatically invokes `recoverStaleLeases()`, resetting any expired leases (`now - lockedAt > leaseTimeoutMs`) left by crashed workers back to `RETRY_PENDING`.
- **Dead Letter Handling:** Jobs exceeding `maxAttempts` (default 5) automatically transition to `FAILED` with `errorClassification = 'PERMANENT_REJECTION'`, preventing poison-pill events from cycling endlessly.

```javascript
// deploy/worker-runner.mjs — Process Preflight & Signal Handling
const lock = acquireWorkerProcessLock(lockFilePath, supervisor);
if (!lock.acquired) {
  console.log(`[Worker Notice] ${lock.reason}`);
  process.exit(0);
}
```

---

## 6. Reverse Proxy & Network Hardening (Nginx)

Nginx configurations for Server 1 (`deploy/nginx/zealosh-lms.nginx.conf`) and Server 2 (`deploy/nginx/zealosh-vc.nginx.conf`) are configured with production-grade security standards:

- **Cloudflare Real IP Restoration & Anti-Spoofing:** Restores actual client IP addresses from `CF-Connecting-IP` across **all official Cloudflare IPv4 and IPv6 CIDR blocks** (e.g. `173.245.48.0/20`, `104.16.0.0/13`, `2400:cb00::/32`, `2606:4700::/32`, `2a06:98c0::/29`). Direct connections from untrusted IP addresses have `CF-Connecting-IP` ignored by Nginx's `real_ip` module, preventing client IP spoofing.
- **Strict Rate Limiting Zones:**
  - `zealosh_api_limit`: 30 requests/sec per IP (`$binary_remote_addr`) with burst of 50.
  - `zealosh_login_limit`: 10 requests/minute per IP with burst of 5 for authentication endpoints.
- **TLS 1.3 Strict Ciphers:** Disables legacy SSLv3, TLS 1.0, 1.1, and insecure CBC ciphers.
- **WebSocket Upgrade:** Native reverse proxy support for real-time WebRTC and socket notifications.
- **Hardened HTTP Headers:**
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 7. Backup, Verification, Restoration & Pruning

The backup manager (`deploy/backup-manager.mjs`) provides autonomous, verifiable backup operations without external dependencies:

```bash
# 1. Create an unencrypted backup archive
node deploy/backup-manager.mjs backup --target /var/www/zealosh/backups

# 2. Create an AES-256-GCM encrypted backup archive
node deploy/backup-manager.mjs backup --target /var/www/zealosh/backups --key <32-byte-hex-key>

# 3. Verify backup archive integrity
node deploy/backup-manager.mjs verify --archive /var/www/zealosh/backups/zealosh-backup-xxx.tar.gz

# 4. Prune old backups older than 14 days
node deploy/backup-manager.mjs prune --target /var/www/zealosh/backups --days 14
```

**Cryptographic Architecture & Restore Safety:**
- **Encryption:** AES-256-GCM authenticated encryption using a 12-byte cryptographically random IV (`crypto.randomBytes(12)`), 16-byte random salt, and 100,000-iteration PBKDF2 key derivation.
- **Two-Stage Atomic Restore:** Files are extracted and validated in an isolated staging folder (`/tmp/zealosh-restore-staging-xxxx`) before writing to the target directory. If decompression, GCM tag verification, or manifest checks fail, the staging directory is purged and the target remains completely untouched.
- **Path Traversal Sandboxing:** All archive entry paths are normalized via `path.normalize()`, and destinations escaping the sandbox or resolving to `data/zealosh-store.json` are immediately aborted.
- **Recovery Audit Evidence:** Successful restoration generates a verifiable `recovery-audit.json` in the destination directory recording timestamp, archive SHA-256, and restored file catalog.
- **CRITICAL SAFEGUARD:** The restore engine explicitly refuses to overwrite or touch the canonical protected historical store (`data/zealosh-store.json`), preserving institutional data continuity.

---

## 8. Health Diagnostics & Observability API

Zealosh LMS exposes a multi-tier health probe endpoint at `/api/health`:

### 8.1 Liveness Probe (`GET /api/health?type=liveness`)
- Returns `200 OK` in `< 5ms`.
- Validates that the Node.js event loop and HTTP server are accepting connections.
- Used by load balancers and container orchestrators for process restart decisions.

### 8.2 Readiness Probe (`GET /api/health?type=readiness`)
- Performs deep connectivity probes against the PostgreSQL / Supabase authoritative database, with a 2,000ms bounded timeout (`runWithTimeout`).
- Evaluates transactional outbox queue depth (`services.outbox = 'HEALTHY' | 'DEGRADED'`).
- Optional integrations (Moodle, BigBlueButton, Ollama) report `UNCONFIGURED` when idle, which **does not degrade** overall application health.
- Emits distributed correlation header `x-correlation-id` on every response.
- Returns comprehensive diagnostic payload:
  ```json
  {
    "status": "HEALTHY",
    "probeType": "readiness",
    "timestamp": "2026-11-10T09:15:00.000Z",
    "correlationId": "corr-1731210900000-a1b2c3d4",
    "services": {
      "application": "HEALTHY",
      "database": "HEALTHY",
      "outbox": "HEALTHY",
      "queueDepth": 0
    }
  }
  ```

---

## 9. Security Hardening & Pre-Flight Compliance Audit

Before staging or production releases, execute the automated security audit script:

```bash
node deploy/audit-security-config.mjs
```

**Security Auditing Checks:**
1. **Content Security Policy (CSP):** Confirms that `unsafe-eval` is strictly forbidden in production Next.js configurations.
2. **Security Headers:** Validates HSTS (`max-age >= 31536000`), `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`.
3. **Webhook Signatures:** Verifies that Razorpay and Stripe webhook handlers mandate HMAC signature validation.
4. **Secret Hygiene:** Scans source code and deployment manifests to guarantee zero private keys, certificates, or plaintext credentials exist in repository files.

---

## 10. Local End-to-End Simulation Runner

To verify the entire release, deployment, health check, and rollback sequence on local development machines without incurring cloud costs or modifying network configurations:

```bash
node deploy/simulate-local-deployment.mjs
```

**Simulation Lifecycle Phases:**
1. `PHASE_0_STORE_BASELINE_CHECK`: Validates `data/zealosh-store.json` hash and size.
2. `PHASE_1_ENVIRONMENT_VALIDATION`: Tests typed config validation.
3. `PHASE_2_MIGRATION_LOCK_AND_AUDIT`: Exercises lock contention and pending migration detection.
4. `PHASE_3_ARTIFACT_PACKAGING`: Builds deterministic release tarball.
5. `PHASE_4_RELEASE_1_DEPLOYED`: Unpacks release 1.0.0 and points atomic symlink.
6. `PHASE_5_HEALTH_PROBE_PASSED`: Probes deployed release files and descriptors.
7. `PHASE_6_RELEASE_2_DEPLOYED`: Unpacks release 1.0.1 and updates atomic symlink.
8. `PHASE_7_CANARY_ROLLBACK_VERIFIED`: Simulates fault and executes instant rollback to 1.0.0.
9. `PHASE_8_POST_VERIFICATION_STORE_INTACT`: Proves protected store remains 100% byte-identical.

