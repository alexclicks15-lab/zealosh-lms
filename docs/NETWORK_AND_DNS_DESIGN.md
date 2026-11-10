# Zealosh LMS — Network Topology, Firewall & DNS Architecture Design

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-09 — Stage A: Staging Infrastructure Architecture, Technical Readiness & Procurement Planning  
**Target Domain:** `zealosh.com`  
**Staging Environment FQDN:** `staging.zealosh.com` / `app.staging.zealosh.com`  
**DNS Status:** **NO CHANGES EXECUTED — PLANNING SPECIFICATION ONLY**  
**Date:** November 2026  

---

## 1. Network Topology & Ingress Architecture

The Zealosh staging network is structured into three distinct security tiers:
1. **Edge Anycast Tier (Public Ingress):** Managed by Cloudflare CDN/WAF. Terminates public TLS 1.3, mitigates DDoS attacks, and proxies HTTP traffic.
2. **DMZ Application & Media Tier (Host Layer):** Server 1 (LMS Core) and Server 2 (VC Media Node) reside on public IP addresses with strict host firewall (`ufw`) policies.
3. **Isolated Private Network Tier (Internal Backplane):** Internal communication between Server 1 and Server 3 (AI inference) or administrative bastions occurs over a private RFC 1918 subnet (`10.0.0.0/24`) or encrypted WireGuard mesh.

```mermaid
graph TD
    Internet((Public Internet)) --> Cloudflare["Cloudflare Edge Anycast Network (Global CDN / WAF)"]
    
    subgraph Edge_Routing["Edge DNS & Proxy Routing"]
        Cloudflare -->|Orange Cloud (Proxied)| CF_HTTPS["Edge TLS 1.3 Termination<br/>app.staging.zealosh.com<br/>vc.staging.zealosh.com"]
        Cloudflare -->|Grey Cloud (DNS-Only)| CF_UDP["Direct UDP Routing<br/>turn.staging.zealosh.com"]
    end

    subgraph Host_DMZ["Host DMZ (Public Interfaces)"]
        CF_HTTPS -->|HTTPS / Port 443| S1_Proxy["Server 1: Nginx Reverse Proxy (127.0.0.1:3000)"]
        CF_HTTPS -->|HTTPS & WSS / Port 443| S2_Proxy["Server 2: Nginx Media Proxy (BigBlueButton API)"]
        CF_UDP -->|UDP 16384-32768| S2_WebRTC["Server 2: WebRTC RTP Streams & Coturn"]
    end

    subgraph Private_Network["Private Isolated Subnet (10.0.0.0/24)"]
        S1_Internal["Server 1 Private IP: 10.0.0.1"]
        S3_Internal["Server 3 Private IP: 10.0.0.3 (Ollama :11434)"]
        S1_Internal -->|HTTP REST / No Public Ingress| S3_Internal
    end

    subgraph Cloud_PaaS["Encrypted Cloud Services (Outbound Only)"]
        S1_Proxy -->|TLS Port 5432 / 6543| Supabase[("Supabase Managed Database")]
        S1_Proxy -->|HTTPS S3 API| R2[("Cloudflare R2 Object Storage")]
    end
```

---

## 2. Proposed Subdomain Architecture

To prevent architectural complexity while maintaining clear operational separation, Zealosh consolidates services onto minimal subdomains:

| FQDN | DNS Record Type | Target Destination | Proxy Status (Cloudflare) | Functional Purpose |
| :--- | :---: | :--- | :---: | :--- |
| **`app.staging.zealosh.com`** | `A` | Server 1 Public IPv4 | **Proxied (Orange Cloud)** | Primary LMS web application, student portal, admin console, and App Router APIs. |
| **`vc.staging.zealosh.com`** | `A` | Server 2 Public IPv4 | **Proxied (Orange Cloud)** | BigBlueButton 4.0 web signaling, presentation slides, and REST API endpoints. |
| **`turn.staging.zealosh.com`** | `A` | Server 2 Public IPv4 | **DNS-Only (Grey Cloud)** | WebRTC STUN/TURN media relay and UDP RTP audio/video traffic (bypass CDN). |
| **`storage.staging.zealosh.com`** | `CNAME` | `<r2-bucket>.r2.cloudflarestorage.com` | **Proxied (Orange Cloud)** | Publicly downloadable student certificates and static marketing media. |

> [!NOTE]
> **Subdomain Consolidation Rationale:**  
> - Administrative interfaces (`/admin`) and API endpoints (`/api/*`) are served directly under `app.staging.zealosh.com`. Creating separate subdomains like `api.staging.zealosh.com` or `admin.staging.zealosh.com` introduces unnecessary CORS preflight roundtrips, cookie domain complexity, and extra SSL certificates.  
> - AI services are strictly internal on private network `10.0.0.3:11434` and **do not receive any public subdomain**.

---

## 3. Host Firewall Policies (`ufw`)

### 3.1 Server 1 (Zealosh LMS Core Application Host)
Server 1 operates a fail-closed firewall policy:
```bash
# Default policies
ufw default deny incoming
ufw default allow outgoing

# Public web ingress
ufw allow 80/tcp comment 'Nginx HTTP redirect to HTTPS'
ufw allow 443/tcp comment 'Nginx HTTPS TLS 1.3 termination'

# Administrative access (Restricted to Bastion / VPN IP)
ufw allow from <ADMIN_BASTION_IP> to any port 22 proto tcp comment 'SSH management'

# Private network ingress
ufw allow in on eth1 to 10.0.0.1 comment 'Private network interface'

# Enable firewall
ufw --force enable
```

