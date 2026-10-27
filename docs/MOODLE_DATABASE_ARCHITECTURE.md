# Zealosh Learning Engine — Moodle Database Architecture & Schema Isolation Specification

**Document Version:** 2.1.0 (Dual-Supabase Production Architecture & Connection Budget)  
**Date:** October 25, 2026  
**Status:** **AUTHORITATIVE ARCHITECTURAL BASELINE (PREPARED FOR STAGING VERIFICATION)**  
**Target Releases:** Moodle 5.3 LTS, PHP 8.3, PostgreSQL 17, Redis 7  
**Related Documents:** [docs/DATA_OWNERSHIP.md](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/DATA_OWNERSHIP.md), [docs/ARCHITECTURE.md](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/ARCHITECTURE.md), [docs/DEPLOYMENT_RUNBOOK.md](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/DEPLOYMENT_RUNBOOK.md), [docs/BACKUP_AND_RESTORE_RUNBOOK.md](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/BACKUP_AND_RESTORE_RUNBOOK.md)

---

## 1. Executive Summary & Approved Architecture

In accordance with enterprise platform requirements, **Supabase PostgreSQL is the established database standard for both Zealosh Core Hub and the Zealosh Learning Engine (Moodle 5.3 LTS)**.

To prevent schema pollution, connection starvation, and coupled backup risks, the platform strictly uses **two separate, isolated Supabase projects**:

1. **Supabase Project 1 (Zealosh Core Hub):**
   - **Endpoint:** `https://yeegsljnjwxdhgzfdnyg.supabase.co`
   - **Data Domain:** Zealosh-owned application models (`courses`, `batches`, `enrollments`, `exam_attempts`, `certificates`, `system_roles`, `audit_logs`).
   - **Access Mechanism:** PostgREST REST API over HTTPS + Direct Edge RPCs with Row-Level Security (RLS).
2. **Supabase Project 2 (Zealosh Learning Engine — Moodle 5.3 LTS):**
   - **Endpoint:** Dedicated Supabase PostgreSQL 17 Project (`aws-0-[region].pooler.supabase.com:5432` Session Mode).
   - **Data Domain:** Moodle's 450+ tables (`mdl_*`), SCORM packs, forum posts, gradebook calculations, and course module completion states.
   - **Access Mechanism:** Native PHP PostgreSQL driver (`pdo_pgsql`/`pgsql`) with SSL encryption (`sslmode=require` or `sslmode=verify-full`).
   - **Connection Mode:** **Session Mode Pooler (Port 5432)**.

```mermaid
graph TD
    Client["Learner / Instructor / Admin Browser & PWA"]
    
    subgraph Edge["Unified Edge Gateway (lms.zealosh.com)"]
        Nginx["Nginx Reverse Proxy (:80 / :443)"]
    end

    subgraph Application_Tier["Staging / Production Application Host (Ubuntu 22.04 LTS)"]
        NextHub["Zealosh Core Hub (Next.js 14 Container :3000)"]
        MoodleEngine["Zealosh Learning Engine (Moodle 5.3 LTS / PHP 8.3 Container :80)"]
        CronRunner["Zealosh Moodle Dedicated Cron Runner (Container)"]
        RedisCache["Redis 7 (Session & Application Cache :6379)"]
    end

    subgraph Supabase_Cloud["Managed Supabase Cloud (Strictly Isolated Projects)"]
        SupabaseCore[("Supabase Project 1: Core Hub<br/>(Courses, Exams, Enrollments, RBAC)")]
        SupabaseMoodle[("Supabase Project 2: Moodle Engine<br/>(Dedicated PostgreSQL 17 / 450+ mdl_* tables)")]
    end

    Client -->|HTTPS| Nginx
    Nginx -->|/ | /courses | /exams | /student | /admin| NextHub
    Nginx -->|/learn-engine/*| MoodleEngine
    
    NextHub -->|REST / RPC (TLS)| SupabaseCore
    NextHub -->|Session / Rate Cache (DB 0)| RedisCache
    
    MoodleEngine -->|TCP Port 5432 Session Pooler (TLS)| SupabaseMoodle
    CronRunner -->|TCP Port 5432 Session Pooler (TLS)| SupabaseMoodle
    MoodleEngine -->|Distributed Session Cache (DB 1)| RedisCache
    MoodleEngine -.->|Universal Cache MUC (DB 2)| RedisCache
    
    MoodleEngine -.->|OIDC Single Sign-On / Tokens| NextHub
```

