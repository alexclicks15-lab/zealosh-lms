---
name: saas-multi-tenant-architecture
description: >-
  Multi-tenant SaaS architecture, tenant isolation, RBAC/ABAC permissions, billing/subscriptions, and usage metering.
  Use this skill when building multi-tenant SaaS systems, organization/workspace partitioning,
  role-based access control, subscription tiers, feature flags, or tenant audit logs.
---

# SaaS Multi-Tenant Architecture Runbook

This skill outlines design patterns and implementation guidelines for secure, scalable multi-tenant SaaS platforms.

---

## 1. Tenant Isolation Models

```
Option A: Row-Level Partitioning (Shared Database, Shared Schema)
  ├── Fast provisioning, lowest infrastructure cost
  └── Isolation enforced via `tenant_id` on every table + Postgres RLS

Option B: Schema-per-Tenant (Shared Database, Separate Schemas)
  ├── Moderate isolation, simplified tenant backup/restore
  └── Dynamic schema switching via search_path

Option C: Database-per-Tenant (Isolated Databases)
  ├── Highest regulatory/compliance isolation (Enterprise tier)
  └── Dynamic connection pool routing via tenant resolver
```

---

## 2. Row-Level Isolation Implementation

Every domain entity table must include `tenant_id`:

```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- RLS policy for tenant isolation
CREATE POLICY tenant_isolation_policy ON tenant_resources
FOR ALL USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);
```

---

## 3. RBAC & Permissions Matrix

Structure permissions into clear roles and granular abilities:

| Role | Organization Management | Billing & Plans | Resource Creation | Read-Only Access |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | Full | Full | Full | Full |
| **Admin** | Member Invites | View Only | Full | Full |
| **Member** | None | None | Create & Edit Own | Full (Within Org) |
| **Viewer** | None | None | None | Read Only |

---

## 4. Usage Metering & Feature Flagging

- **Idempotent Usage Tracking**: Record billable events (`api_calls`, `storage_bytes`, `orders_processed`) with unique idempotency keys.
- **Entitlement Checks**: Validate tenant plan tier before unlocking features:
  ```typescript
  export async function checkFeatureEntitlement(orgId: string, feature: 'custom_domains' | 'advanced_crm' | 'webhooks'): Promise<boolean> {
    const org = await getOrgWithPlan(orgId);
    return org.plan.features.includes(feature);
  }
  ```
- **Audit Logging**: Maintain an append-only `audit_logs` table tracking `actor_id`, `action`, `entity_type`, `entity_id`, `metadata`, and `ip_address`.