### 3.2 Server 2 (Zealosh VC Media Node)
Server 2 requires direct public UDP accessibility for real-time WebRTC media streams:
```bash
# Default policies
ufw default deny incoming
ufw default allow outgoing

# Public web and signaling ingress
ufw allow 80/tcp comment 'BBB Let\'s Encrypt / HTTP'
ufw allow 443/tcp comment 'BBB HTTPS / WSS signaling'

# WebRTC audio & video RTP stream port range
ufw allow 16384:32768/udp comment 'WebRTC RTP audio/video streams'

# Coturn STUN/TURN binding
ufw allow 3478/tcp comment 'Coturn STUN/TURN TCP'
ufw allow 3478/udp comment 'Coturn STUN/TURN UDP'

# Administrative SSH (Restricted to Bastion / VPN IP)
ufw allow from <ADMIN_BASTION_IP> to any port 22 proto tcp comment 'SSH management'

# Enable firewall
ufw --force enable
```

### 3.3 Server 3 (Zealosh AI Inference Node — If Provisioned)
Server 3 is **completely isolated from the public internet**:
```bash
# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow Ollama port ONLY from Server 1 Private IP
ufw allow from 10.0.0.1 to any port 11434 proto tcp comment 'Ollama private inference from Server 1'

# Administrative SSH (Restricted to Bastion / VPN IP)
ufw allow from <ADMIN_BASTION_IP> to any port 22 proto tcp comment 'SSH management'

# Enable firewall
ufw --force enable
```

---

## 4. Reverse Proxy & TLS Configuration

### 4.1 Server 1 Nginx Configuration Template
Located in `deploy/nginx/nginx.staging.conf`:
- **SSL Protocols:** `TLSv1.2 TLSv1.3` exclusively. Insecure protocols (SSLv3, TLS 1.0, TLS 1.1) are explicitly forbidden.
- **SSL Ciphers:** High-security modern cipher suite (`ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256`).
- **HTTP Strict Transport Security (HSTS):** `max-age=31536000; includeSubDomains; preload`.
- **Proxy Headers:** Preserves client IP addresses passed from Cloudflare:
  ```nginx
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $http_cf_connecting_ip;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto https;
  ```
- **Proxy Timeouts:** Extended to 90 seconds on `/api/exams/*` and `/api/admin/reports/*` to accommodate heavy evaluation jobs without 504 Gateway Timeouts.
- **WebSocket Upgrade:** Supported on `/api/messages/*` and `/live/*` via `proxy_set_header Upgrade $http_upgrade` and `proxy_set_header Connection "upgrade"`.

### 4.2 Automated TLS Certificate Renewal
- **Edge Layer:** Managed automatically by Cloudflare with Universal SSL (Cloudflare Origin CA certificates installed on origin servers with 15-year validity).
- **Direct WebRTC Layer (Server 2):** Automated via Let's Encrypt Certbot with systemd timer (`certbot renew --quiet`).

---

## 5. Webhook Ingress & Server-to-Server Authentication

To prevent spoofed requests and replay attacks on external ingress endpoints:
1. **BigBlueButton Recording Callback (`POST /api/webhooks/bbb/recording`):**
   - Server 2 signs the callback JSON payload using `HMAC-SHA256` with `BBB_WEBHOOK_SECRET`.
   - Next.js route handler extracts header `x-zealosh-signature-256`, computes HMAC over the raw request body, and rejects mismatches with HTTP 401 `INVALID_SIGNATURE`.
2. **Payment Provider Webhooks (`POST /api/payments/webhook`):**
   - Validates provider HMAC signatures against `PAYMENT_WEBHOOK_SECRET`.
   - Checks idempotency table `payment_webhook_events` to ensure no payment event is credited twice.
3. **WhatsApp Inbound Webhooks (`POST /api/webhooks/whatsapp`):**
   - Verifies Meta webhook verification token on `GET`, validates SHA-256 HMAC signature on `POST`.

---

## 6. Comprehensive DNS Change Plan (Pending Execution)

The following DNS change plan must be executed in the Cloudflare DNS dashboard **only after server provisioning is authorized and completed**:

| Step # | Record Name | Type | Target Value / IP | TTL | Proxy Mode | Dependency / Precondition | Rollback Action |
| :---: | :--- | :---: | :--- | :---: | :---: | :--- | :--- |
| **01** | `app.staging.zealosh.com` | `A` | `<SERVER_1_PUBLIC_IP>` | Auto | **Proxied (Orange)** | Server 1 provisioned, Nginx running, port 443 open. | Delete record or change IP to maintenance placeholder. |
| **02** | `vc.staging.zealosh.com` | `A` | `<SERVER_2_PUBLIC_IP>` | Auto | **Proxied (Orange)** | Server 2 provisioned, BigBlueButton installed. | Delete record. |
| **03** | `turn.staging.zealosh.com` | `A` | `<SERVER_2_PUBLIC_IP>` | 120s | **DNS-Only (Grey)** | Coturn active, UDP 16384–32768 open on Server 2. | Delete record. |
| **04** | `storage.staging.zealosh.com` | `CNAME` | `<R2_BUCKET_ID>.r2.cloudflarestorage.com` | Auto | **Proxied (Orange)** | Cloudflare R2 bucket created, custom domain attached. | Remove CNAME record. |

> [!WARNING]
> **Zero Premature DNS Changes:**  
> These DNS entries are documented for planning and approval only. No records have been created or modified in any DNS zone.

