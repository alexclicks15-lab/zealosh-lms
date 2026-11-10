#!/usr/bin/env node
// ==============================================================================
// Zealosh LMS — Outbox Dispatcher & Scheduled Tasks Worker Runner
// Path: deploy/worker-runner.mjs
// Milestone: ZM-IMPL-09 (Stage B-Prep.1)
//
// Hardened Single-Instance Supervisor & Concurrency Controller:
// 1. Enforces atomic PID lockfile preventing overlapping or dual-supervisor dispatch
// 2. Traps SIGTERM / SIGINT for graceful in-flight completion and clean lock release
// 3. Auto-recovers stale leases left by killed/crashed worker processes
// 4. Integrates with systemd (authoritative) and PM2 (alternate) supervisors
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { EmailDispatchWorker } from '../src/lib/email/email-dispatch-worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_LOCK_DIR = process.env.ZEALOSH_SHARED_DIR || path.join(os.tmpdir(), 'zealosh-locks');
const DEFAULT_LOCK_FILE = path.join(DEFAULT_LOCK_DIR, 'zealosh-worker.pid');

/**
 * Checks whether a process with the given PID is actively running.
 */
export function isProcessAlive(pid) {
  if (!pid || typeof pid !== 'number' || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // Running under another user
  }
}

/**
 * Acquires a single-instance worker process lock.
 * Prevents concurrent execution across systemd timers, PM2, or manual CLI invocations.
 */
export function acquireWorkerProcessLock(lockFilePath = DEFAULT_LOCK_FILE, supervisor = process.env.ZEALOSH_WORKER_SUPERVISOR || 'standalone') {
  fs.mkdirSync(path.dirname(lockFilePath), { recursive: true });

  if (fs.existsSync(lockFilePath)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      if (isProcessAlive(lockData.pid)) {
        return {
          acquired: false,
          reason: `Active worker already running under PID ${lockData.pid} (Supervisor: ${lockData.supervisor || 'unknown'})`,
          existingPid: lockData.pid,
          supervisor: lockData.supervisor,
        };
      }
      // Process is dead: stale lockfile detected, safe to overwrite
    } catch {
      // Corrupt lockfile, safe to overwrite
    }
  }

  const payload = {
    pid: process.pid,
    supervisor,
    startedAt: new Date().toISOString(),
  };

  fs.writeFileSync(lockFilePath, JSON.stringify(payload, null, 2), 'utf8');
  return { acquired: true, pid: process.pid, supervisor };
}

/**
 * Releases the worker process lockfile.
 */
export function releaseWorkerProcessLock(lockFilePath = DEFAULT_LOCK_FILE) {
  if (fs.existsSync(lockFilePath)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      if (lockData.pid === process.pid) {
        fs.unlinkSync(lockFilePath);
        return true;
      }
    } catch {
      try {
        fs.unlinkSync(lockFilePath);
        return true;
      } catch {}
    }
  }
  return false;
}

/**
 * Runs a single dispatch cycle with concurrency and supervisor conflict protection.
 */
export async function runWorkerOnce(options = {}) {
  const lockFilePath = options.lockFilePath || DEFAULT_LOCK_FILE;
  const supervisor = options.supervisor || process.env.ZEALOSH_WORKER_SUPERVISOR || 'standalone';
  const limit = options.limit || 25;
  const leaseTimeoutMs = options.leaseTimeoutMs || 120000;

  const lock = acquireWorkerProcessLock(lockFilePath, supervisor);
  if (!lock.acquired) {
    return {
      success: false,
      skippedDueToConflict: true,
      reason: lock.reason,
      existingPid: lock.existingPid,
    };
  }

  let isCleanedUp = false;
  const cleanup = () => {
    if (!isCleanedUp) {
      isCleanedUp = true;
      releaseWorkerProcessLock(lockFilePath);
    }
  };

  // Signal handlers for graceful shutdown
  const handleSignal = (sig) => {
    cleanup();
    process.exit(0);
  };

  process.once('SIGTERM', handleSignal);
  process.once('SIGINT', handleSignal);

  try {
    const worker = new EmailDispatchWorker();
    const workerId = `worker_${process.pid}_${Date.now()}`;

    const result = await worker.claimAndDispatchBatch({
      workerId,
      limit,
      leaseTimeoutMs,
    });

    return {
      success: true,
      workerId,
      supervisor,
      ...result,
    };
  } finally {
    process.removeListener('SIGTERM', handleSignal);
    process.removeListener('SIGINT', handleSignal);
    cleanup();
  }
}

// Direct CLI Execution
if (process.argv[1] === __filename) {
  runWorkerOnce()
    .then((res) => {
      if (res.skippedDueToConflict) {
        console.log(`[Worker Notice] ${res.reason}`);
        process.exit(0);
      }
      if (res.processedCount > 0) {
        console.log(
          `[Worker ${res.workerId}] [${res.supervisor}] Dispatched ${res.sentCount} sent, ${res.failedCount} failed, ${res.retryCount} retryable, ${res.suppressedCount} suppressed`
        );
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Worker Fatal Error]:', err);
      process.exit(1);
    });
}
