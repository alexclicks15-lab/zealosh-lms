---
name: brainstorming-and-architecture
description: >-
  System architecture, requirements analysis, and design planning runbook.
  Use this skill when designing new systems, analyzing requirements, scoping complex features,
  evaluating architectural trade-offs, or establishing domain models.
---

# Brainstorming & System Architecture Runbook

This skill establishes a disciplined framework for designing robust, scalable, and maintainable software systems before writing production code.

---

## 1. The 4-Stage Architecture Framework

```
STAGE 1: REQUIREMENTS ANALYSIS & VALIDATION GATE
  ├── Problem Statement (User/Business problem)
  ├── Scope Boundaries (In-scope vs. Out-of-scope)
  └── Success Metrics & Non-Functional Requirements (Latency, RPS, Availability)
         │
         ▼
STAGE 2: DOMAIN MODELING & DATA FLOW
  ├── Entities, Attributes & Relationships
  ├── State Machines & Lifecycle Transitions
  └── Boundaries & Module Decoupling
         │
         ▼
STAGE 3: TECHNICAL DESIGN & TRADE-OFF EVALUATION
  ├── API Contracts & Schema Definitions (OpenAPI / TypeScript)
  ├── Component Hierarchy & Interaction Flow
  └── Architectural Decision Records (ADRs)
         │
         ▼
STAGE 4: IMPLEMENTATION ROADMAP & RISK MITIGATION
  ├── Phased Delivery Steps (Milestones)
  ├── Rollback Strategies & Failure Modes
  └── Verification & Test Matrix
```

---

## 2. Six-Question Feature Validation Gate

Before proposing any new architecture or module, answer:
1. **Real Need**: Does this solve an actual, validated operational or user problem?
2. **Frequency**: Will users/operators interact with this functionality regularly?
3. **Measurable Outcome**: Does it improve revenue, efficiency, reliability, or user experience?
4. **Existing Capabilities**: Can an existing module/service be extended instead of creating a new one?
5. **Maintenance Cost**: Does the architectural complexity justify the business value?
6. **Simplicity Preference**: What is the simplest architecture that completely solves the problem?

---

## 3. Architecture Decision Record (ADR) Template

When deciding between alternative architectural paths, document:

```markdown
# ADR-[NUM]: [Title of Decision]

## Status
[Proposed | Accepted | Superseded | Deprecated]

## Context
What technical or business context necessitates this decision?

## Decision
What is the chosen approach, pattern, or technology?

## Alternatives Considered
1. Alternative A: Pros and Cons
2. Alternative B: Pros and Cons

## Consequences
- **Positive**: What benefits are unlocked?
- **Negative / Trade-offs**: What operational overhead or constraints are accepted?
```

---

## 4. Key Architectural Patterns for Modern Web Apps

- **Modular Monolith**: Group features by domain modules (e.g., `orders`, `inventory`, `customers`, `delivery`) with strict public interfaces.
- **CQRS (Lightweight)**: Separate high-throughput read paths (cached/indexed queries) from transactional write paths (database mutations with locks).
- **Event-Driven Workflows**: Decouple side-effects (notifications, CRM sync, analytics) via background job queues.
- **Idempotency & Resilience**: Ensure all mutation endpoints accept an `Idempotency-Key` and wrap multi-step changes in database transactions.
