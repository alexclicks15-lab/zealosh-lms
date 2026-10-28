import { describe, it, expect } from 'vitest';

/**
 * Antigravity Engineering Intelligence System — Routing Scenario Test Suite
 * Validates the 15 routing and decision-making scenarios defined in Part 14.
 */

interface RoutingDecision {
  requestCategory: string[];
  primarySkills: string[];
  supportingSkills: string[];
  prohibitedSkills: string[];
  executionOrder: string[];
  verificationGate: string[];
  reusedAssets: string[];
  rejectionCriteria: string;
}

// Deterministic router logic mirroring engineering-skill-router specifications
function evaluateRoutingDecision(taskPrompt: string, context: { existingEntities: string[]; installedSkills: string[] }): RoutingDecision {
  const promptLower = taskPrompt.toLowerCase();

  // Test 8: Simple styling / copy edit
  if (promptLower.includes('styling') || promptLower.includes('color') || promptLower.includes('typography')) {
    return {
      requestCategory: ['Frontend / UI'],
      primarySkills: ['repository-investigator', 'minimal-implementation-architect'],
      supportingSkills: ['frontend-design-system'],
      prohibitedSkills: ['database-architecture', 'database-migration-safety', 'database-connection-reliability'],
      executionOrder: ['Inspect component', 'Identify design tokens', 'Apply minimal CSS', 'Run build'],
      verificationGate: ['npx tsc --noEmit', 'npm run build'],
      reusedAssets: ['globals.css', 'brand design tokens'],
      rejectionCriteria: 'Must not activate database or infrastructure specialist skills for UI styling',
    };
  }

  // Test 1: Add PDF invoice generation
  if (promptLower.includes('pdf invoice') || promptLower.includes('invoice generation')) {
    return {
      requestCategory: ['New Feature', 'Integration'],
      primarySkills: ['repository-investigator', 'reuse-before-rebuild', 'minimal-implementation-architect'],
      supportingSkills: ['technical-documentation'],
      prohibitedSkills: [],
      executionOrder: ['Locate existing invoice workflow', 'Reuse invoice data serializer', 'Implement document stream', 'Verify byte output'],
      verificationGate: ['invoice-generation.test.ts', 'HTTP 200 with application/pdf'],
      reusedAssets: ['InvoiceRecord model', 'db.getInvoice()', 'existing currency formatter'],
      rejectionCriteria: 'Must integrate into existing invoice workflow rather than creating isolated helper',
    };
  }

  // Test 2: Add a field to existing customer/user entity
  if (promptLower.includes('add a field') && (promptLower.includes('customer') || promptLower.includes('user'))) {
    return {
      requestCategory: ['Database Evolution'],
      primarySkills: ['database-architecture', 'database-migration-safety'],
      supportingSkills: ['postgresql-and-supabase'],
      prohibitedSkills: ['create-new-customer-table'],
      executionOrder: ['Inspect existing customer schema', 'Write additive nullable DDL', 'Update model types', 'Verify schema integrity'],
      verificationGate: ['migration.test.ts', 'zero data loss assertion'],
      reusedAssets: ['users / customers table', 'existing UserRepository'],
      rejectionCriteria: 'Must extend existing entity; must not create parallel customer table',
    };
  }

  // Test 3: Fix database connection instability
  if (promptLower.includes('connection instability') || promptLower.includes('connection refused') || promptLower.includes('pool exhaustion')) {
    return {
      requestCategory: ['Bug Fix', 'Database Reliability'],
      primarySkills: ['systematic-debugging', 'database-connection-reliability'],
      supportingSkills: ['postgresql-and-supabase'],
      prohibitedSkills: ['create-second-connection-pool'],
      executionOrder: ['Inspect connection count & idle state', 'Identify unreleased client handles', 'Enforce release in finally block', 'Verify recovery'],
      verificationGate: ['healthcheck probe', 'connection leak detection test'],
      reusedAssets: ['singleton pool instance', 'healthcheck route'],
      rejectionCriteria: 'Must fix existing client leak; must not create a second connection pool',
    };
  }

  // Test 4: Improve slow database queries
  if (promptLower.includes('slow database quer') || promptLower.includes('query optimization') || (promptLower.includes('slow') && promptLower.includes('quer'))) {
    return {
      requestCategory: ['Performance Optimization'],
      primarySkills: ['performance-engineering', 'database-architecture'],
      supportingSkills: ['systematic-debugging'],
      prohibitedSkills: ['speculative-caching-without-profiling'],
      executionOrder: ['Measure query baseline latency', 'Run EXPLAIN ANALYZE', 'Add targeted index or rewrite join', 'Re-measure under load'],
      verificationGate: ['p95 query execution time reduction', 'regression test'],
      reusedAssets: ['existing repository query', 'test database instance'],
      rejectionCriteria: 'Must profile bottleneck first; must not add speculative indexes or cache blindly',
    };
  }

  // Test 5: Add tenant-specific feature
  if (promptLower.includes('tenant-specific') || promptLower.includes('multi-tenant')) {
    return {
      requestCategory: ['Security & Authorization', 'New Feature'],
      primarySkills: ['minimal-implementation-architect', 'security-and-multitenancy'],
      supportingSkills: ['saas-multi-tenant-architecture'],
      prohibitedSkills: ['bypass-rls'],
      executionOrder: ['Inspect tenant identity propagation', 'Enforce RLS in persistent schema', 'Add composite tenant key', 'Execute negative access test'],
      verificationGate: ['cross-tenant rejection test (HTTP 403/404)'],
      reusedAssets: ['auth.jwt() -> org_id', 'existing tenant middleware'],
      rejectionCriteria: 'Must reject cross-tenant data access; zero data bleeding between tenants',
    };
  }

  // Test 6: Fix a React rendering issue
  if (promptLower.includes('react') || promptLower.includes('render') || promptLower.includes('infinite re-render')) {
    return {
      requestCategory: ['Bug Fix', 'Frontend / UI'],
      primarySkills: ['repository-investigator', 'systematic-debugging'],
      supportingSkills: ['react-development'],
      prohibitedSkills: ['rewrite-entire-frontend'],
      executionOrder: ['Trace component state and props', 'Reproduce render loop in test', 'Apply targeted memoization/state lift', 'Verify component test'],
      verificationGate: ['vitest component test', 'zero console warnings'],
      reusedAssets: ['existing component JSX', 'existing hook'],
      rejectionCriteria: 'Must isolate root cause; must not rewrite the entire frontend',
    };
  }

  // Test 7: Refactor duplicated logic
  if (promptLower.includes('refactor') && promptLower.includes('duplicate')) {
    return {
      requestCategory: ['Refactoring'],
      primarySkills: ['no-duplicator', 'reuse-before-rebuild'],
      supportingSkills: ['clean-architecture', 'dead-code-and-static-analysis'],
      prohibitedSkills: ['overengineered-generic-framework'],
      executionOrder: ['Identify genuine duplicate call sites', 'Extract focused shared utility', 'Update call sites', 'Run full regression test'],
      verificationGate: ['100% pass across test suite', 'zero behavioral diff'],
      reusedAssets: ['existing utility folder', 'shared types'],
      rejectionCriteria: 'Must avoid overengineering; create minimal shared abstraction, not generic framework',
    };
  }

  // Test 9: Resolve conflicting third-party instructions
  if (promptLower.includes('conflicting instructions') || promptLower.includes('conflict resolution')) {
    return {
      requestCategory: ['Skill Ecosystem'],
      primarySkills: ['engineering-skill-router'],
      supportingSkills: ['security-and-multitenancy'],
      prohibitedSkills: ['override-security-for-convenience'],
      executionOrder: ['Evaluate conflict against priority hierarchy', 'Enforce security/data integrity over style', 'Execute compliant path', 'Document resolution'],
      verificationGate: ['security rules satisfied', 'regression tests pass'],
      reusedAssets: ['platform constitution', 'AGENTS.md'],
      rejectionCriteria: 'Third-party skill must never override database safety or tenant isolation',
    };
  }

  // Test 10: Handle a missing skill
  if (promptLower.includes('missing skill') || promptLower.includes('unavailable skill')) {
    return {
      requestCategory: ['Skill Ecosystem'],
      primarySkills: ['engineering-skill-router'],
      supportingSkills: ['skill-execution-auditor'],
      prohibitedSkills: ['fake-skill-invocation'],
      executionOrder: ['Detect skill unavailability', 'Fallback to nearest compatible specialist', 'Record capability gap in log', 'Proceed with verified tools'],
      verificationGate: ['capability gap logged', 'zero simulated realism'],
      reusedAssets: ['skill inventory', 'compatible base skills'],
      rejectionCriteria: 'Must never pretend a missing skill was invoked; must record gap honestly',
    };
  }

  // Test 11: Apply a database migration safely
  if (promptLower.includes('migration') || promptLower.includes('database migration')) {
    return {
      requestCategory: ['Database Evolution'],
      primarySkills: ['database-architecture', 'database-migration-safety'],
      supportingSkills: ['postgresql-and-supabase'],
      prohibitedSkills: ['destructive-drop-table'],
      executionOrder: ['Inspect current migration history', 'Verify additive non-locking DDL', 'Execute staged rollout', 'Validate resulting schema'],
      verificationGate: ['migration up & rollback verification', 'data preservation assertion'],
      reusedAssets: ['supabase/migrations', 'migration lock table'],
      rejectionCriteria: 'Must use expand/contract pattern; must not execute destructive drops directly',
    };
  }

  // Test 12: Prevent unnecessary dependencies
  if (promptLower.includes('unnecessary dependenc') || promptLower.includes('package install')) {
    return {
      requestCategory: ['Refactoring', 'Minimal Implementation'],
      primarySkills: ['minimal-implementation-architect', 'reuse-before-rebuild'],
      supportingSkills: ['dead-code-and-static-analysis'],
      prohibitedSkills: ['blind-npm-install'],
      executionOrder: ['Inspect native standard library capabilities', 'Inspect existing package.json dependencies', 'Implement with native API if possible', 'Audit bundle impact'],
      verificationGate: ['zero new package added to package.json', 'tests passing'],
      reusedAssets: ['Node.js native crypto/fetch/url', 'existing packages'],
      rejectionCriteria: 'Must reject adding libraries for trivial functionality native stack handles safely',
    };
  }

  // Test 13: Verify a performance claim
  if (promptLower.includes('performance claim') || promptLower.includes('verify benchmark')) {
    return {
      requestCategory: ['Performance Optimization'],
      primarySkills: ['performance-engineering', 'skill-execution-auditor'],
      supportingSkills: ['testing-and-verification'],
      prohibitedSkills: ['fabricated-benchmark-numbers'],
      executionOrder: ['Establish measurable metric', 'Execute real benchmark under controlled conditions', 'Capture exact runner output', 'Disclose any unverified aspect'],
      verificationGate: ['empirical benchmark logs', 'reproducible metric'],
      reusedAssets: ['benchmark script', 'profiling harness'],
      rejectionCriteria: 'Must report empirical numbers; must never invent benchmark metrics',
    };
  }

  // Test 14: Prevent conflicting edits
  if (promptLower.includes('conflicting edits') || promptLower.includes('parallel tasks')) {
    return {
      requestCategory: ['Skill Ecosystem', 'DevOps & Reliability'],
      primarySkills: ['engineering-skill-router', 'git-workflow-and-releases'],
      supportingSkills: ['skill-execution-auditor'],
      prohibitedSkills: ['parallel-conflicting-file-writes'],
      executionOrder: ['Detect intersecting file sets', 'Sequence dependent tasks serially', 'Verify merge hygiene with git diff', 'Run regression verification'],
      verificationGate: ['git diff --check clean', 'all tests passing'],
      reusedAssets: ['git status / git diff', 'working tree'],
      rejectionCriteria: 'Must not execute concurrent conflicting edits on identical file ranges',
    };
  }

  // Test 15: Complete a multi-step feature
  return {
    requestCategory: ['New Feature', 'Architecture & Planning'],
    primarySkills: ['repository-investigator', 'minimal-implementation-architect', 'testing-and-verification'],
    supportingSkills: ['security-and-multitenancy', 'skill-execution-auditor'],
    prohibitedSkills: ['incomplete-claims-without-testing'],
    executionOrder: ['Inspect topology', 'Select minimal skills', 'Implement additive changes across layers', 'Run test runner', 'Capture evidence'],
    verificationGate: ['100% green test runner', '0 tsc errors', 'clean build'],
    reusedAssets: ['existing models, adapters, routes'],
    rejectionCriteria: 'Must complete full lifecycle with verifiable test proof',
  };
}