---

## 2. Supabase Connection Strategy for Moodle's Persistent PHP Runtime

Supabase provides two distinct connection mechanisms through its connection pooler (Supavisor) and direct PostgreSQL endpoints. **It is critical to distinguish Direct PostgreSQL connectivity from Supavisor Session Pooling**, as their hostnames, routing formats, and network requirements differ fundamentally:

### Comprehensive Connection Mode Comparison:

| Connection Mode | Hostname Format | Port | Username Format | Network / IP Support | Moodle Compatibility | Architectural Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Supavisor Session Pooler (RECOMMENDED)** | `aws-0-[region].pooler.supabase.com` | **5432** | `postgres.[project-ref]` *(tenant suffix required)* | **Dual-Stack (IPv4 & IPv6)** | **100% Compatible** (Prepared statements & session GUCs preserved) | **PRIMARY SELECTION for standard IPv4 cloud hosts** (DigitalOcean, Hetzner, AWS EC2 IPv4, Linode). |
| **Direct PostgreSQL Connection** | `db.[project-ref].supabase.co` | **5432** | `postgres` *(no suffix)* | **IPv6 Only** *(unless paid IPv4 Add-on purchased)* | **100% Compatible** (Direct TCP socket to Postgres 17) | **SECONDARY SELECTION:** Requires dual-stack IPv6 host or paid add-on. Will fail on IPv4-only hosts. |
| **Supavisor Transaction Pooler** | `aws-0-[region].pooler.supabase.com` | **6543** | `postgres.[project-ref]` | Dual-Stack (IPv4 & IPv6) | **BROKEN / INCOMPATIBLE** | **STRICTLY FORBIDDEN:** Transaction pooling drops prepared statements and session state between queries. |

### Technical Rationale: Why Transaction Mode (Port 6543) Breaks Moodle:
1. **Named Prepared Statements:** Moodle's native PostgreSQL driver (`dml/pgsql_native_moodle_database.php`) relies on prepared statements (`PREPARE ...`, `EXECUTE ...`). In Transaction Mode, queries in the same HTTP request execute against different backend connections, triggering fatal `ERROR: prepared statement "pdo_stmt_..." does not exist`.
2. **Session-Level GUC Variables:** Moodle configures session-level variables (`SET client_encoding`, `SET standard_conforming_strings`, `SET timezone`). In Transaction Mode, these settings leak or reset between individual queries within a request.
3. **Advisory Locks:** Moodle uses PostgreSQL advisory locks for cache locks and cron task synchronization. Advisory locks are bound to backend connection sessions; transaction pooling drops them prematurely, leading to race conditions.

### Comprehensive Moodle Connection Budget Analysis:

To avoid connection exhaustion, all potential concurrent database clients on Supabase Project 2 are calculated:

1. **Apache HTTP Web Workers:**
   - Managed by MPM prefork: `MaxRequestWorkers 30`.
   - Each active worker serving a PHP request holds up to 1 connection (`dbpersist => false`).
   - Peak Web Demand: **30 client connections**.
2. **Dedicated Background Cron Service (`zealosh-moodle-cron`):**
   - Single-threaded task runner executing `admin/cli/cron.php`.
   - Normal Demand: **1 client connection** (up to **3** during parallel core tasks).
3. **Administrative & Maintenance Operations:**
   - Schema upgrades (`admin/cli/upgrade.php`), maintenance scripts: **1 - 2 connections**.
   - Logical database dumps (`pg_dump` via custom custom format): **1 connection**.
