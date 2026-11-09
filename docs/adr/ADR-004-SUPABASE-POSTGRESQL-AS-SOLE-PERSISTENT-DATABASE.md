# ADR-004: Supabase PostgreSQL as Sole Authoritative Persistent Database & Local Storage Elimination

## Status
**APPROVED** — 2026-11-01

## Context
Zealosh Training & Consultants operates Zealosh LMS (`https://zealosh.com`), an enterprise digital learning and certification platform for high-stakes occupational safety certifications (BCSP ASP/CSP, BCRSP, CIH).

During earlier prototyping and Phase 1–3 milestones, Zealosh LMS utilized a hybrid architecture:
1. Primary relational database schemas were created across 12 migrations in `supabase/migrations/` (58 PostgreSQL tables).
2. However, runtime data access in `src/lib/store/db.ts` maintained in-memory collections (`Map` instances) and serialized state to a local JSON file (`data/zealosh-store.json`) via `persistToDisk()` and `hydrateFromDisk()`.
3. In certain recording, doubt, and certificate flows, exceptions during remote Supabase calls caught errors and silently fell back to in-memory maps and disk persistence (`console.warn('Fallback to in-memory...')`).
4. This dual-write/fallback mechanism posed critical institutional risks:
   - Split source of truth: Data written during a temporary database outage could exist solely in local memory/disk and diverge from PostgreSQL.
   - Durability risk in serverless/container environments: Ephemeral instances lose in-memory and local disk state on restart or scale-out.
   - Non-compliance with enterprise data governance: Dual writes circumvent PostgreSQL ACID constraints, Row-Level Security (RLS), and audit log immutability.

To achieve enterprise production readiness, an explicit institutional architectural mandate was established:
**Supabase PostgreSQL must be the sole authoritative persistent database for Zealosh LMS.**

---

## Decision

We formally deprecate all runtime local disk persistence, in-memory persistent stores, dual writes, and silent fallback mechanisms, establishing **Supabase PostgreSQL as the sole authoritative persistence layer**.

### 1. Authoritative Architecture Flow
```
Client (Browser / PWA)
         │
         ▼  (HTTPS / REST / Server Actions)
Next.js 14 Authenticated Route Handlers (`src/app/api/**/route.ts`)
         │
         ▼  (Server-Side RBAC & Session Token Validation)
Zealosh Persistence Layer (`src/lib/store/db.ts` & `supabase-adapter.ts`)
         │
         ▼  (Direct TLS Pool / Server-Isolated Service Role Client)
Supabase PostgreSQL (Authoritative Single Source of Truth)
```

### 2. Elimination of Runtime Local Storage Mechanisms
- **`data/zealosh-store.json`**: Formally disconnected from runtime application execution. The physical file is preserved byte-for-byte (SHA-256: `F1CB59D0B3FC129548763266B8A1993300D76EB842070657B7719F5F21B3FB10`, 45,005 bytes) as an immutable historical artifact, but is NEVER written to or hydrated from during runtime execution.
- **Runtime `persistToDisk()`**: Deactivated for application runtime. Any call to `persistToDisk()` when pointing to `data/zealosh-store.json` immediately returns `false` without executing disk I/O.
- **Client-Side Storage**: Browser `localStorage`, `sessionStorage`, `IndexedDB`, and `localForage` are strictly forbidden for persistent educational or business records (courses, batches, enrollments, attempts, grades, certificates, invoices). Client-side storage is restricted strictly to non-authoritative UI state (e.g. cookie-based auth session tokens and theme preferences).

### 3. Fail-Safe Error Handling & Elimination of Silent Fallbacks
- All silent catch-and-fallback blocks (`console.warn('Fallback to in-memory...')`) in `src/lib/store/db.ts` are eliminated.
- Database operational failures, network partitions, connection pool exhaustion, or service unavailability in `supabase` storage mode MUST propagate as typed errors (`DatabaseOperationalError`).
- The system will **NEVER** silently fall back to in-memory maps or local files when PostgreSQL is unavailable.
- Failed operations must fail cleanly and transparently without leaving uncommitted partial state in memory.

### 4. Permitted Role for In-Memory State
In-memory data structures are permitted strictly for:
- Request processing pipelines and transactional staging within a single execution context.
- Transient read caching (with cache invalidation on write) where authoritative records reside in PostgreSQL.
- Isolated, hermetic unit tests where `DATABASE_STORAGE=in_memory` is explicitly configured in test harnesses.

---

## Consequences

### Positive Consequences
- **Single Source of Truth**: 100% of institutional records (Users, Enrollments, Courses, Exams, Submissions, Recordings, Audits) reside authoritatively in PostgreSQL.
- **Multi-Instance Durability**: Serverless functions and horizontal container scaling (Docker/VPS) operate reliably without data loss or cache desynchronization.
- **Relational Integrity & RLS**: All mutations enforce PostgreSQL primary keys, foreign keys (`ON DELETE RESTRICT`), unique constraints, and check constraints.
- **Predictable Failure Modes**: Database errors surface immediately as typed exceptions, preventing silent data loss or phantom commits.

### Negative Consequences / Trade-offs
- Operations in `supabase` mode require network connectivity to PostgreSQL; transient outages result in operational failure rather than degraded local operation.
- Unit tests that test real Supabase queries require network connectivity to the staging database or dedicated mock fixtures.

### Mitigations
- Network resilience is maintained via connection pooling, retry logic, and server-side timeouts.
- Dedicated automated durability suite (`tests/database-durability.test.ts`) verifies cross-process persistence.
- Dedicated automated outage failure suite (`tests/database-outage-failure.test.ts`) verifies typed error handling and zero local fallback.

---

## Compliance & Governance
- **Principle 3 (Data Ownership & Isolation)**: Enforced. PostgreSQL is authoritative.
- **Principle 7 (Database Integrity is Mandatory)**: Enforced. Zero duplicate split stores.
- **Principle 8 (Verify Before Claiming Completion)**: Verified by 40 test files, 484/484 tests passing, clean TypeScript check, clean production build across 75 routes, and verified hash on `data/zealosh-store.json`.

