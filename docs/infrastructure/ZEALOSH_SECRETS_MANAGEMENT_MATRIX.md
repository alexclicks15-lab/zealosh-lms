# Zealosh LMS — Multi-Node Secrets & Environment Variables Management Matrix

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-07C — Multi-Node Staging Infrastructure Finalization & Procurement Readiness  
**Target Environment:** Staging & Production Architecture v3.0  
**Security Classification:** Restricted / Security Architecture  
**Date:** November 2026  

---

## 1. Governance Principles & Secret Hygiene

1. **Zero Secret Leakage:** Production and staging secrets must **never** be committed to Git repositories, baked into Docker container layers, or printed to `stdout` / terminal logs.
2. **Principle of Least Privilege:** Each node has access only to secrets strictly necessary for its role:
   - Server 1 has LMS, Supabase, BigBlueButton API, and private AI endpoints.
   - Server 2 has only its local BigBlueButton security salt and webhook HMAC key.
   - Server 3 has **zero database credentials or third-party secrets** (Ollama private runtime only).
3. **Restricted File System Permissions:** Environment configuration files (`.env.staging`, `zealosh-secret.env`) must be owned by the service user and set to mode `0600` (`-rw-------`).

---

## 2. Master Secrets & Environment Variables Matrix

| Variable Name | Node Scope | Classification | Value Format / Constraints | Injection Mechanism | Security Rationale & Blast Radius |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `NODE_ENV` | Server 1 | Non-Secret | Literal `production` | PM2 env / `.env.staging` | Controls Next.js optimized production build execution. |
| `PORT` | Server 1 | Non-Secret | Integer `3000` | PM2 env / `.env.staging` | Local port bound by Next.js server behind Nginx proxy. |
| `ZEALOSH_ENVIRONMENT` | Server 1 | Non-Secret | `staging` or `production` | PM2 env / `.env.staging` | Activates environment-specific telemetry and feature toggles. |
| `ZEALOSH_DOMAIN` | Server 1 | Non-Secret | FQDN `app.zealosh.com` | PM2 env / `.env.staging` | Canonical domain for CORS and cookies. |
| `APP_BASE_URL` | Server 1 | Non-Secret | `https://app.zealosh.com` | PM2 env / `.env.staging` | Base URL used for email links and absolute callback URLs. |
| `DATABASE_STORAGE` | Server 1 | Non-Secret | `supabase` | PM2 env / `.env.staging` | Enforces ADR-004 fail-closed PostgreSQL persistence. |
| `JWT_SECRET` | Server 1 | **CRITICAL** | Random 64-char Hex/Base64 | Mode `0600` `.env.staging` | Signs and verifies user session tokens. Compromise allows session forgery. |
| `NEXT_PUBLIC_SUPABASE_URL` | Server 1 | Sensitive | `https://<ref>.supabase.co` | PM2 env / `.env.staging` | Supabase PostgREST & Auth endpoint. Publicly visible in client JS. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Server 1 | Sensitive | Supabase Anon JWT | PM2 env / `.env.staging` | Used for unauthenticated login/signup. Enforced strictly by PostgreSQL RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server 1 | **CRITICAL** | Supabase Service Role JWT | Mode `0600` `.env.staging` | **Server-side only.** Bypasses RLS for administrative jobs. Never exposed to client. |
| `SUPABASE_DB_PASSWORD` | Workstation / CI | **CRITICAL** | Random 32-char string | CLI prompt / CI Secret | Direct PostgreSQL admin password for migrations on Port 5432. |
| `BBB_BASE_URL` | Server 1 | Sensitive | `https://vc.zealosh.com/bigbluebutton/api` | PM2 env / `.env.staging` | BigBlueButton REST API endpoint. |
| `BBB_SECURITY_SALT` | Server 1, Server 2 | **CRITICAL** | 32-64 char alphanumeric | Mode `0600` file on both nodes | Signs API requests via SHA-1 checksum. Compromise allows rogue meeting creation. |
| `BBB_WEBHOOK_CALLBACK_URL`| Server 1, Server 2 | Sensitive | `https://app.zealosh.com/api/webhooks/bbb/recording` | Script arg / `.env.staging` | Canonical endpoint where Server 2 notifies Server 1 of published recordings. |
| `BBB_WEBHOOK_SECRET` | Server 1, Server 2 | **CRITICAL** | Random 32-char string | Mode `0600` file on both nodes | Signs recording callback payloads via HMAC-SHA256. Prevents callback spoofing. |
| `OLLAMA_BASE_URL` | Server 1 | Sensitive | `http://10.0.0.3:11434` | PM2 env / `.env.staging` | Private network endpoint of Server 3 AI service. Unroutable from public internet. |
| `OLLAMA_MODEL` | Server 1 | Non-Secret | `llama3.2:3b` | PM2 env / `.env.staging` | Specifies active inference model. |
| `AI_INFERENCE_TIMEOUT_MS`| Server 1 | Non-Secret | Integer `15000` | PM2 env / `.env.staging` | Client-side timeout for AI requests (15 seconds) to prevent request pool hangs. |
| `S3_BUCKET_NAME` | Server 1 | Sensitive | `zealosh-production-storage` | PM2 env / `.env.staging` | Cloudflare R2 / AWS S3 bucket name. |
| `S3_ACCESS_KEY_ID` | Server 1 | Sensitive | Alphanumeric Access ID | Mode `0600` `.env.staging` | Cloudflare R2 / S3 API authentication. |
| `S3_SECRET_ACCESS_KEY` | Server 1 | **CRITICAL** | 40-char Secret Key | Mode `0600` `.env.staging` | Grants pre-signing and upload capability to R2/S3. |
| `CLOUDFLARE_API_TOKEN` | CI/CD / Admin | **CRITICAL** | 40-char scoped API token | GitHub Actions Secret | Purges edge cache and updates DNS records. Scoped strictly to `zealosh.com`. |

---

## 3. Secret Rotation & Lifecycle Policy

| Secret Classification | Recommended Rotation Interval | Rotation Procedure | Service Downtime |
| :--- | :---: | :--- | :---: |
| **JWT_SECRET** | 90 Days | Generate new secret, append as secondary key for 24h grace period, then promote. | 0 min |
| **SUPABASE_SERVICE_ROLE_KEY** | 180 Days (or on breach) | Generate in Supabase console, update `/opt/zealosh/.env.staging`, reload PM2. | 0 min (PM2 graceful reload) |
| **BBB_SECURITY_SALT** | 180 Days | Run `bbb-conf --setsecret <NEW_SALT>` on Server 2, update Server 1 `.env.staging`. | < 1 min (BBB reload) |
| **BBB_WEBHOOK_SECRET** | 180 Days | Update `/etc/bigbluebutton/zealosh-secret.env` and Server 1 `.env.staging`. | 0 min |
| **S3_SECRET_ACCESS_KEY** | 180 Days | Create secondary key pair in R2/S3 console, update Server 1, delete old key. | 0 min |
| **SSH Host Keys / Ed25519** | Annual (or personnel exit)| Update `authorized_keys` across all 3 nodes via ansible/bastion. | 0 min |

