---
name: database-architecture
description: Enforces Rule 7 (Database integrity is mandatory). Governs relational schema design, normalization, entity modeling, constraints, foreign keys, index architecture, ORM consistency, and prevents duplicate tables or split sources of truth.
---

# Database Architecture & Governance

## 1. Purpose & Non-Negotiable Rules
The **Database Architecture** skill ensures the structural integrity, normalization, and semantic coherence of the persistent storage layer. It guarantees that the database remains the authoritative single source of truth without redundant tables or fragmented entity ownership.

### Non-Negotiable Invariants:
1. **Never create a parallel table for an existing entity**: If a "customer" entity exists, adding "customer_preferences" must either extend the customer table or have a strict 1-to-1 foreign key relationship.
2. **Never split sources of truth**: A single business fact (e.g. order total, enrollment status, user role) must live in exactly one authoritative column.
3. **Never drop constraints for convenience**: Foreign keys, unique constraints, and check constraints enforce domain rules at the lowest level.

---

## 2. Existing Schema Investigation (Part 8.1)

Before proposing any database change:
1. **Inspect Existing Tables & Relations**:
   - Review active migrations in `supabase/migrations/` or database definitions.
   - Map existing foreign keys, primary keys, and unique indexes.
2. **Inspect Existing Entities**:
   - Check if an existing table already stores related attributes (e.g. checking `users` for role attributes before creating a `roles` table).
3. **Inspect Active Query Patterns**:
   - Check how application repositories query the entity (`src/lib/store/`).
   - Identify join overhead and high-frequency read/write paths.

---

## 3. Schema Evolution Guidelines (Part 8.2)

### When Adding a New Attribute:
1. **Extend Existing Table**: If the attribute represents intrinsic state of an existing entity (e.g., `phone_number`, `badge_url`), add a column to the existing table.
2. **Use Additive, Nullable or Defaulted Columns**:
   ```sql
   ALTER TABLE users ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL;
   ```
   *Never* add a `NOT NULL` column without a sensible `DEFAULT` to a table with existing rows.
3. **Preserve Naming Conventions**:
   - Tables: Lowercase snake_case, pluralized (e.g., `exam_attempts`, `course_batches`).
   - Columns: Lowercase snake_case (e.g., `user_id`, `created_at`).
   - Foreign Keys: `[singular_target_table]_id` with explicit `REFERENCES`.

### When Creating a New Table:
Only introduce a new table when:
- The data represents an independent business entity with distinct lifecycles.
- A true 1-to-many or many-to-many relationship exists (e.g., `student_enrollments`, `course_reviews`).
- The data volume or mutation frequency is vastly different from the parent entity.

---

## 4. Indexing & Constraint Architecture

- **Primary Keys**: UUID v4 or autoincrementing integers (`BIGSERIAL`).
- **Foreign Keys**: Always indexed to optimize join performance and cascade lookups.
- **Unique Constraints**: Tenant-scoped uniqueness where applicable (e.g., `UNIQUE(organization_id, course_slug)`).
- **Check Constraints**: Enforce domain validation in PostgreSQL (e.g., `CHECK (price_inr >= 0)`).
- **Partial Indexes**: Use partial indexes for soft-deletes or status filters (e.g., `CREATE INDEX idx_active_users ON users(id) WHERE status = 'ACTIVE'`).