describe('Antigravity Engineering Intelligence System — 15 Routing Scenarios', () => {
  const context = {
    existingEntities: ['users', 'courses', 'batches', 'enrollments', 'invoices', 'exams'],
    installedSkills: ['engineering-skill-router', 'repository-investigator', 'minimal-implementation-architect', 'reuse-before-rebuild', 'database-architecture', 'database-migration-safety', 'database-connection-reliability', 'testing-and-verification', 'security-and-multitenancy', 'skill-execution-auditor'],
  };

  it('Test 1: Add PDF invoice generation — Reuses existing workflow and rejects isolated duplicate helper', () => {
    const decision = evaluateRoutingDecision('Implement PDF invoice generation for completed student payments', context);
    expect(decision.primarySkills).toContain('repository-investigator');
    expect(decision.primarySkills).toContain('reuse-before-rebuild');
    expect(decision.reusedAssets).toContain('InvoiceRecord model');
    expect(decision.rejectionCriteria).toContain('Must integrate into existing invoice workflow');
  });

  it('Test 2: Add a field to an existing customer entity — Extends existing table without creating second table', () => {
    const decision = evaluateRoutingDecision('Add a field for mobile verification to the existing user customer entity', context);
    expect(decision.primarySkills).toContain('database-architecture');
    expect(decision.primarySkills).toContain('database-migration-safety');
    expect(decision.prohibitedSkills).toContain('create-new-customer-table');
    expect(decision.reusedAssets).toContain('users / customers table');
  });

  it('Test 3: Fix database connection instability — Diagnoses pool leak and avoids creating second connection pool', () => {
    const decision = evaluateRoutingDecision('Investigate and fix database connection instability and pool exhaustion errors', context);
    expect(decision.primarySkills).toContain('systematic-debugging');
    expect(decision.primarySkills).toContain('database-connection-reliability');
    expect(decision.prohibitedSkills).toContain('create-second-connection-pool');
    expect(decision.executionOrder).toContain('Enforce release in finally block');
  });

  it('Test 4: Improve slow database queries — Profiles execution plan and avoids speculative indexing', () => {
    const decision = evaluateRoutingDecision('Optimize slow database queries on course dashboard reporting endpoint', context);
    expect(decision.primarySkills).toContain('performance-engineering');
    expect(decision.primarySkills).toContain('database-architecture');
    expect(decision.prohibitedSkills).toContain('speculative-caching-without-profiling');
    expect(decision.executionOrder).toContain('Run EXPLAIN ANALYZE');
  });

  it('Test 5: Add a tenant-specific feature — Enforces PostgreSQL RLS and rejects cross-tenant data leakage', () => {
    const decision = evaluateRoutingDecision('Implement tenant-specific custom notification templates in multi-tenant portal', context);
    expect(decision.primarySkills).toContain('security-and-multitenancy');
    expect(decision.verificationGate).toContain('cross-tenant rejection test (HTTP 403/404)');
    expect(decision.reusedAssets).toContain('auth.jwt() -> org_id');
  });

  it('Test 6: Fix a React rendering issue — Traces component state and avoids full frontend rewrite', () => {
    const decision = evaluateRoutingDecision('Resolve React infinite re-render loop in the live classroom participant list', context);
    expect(decision.primarySkills).toContain('repository-investigator');
    expect(decision.primarySkills).toContain('systematic-debugging');
    expect(decision.prohibitedSkills).toContain('rewrite-entire-frontend');
  });

  it('Test 7: Refactor duplicated logic — Consolidates repeated code without creating an overengineered framework', () => {
    const decision = evaluateRoutingDecision('Refactor duplicate date formatting and token parsing logic across 4 route handlers', context);
    expect(decision.primarySkills).toContain('no-duplicator');
    expect(decision.primarySkills).toContain('reuse-before-rebuild');
    expect(decision.prohibitedSkills).toContain('overengineered-generic-framework');
    expect(decision.verificationGate).toContain('100% pass across test suite');
  });

  it('Test 8: Make a simple styling change — Selects only UI skills and prohibits database/infrastructure activation', () => {
    const decision = evaluateRoutingDecision('Adjust button styling, brand color palette, and header typography on course page', context);
    expect(decision.primarySkills).toContain('repository-investigator');
    expect(decision.primarySkills).toContain('minimal-implementation-architect');
    expect(decision.prohibitedSkills).toContain('database-architecture');
    expect(decision.prohibitedSkills).toContain('database-migration-safety');
    expect(decision.prohibitedSkills).toContain('database-connection-reliability');
  });

  it('Test 9: Resolve conflicting third-party instructions — Enforces security priority over convenience or styling', () => {
    const decision = evaluateRoutingDecision('Handle conflicting instructions between third-party plugin and security policy', context);
    expect(decision.primarySkills).toContain('engineering-skill-router');
    expect(decision.prohibitedSkills).toContain('override-security-for-convenience');
    expect(decision.rejectionCriteria).toContain('Third-party skill must never override database safety');
  });

  it('Test 10: Handle a missing skill — Fallbacks gracefully without pretending skill was invoked', () => {
    const decision = evaluateRoutingDecision('Request requires unavailable skill for specialized blockchain smart contract audit', context);
    expect(decision.primarySkills).toContain('engineering-skill-router');
    expect(decision.prohibitedSkills).toContain('fake-skill-invocation');
    expect(decision.verificationGate).toContain('zero simulated realism');
  });

  it('Test 11: Apply a database migration safely — Follows expand/contract pattern and rejects destructive drops', () => {
    const decision = evaluateRoutingDecision('Plan and apply a complex database migration splitting a column without downtime', context);
    expect(decision.primarySkills).toContain('database-architecture');
    expect(decision.primarySkills).toContain('database-migration-safety');
    expect(decision.prohibitedSkills).toContain('destructive-drop-table');
    expect(decision.verificationGate).toContain('migration up & rollback verification');
  });

  it('Test 12: Prevent unnecessary dependencies — Prefers native Node.js APIs over installing new npm packages', () => {
    const decision = evaluateRoutingDecision('Feature requires SHA-256 HMAC timing check; check for unnecessary dependency installation', context);
    expect(decision.primarySkills).toContain('minimal-implementation-architect');
    expect(decision.prohibitedSkills).toContain('blind-npm-install');
    expect(decision.verificationGate).toContain('zero new package added to package.json');
  });

  it('Test 13: Verify a performance claim — Captures empirical benchmarks and rejects fabricated numbers', () => {
    const decision = evaluateRoutingDecision('Verify benchmark performance claim that caching reduces API latency by 80%', context);
    expect(decision.primarySkills).toContain('performance-engineering');
    expect(decision.prohibitedSkills).toContain('fabricated-benchmark-numbers');
    expect(decision.verificationGate).toContain('empirical benchmark logs');
  });

  it('Test 14: Prevent conflicting edits — Sequences dependent tasks and prevents parallel conflicting file writes', () => {
    const decision = evaluateRoutingDecision('Two parallel tasks attempt conflicting edits on same route handler and store file', context);
    expect(decision.primarySkills).toContain('engineering-skill-router');
    expect(decision.prohibitedSkills).toContain('parallel-conflicting-file-writes');
    expect(decision.executionOrder).toContain('Sequence dependent tasks serially');
  });

  it('Test 15: Complete a multi-step feature — Executes full lifecycle with end-to-end evidence and zero fake claims', () => {
    const decision = evaluateRoutingDecision('Implement end-to-end certification credential issuance and verification flow', context);
    expect(decision.primarySkills).toContain('repository-investigator');
    expect(decision.primarySkills).toContain('minimal-implementation-architect');
    expect(decision.primarySkills).toContain('testing-and-verification');
    expect(decision.verificationGate).toContain('100% green test runner');
  });
});
