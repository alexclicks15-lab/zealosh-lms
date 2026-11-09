# Zealosh LMS — Authoritative Multi-Node Infrastructure Architecture v2.0
**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Platform Scope:** Single-Institution Enterprise Digital Learning & Certification Examination Platform  
**Target Release:** Production Staging Phase 7 / ZM-IMPL-07B  
**Author:** Principal Software Architect & Infrastructure Engineer  
**Date:** November 2026  
**Security Classification:** Highly Confidential / Enterprise Architectural Specification  

---

## 1. Executive Mission & System Boundaries

Zealosh LMS is the mission-critical digital academy and high-stakes HSE certification examination engine for **Zealosh Training & Consultants** (Kollam, Kerala, India), specializing in ASP, CSP, CRSP, CIT, and NEBOSH examination coaching.

### Core Architecture Invariants
1. **Single-Institution Brand Primacy:** Zealosh Training & Consultants is the exclusive customer-facing brand. All internal software components and third-party engines are branded under strict platform aliases:
   - Web Platform & Exam Engine: **Zealosh LMS**
   - Learning Management Engine: **Zealosh Learning**
   - Real-time Live Classroom & Video Conferencing: **Zealosh VC** (Zealosh Virtual Classroom)
   - AI Course Assistant & Formative Feedback: **Zealosh AI**
2. **Authoritative Data Isolation (Rule 7 & ADR-004):** PostgreSQL is authoritative for Users, Courses, Batches, Entitlements, Exams, Orders, Invoices, Recordings, and Audit Logs. Fail-closed persistence architecture is strictly enforced: when `DATABASE_STORAGE="supabase"`, the application fails closed with zero silent in-memory fallback.
3. **Dedicated Real-Time Media Node:** Live WebRTC video conferencing, audio mixing (FreeSWITCH), and media recording are isolated onto a dedicated high-bandwidth computing node to guarantee zero latency interference with exam delivery and web rendering.
4. **Deterministic Budget Enforcement:** High-performance dedicated computing for real-time classroom workloads is provisioned strictly within the defined operational recurring cost ceiling (< ₹10,000 INR/month for Server 2).

---

## 2. Global Multi-Node System Architecture

The Zealosh production infrastructure is partitioned into a three-node topology fronted by edge security:

```mermaid
flowchart TD
    subgraph Clients["Learners, Faculty & Administrators"]
        Browser["Desktop & Mobile Browsers<br/>(Chrome, Safari, Edge, Firefox)"]
        PWA["Installed PWA Client"]
    end

    subgraph Edge["Edge Security & Traffic Management"]
        Cloudflare["Cloudflare Edge Proxy<br/>- DNS Management<br/>- DDoS L3/L4/L7 Protection<br/>- Edge TLS 1.3 Termination<br/>- HTTP/2 & HTTP/3 Transport"]
    end

    subgraph Node1["Node 1 — Zealosh Core App Hub (Web, API & Inference)"]
        Nginx1["Nginx Ingress Reverse Proxy<br/>SSL Passthrough / Rate Limiting"]
        NextJS["Next.js 14 App Router Cluster<br/>- Node.js 20 LTS (PM2 Cluster Mode)<br/>- SSR & Dynamic Visual PageBuilder<br/>- HSE Exam Engine & Proctoring<br/>- Commerce & Invoicing Service<br/>- Academic Activity Engine"]
        Redis1["Redis Cache & Queue (Local)<br/>- Session Token Revocation<br/>- Outbox Job Queue<br/>- Rate Limit Buckets"]
        Ollama1["Zealosh AI Engine (Ollama Local)<br/>- Private Local LLM Inference<br/>- Zero Third-Party Egress<br/>- Strict System Prompts"]
    end

    subgraph Node2["Node 2 — Zealosh VC Node (BigBlueButton 4.0 Media Node)"]
        Nginx2["Nginx Web Ingress<br/>WebRTC Signaling & Static Client"]
        BBB_Core["BigBlueButton 4.0 Engine (Ubuntu 24.04 LTS noble-400)<br/>- WebRTC SFU (Mediasoup / Kurento)<br/>- FreeSWITCH Audio Bridge<br/>- Redis PubSub Broker<br/>- HTML5 Client (Node >= 24)"]
        BBB_Record["Recording Ingestion Worker<br/>- RAP (Record, Analyze, Publish)<br/>- HMAC Webhook Dispatcher"]
    end

    subgraph Node3["Node 3 — Authoritative Persistence & Auth (Supabase Managed PostgreSQL)"]
        PgBouncer["PgBouncer Connection Pooler<br/>- Port 6543 (Transaction Mode)<br/>- Port 5432 (Session Mode)"]
        Postgres["PostgreSQL 15+ Core Database<br/>- Row Level Security (RLS)<br/>- Stored Procedures & Triggers<br/>- WAL Point-In-Time Recovery"]
        GoTrue["Supabase Auth / GoTrue<br/>JWT Signing & OIDC Provider"]
        S3_Storage["Encrypted Object Storage (S3/R2)<br/>- Course PDFs & Slides<br/>- Class Recording Archives"]
    end

    %% Client Traffic
    Browser -->|HTTPS :443| Cloudflare
    PWA -->|HTTPS :443| Cloudflare

    %% Cloudflare to Nodes
    Cloudflare -->|HTTPS :443<br/>zealosh.com / app.zealosh.com| Nginx1
    Cloudflare -->|HTTPS :443<br/>vc.zealosh.com| Nginx2
    Browser -.->|Direct UDP 16384-32768<br/>WebRTC Audio/Video| BBB_Core

    %% Node 1 Internal Flow
    Nginx1 -->|HTTP :3000| NextJS
    NextJS -->|TCP :6379| Redis1
    NextJS -->|HTTP :11434| Ollama1

    %% Inter-Node Communication
    NextJS -->|Signed HTTPS :443<br/>SHA-1 Checksum Salted REST API| Nginx2
    BBB_Record -->|Signed HTTPS :443 Webhook<br/>HMAC-SHA256 Token| NextJS

    %% Persistence Egress
    NextJS -->|TLS :6543 (Transaction Pool)| PgBouncer
    PgBouncer --> Postgres
    NextJS -->|HTTPS :443| GoTrue
    NextJS -->|HTTPS :443 Signed URLs| S3_Storage
```

