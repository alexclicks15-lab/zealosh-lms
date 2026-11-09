# Zealosh LMS — Authoritative Multi-Node Infrastructure Architecture v3.0

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Platform Scope:** Single-Institution Enterprise Digital Learning & Certification Examination Platform  
**Target Release:** Production Staging Phase 7 / ZM-IMPL-07C  
**Author:** Principal Software Architect & Infrastructure Engineer  
**Date:** November 2026  
**Security Classification:** Highly Confidential / Enterprise Architectural Specification  

---

## 1. Executive Mission & System Boundaries

Zealosh LMS is the mission-critical digital academy and high-stakes HSE certification examination engine for **Zealosh Training & Consultants** (Kollam, Kerala, India), specializing in ASP, CSP, CRSP, CIT, and NEBOSH examination coaching.

### 1.1 Core Architecture Invariants & Non-Negotiable Principles
1. **Single-Institution Brand Primacy:** Zealosh Training & Consultants is the exclusive customer-facing brand. All internal software components and third-party engines are branded under strict platform aliases:
   - Web Platform & Exam Engine: **Zealosh LMS**
   - Learning Management Engine: **Zealosh Learning**
   - Real-time Live Classroom & Video Conferencing: **Zealosh VC** (Zealosh Virtual Classroom)
   - AI Course Assistant & Formative Feedback: **Zealosh AI**
2. **Authoritative Data Isolation (Rule 7 & ADR-004):** PostgreSQL is authoritative for Users, Courses, Batches, Entitlements, Exams, Orders, Invoices, Recordings, and Audit Logs. Fail-closed persistence architecture is strictly enforced: when `DATABASE_STORAGE="supabase"`, the application fails closed with zero silent in-memory fallback.
3. **Dedicated Real-Time Media Node:** Live WebRTC video conferencing, audio mixing (FreeSWITCH), and media recording are isolated onto a dedicated high-bandwidth computing node to guarantee zero latency interference with exam delivery and web rendering.
4. **Deterministic Budget Enforcement:** High-performance dedicated computing for real-time classroom workloads is provisioned strictly within the defined operational recurring cost ceiling (< ₹10,000 INR/month for Server 2).
5. **Private Network AI Isolation:** Private AI inference (Zealosh AI / Ollama) is isolated on Server 3 with zero public internet ingress and zero access to database credentials or student records.
6. **No Phantom Infrastructure Dependencies:** Server 1 runs a clean, lightweight Node.js/Next.js stack with an authoritative database/file-backed outbox queue. Unneeded Redis caches and local LLM runtimes are strictly removed from Server 1.

---

## 2. Global Multi-Node System Architecture Topology

The authoritative Zealosh multi-node architecture consists of three compute nodes, one external managed database PaaS, edge security, and cloud object storage:

