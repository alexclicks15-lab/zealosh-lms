import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ZealoshDatabase } from '../src/lib/store/db';
import {
  ClassRecording,
  RecordingBatchAccess,
  RecordingHighlight,
  RecordingResource,
  RecordingDoubt,
  RecordingDoubtAnswer,
} from '../src/types';

describe('Zealosh LMS — Recording Persistence Regression Suite', () => {
  const testStorePath = path.join(process.cwd(), 'data', 'temp-test-recording-persistence.json');

  function cleanupFiles() {
    try {
      if (fs.existsSync(testStorePath)) fs.unlinkSync(testStorePath);
      const dir = path.dirname(testStorePath);
      const base = path.basename(testStorePath);
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith(`${base}.tmp`)) {
            try {
              fs.unlinkSync(path.join(dir, file));
            } catch {
              // Ignore
            }
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  beforeAll(() => {
    cleanupFiles();
  });

  afterAll(() => {
    cleanupFiles();
  });

  beforeEach(() => {
    cleanupFiles();
  });

  it('fails against unpersisted recording collections and verifies all six collections persist and rehydrate', async () => {
    // 1. Initialize an isolated database instance redirected to testStorePath
    const db1 = new ZealoshDatabase(testStorePath);
    (db1 as any).persistenceFilePath = testStorePath;

    // 2. Prepare sample entities for all six collections
    const sampleRecording: ClassRecording = {
      id: 'rec-test-persist-01',
      sessionId: 'ses-test-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      title: 'HSE Risk Assessment & Fall Protection Deep Dive',
      description: 'Comprehensive review of fall arrest anchors and scaffolding calculations',
      storageProvider: 'BIGBLUEBUTTON',
      storagePath: 'recordings/rec-test-persist-01/video.mp4',
      mediaUrl: 'https://media.zealosh.com/rec-test-persist-01.mp4',
      durationSeconds: 7200,
      fileSizeBytes: 1048576000,
      status: 'AVAILABLE',
      isDownloadable: true,
      allowDownload: true,
      availableFrom: '2026-10-28T00:00:00Z',
      createdAt: '2026-10-28T10:00:00Z',
      updatedAt: '2026-10-28T12:00:00Z',
    };

    const sampleBatchAccess: RecordingBatchAccess = {
      id: 'rba-test-persist-01',
      recordingId: sampleRecording.id,
      sourceBatchId: 'btc-asp-weekday',
      targetBatchId: 'btc-asp-full',
      allowDownload: false,
      status: 'ACTIVE',
      grantedBy: 'usr-admin-01',
      grantedAt: '2026-10-28T13:00:00Z',
      createdAt: '2026-10-28T13:00:00Z',
    };

    const sampleHighlight: RecordingHighlight = {
      id: 'rhl-test-persist-01',
      recordingId: sampleRecording.id,
      title: 'Scaffolding Tie-Back Ratios',
      description: 'Critical OSHA/BCSP calculation for 4:1 base to height ratios',
      startTimestampSeconds: 1200,
      endTimestampSeconds: 1800,
      createdBy: 'usr-inst-01',
      createdAt: '2026-10-28T14:00:00Z',
      updatedAt: '2026-10-28T14:00:00Z',
    };

    const sampleResource: RecordingResource = {
      id: 'rres-test-persist-01',
      recordingId: sampleRecording.id,
      highlightId: sampleHighlight.id,
      title: 'Scaffold Inspection Checklist PDF',
      description: 'Official BCSP ASP exam reference checklist',
      resourceType: 'PDF',
      url: 'https://assets.zealosh.com/docs/scaffold-inspection.pdf',
      fileSizeBytes: 204800,
      uploadedBy: 'usr-inst-01',
      createdAt: '2026-10-28T14:15:00Z',
    };

    const sampleDoubt: RecordingDoubt = {
      id: 'rdbt-test-persist-01',
      recordingId: sampleRecording.id,
      userId: 'usr-std-01',
      userName: 'Arjun Menon',
      timestampSeconds: 1530,
      question: 'Does the 4:1 ratio apply to mobile rolling scaffolds before locking casters?',
      status: 'RESOLVED',
      isPublic: true,
      createdAt: '2026-10-28T15:00:00Z',
      updatedAt: '2026-10-28T15:30:00Z',
    };

    const sampleAnswer: RecordingDoubtAnswer = {
      id: 'rans-test-persist-01',
      doubtId: sampleDoubt.id,
      instructorId: 'usr-inst-01',
      instructorName: 'Vishnu Rajendran, CSP',
      answerText: 'Yes, with outriggers installed to satisfy base dimension requirements.',
      createdAt: '2026-10-28T15:30:00Z',
    };

    // 3. Populate memory store
    db1.classRecordings.set(sampleRecording.id, sampleRecording);
    db1.recordingBatchAccess.set(sampleBatchAccess.id, sampleBatchAccess);
    db1.recordingHighlights.set(sampleHighlight.id, sampleHighlight);
    db1.recordingResources.set(sampleResource.id, sampleResource);
    db1.recordingDoubts.set(sampleDoubt.id, sampleDoubt);
    db1.recordingDoubtAnswers.set(sampleAnswer.id, sampleAnswer);

    // 4. Trigger persistToDisk
    db1.persistToDisk();

    // 5. Inspect the raw serialized JSON on disk
    expect(fs.existsSync(testStorePath)).toBe(true);
    const rawDiskContent = fs.readFileSync(testStorePath, 'utf-8');
    const diskJson = JSON.parse(rawDiskContent);

    // This expectation asserts that the serialized disk JSON contains classRecordings
    // (Fails in original defective db.ts because persistToDisk omitted all six recording collections)
    expect(diskJson.classRecordings).toBeDefined();
    expect(diskJson.classRecordings[sampleRecording.id]).toBeDefined();
    expect(diskJson.classRecordings[sampleRecording.id].title).toBe('HSE Risk Assessment & Fall Protection Deep Dive');

    expect(diskJson.recordingBatchAccess).toBeDefined();
    expect(diskJson.recordingBatchAccess[sampleBatchAccess.id]).toBeDefined();

    expect(diskJson.recordingHighlights).toBeDefined();
    expect(diskJson.recordingHighlights[sampleHighlight.id]).toBeDefined();

    expect(diskJson.recordingResources).toBeDefined();
    expect(diskJson.recordingResources[sampleResource.id]).toBeDefined();

    expect(diskJson.recordingDoubts).toBeDefined();
    expect(diskJson.recordingDoubts[sampleDoubt.id]).toBeDefined();

    expect(diskJson.recordingDoubtAnswers).toBeDefined();
    expect(diskJson.recordingDoubtAnswers[sampleAnswer.id]).toBeDefined();

    // 6. Simulate cold restart: instantiate a new db pointing at the persisted file
    const db2 = new ZealoshDatabase(testStorePath);
    (db2 as any).persistenceFilePath = testStorePath;
    const rehydrated = (db2 as any).hydrateFromDisk();
    expect(rehydrated).toBe(true);

    // Verify all six collections are hydrated into Maps
    expect(db2.classRecordings.has(sampleRecording.id)).toBe(true);
    const hydratedRecording = db2.classRecordings.get(sampleRecording.id);
    expect(hydratedRecording?.durationSeconds).toBe(7200);
    expect(hydratedRecording?.status).toBe('AVAILABLE');

    expect(db2.recordingBatchAccess.has(sampleBatchAccess.id)).toBe(true);
    expect(db2.recordingHighlights.has(sampleHighlight.id)).toBe(true);
    expect(db2.recordingResources.has(sampleResource.id)).toBe(true);
    expect(db2.recordingDoubts.has(sampleDoubt.id)).toBe(true);
    expect(db2.recordingDoubtAnswers.has(sampleAnswer.id)).toBe(true);
  });

  it('handles empty recording collections cleanly during persistence and rehydration', () => {
    const db = new ZealoshDatabase(testStorePath);
    (db as any).persistenceFilePath = testStorePath;

    // Ensure collections are empty
    db.classRecordings.clear();
    db.recordingBatchAccess.clear();
    db.recordingHighlights.clear();
    db.recordingResources.clear();
    db.recordingDoubts.clear();
    db.recordingDoubtAnswers.clear();

    db.persistToDisk();

    const raw = fs.readFileSync(testStorePath, 'utf-8');
    const json = JSON.parse(raw);

    expect(json.classRecordings).toEqual({});
    expect(json.recordingBatchAccess).toEqual({});
    expect(json.recordingHighlights).toEqual({});
    expect(json.recordingResources).toEqual({});
    expect(json.recordingDoubts).toEqual({});
    expect(json.recordingDoubtAnswers).toEqual({});

    const db2 = new ZealoshDatabase(testStorePath);
    (db2 as any).persistenceFilePath = testStorePath;
    (db2 as any).hydrateFromDisk();

    expect(db2.classRecordings.size).toBe(0);
    expect(db2.recordingBatchAccess.size).toBe(0);
  });

  it('preserves backward compatibility when hydrating legacy snapshots lacking recording fields', () => {
    // Write legacy JSON structure lacking the 6 recording fields
    const legacySnapshot = {
      users: {
        'usr-admin-01': {
          id: 'usr-admin-01',
          name: 'Super Admin',
          email: 'admin@zealosh.com',
          role: 'SUPER_ADMIN',
          organizationId: 'org-zealosh-main',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        },
      },
      courses: {
        'crs-asp-01': {
          id: 'crs-asp-01',
          title: 'ASP Certification Prep',
          slug: 'asp-prep',
        },
      },
      batches: {
        'btc-asp-weekday': {
          id: 'btc-asp-weekday',
          courseId: 'crs-asp-01',
          name: 'Weekday Batch',
        },
        'btc-asp-full': {
          id: 'btc-asp-full',
          courseId: 'crs-asp-01',
          name: 'Full Batch',
        },
      },
      enrollments: {},
      lessons: {},
      liveSessions: {},
      attendance: {},
      examQuestions: {},
      examBlueprints: {
        'bp-asp-bcsp-v10': { id: 'bp-asp-bcsp-v10', title: 'ASP Blueprint' },
      },
      examAttempts: {},
      lastPersistedAt: '2026-01-01T00:00:00Z',
    };

    fs.writeFileSync(testStorePath, JSON.stringify(legacySnapshot, null, 2), 'utf-8');

    const db = new ZealoshDatabase(testStorePath);
    (db as any).persistenceFilePath = testStorePath;
    const hydrated = (db as any).hydrateFromDisk();

    expect(hydrated).toBe(true);
    expect(db.users.has('usr-admin-01')).toBe(true);
    // Recording maps must default cleanly to empty Maps without throwing
    expect(db.classRecordings).toBeInstanceOf(Map);
    expect(db.classRecordings.size).toBe(0);
    expect(db.recordingBatchAccess).toBeInstanceOf(Map);
    expect(db.recordingBatchAccess.size).toBe(0);
    expect(db.recordingHighlights).toBeInstanceOf(Map);
    expect(db.recordingResources).toBeInstanceOf(Map);
    expect(db.recordingDoubts).toBeInstanceOf(Map);
    expect(db.recordingDoubtAnswers).toBeInstanceOf(Map);
  });

  it('preserves existing core collections alongside recording collections', () => {
    const db = new ZealoshDatabase(testStorePath);
    (db as any).persistenceFilePath = testStorePath;

    // Verify existing core users and courses are populated
    expect(db.users.size).toBeGreaterThan(0);
    expect(db.courses.size).toBeGreaterThan(0);

    const recording: ClassRecording = {
      id: 'rec-preserve-test',
      sessionId: 'ses-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      title: 'Preserve Test',
      storageProvider: 'BIGBLUEBUTTON',
      storagePath: 'path/rec.mp4',
      mediaUrl: 'https://media.zealosh.com/rec.mp4',
      durationSeconds: 1800,
      fileSizeBytes: 50000000,
      status: 'AVAILABLE',
      isDownloadable: false,
      availableFrom: '2026-10-28T00:00:00Z',
      createdAt: '2026-10-28T00:00:00Z',
      updatedAt: '2026-10-28T00:00:00Z',
    };
    db.classRecordings.set(recording.id, recording);

    db.persistToDisk();

    const db2 = new ZealoshDatabase(testStorePath);
    (db2 as any).persistenceFilePath = testStorePath;
    (db2 as any).hydrateFromDisk();

    // Verify both core data AND recordings survive together
    expect(db2.users.has('usr-admin-01')).toBe(true);
    expect(db2.courses.has('crs-asp-01')).toBe(true);
    expect(db2.classRecordings.has('rec-preserve-test')).toBe(true);
  });

  it('preserves previous valid snapshot when replacement fails, cleans up temporary files, and reports failure', () => {
    const db = new ZealoshDatabase(testStorePath);
    (db as any).persistenceFilePath = testStorePath;

    // Establish a verified initial snapshot
    const initialRecording: ClassRecording = {
      id: 'rec-initial-valid',
      sessionId: 'ses-valid-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      title: 'Initial Valid Baseline Recording',
      storageProvider: 'BIGBLUEBUTTON',
      storagePath: 'recordings/valid/video.mp4',
      mediaUrl: 'https://media.zealosh.com/valid.mp4',
      durationSeconds: 3600,
      fileSizeBytes: 500000,
      status: 'AVAILABLE',
      isDownloadable: true,
      availableFrom: '2026-10-28T00:00:00Z',
      createdAt: '2026-10-28T00:00:00Z',
      updatedAt: '2026-10-28T00:00:00Z',
    };
    db.classRecordings.set(initialRecording.id, initialRecording);
    const initialWriteSuccess = db.persistToDisk();
    expect(initialWriteSuccess).toBe(true);
    expect(db.lastPersistenceError).toBeNull();

    // Read the exact pristine on-disk content of the valid snapshot
    const pristineSnapshot = fs.readFileSync(testStorePath, 'utf-8');
    const pristineJson = JSON.parse(pristineSnapshot);
    expect(pristineJson.classRecordings['rec-initial-valid']).toBeDefined();

    // Now introduce an update in memory
    const corruptedUpdate: ClassRecording = {
      ...initialRecording,
      id: 'rec-uncommitted-attempt',
      title: 'This should not corrupt the disk snapshot if rename fails',
    };
    db.classRecordings.set(corruptedUpdate.id, corruptedUpdate);

    // Mock renameSync to simulate OS-level file lock, permissions error, or EBUSY
    const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('EXDEV / EBUSY: simulated file lock during atomic rename');
    });

    try {
      const result = db.persistToDisk();

      // 1. Failure must NOT be silently represented as success
      expect(result).toBe(false);
      expect(db.lastPersistenceError).toBeInstanceOf(Error);
      expect(db.lastPersistenceError?.message).toContain('simulated file lock during atomic rename');

      // 2. The previous valid snapshot on disk MUST be completely preserved and NOT truncated or altered
      const currentDiskContent = fs.readFileSync(testStorePath, 'utf-8');
      expect(currentDiskContent).toBe(pristineSnapshot);
      const currentJson = JSON.parse(currentDiskContent);
      expect(currentJson.classRecordings['rec-initial-valid']).toBeDefined();
      expect(currentJson.classRecordings['rec-uncommitted-attempt']).toBeUndefined();

      // 3. No orphaned .tmp files must remain on disk
      const dir = path.dirname(testStorePath);
      const base = path.basename(testStorePath);
      const remainingFiles = fs.readdirSync(dir);
      const orphanedTmpFiles = remainingFiles.filter((f) => f.startsWith(`${base}.tmp`));
      expect(orphanedTmpFiles).toHaveLength(0);
    } finally {
      renameSpy.mockRestore();
    }
  });

  it('handles writeFileSync failure during temp staging and cleans up cleanly', () => {
    const db = new ZealoshDatabase(testStorePath);
    (db as any).persistenceFilePath = testStorePath;

    // Spy on writeFileSync to fail when writing to temp
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('ENOSPC: no space left on device');
    });

    try {
      const result = db.persistToDisk();
      expect(result).toBe(false);
      expect(db.lastPersistenceError?.message).toContain('ENOSPC');

      // Ensure no temp files leaked
      const dir = path.dirname(testStorePath);
      const base = path.basename(testStorePath);
      const remainingFiles = fs.readdirSync(dir);
      const orphanedTmpFiles = remainingFiles.filter((f) => f.startsWith(`${base}.tmp`));
      expect(orphanedTmpFiles).toHaveLength(0);
    } finally {
      writeSpy.mockRestore();
    }
  });
});