---

## 3. Node Specifications & Hardware Sizing

### Node 1: Zealosh Core App Hub (Web, SSR, API, Exam Engine & Private AI)
- **Role:** Web traffic, Server-Side Rendering, Visual PageBuilder, Exam Engine, Student/Instructor Portals, Transactional Email Queue, and Local Private AI Inference.
- **Operating System:** Ubuntu 24.04 LTS (x86_64).
- **Runtime Environment:** Node.js 20 LTS (Active LTS), PM2 Process Manager (Cluster Mode, 4 worker instances).
- **Recommended Provider & Model:**
  - **Primary:** Hetzner Cloud **CPX31** (4 vCPU AMD EPYC, 8 GB RAM, 160 GB NVMe SSD, 20 TB Traffic) at **€14.90/month (~₹1,380/month)**.
  - **Alternate:** OVHcloud **Comfort vPS** (4 vCPU, 8 GB RAM, 160 GB SSD) at **$16.50/month (~₹1,400/month)**.
- **Dedicated Components:**
  - `nginx`: Reverse proxy, HTTP/2 termination, gzip/brotli compression, and security headers.
  - `pm2` / `next-server`: Next.js production build (`npm run start` on port 3000).
  - `redis-server`: In-memory cache, rate-limiting store, and job outbox on port 6379 (bound to `127.0.0.1` strictly).
  - `ollama`: Private LLM runtime serving `llama3.2:3b` or `qwen2.5:3b` on port 11434 (bound to `127.0.0.1` strictly).

### Node 2: Zealosh VC Node (Dedicated BigBlueButton 4.0 Media Node)
- **Role:** Dedicated WebRTC media conferencing, low-latency audio/video routing, screen sharing, interactive whiteboard, live attendee roster, and session recording generation.
- **Operating System:** Ubuntu 24.04 LTS (`noble-400` official release).
- **Runtime Environment:** BigBlueButton 4.0 stack (FreeSWITCH, Mediasoup / Kurento, Redis, bbb-html5 on Node >= 24).
- **Recommended Provider & Sizing (Strict Budget Verification):**
  - **Primary Choice (Hetzner Cloud Dedicated vCPU):**
    - **Plan:** Hetzner Cloud **CCX33** (Dedicated 8 vCPU AMD EPYC, 32 GB RAM, 240 GB NVMe, 30 TB Outbound Traffic).
    - **Price:** **€68.40/month (~₹6,300/month INR)**.
    - **Budget Ceiling Compliance:** Well below the ₹10,000 INR/month ceiling.
  - **Alternate Choice (OVHcloud Rise Dedicated Server):**
    - **Plan:** OVHcloud **Rise-1** (Dedicated Intel Xeon E3 / Core i7, 32 GB RAM, 2x 500 GB NVMe, Unmetered 500 Mbps Bandwidth).
    - **Price:** **$65.00/month (~₹5,500/month INR)**.
    - **Budget Ceiling Compliance:** Well below the ₹10,000 INR/month ceiling.