4. **Core Hub Footprint on Project 2:**
   - **0 connections** (Core Hub connects exclusively to Supabase Project 1).

**Total Simultaneous Peak Client Demand:** **33 - 36 connections**.

#### Evaluation Against Supabase Capacity Limits:
- **Direct Connection Limit (Micro / Small Tiers):** Typically ~60 total connections (~45 usable after Supabase internal reservations). Peak demand of 36 clients consumes **80%** of direct capacity.
- **Supavisor Session Mode Pooler (Port 5432):**
  - Accepts hundreds of incoming client connections.
  - However, Supavisor's *allocated backend pool size* to PostgreSQL on smaller compute plans may default to 15-25 backend connections.
  - When 30+ client requests arrive simultaneously, Supavisor session mode holds and queues excess client queries until backend slots open.
- **Safety Invariant:** `MaxRequestWorkers 30` establishes a ceiling on Apache web concurrency, but **does NOT independently guarantee compliance with Supabase connection limits** unless the target Supabase project's compute plan and Supavisor pool size are sized for at least 35 connections.
- **Classification:** **PREPARED (CEILING CONFIGURED; REQUIRES LIVE STAGING BENCHMARK ONCE PROJECT 2 IS PROVISIONED)**.

---

## 3. End-to-End TLS Verification & Redis Isolation Analysis

### PostgreSQL TLS Verification Strategy:
- **Default (`sslmode=require`):**
  - Encrypts all database traffic in transit via TLS.
  - Prevents passive wiretapping and network eavesdropping.
  - Does *not* verify the server's X.509 certificate against a Certificate Authority (CA) or check hostname matching.