```mermaid
flowchart TD
    subgraph Clients["Learners, Faculty & Administrators"]
        Browser["Web Browsers<br/>(Chrome, Safari, Edge, Firefox)"]
        MobileApp["Mobile / PWA Client"]
    end

    subgraph Edge["Edge Security & Traffic Management (Cloudflare)"]
        CF_Proxy["Cloudflare CDN & WAF (Proxied)<br/>- DDoS L3/L4/L7 Mitigation<br/>- Strict Edge TLS 1.3 Termination<br/>- Origin Shield & HTTP/2 / HTTP/3<br/>- FQDNs: app.zealosh.com, vc.zealosh.com"]
        CF_DNS["Cloudflare DNS-Only (Grey Cloud)<br/>- Direct Media & NAT Traversal<br/>- FQDN: turn.zealosh.com"]
    end

    subgraph Server1["Server 1: Zealosh LMS Core (Public VPS)"]
        Nginx1["Nginx Ingress Reverse Proxy<br/>- SSL Passthrough / Rate Limiting<br/>- Static Caching & Security Headers"]
        NextCluster["Next.js 14 App Router Cluster<br/>- Node.js 20 LTS (PM2 Cluster Mode)<br/>- SSR & Dynamic Visual PageBuilder<br/>- HSE Certification Exam Engine<br/>- Commerce & Invoicing Service<br/>- Outbox Email & Webhook Dispatcher"]
    end

    subgraph Server2["Server 2: Zealosh VC (Dedicated Compute / Bare-Metal)"]
        Nginx2["Nginx Web Ingress<br/>WebRTC Signaling & Static HTML5 Client"]
        BBB_Core["BigBlueButton 4.0 Media Stack<br/>- WebRTC SFU (Mediasoup / Kurento)<br/>- FreeSWITCH Audio Bridge<br/>- bbb-html5 Client Engine<br/>- Internal Redis Event Bus"]
        BBB_RAP["Recording Engine (RAP)<br/>- Record, Analyze, Publish<br/>- zealosh_post_publish.rb HMAC Webhook"]
    end

    subgraph Server3["Server 3: Zealosh AI (Private VPS — Private LAN Only)"]
        OllamaServer["Ollama AI Runtime (Systemd)<br/>- Port 11434 (Bound to 10.0.0.3 Only)<br/>- Quantized Models: llama3.2:3b / qwen2.5:3b<br/>- Course-Grounded RAG Assistant<br/>- Formative Assignment Evaluation"]
    end

    subgraph SupabasePaaS["Managed Database & Auth (External Supabase PaaS)"]
        PostgREST["PostgREST HTTPS API (:443)<br/>- Primary Data Adapter Transport<br/>- Row Level Security (RLS) Enforced"]
        GoTrue["GoTrue Auth Service (:443)<br/>- JWT Signing & Session Lifecycle"]
        PgBouncer["PgBouncer Pooler (:6543 / :5432)<br/>- Port 6543: Transaction Mode<br/>- Port 5432: Session Mode (DDL & Migrations)"]
        PostgresCore["Authoritative PostgreSQL 15+ Core<br/>- Automated WAL Backups & PITR"]
    end

    subgraph StorageCloud["Encrypted Object Storage (Cloudflare R2 / AWS S3)"]
        S3Bucket["Object Storage Buckets<br/>- /materials/ (Course PDFs, Slides, SCORM)<br/>- /recordings/ (Published BBB MP4 Archives)"]
    end

    %% Client Access Paths
    Browser -->|HTTPS :443| CF_Proxy
    MobileApp -->|HTTPS :443| CF_Proxy

    %% Cloudflare Edge to Servers
    CF_Proxy -->|HTTPS :443 (Strict SSL)<br/>app.zealosh.com| Nginx1
    CF_Proxy -->|HTTPS :443 (Strict SSL)<br/>vc.zealosh.com| Nginx2

    %% WebRTC Direct Media Streams (Bypasses Cloudflare Proxy)
    Browser -.->|Direct UDP 16384-32768<br/>WebRTC Audio, Video & Screen Share| BBB_Core
    Browser -.->|Direct UDP/TCP 3478 & 49152-65535<br/>STUN/TURN Media Relay| CF_DNS
    CF_DNS -.-> BBB_Core

    %% Server 1 Internal Execution
    Nginx1 -->|HTTP :3000| NextCluster

    %% Inter-Server Secure Communication
    NextCluster -->|Signed HTTPS :443<br/>SHA-1 Checksum Salted REST API| Nginx2
    BBB_RAP -->|Signed HTTPS :443 Webhook<br/>HMAC-SHA256 Token| NextCluster
    NextCluster -->|Private HTTP :11434<br/>Private Wire / 10.0.0.3 Only| OllamaServer

    %% Persistence Egress from Server 1
    NextCluster -->|HTTPS :443 (PostgREST API)| PostgREST
    NextCluster -->|HTTPS :443 (Auth API)| GoTrue
    NextCluster -.->|TLS :5432 (DDL / Migration Only)| PgBouncer
    NextCluster -->|HTTPS :443 Signed URLs| S3Bucket
    BBB_RAP -->|HTTPS :443 Multipart Upload| S3Bucket
```

---

## 3. Detailed Node Specifications & Architectural Boundaries