- **Why Dedicated Computing is Mandatory for Node 2:**
  - WebRTC media encoding and FreeSWITCH audio mixing require predictable, non-throttled CPU cycles. Shared vCPU instances suffer from "noisy neighbor" steal time which causes packet loss, jitter, audio dropouts, and WebRTC disconnection during live classroom sessions.
  - BigBlueButton 4.0 officially requires a minimum of 8 physical/dedicated CPU cores and 16 GB RAM (32 GB strongly recommended for recording processing and simultaneous 100+ webcam sessions).

### Node 3: Authoritative Persistence & Auth (Supabase Managed PostgreSQL)
- **Role:** Relational ACID storage, Row-Level Security enforcement, GoTrue JWT authentication, and automated backup preservation.
- **Tier:** Supabase Managed Cloud (AWS Frankfurt `eu-central-1` or AWS Mumbai `ap-south-1` for lowest latency to India).
- **Plan:** **Supabase Pro Tier** at **$25.00/month (~₹2,100/month INR)**.
- **Storage & Compute Included:**
  - 8 GB disk storage included (auto-expanding).
  - 100,000 monthly active users (MAU).
  - 250 GB database bandwidth.
  - 7-day daily automated backups + Point-In-Time Recovery (PITR) add-on.
  - Built-in PgBouncer transaction pooling (up to 200 concurrent pool connections).

---

## 4. Comprehensive Network Port & Traffic Matrix

| Source | Destination | Protocol / Port | Purpose | Encryption / Auth |
| :--- | :--- | :--- | :--- | :--- |
| **Public Internet** | **Cloudflare Edge** | TCP 80, 443 | Public HTTP/HTTPS Traffic | TLS 1.3 / Strict SNI |
| **Cloudflare Edge** | **Node 1 (Nginx)** | TCP 443 | Web Application & CMS Traffic | Full (Strict) TLS 1.3 with Cloudflare Origin CA |
| **Cloudflare Edge** | **Node 2 (Nginx)** | TCP 443 | Classroom Web App & HTML5 Client | Full (Strict) TLS 1.3 with Cloudflare Origin CA |
| **Learner / Faculty** | **Node 2 (BBB)** | UDP 16384–32768 | WebRTC Audio, Video & Screen Share | DTLS-SRTP (RFC 5764) |
| **Learner / Faculty** | **Node 2 (BBB)** | TCP/UDP 3478 | STUN / TURN NAT Traversal | HMAC-SHA1 Credential |
| **Learner / Faculty** | **Node 2 (BBB)** | UDP 49152–65535 | TURN Relay Allocation Range | DTLS-SRTP |
| **Node 1 (Next.js)** | **Node 2 (BBB)** | TCP 443 | Room Provisioning & Join Tokens | HTTPS REST + SHA-1 Checksum Salt |
| **Node 2 (BBB RAP)** | **Node 1 (Next.js)** | TCP 443 | Recording Ingestion Webhook | HTTPS POST + Bearer HMAC Token |
| **Node 1 (Next.js)** | **Node 3 (Supabase)**| TCP 6543 | Transactional Database Queries | TLS `sslmode=require` via PgBouncer |
| **Node 1 (Next.js)** | **Node 3 (Supabase)**| TCP 5432 | Direct Admin / Migration Operations | TLS `sslmode=require` Direct PostgreSQL |
| **Node 1 (Next.js)** | **Node 3 (Auth)** | TCP 443 | Supabase GoTrue Auth REST API | HTTPS + Service Role / Anon JWT |
| **Admin Bastion** | **Node 1 / Node 2** | TCP 22 | SSH Administrative Access | Ed25519 Public Key Only (No Passwords) |

> [!IMPORTANT]
> All other incoming ports are blocked by host firewalls (`ufw`) and Cloudflare network security rules. Direct database ports (5432 / 6543) are restricted to authorized server IP addresses.

---

