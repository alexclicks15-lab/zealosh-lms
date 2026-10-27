---
name: postgresql-and-supabase
description: >-
  PostgreSQL database design, indexing, migrations, query optimization, connection pooling, and Supabase RLS.
  Use this skill when designing relational schemas, writing complex SQL queries, tuning database performance,
  configuring Row Level Security (RLS) policies, or managing database migrations.
---

# PostgreSQL & Supabase Database Runbook

This skill establishes database design standards, query optimization techniques, transaction safety, and Supabase Row Level Security (RLS) policies.

---

## 1. Schema Design Best Practices

- **Primary Keys**: Use `UUIDv7` (time-sortable) or `BIGINT GENERATED ALWAYS AS IDENTITY` for relational entities.
- **Foreign Keys**: Always define foreign keys with appropriate `ON DELETE` behaviors (`CASCADE`, `RESTRICT`, or `SET NULL`).
- **Audit Columns**: Include `created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL` and `updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL` on all tables.
- **Constraints**: Enforce domain rules with `CHECK` constraints (e.g., `CHECK (price >= 0)`, `CHECK (status IN ('draft', 'published', 'archived'))`).

---

## 2. Supabase Row Level Security (RLS) Patterns

Always enable RLS on every user/tenant-facing table:

```sql
-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own orders
CREATE POLICY "Users can view own orders" 
ON orders FOR SELECT 
USING (auth.uid() = customer_id);

-- Allow authenticated users to insert orders for themselves
CREATE POLICY "Users can create own orders" 
ON orders FOR INSERT 
WITH CHECK (auth.uid() = customer_id);

-- Allow admins full access via role check or app metadata
CREATE POLICY "Admins have full access to orders" 
ON orders FOR ALL 
USING (
  coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'admin'
  OR (auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean = true
);
```

---

## 3. Indexing & Query Optimization

1. **Foreign Keys**: Always index foreign key columns to prevent full table scans during joins and cascade deletions.
2. **Compound Indexes**: Order columns by equality first, range/sort second:
   ```sql
   CREATE INDEX idx_orders_customer_status_created 
   ON orders (customer_id, status, created_at DESC);
   ```
3. **Partial Indexes**: Index only active/relevant subsets to save RAM and write overhead:
   ```sql
   CREATE INDEX idx_unfulfilled_orders 
   ON orders (created_at) 
   WHERE status IN ('pending', 'processing');
   ```
4. **Text Search**: Use `pg_trgm` or GIN full-text indexes (`to_tsvector('english', name || ' ' || description)`) for search.

---

## 4. Concurrency & Transaction Safety

- **Inventory Row-Locks**: Use `SELECT ... FOR UPDATE` inside transactions when reserving inventory to prevent race conditions:
  ```sql
  BEGIN;
  SELECT stock_quantity 
  FROM product_variants 
  WHERE id = $1 
  FOR UPDATE;
  
  UPDATE product_variants 
  SET stock_quantity = stock_quantity - $2 
  WHERE id = $1 AND stock_quantity >= $2;
  COMMIT;
  ```