### 3.1 Server 1: Zealosh LMS Core (Public Application Hub)
- **Role:** Web traffic, Server-Side Rendering (SSR), Visual PageBuilder CMS, HSE Exam Engine & Anti-Cheat Proctoring, Admissions & Payments, Outbox Email Dispatcher.
- **Operating System:** Clean Ubuntu 24.04 LTS (x86_64).
- **Runtime:** Node.js 20 LTS (Active LTS), PM2 Process Manager in Cluster Mode (4 worker threads).
- **Public FQDN:** `app.zealosh.com` / `zealosh.com`.
- **Software Components:**
  - `nginx`: Ingress reverse proxy, TLS 1.3 termination with Cloudflare Origin CA certificate, HTTP/2 transport, security headers (`Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`).
  - `pm2` / `next-server`: Next.js 14 App Router production bundle listening on `127.0.0.1:3000`.
  - `systemd` Outbox Worker: Background Node.js process executing transactional email and webhook dispatches.
- **Exclusions:**
  - **NO local Ollama:** Inference is offloaded to Server 3.
  - **NO Redis cache:** Application uses database-backed transactions and store-backed caching, avoiding unnecessary stateful memory dependencies.

### 3.2 Server 2: Zealosh VC (Dedicated Compute / Bare-Metal Real-Time Media Node)
- **Role:** Real-time WebRTC audio/video conferencing, low-latency screen sharing, interactive whiteboard, live attendee roster, and session recording generation.
- **Operating System:** Clean Ubuntu 24.04 LTS 64-bit (`noble-400` official release).
- **Runtime:** BigBlueButton 4.0 Media Stack (FreeSWITCH, Mediasoup / Kurento, bbb-html5 on Node >= 24, internal Redis bus, bbb-webhooks).
- **Public FQDN:** `vc.zealosh.com` (web & signaling) and `turn.zealosh.com` (STUN/TURN relay).
- **Compute Sizing Rule:** Must be **dedicated compute** (bare metal or dedicated vCPU) to eliminate CPU steal and guarantee jitter-free WebRTC audio/video encoding for 100+ concurrent students.
- **Monthly Cost Rule:** Recurring monthly infrastructure cost must strictly remain **under ₹10,000 INR/month**.

### 3.3 Server 3: Zealosh AI (Private Dedicated AI Inference Node)
- **Role:** Dedicated private LLM inference engine executing course-grounded RAG assistance, automated rubric grading feedback, and student query synthesis.
- **Operating System:** Clean Ubuntu 24.04 LTS 64-bit.
- **Runtime:** Ollama Linux daemon (`systemd` service `ollama.service`).
- **Network Attachment:** **Strictly Private Network** (`10.0.0.3` or private wire).
- **Public Internet Ingress:** **NONE (0 open public ports)**. All public traffic is rejected by firewall.
- **Data Access:** **Zero Supabase database credentials or student records stored on Server 3**. Receives only sanitized prompt contexts forwarded by Server 1 via private REST API (`http://10.0.0.3:11434/api/generate`).
- **Models Loaded:** `llama3.2:3b` and `qwen2.5:3b` (quantized 4-bit/8-bit models with fast CPU token generation).

### 3.4 Supabase Managed Database PaaS (External Authoritative Persistence)
- **Role:** Authoritative single source of truth for Users, Batches, Courses, Enrollments, Exam Blueprints, Questions, Submissions, Grades, Financial Orders, and Audit Logs.
- **Service Type:** External Managed PostgreSQL 15+ PaaS (AWS Frankfurt `eu-central-1` or AWS Mumbai `ap-south-1`).
- **Primary Transport:** HTTPS REST via PostgREST (`@supabase/supabase-js`) on port 443 with Row-Level Security (RLS) enforcement.
- **Secondary Direct TCP Ports:**
  - **Port 5432 (Session Mode):** Used exclusively for administrative schema migrations, DDL scripts, and database maintenance.
  - **Port 6543 (Transaction Mode):** Available for persistent connection-pooled queries if native SQL drivers are required.

### 3.5 Cloud Storage (Encrypted Object Storage)
- **Role:** Secure storage for student PDF handouts, presentation slides, SCORM packages, and published BigBlueButton MP4 recordings.
- **Provider:** Cloudflare R2 or AWS S3 (Frankfurt / Mumbai).
- **Access Pattern:** Server 1 issues short-lived pre-signed HTTPS download URLs to authenticated learners with valid entitlements.