## 5. Inter-Service Authentication & Security Protocols

### 5.1 Node 1 to Node 2: Live Room Provisioning Protocol
- Node 1 authenticates to BigBlueButton via signed server-side REST API calls.
- Every API call computes a SHA-1 checksum parameter:
  $$\text{checksum} = \text{SHA-1}(\text{api\_action} + \text{query\_params} + \text{BBB\_SECRET})$$
- The `BBB_SECRET` is never transmitted over the wire and is known only to Server 1 environment variables and Server 2 `/etc/bigbluebutton/bbb-web.properties`.
- Egress from Node 1 is locked to Server 2's specific domain (`vc.zealosh.com`).

### 5.2 Node 2 to Node 1: Recording Ingestion Webhook
- When BigBlueButton finishes processing a recording (RAP pipeline: Record, Archive, Process, Publish), a post-publish script dispatches an HTTP POST payload to `https://app.zealosh.com/api/webhooks/bbb/recording`.
- Payload headers include:
  `x-zealosh-signature: sha256=<HMAC_HEX>`
- Node 1 validates the HMAC signature using `RECORDING_WEBHOOK_SECRET` before updating recording records in PostgreSQL.

### 5.3 Node 1 to Node 3: Persistence & Connection Pooling
- Next.js connects to Supabase PostgreSQL using two distinct connection strings:
  1. **Runtime App Traffic:** Port 6543 via PgBouncer in **Transaction Mode**. Ideal for serverless and Node.js async operations with connection reuse.
  2. **Migration & DDL Scripts:** Port 5432 Direct Connection. Mandatory for schema migrations, prepared statements, and transactional locks.
- **Fail-Closed Invariant (ADR-004):** When `DATABASE_STORAGE="supabase"`, missing credentials throw immediately upon bootstrap. If remote database connectivity fails, errors bubble up as standard HTTP 500 / 503 errors rather than silently delegating mutations to an in-memory or mock store.

---

## 6. Disaster Recovery, RTO, RPO & Resilience

| Category | SLA Target | Implementation Architecture |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **< 15 minutes** | Supabase continuous Write-Ahead Log (WAL) archiving + hourly S3 snapshots. |
| **Recovery Time Objective (RTO)** | **< 2 hours** | Infrastructure as Code (Docker Compose / Ansible playbooks) capable of provisioning a clean Node 1 and Node 2 in < 45 minutes. |
| **Node 1 Server Failure** | **RTO < 30 min** | Spin up secondary instance from pre-built Docker image, attach persistent environment secrets, and update Cloudflare DNS origin. |
| **Node 2 Server Failure** | **RTO < 45 min** | Run automated `bbb-staging-setup.sh` on fresh Ubuntu 24.04 instance. Active sessions terminate gracefully; recorded sessions remain safe in S3. |
| **Database Outage** | **RTO < 15 min** | Supabase managed multi-AZ automated failover to replica. |

---

## 7. Monthly Total Cost of Ownership (TCO) Summary

| Infrastructure Component | Provider & Tier | Monthly Cost (EUR/USD) | Monthly Cost (INR) |
| :--- | :--- | :--- | :--- |
| **Node 1 (LMS Core App & AI)** | Hetzner Cloud CPX31 (4 vCPU AMD, 8 GB RAM) | €14.90 | ~₹1,380 |
| **Node 2 (Zealosh VC Media)** | Hetzner Cloud CCX33 (8 vCPU Dedicated, 32 GB RAM) | €68.40 | ~₹6,300 |
| **Node 3 (Authoritative DB & Auth)**| Supabase Managed Pro Plan | $25.00 | ~₹2,100 |
| **Edge Security & CDN** | Cloudflare Free / Pro Tier | $0.00 – $20.00 | ~₹0 – ₹1,680 |
| **Object Storage (Recordings/PDFs)**| Cloudflare R2 / AWS S3 (First 50 GB) | ~$3.00 | ~₹250 |
| **Total Monthly Infrastructure TCO**| **Production-Grade Multi-Node Stack** | **~€105 / ~$115** | **~₹9,800 – ₹11,500** |

> [!NOTE]
> The dedicated real-time media node (Server 2) is strictly within its designated monthly ceiling of **< ₹10,000 INR/month** (running at ~₹6,300 INR/month on Hetzner CCX33 or ~₹5,500 INR/month on OVHcloud Rise-1). The combined platform cost is under ₹12,000 INR/month for the complete institutional workload.

