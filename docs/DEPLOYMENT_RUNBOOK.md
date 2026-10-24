# Zealosh LMS — Deployment Runbook & Operational Guide

**Document Version:** 1.0.0  
**Status:** Operations Baseline  
**Target Environments:** Local Development, Staging, Multi-Node Production

---

## 1. Environment Configurations & Secret Management

All environment variables must be declared in `.env` (development) or injected via secret managers (AWS Secrets Manager / Vault / Doppler in production).

### Critical Environment Variables:
```ini
# Application
NODE_ENV=production
PORT=3000
APP_BASE_URL=https://lms.zealosh.com
API_BASE_URL=https://lms.zealosh.com/api

# Database
DATABASE_URL=postgresql://zealosh_user:STRONG_PASSWORD@postgres-primary:5432/zealosh_lms?schema=public&sslmode=prefer
REDIS_URL=redis://:STRONG_REDIS_PASSWORD@redis-cluster:6379

# Authentication & JWT
JWT_SECRET=SUPER_SECURE_256_BIT_SECRET_KEY
JWT_EXPIRATION=15m
REFRESH_TOKEN_SECRET=SUPER_SECURE_REFRESH_SECRET_KEY
REFRESH_TOKEN_EXPIRATION=7d

# Moodle Integration
MOODLE_BASE_URL=https://moodle.internal.zealosh.com
MOODLE_WS_TOKEN=SECURE_MOODLE_WEB_SERVICE_TOKEN

# BigBlueButton Integration
BBB_BASE_URL=https://bbb.internal.zealosh.com/bigbluebutton/api
BBB_SECURITY_SALT=SECURE_BBB_SHARED_SECRET_SALT

# Payments
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=RAZORPAY_SECRET
STRIPE_SECRET_KEY=sk_live_...
PAYMENT_WEBHOOK_SECRET=WEBHOOK_SECRET

# Object Storage (S3 / R2)
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_BUCKET=zealosh-lms-assets
STORAGE_ACCESS_KEY_ID=...
STORAGE_SECRET_ACCESS_KEY=...
```

> [!CAUTION]
> Never commit active credentials, private keys, or `.env` files to source control.

---

## 2. Production Docker Architecture (`docker-compose.prod.yml`)

```mermaid
graph TD
    Internet((Public Web)) -->|HTTPS :443| NginxEdge[Reverse Proxy / TLS Termination]
    
    subgraph App_Cluster["Zealosh Application Tier"]
        NextApp["Next.js Web Frontend (Replicas: 2+)"]
        NestAPI["NestJS Backend API (Replicas: 2+)"]
        Worker["Background Queue Worker (BullMQ)"]
    end
    
    subgraph Data_Tier["Authoritative Data Tier"]
        PostgresDB[(PostgreSQL 16 Primary)]
        RedisStore[(Redis 7 Cache & Queue)]
    end
    
    subgraph Upstream_Tier["Specialized Services"]
        MoodleCore["Moodle 4.x (PHP-FPM + Nginx)"]
        BBBCluster["BigBlueButton 2.7+ Cluster"]
    end

    NginxEdge --> NextApp
    NginxEdge --> NestAPI
    NextApp --> NestAPI
    NestAPI --> PostgresDB
    NestAPI --> RedisStore
    Worker --> PostgresDB
    Worker --> RedisStore
    NestAPI --> MoodleCore
    NestAPI --> BBBCluster
```

---

## 3. Database Migration & Rollback Procedure

All database schema evolutions must be managed strictly via automated migrations:

1. **Deploying Migrations:**
   ```bash
   # Run pre-flight migration check
   npx prisma migrate deploy
   ```
2. **Rollback Strategy:**
   - In case of deployment failure, execute rollback script:
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```
   - For breaking schema changes, use the Expand/Contract (Blue/Green) schema pattern: introduce new columns as optional, populate them, and deprecate old columns in a subsequent release.

---

## 4. Disaster Recovery & Backup Verification

1. **Automated Database Backups:**
   - Daily full snapshot + hourly WAL archiving to encrypted off-site object storage.
   - Command:
   ```bash
   pg_dump -Fc --no-acl --no-owner -h $DB_HOST -U $DB_USER $DB_NAME | gzip > /backups/zealosh_db_$(date +%Y%m%d_%H%M%S).dump.gz
   ```
2. **Restoration Verification Protocol (Quarterly Drill):**
   - Restore database dump to an isolated staging test instance:
   ```bash
   dropdb -h $STAGING_HOST -U $STAGING_USER zealosh_test_restore
   createdb -h $STAGING_HOST -U $STAGING_USER zealosh_test_restore
   gunzip -c backup.dump.gz | pg_restore -h $STAGING_HOST -U $STAGING_USER -d zealosh_test_restore
   ```
   - Run automated health integrity suite against restored database.

---

## 5. Health Checks & Readiness Probes

The system provides dual probes for orchestrators (Kubernetes / Docker Swarm / ECS):
- **Liveness Probe (`/api/health/liveness`):** Returns HTTP 200 if the Node.js process is active and responsive.
- **Readiness Probe (`/api/health/readiness`):** Returns HTTP 200 only if:
  - PostgreSQL database connection is alive (`SELECT 1`).
  - Redis connection is operational (`PING -> PONG`).
  - Disk storage is writable.
