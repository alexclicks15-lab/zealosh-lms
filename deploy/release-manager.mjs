#!/usr/bin/env node
// ==============================================================================
// Zealosh LMS — Deterministic Release Manager & Rollback Engine
// Milestone: ZM-IMPL-09 (Stage B-Prep)
// Manages atomic release activations, symlink updates, migration locks,
// pre-deployment checks, and rapid rollback in < 2 minutes.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { verifyArtifact, parseTarBuffer } from './verify-deployment-artifact.mjs';
import { validateEnvironment, parseEnvFile } from './validate-staging-env.mjs';

/**
 * Extracts a verified TAR archive into a target directory.
 */
export function extractTarBufferToDisk(tarBuffer, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = parseTarBuffer(tarBuffer);

  for (const entry of entries) {
    const fullPath = path.join(targetDir, entry.path);

    if (entry.typeFlag === '5' || entry.path.endsWith('/')) {
      fs.mkdirSync(fullPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, entry.content);
    }
  }

  return entries.length;
}

/**
 * Manages atomic directory symlinks with cross-platform fallback.
 */
export function setAtomicSymlink(targetPath, linkPath) {
  const tempLink = `${linkPath}.tmp-${Date.now()}`;

  try {
    // Try symbolic link first
    fs.symlinkSync(targetPath, tempLink, 'junction');
    fs.renameSync(tempLink, linkPath);
  } catch (err) {
    // Fallback: If symlink is not permitted or fails on platform, write a pointer file
    try {
      if (fs.existsSync(tempLink)) fs.rmSync(tempLink, { recursive: true, force: true });
    } catch {}

    const pointerFile = path.join(path.dirname(linkPath), '.active-release-pointer.json');
    fs.writeFileSync(
      pointerFile,
      JSON.stringify({ activeReleasePath: targetPath, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
  }
}

/**
 * Resolves the currently active release path.
 */
export function getActiveReleasePath(linkPath) {
  if (fs.existsSync(linkPath)) {
    try {
      return fs.realpathSync(linkPath);
    } catch {}
  }

  const pointerFile = path.join(path.dirname(linkPath), '.active-release-pointer.json');
  if (fs.existsSync(pointerFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(pointerFile, 'utf8'));
      return data.activeReleasePath;
    } catch {}
  }

  return null;
}

/**
 * Migration Lock Manager to prevent concurrent migration execution.
 */
export function acquireMigrationLock(lockFilePath, ttlMs = 300000) {
  if (fs.existsSync(lockFilePath)) {
    try {
      const content = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
      const ageMs = Date.now() - new Date(content.acquiredAt).getTime();
      if (ageMs < (content.ttlMs || ttlMs)) {
        return {
          acquired: false,
          reason: `Migration lock held by PID ${content.pid} (${Math.round(ageMs / 1000)}s old)`,
        };
      }
    } catch {}
  }

  const lockData = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    ttlMs,
  };

  fs.mkdirSync(path.dirname(lockFilePath), { recursive: true });
  fs.writeFileSync(lockFilePath, JSON.stringify(lockData, null, 2), 'utf8');
  return { acquired: true };
}

export function releaseMigrationLock(lockFilePath) {
  if (fs.existsSync(lockFilePath)) {
    try {
      fs.unlinkSync(lockFilePath);
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Detects pending migrations between repository SQL files and applied migrations.
 */
export function checkPendingMigrations(migrationsDir, appliedMigrationNames = []) {
  if (!fs.existsSync(migrationsDir)) {
    return { pending: [], total: 0 };
  }

  const allFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedSet = new Set(appliedMigrationNames);
  const pending = allFiles.filter((f) => !appliedSet.has(f));

  return {
    allMigrations: allFiles,
    pending,
    total: allFiles.length,
    pendingCount: pending.length,
  };
}

/**
 * Executes a full release deployment workflow.
 * @param {Object} options
 * @param {string} options.artifactPath
 * @param {string} options.baseDir
 * @param {string} [options.targetVersion]
 * @param {string|null} [options.expectedChecksum]
 * @param {string|null} [options.sharedEnvPath]
 * @param {boolean} [options.skipEnvValidation]
 */
export function deployRelease({
  artifactPath,
  baseDir,
  targetVersion = '1.0.0',
  expectedChecksum = null,
  sharedEnvPath = null,
  skipEnvValidation = false,
}) {
  const startTime = Date.now();
  const releasesDir = path.join(baseDir, 'releases');
  const sharedDir = path.join(baseDir, 'shared');
  const currentLink = path.join(baseDir, 'current');
  const historyFile = path.join(sharedDir, 'deployment-history.json');
  const lockFile = path.join(sharedDir, 'release.lock');

  fs.mkdirSync(releasesDir, { recursive: true });
  fs.mkdirSync(sharedDir, { recursive: true });

  // 1. Acquire Deployment Lock
  const lock = acquireMigrationLock(lockFile, 180000); // 3 minutes TTL
  if (!lock.acquired) {
    throw new Error(`Deployment Aborted: ${lock.reason}`);
  }

  try {
    // 2. Verify Artifact
    const verifyResult = verifyArtifact(artifactPath, expectedChecksum);
    if (!verifyResult.valid) {
      throw new Error(`Artifact Verification Failed: ${verifyResult.error || 'Checksum mismatch'}`);
    }

    // 3. Extract to Unique Release Directory
    const releaseTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const releaseId = `release-${targetVersion}-${releaseTimestamp}`;
    const releaseDir = path.join(releasesDir, releaseId);

    try {
      const archiveBuffer = fs.readFileSync(artifactPath);
      const uncompressedTar = zlib.gunzipSync(archiveBuffer);
      const fileCount = extractTarBufferToDisk(uncompressedTar, releaseDir);

      // 4. Link Shared Configuration
      if (sharedEnvPath && fs.existsSync(sharedEnvPath)) {
        const releaseEnvPath = path.join(releaseDir, '.env.staging');
        fs.copyFileSync(sharedEnvPath, releaseEnvPath);

        // 5. Pre-deployment Environment Validation
        if (!skipEnvValidation) {
          const envContent = fs.readFileSync(releaseEnvPath, 'utf8');
          const envMap = parseEnvFile(envContent);
          const envCheck = validateEnvironment(envMap, 'staging');
          if (!envCheck.valid) {
            const errorReports = (envCheck.reports || []).filter(
              (r) => r.status === 'MISSING' || r.status === 'INVALID'
            );
            const errorMsg = errorReports.map((e) => `[${e.name}] ${e.message}`).join(', ');
            throw new Error(
              `Pre-deployment Environment Validation Failed (${envCheck.errorCount} errors): ${errorMsg}`
            );
          }
        }
      }

      // 6. Record Release Metadata
      const releaseMeta = {
        releaseId,
        version: targetVersion,
        deployedAt: new Date().toISOString(),
        artifactSha256: verifyResult.sha256,
        fileCount,
        deployDurationMs: Date.now() - startTime,
      };
      fs.writeFileSync(
        path.join(releaseDir, 'release-metadata.json'),
        JSON.stringify(releaseMeta, null, 2),
        'utf8'
      );

      // 7. Atomic Symlink Switch
      setAtomicSymlink(releaseDir, currentLink);

      // 8. Update Deployment History
      let history = [];
      if (fs.existsSync(historyFile)) {
        try {
          history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        } catch {}
      }
      history.push({
        event: 'DEPLOYMENT_SUCCESS',
        ...releaseMeta,
      });
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');

      return {
        success: true,
        releaseId,
        releaseDir,
        sha256: verifyResult.sha256,
        fileCount,
        durationMs: Date.now() - startTime,
      };
    } catch (deployErr) {
      // Clean up aborted release directory to avoid leaving partial artifacts
      if (fs.existsSync(releaseDir)) {
        try {
          fs.rmSync(releaseDir, { recursive: true, force: true });
        } catch {}
      }
      throw deployErr;
    }
  } finally {
    releaseMigrationLock(lockFile);
  }
}

/**
 * Rolls back to the previously active release.
 */
export function rollbackRelease({ baseDir }) {
  const startTime = Date.now();
  const releasesDir = path.join(baseDir, 'releases');
  const currentLink = path.join(baseDir, 'current');
  const sharedDir = path.join(baseDir, 'shared');
  const historyFile = path.join(sharedDir, 'deployment-history.json');

  if (!fs.existsSync(releasesDir)) {
    throw new Error('Rollback Failed: No releases directory found.');
  }

  // Get available releases sorted descending by creation time
  const availableReleases = fs
    .readdirSync(releasesDir)
    .filter((name) => name.startsWith('release-') && fs.statSync(path.join(releasesDir, name)).isDirectory())
    .sort()
    .reverse();

  if (availableReleases.length < 2) {
    throw new Error(
      `Rollback Failed: Found ${availableReleases.length} releases. At least 2 releases are required to roll back.`
    );
  }

  const currentPath = getActiveReleasePath(currentLink);
  const currentReleaseName = currentPath ? path.basename(currentPath) : null;

  // Find target previous release (the first one that is NOT the currently active release)
  const previousReleaseName = availableReleases.find((r) => r !== currentReleaseName) || availableReleases[1];
  const targetReleaseDir = path.join(releasesDir, previousReleaseName);

  // Perform atomic switch to previous release
  setAtomicSymlink(targetReleaseDir, currentLink);

  // Record rollback event
  let history = [];
  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch {}
  }

  const rollbackEvent = {
    event: 'ROLLBACK_SUCCESS',
    fromRelease: currentReleaseName,
    toRelease: previousReleaseName,
    rolledBackAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
  history.push(rollbackEvent);
  fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');

  return {
    success: true,
    previousRelease: previousReleaseName,
    activeReleaseDir: targetReleaseDir,
    durationMs: Date.now() - startTime,
  };
}

