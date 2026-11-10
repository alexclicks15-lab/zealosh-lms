// ==============================================================================
// Zealosh LMS — Local End-to-End Deployment & Rollback Simulation Test Suite
// Path: tests/local-deployment-simulation.test.ts
// Milestone: ZM-IMPL-09 (Stage B-Prep.1)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runLocalDeploymentSimulation } from '../deploy/simulate-local-deployment.mjs';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROTECTED_STORE = path.join(PROJECT_ROOT, 'data', 'zealosh-store.json');
const EXPECTED_HASH = 'f1cb59d0b3fc129548763266b8a1993300d76eb842070657b7719f5f21b3fb10';
const EXPECTED_SIZE = 45005;

describe('Zealosh LMS — Local End-to-End Deployment Simulation Engine', () => {
  it('1. should maintain protected store integrity before simulation', () => {
    expect(fs.existsSync(PROTECTED_STORE)).toBe(true);
    const stat = fs.statSync(PROTECTED_STORE);
    expect(stat.size).toBe(EXPECTED_SIZE);

    const hash = crypto.createHash('sha256').update(fs.readFileSync(PROTECTED_STORE)).digest('hex');
    expect(hash.toLowerCase()).toBe(EXPECTED_HASH.toLowerCase());
  });

  it('2. should execute complete 17-phase operational lifecycle cleanly', async () => {
    const result = await runLocalDeploymentSimulation();

    expect(result.success).toBe(true);
    expect(result.totalPhases).toBe(17);
    expect(result.phasesCompleted.length).toBe(17);

    const phaseNames = result.phasesCompleted.map((p: any) => p.name);
    expect(phaseNames).toEqual([
      'PHASE_1_INITIAL_ENVIRONMENT_VALIDATION',
      'PHASE_2_ARTIFACT_CREATION',
      'PHASE_3_MANIFEST_VALIDATION',
      'PHASE_4_ARTIFACT_CHECKSUM_VERIFICATION',
      'PHASE_5_RELEASE_STAGING',
      'PHASE_6_MIGRATION_PREFLIGHT_AND_LOCK',
      'PHASE_7_WORKER_SUPERVISOR_SELECTION',
      'PHASE_8_RELEASE_ACTIVATION',
      'PHASE_9_HEALTH_VERIFICATION',
      'PHASE_10_FAILURE_DETECTION',
      'PHASE_11_ROLLBACK',
      'PHASE_12_BACKUP_CREATION',
      'PHASE_13_BACKUP_VERIFICATION',
      'PHASE_14_RECOVERY_IN_TEMPORARY_DIR',
      'PHASE_15_AUDIT_TRAIL_GENERATION',
      'PHASE_16_TEMPORARY_RESOURCE_CLEANUP',
      'PHASE_17_FINAL_PROTECTED_STORE_INTEGRITY',
    ]);
  });

  it('3. should verify protected store integrity remains byte-for-byte identical after simulation', () => {
    expect(fs.existsSync(PROTECTED_STORE)).toBe(true);
    const stat = fs.statSync(PROTECTED_STORE);
    expect(stat.size).toBe(EXPECTED_SIZE);

    const hash = crypto.createHash('sha256').update(fs.readFileSync(PROTECTED_STORE)).digest('hex');
    expect(hash.toLowerCase()).toBe(EXPECTED_HASH.toLowerCase());
  });
});
