# Zealosh LMS — Multi-Node Staging Infrastructure Bill of Materials (BOM) & Procurement Specification

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-07C — Multi-Node Staging Infrastructure Finalization & Procurement Readiness  
**Target Environment:** Three-Node Production Staging Architecture v3.0  
**Author:** Principal Software Architect & Infrastructure Engineer  
**Date:** November 2026  
**Status:** APPROVED FOR STAKEHOLDER PROCUREMENT  

---

## 1. Executive Summary & Procurement Guidelines

This document provides the complete, procurement-ready Bill of Materials (BOM) for the Zealosh LMS three-server production staging infrastructure.

### Mandatory Procurement Principles
1. **Zero Premature Purchase:** No cloud accounts may be charged or instances spun up without explicit stakeholder written authorization.
2. **Server 2 Hard Budget Ceiling:** The monthly recurring cost for Server 2 (Zealosh VC Media Node) must strictly remain **under ₹10,000 INR/month** (inclusive of applicable taxes).
3. **Dedicated Computing for Media:** Server 2 must utilize **dedicated bare-metal or dedicated vCPUs** (no noisy neighbors or shared CPU credits) to prevent WebRTC packet dropouts, audio jitter, and screen freeze during live classroom sessions.
4. **Private Network AI Isolation:** Server 3 must be provisioned on a private network or protected by strict host firewall rules with zero public ingress and zero database credentials.
5. **Brand Primacy:** All infrastructure is registered and configured exclusively under the brand **Zealosh Training & Consultants**.

---

## 2. Global Staging Bill of Materials (BOM) — Master Line Items

| Item # | System Role | Recommended Provider & SKU | Specifications (vCPU / RAM / Disk / Net) | Base Monthly Cost | Est. Tax (18% GST/VAT) | Total Monthly Cost (INR) | Billing Model |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **01** | **Server 1: Zealosh LMS Core** | **Hetzner Cloud CPX31** *(Alt: Contabo VPS 2)* | 4 vCPU (AMD EPYC), 8 GB RAM, 160 GB NVMe, 20 TB traffic, 1 IPv4 | €14.90 / mo (~₹1,380) | ~₹248 | **~₹1,628 / mo** | Hourly Metered (Monthly Capped) |
| **02** | **Server 2: Zealosh VC (Media)** | **OVHcloud Rise-1 Bare Metal** *(Alt: Contabo Cloud VDS M)* | Intel Xeon-E 2386G (6C/12T), 32 GB DDR4 ECC, 2x 512 GB NVMe, 1 Gbps unmetered | ~₹5,250 / mo ($62 USD) | ~₹945 | **~₹6,195 / mo** | Monthly Subscription |
| **03** | **Server 3: Zealosh AI (Inference)** | **Contabo Cloud VPS 3** *(Alt: Hetzner CPX31)* | 8 vCPU, 24 GB RAM, 200 GB NVMe, 32 TB traffic, Private LAN | $19.50 / mo (~₹1,650) | ~₹297 | **~₹1,947 / mo** | Monthly Subscription |
| **04** | **Database & Auth (Managed PaaS)** | **Supabase Pro Plan** | PostgreSQL 15+, GoTrue Auth, 8 GB DB storage, 100k MAU, PITR backups | $25.00 / mo (~₹2,100) | ~₹378 | **~₹2,478 / mo** | Monthly SaaS |
| **05** | **Edge CDN & WAF** | **Cloudflare Free / Pro Tier** | Global Anycast DNS, L3/L4/L7 DDoS mitigation, Edge TLS 1.3 | $0.00 – $20.00 / mo | ~₹0 – ₹300 | **~₹0 – ₹1,980 / mo** | Monthly SaaS |
| **06** | **Encrypted Object Storage** | **Cloudflare R2 / AWS S3** | 50 GB storage, Class A/B operations (PDFs & BBB recordings) | ~$3.00 – $5.00 / mo | ~₹75 | **~₹325 – ₹495 / mo** | Usage Metered |
| **TOTAL**| **Complete Recurring Staging TCO** | — | **Full 3-Server + DB + AI + CDN Platform** | **~$125 – $145 USD** | — | **~₹12,500 – ₹14,700 / mo** | **All-Inclusive** |

> [!IMPORTANT]
> **Server 2 Budget Compliance:** Item 02 (Zealosh VC Media Node) costs **~₹6,195 INR/month (inclusive of 18% GST)** on OVHcloud Rise-1 Bare Metal (or **~₹5,074 INR/month** on Contabo Cloud VDS M). This is **well below the ₹10,000 INR/month ceiling**, leaving over ₹3,800 INR/month of budgetary headroom.

---

## 3. Server 2 (Zealosh VC Media Node) Detailed Provider Evaluation

BigBlueButton 4.0 Media Stack requires predictable, high-performance CPU processing for real-time WebRTC audio/video mixing (FreeSWITCH and Mediasoup/Kurento) and simultaneous recording encoding (RAP pipeline). The table below compares current, verified provider offerings:

| Provider | SKU & Tier | CPU Architecture | RAM | Storage | Bandwidth & Port Speed | Monthly Price (excl. tax) | Monthly Price (incl. 18% GST) | Compliance Verdict (< ₹10,000/mo) |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **OVHcloud** | **Rise-1 Bare Metal** *(Primary)* | Intel Xeon-E 2386G (6 Cores / 12 Threads @ 3.5 GHz) | 32 GB DDR4 ECC | 2x 512 GB NVMe (Soft RAID) | 1 Gbps Unmetered / Anti-DDoS | ~₹5,250 / mo (€55 / $62) | **₹6,195 / mo** | **PASSED (38% Headroom)** — Physical Bare Metal, Zero Virtualization Contention |
| **Contabo** | **Cloud VDS M** *(Alternate)* | Dedicated AMD EPYC (8 Dedicated vCPUs) | 32 GB RAM | 240 GB NVMe | 1 Gbps Port, Unmetered (Fair Use) | ~₹4,300 / mo (€49 / $52) | **₹5,074 / mo** | **PASSED (49% Headroom)** — 8 Dedicated vCPUs, 32 GB RAM |
| **Hetzner Cloud** | **CCX23** | Dedicated AMD EPYC (4 Dedicated vCPUs) | 16 GB RAM | 160 GB NVMe | 20 TB Traffic, 1 Gbps Port | ~₹8,000 / mo (€86.49) | **₹9,440 / mo** | **PASSED (Borderline)** — 16 GB RAM meets minimum, higher unit cost |
| **Hetzner Cloud** | **CCX33** | Dedicated AMD EPYC (8 Dedicated vCPUs) | 32 GB RAM | 240 GB NVMe | 30 TB Traffic, 1 Gbps Port | ~₹12,800 / mo (€138.99) | **₹15,100 / mo** | **DISQUALIFIED (Over Budget)** — Exceeds ₹10,000/mo ceiling following mid-2026 pricing updates |

### Recommendation for Server 2
- **First Choice:** **OVHcloud Rise-1 Bare Metal** (Physical single-tenant hardware, ECC memory, hardware RAID NVMe, total isolation from hypervisor scheduling jitter).
- **Secondary Choice:** **Contabo Cloud VDS M** (Dedicated AMD EPYC cores, 32 GB RAM, exceptional price-to-performance ratio).

---

## 4. One-Time Procurement Line Items: Independent Penetration Testing

Before promoting staging to production, an independent third-party penetration test is mandatory.

| Service | Scope & Standard | Vendor Tier | Estimated Cost Range (INR) | Deliverables |
| :--- | :--- | :--- | :---: | :--- |
| **Independent Web & API Penetration Test** | OWASP ASVS v4.0.3 Level 2, WSTG v4.2, Server 1/2/3 configuration review | CERT-In Empaneled / CREST Accredited Security Firm | ₹75,000 – ₹1,25,000 (One-Time) | Formal Executive Summary, Technical Vulnerability Report with CVSS v3.1 scoring, Proof-of-Concept exploits, and 30-day Free Re-Testing Certificate |

---

## 5. Domain, DNS & SSL Procurement Matrix

| Asset | Domain Name | Registrar / Provider | Purpose | Annual / Monthly Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Apex Domain** | `zealosh.com` | Cloudflare Registrar / Namecheap | Official Institutional Website | ~₹1,100 / year ($12/yr) |
| **LMS Subdomain** | `app.zealosh.com` | Cloudflare DNS (Orange Cloud) | Production LMS Core Web Application | Included with domain |
| **VC Subdomain** | `vc.zealosh.com` | Cloudflare DNS (Orange Cloud) | Live Classroom Web & WebSocket Signaling | Included with domain |
| **TURN Subdomain** | `turn.zealosh.com` | Cloudflare DNS (Grey Cloud DNS-Only)| WebRTC UDP Media Relay (Direct IP) | Included with domain |
| **SSL/TLS Certificates**| `*.zealosh.com` | Let's Encrypt / Cloudflare Origin CA | End-to-End TLS 1.3 Encryption | **₹0 (Free Automated)** |

---

## 6. Procurement Execution Checklist for Stakeholders

Upon formal approval of this milestone, the authorized human purchasing agent must execute the following sequential actions:

1. **Account Setup & Identity Verification:**
   - [ ] Create/login to OVHcloud or Contabo account with institutional credentials (`procurement@zealosh.com`).
   - [ ] Complete KYC verification (required for dedicated bare-metal server provisioning).
2. **Server 2 Provisioning:**
   - [ ] Order **OVHcloud Rise-1 Bare Metal** (or **Contabo Cloud VDS M**) in European or Indian datacenter region.
   - [ ] Select **Ubuntu 24.04 LTS 64-bit** clean base image.
   - [ ] Record Public IPv4, initial root password, and SSH key fingerprint.
3. **Server 1 Provisioning:**
   - [ ] Order **Hetzner Cloud CPX31** (or **Contabo VPS 2**) with Ubuntu 24.04 LTS.
   - [ ] Attach private network subnet `10.0.0.0/24`.
4. **Server 3 Provisioning:**
   - [ ] Order **Contabo Cloud VPS 3** (or **Hetzner CPX31**) with Ubuntu 24.04 LTS.
   - [ ] Attach private network interface `10.0.0.3`.
5. **Database Activation:**
   - [ ] Upgrade existing Supabase project to **Pro Plan** ($25/mo) in Frankfurt or Mumbai region.
   - [ ] Enable automated daily backups and note down PostgREST URL and Service Role Key.
6. **Object Storage Activation:**
   - [ ] Create Cloudflare R2 bucket `zealosh-production-storage` with private access credentials.