---

## 4. Comprehensive Port, Protocol & Firewall Matrix

| Interface | Source | Destination | Protocol / Port | Purpose | Encryption & Authentication |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Public Web** | Client Browser | Cloudflare Edge | TCP 80, 443 | Public HTTP/HTTPS requests | TLS 1.3 / Strict SNI |
| **Edge Ingress** | Cloudflare Edge | Server 1 (Nginx) | TCP 443 | Web App & API Traffic | Full (Strict) TLS 1.3 with Cloudflare Origin CA |
| **Edge Ingress** | Cloudflare Edge | Server 2 (Nginx) | TCP 443 | Classroom Web & Signaling | Full (Strict) TLS 1.3 with Cloudflare Origin CA |
| **WebRTC Media** | Client Browser | Server 2 (BBB) | UDP 16384–32768 | WebRTC Audio/Video Streams | DTLS-SRTP (RFC 5764) — Direct connection |
| **STUN/TURN** | Client Browser | Server 2 (coturn) | TCP/UDP 3478 | NAT Discovery & Traversal | HMAC-SHA1 Credential |
| **TURN Relay** | Client Browser | Server 2 (coturn) | UDP 49152–65535 | TURN Media Relay Allocation | DTLS-SRTP — Direct connection |
| **Inter-Service** | Server 1 (Next.js) | Server 2 (BBB) | TCP 443 | Room Provisioning & Join Tokens | Signed HTTPS REST with SHA-1 Checksum Salt |
| **Inter-Service** | Server 2 (RAP) | Server 1 (Next.js) | TCP 443 | Recording Ingestion Webhook | Signed HTTPS POST with HMAC-SHA256 Token |
| **Private LAN** | Server 1 (Next.js) | Server 3 (Ollama) | TCP 11434 | Private AI Inference Queries | Private Network (`10.0.0.0/24`) Whitelisted |
| **Database** | Server 1 (Next.js) | Supabase (PostgREST)| TCP 443 | Authoritative CRUD Operations | HTTPS REST + Service Role / Anon JWT |
| **Database** | Server 1 (Next.js) | Supabase (PgBouncer)| TCP 5432 | DDL Schema Migrations | Direct TLS `sslmode=require` |
| **Media Storage**| Server 1 / Server 2 | Cloudflare R2 / S3 | TCP 443 | Handouts & Recording Archives | HTTPS REST + S3 Signed API Tokens |
| **Management** | Admin Bastion IP | Server 1 / 2 / 3 | TCP 22 | SSH Server Administration | Ed25519 Public Key Only (No Passwords) |

> [!CRITICAL]
> **Cloudflare WebRTC Media Routing Invariant:**
> Cloudflare standard HTTP proxying (orange-cloud) supports web pages and WebSocket signaling (`app.zealosh.com`, `vc.zealosh.com`), but **CANNOT proxy raw WebRTC UDP media traffic (ports 16384–32768)**.
> All WebRTC UDP media packets must connect **directly from the student browser to Server 2's public IP address** (or via `turn.zealosh.com` DNS-only grey-cloud record).

---

## 5. Inter-Service Security Protocols & Cryptographic Contracts

### 5.1 Server 1 to Server 2: Live Room Provisioning (SHA-1 Salted Protocol)
- Server 1 provisions virtual rooms and issues learner join tokens by invoking BigBlueButton's REST API over HTTPS.
- Every API request computes a cryptographic SHA-1 signature appended to query parameters:
  $$\text{checksum} = \text{SHA-1}\left(\text{action\_name} + \text{query\_params} + \text{BBB\_SECURITY\_SALT}\right)$$
- The `BBB_SECURITY_SALT` is known only to Server 1's secure environment (`/opt/zealosh/.env.staging`) and Server 2's `/etc/bigbluebutton/bbb-web.properties`.
- It is never exposed in browser payloads or HTTP logs.

