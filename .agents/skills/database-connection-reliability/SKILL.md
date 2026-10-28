---
name: database-connection-reliability
description: Governs database connection pools, pool exhaustion prevention, client lifecycle, idle timeouts, transaction isolation, retry safety, serverless connection handling, and leak detection.
---

# Database Connection Reliability & Pool Governance

## 1. Purpose & Core Invariants
The **Database Connection Reliability** skill ensures that applications maintain resilient, performant, and leak-free communication with the persistence layer under high concurrency, network partitions, and container restarts.

### Non-Negotiable Invariants:
1. **Never create redundant connection pools**: Creating a new database client instance on every request exhausts available database connections within minutes.
2. **Never swallow database connection errors silently**: Log connection failures with structured context and emit health probe failures.
3. **Never retry non-idempotent transactions blindly**: Retrying mutations after a timeout can result in duplicate payments, double enrollments, or corrupted audit logs.

---

## 2. Connection Pool Architecture & Sizing

### Connection Pool Sizing Formula:
$$\text{Pool Size} = ((\text{Core Count} \times 2) + \text{Effective Spindle Count})$$
For cloud PostgreSQL hosts (Supabase, AWS RDS, DigitalOcean Managed DB):
- **Server 1 Dedicated Node**: Sized to max 20–30 connections per worker process.
- **Connection Pooler (Supavisor / PgBouncer)**:
  - **Transaction Mode (Port 6543)**: Ideal for stateless REST API endpoints and serverless functions (short-lived queries, no session state).
  - **Session Mode (Port 5432)**: Mandatory for Moodle Core or applications using prepared statements, session-level temporary tables, or advisory locks.

---

## 3. Connection Leak Prevention Checklist

1. **Always Release Connections**:
   - In Node.js / TypeScript, ensure `client.release()` or ORM scopes execute in a `finally` block:
     ```typescript
     const client = await pool.connect();
     try {
       await client.query('BEGIN');
       // business logic
       await client.query('COMMIT');
     } catch (err) {
       await client.query('ROLLBACK');
       throw err;
     } finally {
       client.release(); // Mandatory to prevent pool exhaustion
     }
     ```
2. **Configure Explicit Timeouts**:
   - `connectionTimeoutMillis`: 5,000ms (fail fast rather than queue indefinitely).
   - `idleTimeoutMillis`: 30,000ms (reap stale connections).
   - `statement_timeout`: 10,000ms (prevent runaway unbounded queries).
3. **Singleton Client Initialization**:
   - Verify database adapters export a singleton instance rather than instantiating new pools on module imports or route requests.

---

## 4. Troubleshooting & Connection Recovery Workflow

When a database connection failure occurs:
1. **Gather Evidence**: Check database server error logs (`FATAL: remaining connection slots are reserved for non-replication superuser connections` indicates a connection leak).
2. **Check Active Connections**:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
3. **Identify Leaking Clients**: Inspect queries in `idle in transaction` state.
4. **Implement Smallest Fix**: Increase pooler limits if legitimately under-provisioned, or patch unreleased client handles in the application code.
5. **Verify Recovery**: Run connection probe suite and verify healthcheck endpoint returns HTTP 200.