- **Strict Verification (`sslmode=verify-full`):**
  - Encrypts traffic, verifies certificate validity against trusted root CA, and validates hostname identity.
  - **Supavisor Pooler Compatibility:** Hostnames (`aws-0-[region].pooler.supabase.com`) use certificates issued by public CAs (Amazon Trust Services / Let's Encrypt). Verified natively by the Debian CA bundle (`/etc/ssl/certs/ca-certificates.crt`).
  - **Direct Connection Compatibility:** Direct endpoints (`db.[project-ref].supabase.co`) require downloading Supabase's `prod-ca-2021.crt` and configuring `MOODLE_DATABASE_SSLROOTCERT=/etc/ssl/certs/supabase-prod-ca.crt`.
  - The runtime entrypoint supports both modes seamlessly via `MOODLE_DATABASE_SSLMODE` and `MOODLE_DATABASE_SSLROOTCERT`.

### Real Redis Isolation Status:
- **Session Layer (Active):** Configured in `config.php` to use Redis **Database 1** (`session_redis_database = 1`, `session_redis_prefix = "zealosh_moodle_sess_"`). Offloads active user sessions completely from PostgreSQL.
- **Core Hub Layer (Active):** Reserved for Redis **Database 0** (`zealosh_hub_*`).
- **Moodle Universal Cache (MUC) Layer (Architecture & Status):**
  - Moodle core stores cache definitions in `moodledata/muc/config.php`. Out-of-the-box, MUC defaults to local persistent disk storage (`/var/moodledata/cache`).
  - An automated configuration script [deploy/moodle/configure-redis-muc.php](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/deploy/moodle/configure-redis-muc.php) is provided to register a Redis store instance on **Database 2** (`zealosh_moodle_muc_`).
  - **Evidence Invariant:** We do not claim zero collision risk based on paper documentation. MUC remains on persistent local disk until the configuration script is executed against an initialized Moodle instance on staging. At no point do Moodle sessions or caches touch Core Hub's Database 0.

---

## 3. Moodle 5.3 LTS & PostgreSQL 17 Compatibility

- **Moodle Version:** **Moodle 5.3 LTS** (Official Long-Term Support release).
- **PHP Baseline:** **PHP 8.3** (Mandatory for Moodle 5.3; PHP 8.2 is deprecated/unsupported).
- **Database Baseline:** **PostgreSQL 17** (Supabase native engine).
- **Container Strategy:**
  - Bitnami's commercial shift to "Bitnami Secure Images" and developer-only example Compose manifests makes third-party Bitnami images unsuitable for production.
  - The platform utilizes a hardened multi-stage container: [deploy/moodle/Dockerfile](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/deploy/moodle/Dockerfile) built on the official `php:8.3-apache` image.
  - Installs official `postgresql-client-17`, `libpq-dev`, `gd` (freetype/jpeg), `intl`, `zip`, `soap`, `opcache`, `redis`, and official Moodle 5.3 LTS source.
  - Entrypoint script dynamically generates `config.php` injecting Supabase SSL parameters without manual installer steps.

### 3.2 CLI Installer Flags, Shell Safety & Routing Enforcement:
- **Installer Script:** Pinned Moodle 5.3 source verifies `admin/cli/install_database.php` as the authoritative installer when `config.php` pre-exists.
- **Flag Verification:** Supports `--lang`, `--adminuser`, `--adminpass`, `--adminemail`, `--fullname`, `--shortname`, `--summary`, `--supportemail`, `--noreplyemail`, `--agree-license`.
- **Strictly No `--non-interactive` on `install_database.php`:** Unlike `install.php`, `install_database.php` is strictly unattended by design; passing `--non-interactive` triggers a fatal `cliunknowoption` exception.
- **Fail-Early Password Check:** Initial boot halts immediately with exit code 1 if `MOODLE_ADMIN_PASSWORD` is empty, preventing containers from hanging or entering corrupt states.
- **Shell Argument Safety:** Privilege dropping via `run_as_moodle_user` helper (`runuser -u www-data -- php "$@"`) ensures credentials with spaces, `$`, `"`, `'`, `\`, `!`, `#`, `%`, `&`, `*` are passed as raw `argv` tokens without secondary subshell interpretation.
- **Upgrade Decoupling:** Decoupled from first install; production upgrades execute `admin/cli/upgrade.php --non-interactive` with `--allow-unstable` strictly omitted.
- **Apache Web-Root Routing:** Apache `DocumentRoot` points to `/var/www/html/public` with `DirectoryIndex index.php` and `FallbackResource /r.php`. `config.php`, core libraries, and `/var/moodledata` (0770) remain strictly outside the HTTP root.

---

## 4. Theme & Plugin Compatibility Matrix

- **Theme Package:** `theme_zealosh` ([moodle-custom/theme_zealosh/](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/moodle-custom/theme_zealosh/)).
  - Extends parent theme `boost` (supported continuously in Moodle 5.x).
  - Version metadata updated to `$plugin->version = 2026102600; $plugin->requires = 2024042200;`.
  - Zero deprecated SCSS variables; uses official Zealosh brand tokens (`#4f8c4c`, `#3a7536`, `#252c41`).
  - Renders authentic Zealosh horizontal mark and round emblem.
- **OIDC Single Sign-On:**
  - Uses Moodle Core `auth_oauth2` service discovery.
  - Directly maps Zealosh Core Hub endpoints (`/.well-known/openid-configuration`, `/api/oauth/authorize`, `/api/oauth/token`, `/api/oauth/userinfo`).
  - Fully tested against PKCE S256 and `application/x-www-form-urlencoded` token exchange.

---

## 5. Offline Fallback Architecture (Local Offline Development Only)

For environments completely isolated from the Internet without cloud connectivity, an optional local PostgreSQL 17 container stack is provided at:
- Manifest: [deploy/postgres/docker-compose.local-postgres-fallback.yml](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/deploy/postgres/docker-compose.local-postgres-fallback.yml)
- Initialization SQL: [deploy/postgres/init-moodle-db.sql](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/deploy/postgres/init-moodle-db.sql)

This container is **excluded** from default production and staging deployment, ensuring 100% adherence to the user's Supabase architecture.

---

## 6. Finalized Architecture Decision: Option A — Dedicated Supabase Project 2 for Moodle

In accordance with architectural review on October 27, 2026, **Option A (Dedicated Supabase Project 2)** is approved as the authoritative architectural direction for the Zealosh LMS staging environment, subject to the compatibility, security, and verification gates below.

> [!IMPORTANT]
> **Planning Decision Only:** This selection approves the staging configuration and deployment runbook. It does **NOT** authorize creating a paid project, altering billing, provisioning cloud infrastructure, modifying DNS records, or deploying to a live host without prior operator authorization.
>
> **Core Hub Invariant:** The existing **Zealosh Core Hub database (Supabase Project 1: `https://yeegsljnjwxdhgzfdnyg.supabase.co`) remains 100% separate, untouched, and unchanged.**

### 6.1 Architectural Rationale: Why Option A for Zealosh Staging
1. **Absolute Schema & Domain Separation:** Moodle 5.3 installs over 450 core tables (`mdl_*`), heavy stored procedures, gradebook algorithms, and SCORM tracking tables. Placing Moodle in Project 2 completely isolates it from Zealosh-owned business models (`courses`, `batches`, `enrollments`, `exam_attempts`, `certificates`, `system_roles`, `audit_logs`) in Project 1.
2. **Unified Cloud Ecosystem:** Leverages the existing Supabase organization, operational runbooks, and developer familiarity without introducing a third-party managed database provider (e.g. AWS RDS or DigitalOcean Managed Databases) for staging.
3. **Managed High-Availability & Backups:** Provides automated daily cloud snapshots, automated OS and PostgreSQL minor patching, point-in-time recovery capabilities, and encrypted storage at rest out of the box.
4. **Strong Security Boundary via Data API Disablement:** Because Moodle is a self-contained monolithic PHP application connecting via standard PostgreSQL sockets, Supabase's auto-generated PostgREST HTTP Data API can be **completely disabled**, eliminating public REST attack surface entirely.

### 6.2 Upstream Compatibility & Version Requirements
- **PostgreSQL 17.0+ Requirement:** Upstream Moodle 5.3 strictly mandates **PostgreSQL 17 or later** and **PHP 8.3 or later**. Earlier versions (PostgreSQL 15 or 16) fail Moodle's environment sanity check.
- **Operator Selection Gate:** Supabase supports both PostgreSQL 15 and PostgreSQL 17. When creating Project 2, the operator **MUST explicitly select PostgreSQL 17** in the Supabase Dashboard project creation wizard.
- **PHP Extensions & Driver:** Validated against [`deploy/moodle/Dockerfile`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/deploy/moodle/Dockerfile), which installs official `postgresql-client-17`, `libpq-dev`, `pdo_pgsql`, and `pgsql` compiled against PHP 8.3.

### 6.3 Security Boundary: Disabling the Data API on Project 2
Unlike the Zealosh Core Hub (Project 1), which relies on Supabase's PostgREST API for authenticated web clients and edge functions, Moodle connects exclusively via standard database sockets. Supabase's auto-generated Data API is completely unneeded for Project 2.

Disabling the Data API removes the auto-generated REST/GraphQL endpoints at the API gateway level, regardless of database permissions or RLS policies. This represents the strongest possible defense against unintended public table exposure.

#### Operator Procedure to Disable Data API (Project 2 Only):
1. **Supabase Dashboard Execution:**
   - Log into the Supabase Dashboard and select **Project 2 (Zealosh Learning Engine / Moodle)**.
   - Navigate to: **Project Settings** > **API**.
   - Under **Data API Settings**, toggle **Data API** to **OFF** (Disabled).
   - Confirm that `https://[moodle-project-ref].supabase.co/rest/v1/` returns `404 Not Found` or `503 Service Unavailable`.
2. **Crucial Safety Rule:**
   - **DO NOT disable the Data API on Project 1 (Zealosh Core Hub).** Project 1 actively requires PostgREST for client authentication and application data persistence.
3. **Defense-in-Depth Database Privilege Hardening (SQL Editor):**
   Even with the Data API disabled at the gateway, execute the following SQL in Project 2's SQL Editor to enforce least privilege at the PostgreSQL schema layer:
   ```sql
   -- Defense-in-depth: Revoke all public schema permissions from API roles
   REVOKE USAGE ON SCHEMA public FROM anon, authenticated;
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
   REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
   ```
4. **Database Authentication & Roles:**
   - Connect using a dedicated database role (e.g. `postgres` with a strong, cryptographically generated password, or a dedicated `moodle_user`).
   - Moodle requires DDL privileges (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, `DROP TABLE`) during initial installation and version upgrades (`admin/cli/upgrade.php`), and standard DML privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) during runtime.
   - Database credentials must **never** be committed to source control or printed in console logs.

