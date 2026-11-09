# Zealosh LMS — Multi-Node Staging Provisioning & Deployment Runbooks

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-07C — Multi-Node Staging Infrastructure Finalization & Procurement Readiness  
**Target Environment:** Staging Architecture v3.0 (Server 1, Server 2, Server 3, Supabase PaaS)  
**Security Classification:** Highly Confidential / Operational Runbooks  
**Date:** November 2026  

---

## 1. Overview & General Prerequisites

These step-by-step engineering runbooks provide reproducible, deterministic procedures to provision, configure, harden, and verify each server in the Zealosh three-node staging architecture.

### General Operator Prerequisites
1. Dedicated operator terminal with SSH key access (`ed25519` key pair).
2. Clean Ubuntu 24.04 LTS installations on all three server nodes.
3. Cloudflare DNS administrative access for domain `zealosh.com`.
4. Staging environment secrets securely prepared (zero storage in public repositories).

---

## 2. Server 1 Runbook: Zealosh LMS Core (Public Application Hub)

### 2.1 OS Initialization & Package Installation
```bash
# Connect to Server 1
ssh root@<SERVER_1_PUBLIC_IP>

# Update and install base utilities
apt-get update -y && apt-get upgrade -y
apt-get install -y curl wget git ufw nginx build-essential fail2ban jq

# Install Node.js 20 LTS (Active LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node and NPM versions
node -v   # Must report v20.x.x
npm -v    # Must report v10.x.x

# Install PM2 process manager globally
npm install -g pm2
```

### 2.2 Host Firewall Configuration
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 2.3 Application Deployment & Directory Setup
```bash
# Create application user and deploy directory
useradd -m -s /bin/bash deployer
mkdir -p /opt/zealosh
chown -R deployer:deployer /opt/zealosh

# As deployer user:
su - deployer
cd /opt/zealosh

# Clone or unpack application build artifact
# (In automated CI/CD, deployment package is unpacked here)
tar -xzf /tmp/zealosh-lms-staging-artifact.tar.gz -C /opt/zealosh

# Install production dependencies
npm ci --omit=dev

# Build Next.js application
npm run build

# Verify build output
ls -la /opt/zealosh/.next
```

### 2.4 Environment File & Secret Injection
Create `/opt/zealosh/.env.staging` (permissions `0600`):
```bash
cat <<'EOF' > /opt/zealosh/.env.staging
NODE_ENV=production
PORT=3000
ZEALOSH_ENVIRONMENT=staging
ZEALOSH_DOMAIN=app.zealosh.com
APP_BASE_URL=https://app.zealosh.com
NEXT_PUBLIC_APP_URL=https://app.zealosh.com
DATABASE_STORAGE=supabase

# Security & Session Secrets
JWT_SECRET=<STAGING_JWT_SECRET_MIN_32_CHARS>

# Authoritative Supabase Managed Database
NEXT_PUBLIC_SUPABASE_URL=https://<SUPABASE_PROJECT_ID>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_ANON_JWT>
SUPABASE_SERVICE_ROLE_KEY=<SUPABASE_SERVICE_ROLE_JWT>

# Server 2 (Zealosh VC Media Node) Integration
BBB_BASE_URL=https://vc.zealosh.com/bigbluebutton/api
BBB_SECURITY_SALT=<CAPTURED_FROM_SERVER_2_SALT>
BBB_WEBHOOK_CALLBACK_URL=https://app.zealosh.com/api/webhooks/bbb/recording
BBB_WEBHOOK_SECRET=<STAGING_HMAC_SECRET_MIN_16_CHARS>

# Server 3 (Zealosh AI Inference Node) Integration
OLLAMA_BASE_URL=http://10.0.0.3:11434
OLLAMA_MODEL=llama3.2:3b
AI_INFERENCE_TIMEOUT_MS=15000
EOF

chmod 0600 /opt/zealosh/.env.staging
```

### 2.5 PM2 Process Manager Configuration
Create `/opt/zealosh/ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'zealosh-lms',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/opt/zealosh',
      instances: 'max',
      exec_mode: 'cluster',
      env_file: '/opt/zealosh/.env.staging',
      max_memory_restart: '1500M',
      listen_timeout: 10000,
      kill_timeout: 5000,
      autorestart: true,
    },
  ],
};
```

Start and persist the application:
```bash
pm2 start /opt/zealosh/ecosystem.config.js
pm2 save
pm2 startup systemd -u deployer --hp /home/deployer
```

### 2.6 Nginx Reverse Proxy Configuration
Create `/etc/nginx/sites-available/zealosh-lms`:
```nginx
server {
    listen 80;
    server_name app.zealosh.com zealosh.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.zealosh.com zealosh.com;

    ssl_certificate /etc/ssl/certs/zealosh-origin.pem;
    ssl_certificate_key /etc/ssl/private/zealosh-origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

Enable site and restart Nginx:
```bash
ln -sf /etc/nginx/sites-available/zealosh-lms /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 2.7 Verification Probe
```bash
curl -I https://app.zealosh.com/api/health
# Must return HTTP/2 200 OK with "status": "ok"
```

