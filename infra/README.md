# Zealosh LMS — Infrastructure & Deployment Package

This directory contains the automated Infrastructure-as-Code (Terraform), host initialization (Cloud-Init), and deployment automation scripts for **Zealosh Training & Consultants**.

---

## 1. Package Directory Map

```
infra/
├── terraform/                       # Terraform modules (DigitalOcean / Multi-Cloud)
│   ├── main.tf                      # Droplet / VM and VPC declarations
│   ├── variables.tf                 # Configurable instance sizes, regions, and admin IPs
│   ├── firewalls.tf                 # Network security rules for App and WebRTC media
│   └── outputs.tf                   # Public IPs and DNS mapping instructions
│
├── environments/
│   └── staging/
│       └── terraform.tfvars.example # Staging environment variables template
│
├── cloud-init/                      # Cloud-Init configurations for Ubuntu 22.04 LTS
│   ├── app-server.cloud-init.yaml   # Server 1: Docker, Compose, UFW, logrotate
│   └── media-server.cloud-init.yaml # Server 2: Kernel tuning & swap for BigBlueButton
│
├── scripts/                         # Idempotent operational shell scripts
│   ├── preflight-check.sh           # Host audit (CPU, RAM, disk, OS, ports)
│   ├── deploy-app-stack.sh          # Container build, volume setup, and launch
│   ├── moodle-activate-theme-and-sso.sh # Moodle CLI theme activation & cache purge
│   ├── backup-restore-test.sh       # Automated backup drill & restore verification
│   └── health-diagnostics.sh        # HTTP & container status diagnostic probes
│
└── README.md                        # This master guide
```

---

## 2. Infrastructure Architecture Overview

The Zealosh platform is deployed across **two physical/virtual nodes** to isolate heavy real-time WebRTC media traffic from database transactions:

1. **Server 1 (`zealosh-staging-app`):**
   - **Specs:** 4 vCPU, 16GB RAM, 100GB SSD, Ubuntu 22.04 LTS.
   - **Stack:** Nginx Reverse Proxy Gateway (:80/:443) -> Next.js Core Hub (:3000), Moodle 4.4 Engine (:80), PostgreSQL 16 (:5432), Redis 7 (:6379).
   - **DNS Record:** `lms.staging.zealosh.com` -> Server 1 IP.

2. **Server 2 (`zealosh-staging-media`):**
   - **Specs:** 8 Dedicated vCPUs, 16GB RAM, 500GB SSD, Dedicated Public IPv4.
   - **Stack:** BigBlueButton 4.0 Media Node (noble-400 / Ubuntu 24.04 LTS: FreeSWITCH, LiveKit SFU, custom Zealosh HTML5 client).
   - **DNS Record:** `media.staging.zealosh.com` -> Server 2 IP.

---

## 3. Provisioning Methods

### Method A: Automated Cloud Provisioning via Terraform (Recommended)
```bash
cd infra/terraform
cp ../environments/staging/terraform.tfvars.example terraform.tfvars
# Configure your digitalocean token and SSH key fingerprint
export DIGITALOCEAN_TOKEN="your_token"

terraform init
terraform plan
terraform apply
```
Terraform will output the public IP addresses and DNS configuration instructions.

### Method B: Manual Droplet Creation using Cloud-Init
When creating droplets/VMs in DigitalOcean, Hetzner, or AWS:
- For Server 1, paste `infra/cloud-init/app-server.cloud-init.yaml` into User Data.
- For Server 2, paste `infra/cloud-init/media-server.cloud-init.yaml` into User Data.

---

## 4. Deploying the Application & Moodle Engine (Server 1)

SSH into Server 1 and run:
```bash
# 1. Run preflight system verification
bash infra/scripts/preflight-check.sh

# 2. Deploy containerized platform stack
bash infra/scripts/deploy-app-stack.sh

# 3. Activate Zealosh Moodle theme & enable OAuth2
bash infra/scripts/moodle-activate-theme-and-sso.sh

# 4. Verify system health
bash infra/scripts/health-diagnostics.sh
```

---

## 5. Deploying the Live Classroom Media Server (Server 2)

SSH into Server 2 as root:
```bash
# 1. Execute automated installer with your target domain
sudo bash deploy/bbb-staging-setup.sh media.staging.zealosh.com admin@zealosh.com

# 2. Retrieve your BBB secret
bbb-conf --secret
```
Insert the retrieved `BBB_SECURITY_SALT` into `.env.staging` (or `.env.production`) on Server 1 and restart `zealosh-hub`.

---

## 6. Backup & Recovery Drill Verification

To test backup integrity and verify zero data corruption on Server 1:
```bash
bash infra/scripts/backup-restore-test.sh
```
This script snapshots `data/zealosh-store.json`, takes a PostgreSQL dump, restores it into a temporary database, verifies table counts, and cleans up.