### 6.4 Connection Mode & Supavisor Session-Mode Pooling
- **Approved Connection Mode:** **Session-Mode Pooler (Port 5432)**
  - Endpoint: `aws-0-[region].pooler.supabase.com`
  - Port: **5432**
  - Username: `postgres.[project-ref]` *(tenant suffix is required by Supavisor for routing)*
  - SSL Mode: `sslmode=require` (or `verify-full`)
  - Network Routing: Session mode pooler endpoints support **dual-stack (IPv4 & IPv6)** natively at **$0 extra cost**. This enables standard IPv4 cloud hosts (DigitalOcean, AWS, Hetzner) to connect without requiring a dedicated IPv4 add-on.
- **Strictly Forbidden: Transaction Mode Pooler (Port 6543):**
  - Transaction-mode pooling drops prepared statements (`pdo_stmt_*`), resets session GUCs (`SET timezone`), and discards PostgreSQL advisory locks used by Moodle cache locks and cron tasks. It is **STRICTLY PROHIBITED** for Moodle.
- **Direct Connection (`db.[ref].supabase.co:5432`):**
  - Direct connection to port 5432 is IPv6-only by default on Supabase. It will fail on IPv4-only cloud hosts unless a paid IPv4 add-on ($4/mo) is purchased. Hence, Session-Mode Pooler (Port 5432) is the primary approved endpoint.