---

## 3. Server 2 Runbook: Zealosh VC (BigBlueButton 4.0 Dedicated Media Node)

### 3.1 Pre-Installation Verification
Ensure Server 2 is clean Ubuntu 24.04 LTS on dedicated compute (OVHcloud Rise-1 or Contabo VDS M):
```bash
ssh root@<SERVER_2_PUBLIC_IP>

# Verify dedicated CPU resources
nproc               # Must report >= 6 cores
free -m             # Must report >= 16000 MB RAM (32GB recommended)
df -BG /            # Must report >= 50GB free NVMe storage
```

### 3.2 DNS Preflight Check
Before running installer, ensure DNS records have propagated:
```bash
# Both FQDNs must resolve to Server 2's public IP
dig +short vc.zealosh.com
dig +short turn.zealosh.com
```

### 3.3 Execute Automated Setup Script
Copy and execute `deploy/bbb-staging-setup.sh`:
```bash
chmod +x /root/bbb-staging-setup.sh
/root/bbb-staging-setup.sh \
  "vc.zealosh.com" \
  "admin@zealosh.com" \
  "https://app.zealosh.com/api/webhooks/bbb/recording" \
  "<STAGING_HMAC_SECRET_MIN_16_CHARS>"
```

### 3.4 Verification & Secret Extraction
```bash
# Verify BigBlueButton health
bbb-conf --check

# Verify isolated secret configuration file
ls -la /etc/bigbluebutton/zealosh-secret.env
# Permissions must be -rw------- (0600)

# Verify recording post_publish hook
ls -la /usr/local/bigbluebutton/core/scripts/post_publish/zealosh_post_publish.rb
```

---

## 4. Server 3 Runbook: Zealosh AI (Private Dedicated AI Inference Node)

### 4.1 Private Network Attachment & Host Firewall
Server 3 must be strictly inaccessible from the public internet:
```bash
ssh root@<SERVER_3_PUBLIC_IP>

# Configure UFW firewall
ufw default deny incoming
ufw default allow outgoing

# Allow SSH only from admin bastion IP
ufw allow from <ADMIN_BASTION_IP> to any port 22 proto tcp

# Allow Ollama port 11434 ONLY from Server 1 Private IP (10.0.0.1)
ufw allow from 10.0.0.1 to any port 11434 proto tcp

# Deny all other incoming traffic
ufw --force enable
```

### 4.2 Ollama Installation & Systemd Binding
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Configure Ollama systemd environment to bind strictly to Private IP
mkdir -p /etc/systemd/system/ollama.service.d/
cat <<'EOF' > /etc/systemd/system/ollama.service.d/environment.conf
[Service]
Environment="OLLAMA_HOST=10.0.0.3:11434"
Environment="OLLAMA_ORIGINS=http://10.0.0.1,https://app.zealosh.com"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
EOF

# Reload and restart Ollama service
systemctl daemon-reload
systemctl restart ollama
systemctl enable ollama
```

### 4.3 Model Pulling & Cache Warming
```bash
# Pull lightweight quantized models into local cache
ollama pull llama3.2:3b
ollama pull qwen2.5:3b

# Verify models are loaded
ollama list
```

### 4.4 Private Inference Connectivity Test
From Server 1, execute test curl:
```bash
curl -X POST http://10.0.0.3:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:3b",
    "prompt": "Respond with the single word: OK",
    "stream": false
  }'
# Must return JSON response with "response": "OK" within 2500ms
```

---

## 5. Supabase Managed Database Integration Runbook

### 5.1 Project Setup & Region Selection
1. Log in to Supabase Management Console (`https://supabase.com/dashboard`).
2. Provision new project under organization `Zealosh Training & Consultants`:
   - Name: `zealosh-staging-core`
   - Region: `eu-central-1` (Frankfurt) or `ap-south-1` (Mumbai).
   - Plan: Upgrade to **Pro Plan ($25/mo)** to enable automated daily backups, PITR, and increased compute.

### 5.2 Schema Migration Execution
From Server 1 (or developer workstation with database credentials):
```bash
# Connect directly to Port 5432 (Session Mode) to apply migrations
export PGPASSWORD="<SUPABASE_DB_PASSWORD>"
psql -h db.<SUPABASE_PROJECT_REF>.supabase.co -p 5432 -U postgres -d postgres \
  -f supabase/migrations/20261101000017_zealosh_support_ticketing_and_helpdesk.sql

# Verify migration status and RLS policies
psql -h db.<SUPABASE_PROJECT_REF>.supabase.co -p 5432 -U postgres -d postgres \
  -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';"
```

### 5.3 PostgREST REST API Health Check
```bash
curl -i -H "apikey: <SUPABASE_ANON_KEY>" \
  https://<SUPABASE_PROJECT_REF>.supabase.co/rest/v1/courses?select=id,title&limit=1
# Must return HTTP 200 OK with JSON array
```

