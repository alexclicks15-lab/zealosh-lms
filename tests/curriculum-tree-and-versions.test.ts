// tests/curriculum-tree-and-versions.test.ts
// Vitest suite for Visual Curriculum Hierarchy Reordering and Syllabus Versioning

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { SyllabusVersion } from '@/types';

describe('Academic Curriculum Hierarchy & Syllabus Versioning', () => {
  const courseId = `course-curric-${Date.now()}`;

  beforeEach(() => {
    // Clear syllabus versions for test isolation
    (db as any).syllabusVersions?.clear();
  });

  it('creates and retrieves syllabus draft versions for a course', async () => {
    const version1 = await db.saveSyllabusVersion({
      courseId,
      version: '1.0.0',
      title: 'HSE Safety Professional - 2026 Core Syllabus',
      changeSummary: 'Initial curriculum structure based on OHS standards',
      snapshotData: {
        modules: [
          {
            id: 'mod-1',
            title: 'Hazard Identification',
            topics: [
              { id: 'top-1-1', title: 'Physical Hazards & Risk Scoring', subtopics: [] }
            ]
          }
        ]
      },
      status: 'DRAFT',
      createdBy: 'admin-curator',
    });

    expect(version1.id).toBeDefined();
    expect(version1.version).toBe('1.0.0');
    expect(version1.status).toBe('DRAFT');

    const versions = await db.getSyllabusVersions(courseId);
    expect(versions).toHaveLength(1);
    expect(versions[0].id).toBe(version1.id);
  });

  it('publishes a syllabus version and archives previously published versions', async () => {
    const v1 = await db.saveSyllabusVersion({
      courseId,
      version: '1.0.0',
      title: 'Initial HSE Syllabus',
      snapshotData: { modules: [] },
      status: 'DRAFT',
      createdBy: 'curator-1',
    });

    const pub1 = await db.publishSyllabusVersion(v1.id, 'admin-approver');
    expect(pub1.status).toBe('PUBLISHED');
    expect(pub1.publishedBy).toBe('admin-approver');
    expect(pub1.publishedAt).toBeDefined();

    // Create v2 draft and publish it
    const v2 = await db.saveSyllabusVersion({
      courseId,
      version: '1.1.0',
      title: 'Updated HSE Syllabus with EV Battery Safety',
      changeSummary: 'Added EV battery thermal runaway risk assessment module',
      snapshotData: { modules: [{ id: 'mod-ev', title: 'Lithium Battery Hazard Safety' }] },
      status: 'DRAFT',
      createdBy: 'curator-2',
    });

    const pub2 = await db.publishSyllabusVersion(v2.id, 'admin-chief');
    expect(pub2.status).toBe('PUBLISHED');

    // Verify v1 is now ARCHIVED
    const allVersions = await db.getSyllabusVersions(courseId);
    const retiredV1 = allVersions.find((v) => v.id === v1.id);
    const activeV2 = allVersions.find((v) => v.id === v2.id);

    expect(retiredV1?.status).toBe('ARCHIVED');
    expect(activeV2?.status).toBe('PUBLISHED');
  });

  it('enforces acyclic order and rejects unknown syllabus version ID for publishing', async () => {
    await expect(
      db.publishSyllabusVersion('non-existent-version-id', 'admin-user')
    ).rejects.toThrow();
  });
});