### 6.5 Connection Budget & Concurrency Sizing
- **Apache MPM Prefork:** Capped at `MaxRequestWorkers 30`. Each active worker serving a PHP web request consumes up to 1 database connection (`dbpersist => false`).
- **Background Cron (`zealosh-moodle-cron`):** 1–3 connections during scheduled tasks.
- **Maintenance / Admin / Dumps:** 1–2 connections during upgrades or `backup-restore-test.sh` runs.
- **Peak Client Concurrency:** **33 – 35 concurrent connections.**
- **Supavisor Sizing Requirement:** The chosen compute size for Project 2 must support a Supavisor backend pool allocation of at least 35 connections to prevent query latency queuing during peak student traffic.

### 6.6 Accurate Staging Cost Breakdown & Pricing Assumptions
In Supabase's organization-based billing model, an organization pays a base subscription (e.g. Pro Plan at $25/month), which includes $10/month in compute credits (covering up to 2 Micro compute instances).

Adding a dedicated Project 2 within an existing paid organization does **NOT** duplicate the base $25/month subscription fee. Instead, costs are billed on an **incremental usage and compute basis**:

| Cost Component | Pricing Specification | Staging Allocation | Incremental Monthly Cost |
| :--- | :--- | :--- | :--- |
| **Organization Base Plan** | $25 / month (covers organization, Pro features, 250GB egress) | Existing Account | **$0.00** *(Already paid by Core Hub)* |
| **Compute Instance (Project 2)** | • **Micro Compute:** ~$10 / month (1GB RAM, shared CPU)<br/>• **Small Compute:** ~$20 / month (2GB RAM, 2 shared CPUs) | Micro for basic staging;<br/>Small for 30-worker concurrency tests | **$10 – $20 / month** |
| **Disk Storage** | 8 GB included per project; $0.125 / GB / month overage | Clean Moodle staging DB: ~500MB – 2GB | **$0.00** *(Fits in 8 GB quota)* |
| **Network Egress** | 250 GB / month included organization-wide | Staging DB queries within VPC / egress | **$0.00** *(Included in plan)* |
| **Dual-Stack IPv4 Support** | Port 5432 Session Pooler (`pooler.supabase.com`) | Dual-stack IPv4/IPv6 included | **$0.00** *(Avoids $4/mo IPv4 add-on)* |
| **Daily Cloud Backups** | Automated daily snapshots (7-day retention) included | Included in Pro organization tier | **$0.00** |
| **Point-in-Time Recovery (PITR)** | Optional paid add-on ($100/mo on Pro) | **NOT REQUIRED** for staging (scripted dumps used) | **$0.00** |
| **TOTAL ESTIMATED INCREMENTAL COST** | | | **~$10 – $20 / month** |

