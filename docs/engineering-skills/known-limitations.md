# Zealosh LMS & Antigravity Engineering Intelligence System
## Known Limitations, Enforcement Boundaries & Verification Tiers

To maintain absolute architectural honesty and eliminate "simulated realism," this document delineates the operational boundaries of the Engineering Skill Ecosystem. It explicitly distinguishes between what is technically enforced by the platform, what is encouraged via prompt/instruction heuristics, what is empirically verified via automated test suites, and what strictly requires human manual review.

---

## 1. Classification of Enforcement Tiers

Every rule and principle in the Antigravity Engineering Intelligence System operates under one of four distinct tiers:

```
┌────────────────────────────────────────────────────────┐
│  Tier 1: Mechanically Enforced (Platform/OS/Compiler)  │
├────────────────────────────────────────────────────────┤
│  Tier 2: Programmatically Verified (Vitest / CI Tests) │
├────────────────────────────────────────────────────────┤
│  Tier 3: Instructionally Encouraged (LLM Heuristics)   │
├────────────────────────────────────────────────────────┤
│  Tier 4: Manual Human Review & Architectural Sign-off  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Breakdown by Architectural Domain

### 2.1 Skill Discovery & Invocation
| Capability / Constraint | Enforcement Tier | Mechanism & Evidence | Limitations & Edge Cases |
|:---|:---|:---|:---|
| **Skill Discovery** | **Tier 1** (Mechanically Enforced) | Antigravity engine scans `.agents/skills/*/SKILL.md` and `~/.gemini/config/skills/` on boot. Verified in workspace prompt. | Subdirectories deeper than 1 level or non-standard file extensions are not discovered. |
| **Automatic Routing** | **Tier 2** (Programmatically Verified) | Validated via `scripts/skill-validation/routing-scenarios.test.ts` (15/15 scenarios passing). | Model context window constraints may cause secondary sub-skills to be omitted if not explicitly prompted in complex tasks. |
| **Skill Selection Non-Bypass** | **Tier 3** (Instructionally Encouraged) | Prompt instructions in `AGENTS.md` mandate router evaluation before execution. | An external prompt or developer prompt directly requesting raw code generation can bypass the router unless gated by pre-commit hooks. |

---

### 2.2 Database Governance & Safety
| Capability / Constraint | Enforcement Tier | Mechanism & Evidence | Limitations & Edge Cases |
|:---|:---|:---|:---|
| **Zero Table Duplication** | **Tier 2 / Tier 3** (Hybrid) | Heuristically guided by `database-architecture/SKILL.md` and verified in schema test assertions. | Cannot mechanically prevent an agent from creating a separate table if user explicitly instructs table creation. |
| **Migration Lock Timeout & Safety** | **Tier 2** (Programmatically Verified) | Migration scripts in `prisma/migrations` or raw SQL scripts contain lock timeout guards and additive column statements. | Local developer environments without live PostgreSQL engines rely on static AST syntax verification rather than real database engine lock testing. |
| **Connection Pool Leak Prevention** | **Tier 1 / Tier 2** (Hybrid) | Singleton database client instantiated in `src/lib/db.ts`; verified in unit tests. | Serverless edge functions with high concurrent cold starts can exhaust connections unless PgBouncer / transaction mode pooling is enabled upstream. |
| **Production Database Safeguard** | **Tier 4** (Manual Human Review) | Strictly forbidden to execute `DROP`, `TRUNCATE`, or `RESET` on production databases. | Requires explicit human operator authorization before running any destructive migration or staging deploy script. |

---

### 2.3 Code Minimization & Reuse
| Capability / Constraint | Enforcement Tier | Mechanism & Evidence | Limitations & Edge Cases |
|:---|:---|:---|:---|
| **Zero Redundant Dependencies** | **Tier 1** (Mechanically Enforced) | `package.json` package additions require explicit `npm install`. Build fails on missing dependencies. | The agent might still write custom inline utility code instead of importing a native Node.js / Lodash / date-fns helper unless caught in code review. |
| **Reuse Existing Services** | **Tier 3** (Instructionally Encouraged) | Guided by `reuse-before-rebuild/SKILL.md` and `repository-investigator/SKILL.md`. | Requires thorough grep/ripgrep searching. If an existing utility has an obscure or non-standard name, the agent might inadvertently recreate a duplicate helper. |
| **Type Safety & Build Integrity** | **Tier 1** (Mechanically Enforced) | `npx tsc --noEmit` and `npm run build` validate 100% of TypeScript types, routes, and JSX primitives. | `any` casts or unvalidated `JSON.parse` operations can bypass compile-time safety without runtime Zod schemas. |

---

### 2.4 Performance Engineering
| Capability / Constraint | Enforcement Tier | Mechanism & Evidence | Limitations & Edge Cases |
|:---|:---|:---|:---|
| **Benchmark Evidence Requirement** | **Tier 3** (Instructionally Encouraged) | `performance-engineering/SKILL.md` strictly forbids claiming performance gains without empirical numbers. | Local development environments often have low latency that does not reflect production network latency, geographically distributed latency, or multi-tenant database contention. |
| **React Re-render Optimization** | **Tier 2** (Programmatically Verified) | Verified via Vitest render tests and static inspection of memoization hooks (`useMemo`, `useCallback`). | React synthetic event overhead and DevTools flame chart analysis require active browser sessions rather than purely headless CI execution. |

---

### 2.5 Multi-Tenant Isolation & Security
| Capability / Constraint | Enforcement Tier | Mechanism & Evidence | Limitations & Edge Cases |
|:---|:---|:---|:---|
| **Tenant ID Propagation** | **Tier 1 / Tier 2** (Hybrid) | Server-side API middleware and session token validation in `src/lib/auth.ts` enforce tenant scoping on queries. | If an endpoint fails to check `tenant_id` in a raw SQL query, the compiler will not detect the logical leak without an automated cross-tenant security test. |
| **Secret Protection & Hygiene** | **Tier 1 / Tier 2** (Hybrid) | Pre-commit git hooks and Vitest environment variable checks prevent committing unencrypted tokens or credentials. | In-memory debug logs might print sensitive parameters if error handlers serialize entire request payloads without sanitization. |
| **OWASP / Pen-Testing** | **Tier 4** (Manual Human Review) | Complex multi-vector injection attacks, SSRF via webhooks, and subtle timing attacks require periodic third-party security audits. | Headless automated scanners catch known signatures but cannot identify subtle business logic authorization bypasses. |

---

## 3. Transparency & Reporting Protocol

In all agent interactions, completion reports, and architectural proposals:
1. **Never conflate Tier 3 (Instructional heuristic) with Tier 1 (Mechanical guarantee).**
2. **Always cite test output as evidence:** When stating "this works," provide the test file, assertion count, and execution time.
3. **Explicitly mark unexecuted tests:** If an integration test or performance benchmark was skipped due to missing infrastructure, state:
   > *"Unverified in local environment: Real BigBlueButton WebRTC media audio/video latency was not benchmarked because local environment lacks a dedicated TURN/STUN server."*
4. **Honesty over perfection:** Acknowledging a verified gap is a hallmark of senior engineering discipline.
