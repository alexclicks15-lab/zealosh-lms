---
name: devops-and-docker-deploy
description: >-
  DevOps, Docker multi-stage builds, Docker Compose, CI/CD pipelines, environment configuration, and cloud deployments.
  Use this skill when creating Dockerfiles, configuring docker-compose environments, setting up GitHub Actions CI/CD,
  managing production environment variables, configuring health checks, or deploying to Vercel/Cloudflare/VPS.
---

# DevOps, Docker & Deployment Runbook

This skill outlines production containerization standards, CI/CD pipeline automation, and cloud deployment procedures.

---

## 1. Multi-Stage Dockerfile Pattern (Next.js & Node)

Create lightweight, secure multi-stage Docker images running as non-root:

```dockerfile
# Stage 1: Base & Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

---

## 2. GitHub Actions CI/CD Pipeline

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Typecheck
        run: npm run typecheck || npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Run Tests
        run: npm test

      - name: Run Playwright E2E
        run: npx playwright test
        env:
          CI: true
```

---

## 3. Production Deployment & Health Checks

1. **Zero-Downtime Health Check**: Implement `/api/health` that verifies database connectivity and core service availability.
2. **Environment Variable Management**: Never bake secrets into Docker images or client builds. Inject at runtime via container orchestrator or secret manager.
3. **Graceful Shutdown**: Handle `SIGTERM` and `SIGINT` signals to close active database connections and complete inflight HTTP requests before terminating.
4. **Log Aggregation**: Output structured JSON logs to `stdout`/`stderr` with timestamps, log levels, and request trace IDs.
