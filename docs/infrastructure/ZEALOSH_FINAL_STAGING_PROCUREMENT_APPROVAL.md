# Zealosh LMS — Final Staging Procurement Specification & Authorization Package

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-09 — Staging Procurement, Provisioning & Release Gating  
**Authoritative Repositories:** `zealosh-lms`, `zealosh-classroom`  
**Security Classification:** Restricted / Commercial & Infrastructure Governance  
**Date:** November 8, 2026  
**Status:** **READY FOR STAKEHOLDER PROCUREMENT AUTHORIZATION — CHARGES STRICTLY FROZEN**

---

## 1. Executive Mission & Governance Boundary

This document serves as the formal procurement authorization proposal for the multi-node staging infrastructure of **Zealosh Training & Consultants** (Kollam, Kerala, India).

### Non-Negotiable Procurement Rules (Section 2 Compliance)
1. **Zero Premature Orders:** No server, database tier, edge CDN subscription, storage bucket, or security testing contract may be purchased, spun up, or committed without explicit, written authorization from the institutional authority.
2. **Server 2 Hard Budget Ceiling:** The monthly recurring cost for Server 2 (Zealosh VC Media Node) must strictly remain **below ₹10,000 INR/month**, inclusive of Indian GST (18%) and foreign exchange buffer.
3. **Execution Boundary:** All configuration files, cloud-init scripts, reverse proxy templates, firewall rules, and deployment procedures are prepared deterministically in advance, but **no chargeable API or order button has been or will be executed** by the engineering agent without explicit approval.
4. **Brand Primacy:** All invoices, server hostnames, and reverse-proxy registrations are registered strictly under **Zealosh Training & Consultants**.

---

## 2. Server 2 (Zealosh VC Media Node) Provider Comparison & Budget Compliance

BigBlueButton 4.0 Media Stack requires predictable, high-performance computing for real-time WebRTC audio/video mixing (FreeSWITCH and Mediasoup/Kurento) and simultaneous recording encoding (RAP pipeline). The table below compares current, verified provider offerings:

| Evaluation Dimension | Primary Choice: OVHcloud Rise-1 Bare Metal | Secondary Alternative: Contabo Cloud VDS M | Tertiary Option: Hetzner Cloud CCX23 |
| :--- | :--- | :--- | :--- |
| **Server Category** | **Physical Dedicated Bare-Metal** | Dedicated Virtual Server (VDS) | Dedicated Cloud Instance |
| **Data Center Region** | **Mumbai, India (Local Low Latency)** | Mumbai, India / Singapore | Falkenstein, Germany |
| **CPU Architecture** | Intel Xeon-E 2386G (6 Cores / 12 Threads @ 3.5 GHz base / 4.7 GHz turbo) | AMD EPYC (8 Dedicated vCPUs) | AMD EPYC (4 Dedicated vCPUs) |
| **RAM** | 32 GB DDR4 ECC RAM | 32 GB RAM | 16 GB RAM |
| **Storage** | 2 x 512 GB NVMe SSD (Hardware / Software RAID-1) | 240 GB NVMe SSD | 160 GB NVMe SSD |
| **Public Bandwidth** | **1 Gbps Unmetered** (Crucial for WebRTC burst) | 1 Gbps Port, 32 TB Fair Use | 20 TB Traffic, 1 Gbps Port |
| **Hypervisor Interference** | **Zero (100% Bare Metal, No Steal Time)** | Low (Dedicated vCPUs) | Low (Dedicated vCPUs) |
| **Base Monthly Cost** | ~₹5,250 INR/mo (€55 / $62 USD) | ~₹4,300 INR/mo (€49 / $52 USD) | ~₹8,000 INR/mo (€86.49 EUR) |
| **Indian GST (18%)** | ~₹945 INR/mo | ~₹774 INR/mo | ~₹1,440 INR/mo |
| **Total Monthly Cost** | **~₹6,195 INR/month (incl. 18% GST)** | **~₹5,074 INR/month (incl. 18% GST)** | **~₹9,440 INR/month (incl. 18% GST)** |
| **Budget Ceiling (< ₹10k)**| **PASSED — ₹3,805 / 38% Headroom** | **PASSED — ₹4,926 / 49% Headroom** | **PASSED — Marginal ₹560 Headroom** |
| **Contract / Renewal** | Monthly commitment, cancelable anytime | Monthly commitment, cancelable anytime | Monthly commitment, cancelable anytime |
| **Recommendation** | **STRONGLY RECOMMENDED** | Recommended Fallback | Not recommended (high latency to India) |

---

## 3. Consolidated Staging Platform Bill of Materials (BOM)