### 5.2 Server 2 to Server 1: Recording Ingestion Webhook (HMAC-SHA256 Contract)
- When BigBlueButton finishes processing a session recording (the RAP pipeline: Record, Archive, Process, Publish), a post-publish script (`zealosh_post_publish.rb`) posts the metadata payload to `https://app.zealosh.com/api/webhooks/bbb/recording`.
- Payload headers include:
  ```http
  x-zealosh-signature: sha256=<HMAC_HEX_DIGEST>
  content-type: application/json
  ```
- Server 1 verifies the signature using `BBB_WEBHOOK_SECRET` before updating recording records in PostgreSQL. Unsigned or invalid requests return `401 UNAUTHORIZED`.

### 5.3 Server 1 to Server 3: Private AI Inference Protocol
- Server 1 communicates with Server 3 over private networking (`10.0.0.1` -> `10.0.0.3` on port 11434).
- Server 3's host firewall blocks all incoming traffic from any interface other than the private network subnet.
- The AI service layer enforces strict sanitization: student PII (names, phone numbers, email addresses) is stripped before prompt dispatch; only course question texts and anonymized student drafts are forwarded for RAG processing.

---

## 6. Disaster Recovery, RTO, RPO & Availability Guarantees

| Metric / Failure Mode | Target Objective | Implementation Strategy |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **< 15 minutes** | Continuous PostgreSQL Write-Ahead Log (WAL) archiving in Supabase + hourly object storage snapshots. |
| **Recovery Time Objective (RTO)** | **< 2 hours** | Automated infrastructure setup runbooks capable of rebuilding Server 1, 2, and 3 from clean Ubuntu 24.04 images in < 45 minutes. |
| **Server 1 Crash (LMS Hub)** | **RTO < 30 minutes** | Spin up secondary VPS from automated runbook, inject `.env.staging` secrets, switch Cloudflare DNS origin. Zero data lost (stored in Supabase). |
| **Server 2 Crash (Media Node)** | **RTO < 45 minutes** | Run `deploy/bbb-staging-setup.sh` on fresh dedicated VPS. In-flight sessions terminate; recorded sessions remain intact in R2/S3. |
| **Server 3 Crash (AI Node)** | **RTO < 20 minutes** | Next.js AI adapter gracefully enters `UNCONFIGURED` / `DOWN` status without affecting core LMS or exams. Rebuild VPS with Ollama runbook. |
| **Database Outage (Supabase)** | **RTO < 15 minutes** | Automated multi-AZ failover to standby replica managed by Supabase SLA. |

---

## 7. Monthly Total Cost of Ownership (TCO) Architectural Summary

| Node / Service | Role | Provider & Tier | Monthly Cost (EUR/USD) | Monthly Cost (INR) |
| :--- | :--- | :--- | :--- | :--- |
| **Server 1** | LMS Core, SSR & Exams | Hetzner CPX31 / Contabo VPS 2 | €14.90 / $11.50 | ~₹1,380 – ₹1,630 |
| **Server 2** | Zealosh VC Media Host | OVHcloud Rise-1 / Contabo VDS M | €49.00 / $60.00 | ~₹5,070 – ₹6,195 (incl. tax) |
| **Server 3** | Dedicated AI Inference | Contabo VPS 3 / Hetzner CPX31 | $19.50 / €14.90 | ~₹1,380 – ₹1,650 |
| **Database** | Authoritative DB & Auth | Supabase Managed Pro Tier | $25.00 | ~₹2,100 |
| **Edge Security**| DDoS & CDN Proxy | Cloudflare Free / Pro Tier | $0.00 – $20.00 | ~₹0 – ₹1,680 |
| **Object Storage**| PDFs & Media Archives | Cloudflare R2 / AWS S3 | ~$3.00 – $5.00 | ~₹250 – ₹420 |
| **Total Monthly TCO** | **Full Multi-Node Staging Stack** | — | **~$125 – $140 USD** | **~₹10,500 – ₹12,000 INR** |

> [!NOTE]
> Server 2 recurring monthly cost is verified at **~₹5,070 – ₹6,195 INR/month (inclusive of tax)**, providing a comfortable 38% to 49% headroom below the non-negotiable **₹10,000 INR/month ceiling**.