*Assumptions:*
1. Project 2 is created within an existing Supabase Pro organization.
2. If compute credits are already exhausted by Project 1, Project 2 compute is billed at standard hourly rates ($0.01344/hr for Micro, $0.027/hr for Small).
3. Session-mode pooler eliminates the need for the $4/mo dedicated IPv4 address add-on.

### 6.7 Backup, Restore & Recovery Procedures
- **Tier 1: Cloud-Managed Snapshots:** Automated daily snapshots managed directly in Supabase Dashboard.
- **Tier 2: Cold Logical SQL Dumps:** Executed via `infra/scripts/backup-restore-test.sh` using `pg_dump` targeting the Session Pooler (`aws-0-[region].pooler.supabase.com:5432`).
- **Tier 3: File Storage Assets (`moodledata`):** Container volume archived to compressed tarball (`moodledata-[timestamp].tar.gz`), excluding transient cache directories (`cache`, `localcache`, `temp`, `trashdir`).
- **Tier 4: Non-Destructive Restore Drill:** Verified against disposable test database (`zealosh_drill_[timestamp]`) without touching live application data.
- **Retention Policy:** Enforces 7-day daily retention, 4-week weekly retention, and 12-month monthly retention with automated pruning.

### 6.8 Risks, Limitations & Production Reassessment Conditions
Before transitioning from staging to production, the following conditions must be reassessed:
1. **Load Testing Under Peak Concurrency:** Execute concurrent load tests (simulating 100+ active learners submitting quizzes and joining live classes) to verify Supavisor session pooler latency.
2. **Storage Growth Monitoring:** Monitor database table growth (`mdl_logstore_standard_log`, `mdl_grade_grades`, forum attachments) to forecast when storage exceeds 8GB.
3. **Production RPO / PITR Requirement:** Production enterprise SLA may require Point-in-Time Recovery ($100/mo add-on) for sub-minute RPO.
4. **Option B Reassessment Trigger:** If Supavisor session pooler latency, connection queueing, or third-party platform coupling prove problematic during staging benchmarks, **Option B (Dedicated Managed PostgreSQL 17)** remains fully vetted and documented below as the immediate operational alternative.

---

## 7. Documented Alternative: Option B — Dedicated Managed PostgreSQL 17 Server

If future operational requirements favor independent database hosting, reduced platform coupling, or direct socket connectivity without pooler middleware, Option B provides the following architectural baseline:

| Dimension | Specification |
| :--- | :--- |
| **Provider / Engine** | DigitalOcean Managed Databases (PostgreSQL 17) or AWS RDS PostgreSQL 17 |
| **Hardware Baseline** | 1–2 vCPUs, 2–4 GB RAM, 30–50 GB NVMe SSD storage |
| **Connection Topology** | Direct native PostgreSQL connection on port 5432 over private VPC network |
| **Authentication** | Standard database user (`moodle_user`) with dedicated strong password |
| **Attack Surface** | **Zero HTTP API exposure:** PostgREST does not exist; port 5432 restricted to Server 1 VPC IP |
| **Monthly Cost** | ~$15 – $30 / month (all-inclusive compute, storage, daily backups, and automated failover) |
| **Transition Path** | Supported transparently by setting `MOODLE_DATABASE_HOST` to the managed database hostname in `.env.staging` |


