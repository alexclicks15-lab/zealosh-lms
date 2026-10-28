---
name: database-migration-safety
description: Governs zero-downtime database migrations, backward-compatible DDL, non-destructive schema evolution, lock timeout prevention, data preservation, and verified rollback procedures.
---

# Database Migration Safety & Zero-Downtime Governance

## 1. Purpose & Non-Negotiable Invariants
The **Database Migration Safety** skill protects persistent production data against accidental loss, schema lockups, and breaking API transitions during deployments.

### Non-Negotiable Migration Invariants:
1. **Never drop, truncate, or recreate a table as a shortcut**: All schema evolutions must be additive or staged safely across deployments.
2. **Never execute destructive DDL directly in production without a verified rollback plan**: Renaming columns, dropping columns, or changing column types abruptly will crash running application replicas.
3. **Always use transactions for DDL where supported**: Ensure migrations fail atomically without leaving half-applied schema state.

---

## 2. Zero-Downtime Migration Patterns (Expand / Contract)

When modifying existing columns or breaking structural changes:

```mermaid
sequenceDiagram
    participant App as App Version 1
    participant DB as PostgreSQL Database
    participant Mig as Migration Runner
    participant NewApp as App Version 2

    Note over Mig,DB: Phase 1: Expand (Additive DDL)
    Mig->>DB: Add new column (nullable/default)
    Note over App,DB: Old app reads/writes old column
    Note over NewApp,DB: Phase 2: Dual-Writing
    NewApp->>DB: App writes both old and new columns
    Note over Mig,DB: Phase 3: Backfill Historical Data
    Mig->>DB: UPDATE table SET new_col = old_col WHERE new_col IS NULL
    Note over NewApp,DB: Phase 4: Contract
    NewApp->>DB: App reads strictly from new column
    Mig->>DB: Drop old column safely in subsequent release
```

---

## 3. Migration Safety Checklist (Preflight & Postflight)

### Preflight DDL Checklist:
- [ ] **Table Lock Assessment**: Does this migration lock a large table? (e.g. `ADD COLUMN ... NOT NULL` without default locks the entire table).
- [ ] **Concurrent Indexing**: Use `CREATE INDEX CONCURRENTLY` in PostgreSQL to prevent read/write locks.
- [ ] **Lock Timeout**: Set strict lock timeout to prevent queueing transactions:
  ```sql
  SET lock_timeout = '3s';
  ```
- [ ] **Idempotency**: Use `IF NOT EXISTS` / `IF EXISTS` where appropriate:
  ```sql
  CREATE TABLE IF NOT EXISTS ...
  ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
  ```

### Rollback & Verification Protocol:
- [ ] Every forward migration must have a paired rollback verification script or documented recovery boundary.
- [ ] Test the forward migration on an isolated staging clone before production.
- [ ] Verify that existing application code operates cleanly when connected to the migrated schema.
- [ ] Never claim a migration is production-ready if it has only been inspected visually.
