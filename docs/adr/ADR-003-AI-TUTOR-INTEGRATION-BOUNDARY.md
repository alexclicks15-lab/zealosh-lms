# Architecture Decision Record (ADR)
## ADR-003: Optional AI Tutor Feature Gate, Minimal Integration Boundary & Strict Security Constraints

**Document ID:** ADR-003  
**Status:** **PROPOSED / NOT APPROVED FOR FULL IMPLEMENTATION**  
**Date:** October 27, 2026  
**Deciders:** Principal Software Architect, Lead Security Engineer, Database Architect, Product Lead  
**Scope:** Core Hub, AI Tutor Capability Gate, Provider Abstraction, and Data Protection Invariants  

---

## 1. Context & Problem Statement

Product stakeholders have proposed an interactive "AI Tutor" to assist students in preparing for international Health, Safety, and Environment (HSE) certifications (e.g., ASP, CSP, IOSH, NEBOSH). 

However, premature deployment of AI infrastructure introduces severe enterprise risks:
1. **Unapproved Infrastructure & Operational Costs:** Provisioning dedicated GPU servers, cloud LLM tokens, or self-hosted Ollama instances without verified demand, budget approval, and unit economics creates unauthorized operational expenses.
2. **Academic & Assessment Integrity:** High-stakes certification prep platforms cannot permit an AI system to leak active exam questions, reveal restricted answer keys, or generate unverified or hallucinated safety guidance.
3. **Data Privacy & Tenant Isolation:** Learners and corporate cohorts must never have their notes, doubt questions, or personal data exposed across cohort boundaries or ingested into unapproved training sets.
4. **Platform Distraction:** The core LMS must function flawlessly as a secure, standalone learning platform independently of any optional AI assistant.

**Core Questions:**
- How do we prepare the architectural seams so that an AI Tutor can be added in the future without major architectural rework, while guaranteeing that **zero AI infrastructure is deployed, zero outbound inference calls occur, and the feature remains completely invisible and inaccessible today**?

---

## 2. Decision & Invariants

The Zealosh AI Tutor is formally classified as **OPTIONAL, PROPOSED, AND NOT APPROVED FOR FULL IMPLEMENTATION**.

We establish a minimal, non-invasive architectural integration boundary governed by the following non-negotiable rules:

### 2.1 Authoritative Central Feature Gate
1. **Default Value:** Strictly `false` (`ai_tutor_enabled = FALSE`).
2. **Storage:** Persisted authoritatively in `public.feature_flags` via PostgreSQL migration `20261027000007_zealosh_ai_tutor_gate.sql` and mapped in `SupabaseAdapter` and `db.ts`.
3. **Immutability by Default:** No migration, seed script, container start, or database reset shall automatically set this flag to `true`.
4. **Strict Superadmin Privilege:** Only an authenticated user with `SUPER_ADMIN` role and `settings.manage` permission may alter the flag. Ordinary users, instructors, and organization admins are rejected with HTTP 403 Forbidden.
5. **No Premature Operational Controls:** No operational "Enable AI Tutor" button is surfaced in regular administrator UI tabs to avoid misleading administrators before implementation is approved.

### 2.2 Server-Side Hard Gate & Zero Outbound Inference
1. **Gate Enforcement Before Execution:** All server endpoints and service methods (`aiTutorService.query()`, `checkHealth()`) invoke `assertAiTutorEnabled()` as their first operation. If disabled, an `AiTutorDisabledError` is thrown immediately.
2. **Zero Incurred Costs:** When disabled, zero background jobs, zero model downloads, zero vector embeddings, zero Ollama calls, and zero third-party API requests are executed.
3. **Client Visibility:** When disabled, no chatbot widgets, navigation links, launchers, or tutor pages are visible to students, instructors, or anonymous guests.
4. **Direct API Protection:** Direct POST requests to `/api/ai-tutor/query` return HTTP 403 `AI_TUTOR_DISABLED`.

### 2.3 Strict Assessment and Security Firewalls
If the AI Tutor is approved in the future, the following boundaries must be maintained:
1. **Active Exam Lockout:** The tutor is automatically suspended for any student with an active, in-progress exam attempt (`EXAM_IN_PROGRESS`).
2. **Restricted Question Bank Isolation:** Raw question answer keys (`correctOptionIds`), exam explanations, and blueprint scoring weights must never be queryable or embedded into tutor context.
3. **Course Enrollment Isolation:** Students may only query course materials for courses in which they hold an `ACTIVE` enrollment.
4. **Server-Only Provider Proxying:** All model interactions must occur server-side through `AiTutorProvider`. Browsers must never connect directly to Ollama or AI endpoints.

### 2.4 Candidate Deployment Architecture (For Future Evaluation Only)
- **Candidate:** Self-hosted Ollama on a dedicated, isolated VPS (e.g. `Server 3` on an internal private VPC), communicating strictly over mutual TLS or private networking.
- **Evaluation Criteria:** Model accuracy on HSE terminology (OSHA, BCSP, NEBOSH regulations), latency under concurrent load, zero document hallucination with verifiable source citations, and strict privacy guarantees.
- **Current Status:** Not provisioned. Not deployed. Zero spend authorized.

---

## 3. Consequences

### Positive:
- **Zero Risk & Zero Cost:** The platform incurs no AI infrastructure costs, GPU hosting fees, or external API bills.
- **Safe Seam:** The `AiTutorService` interface, config validation, and route seam allow future integration without refactoring core LMS routes or database architecture.
- **Audit Compliance:** Attempts to access or tamper with the tutor feature are blocked and logged.

### Negative / Limitations:
- The AI Tutor remains non-operational until formal product, security, and financial sign-off is granted.
