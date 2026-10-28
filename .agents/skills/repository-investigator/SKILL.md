---
name: repository-investigator
description: Enforces Rule 1 (Inspect before implementing). Systematically maps codebase structure, application entry points, existing services, database schemas, API contracts, callers, and test suites before proposing or executing any code modification.
---

# Repository Investigator

## 1. Purpose
The **Repository Investigator** ensures that the AI engineer operates with complete contextual awareness of the existing codebase. It strictly forbids "blind coding," guessing file structures, or creating duplicate modules when solutions already exist.

---

## 2. Investigation Protocol (Mandatory Before Editing)

Before editing or creating any file, execute the following 5-point inspection:

### Phase 1: Application Topology & Entry Points
1. Inspect the workspace root configuration (`package.json`, `tsconfig.json`, `docker-compose.yml`, `.env.example`).
2. Identify runtime framework and routing pattern (Next.js 14 App Router, Express, Fastify, etc.).
3. Identify application entry points (`src/app/`, `src/index.ts`, `src/main.ts`).

### Phase 2: Feature & Responsibility Mapping
1. Search for existing implementations of the requested capability using `grep_search`:
   - Search for entity names, function names, API route paths, or related keywords.
2. Inspect existing controllers, handlers, services, and adapters.
3. Trace existing data flows from incoming request to persistence layer.

### Phase 3: Data Model & Persistence Inspection
1. Identify the authoritative database and ORM (Supabase, PostgreSQL, Prisma, Drizzle, raw SQL).
2. Inspect schema definitions (`supabase/migrations/`, `schema.sql`, entity models).
3. Check existing tables, columns, constraints, foreign keys, and indexes before proposing new fields.

### Phase 4: Caller & Consumer Impact Analysis
1. Find all references to the target function, component, or endpoint before refactoring.
2. Verify that proposed changes will not break client interfaces, background workers, or external webhooks.
3. Check if existing unit or integration tests already cover the target area (`tests/`).

### Phase 5: Architectural Convention Audit
1. Identify prevailing design patterns (Dependency Injection, Adapter pattern, Repository pattern).
2. Inspect error handling, logging, and response serialization conventions.
3. Follow existing naming conventions and design token systems.

---

## 3. Investigation Checkpoints & Output Checklist

Before moving to the implementation phase, the investigator must answer:
- [ ] Where is similar functionality implemented in this codebase?
- [ ] What existing utilities, types, or services can be imported directly?
- [ ] What existing database entities or columns already store related data?
- [ ] What tests exist today that prove the current behavior?
- [ ] What is the exact blast radius of the proposed modification?

If the answer to "where is similar functionality implemented" is unknown, continue searching before writing code.