| Item # | System Role | Recommended Provider & SKU | Hardware / Resource Specs | Base Monthly Cost | Est. Tax (18% GST/VAT) | Total Monthly Cost (INR) | Billing Model | Procurement Status |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **01** | **Server 1: Zealosh LMS Core** | **Hetzner Cloud CPX31** *(Alt: Contabo VPS 2)* | 4 vCPU (AMD EPYC), 8 GB RAM, 160 GB NVMe, 20 TB traffic, 1 IPv4 | €14.90 / mo (~₹1,380) | ~₹248 | **~₹1,628 / mo** | Hourly Metered (Monthly Capped) | Ready for Purchase |
| **02** | **Server 2: Zealosh VC (Media)** | **OVHcloud Rise-1 Bare Metal** | Intel Xeon-E 2386G (6C/12T), 32 GB ECC, 2x512GB NVMe RAID-1, 1 Gbps unmetered | ~₹5,250 / mo ($62 USD) | ~₹945 | **~₹6,195 / mo** | Monthly Subscription | Ready for Purchase |
| **03** | **Server 3: Zealosh AI (Inference)** | **Contabo Cloud VPS 3** *(Alt: Hetzner CPX31)* | 8 vCPU, 24 GB RAM, 200 GB NVMe, 32 TB traffic, Private LAN | $19.50 / mo (~₹1,650) | ~₹297 | **~₹1,947 / mo** | Monthly Subscription | Ready for Purchase |
| **04** | **Database & Auth (Managed PaaS)** | **Supabase Pro Plan** | PostgreSQL 15+, GoTrue Auth, 8 GB DB storage, 100k MAU, PITR backups | $25.00 / mo (~₹2,100) | ~₹378 | **~₹2,478 / mo** | Monthly SaaS | Ready for Upgrade |
| **05** | **Edge CDN, WAF & DNS** | **Cloudflare Free / Pro Tier** | Global Anycast DNS, L3/L4/L7 DDoS mitigation, Edge TLS 1.3 | $0.00 – $20.00 / mo | ~₹0 – ₹300 | **~₹0 – ₹1,980 / mo** | Monthly SaaS | Ready for Activation |
| **06** | **Encrypted Object Storage** | **Cloudflare R2 / AWS S3** | 50 GB storage, Class A/B operations (PDFs & BBB recordings) | ~$3.00 – $5.00 / mo | ~₹75 | **~₹325 – ₹495 / mo** | Usage Metered | Ready for Setup |
| **SUBTOTAL**| **Consolidated Recurring Cost** | — | **Full 3-Server + DB + AI + CDN Platform** | **~$125 – $145 USD** | — | **~₹12,573 – ₹14,723 / mo** | All-Inclusive | **FROZEN PENDING APPROVAL** |

---

## 4. One-Time Procurement Line Items

| Item # | Purpose / Service | Provider / Authority | Estimated Cost Range (INR) | Justification & Deliverables |
| :---: | :--- | :--- | :---: | :--- |
| **OT-01** | **Apex Domain Registration** | Cloudflare Registrar / Namecheap (`zealosh.com`) | ~₹1,100 / year ($12 USD) | Official institutional domain, DNSSEC, automated TLS certificates. |
| **OT-02** | **Independent Penetration Test** | CERT-In Empaneled / CREST Accredited Security Firm | ₹75,000 – ₹1,25,000 (One-Time) | OWASP ASVS 5.0.0 Level 2 + WSTG 4.2 full platform audit; 30-day free re-test certificate. |
| **OT-03** | **Server 2 Setup Fee (if any)** | OVHcloud (frequently waived on 12-mo or promotions) | ₹0 – ₹2,500 (One-Time) | Physical hardware rack installation and initial provisioning. |

---

## 5. Formal Procurement Approval Checklist (Stakeholder Action Required)

To authorize procurement, the authorized institutional stakeholder must review and sign off on the following:

- [ ] **Approval 1 (Server 1):** Authorize Hetzner Cloud account creation and provisioning of CPX31 VPS (~₹1,628/mo).
- [ ] **Approval 2 (Server 2):** Authorize OVHcloud account creation and ordering of Rise-1 Bare Metal in Mumbai DC (~₹6,195/mo, 38% under budget ceiling).
- [ ] **Approval 3 (Server 3):** Authorize Contabo account creation and ordering of Cloud VPS 3 (~₹1,947/mo) for private AI inference.
- [ ] **Approval 4 (Supabase Managed PaaS):** Authorize upgrade of Zealosh Core project to Supabase Pro Tier ($25/mo, ~₹2,478/mo).
- [ ] **Approval 5 (Storage & CDN):** Authorize Cloudflare R2 bucket creation and Cloudflare Pro activation.
- [ ] **Approval 6 (Security Vendor RFP):** Approve release of `docs/infrastructure/ZEALOSH_PENETRATION_TESTING_RFP.md` to selected CERT-In / CREST accredited vendors for formal quotation.

**Stakeholder Sign-Off:**  
*Name:* _______________________________________  
*Role:* Institutional Executive / Managing Director  
*Date:* _______________________________________  
*Authorization Status:* **PENDING FORMAL SIGNATURE**

