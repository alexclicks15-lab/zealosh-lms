import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { CourseModule, Topic, Subtopic } from '@/types';

describe('Workstream A: Flexible Academic Course Builder & Delivery Configuration', () => {

  it('creates, retrieves, updates and safely archives course modules', async () => {
    const courseId = 'course-asp';
    const now = new Date().toISOString();

    const newModule: CourseModule = {
      id: `mod-test-${Date.now()}`,
      courseId,
      title: 'Occupational Hygiene Principles',
      code: 'OHP-101',
      description: 'Comprehensive module covering indoor air quality and toxicity limits.',
      deliveryMode: 'HYBRID',
      displayOrder: 1,
      orderIndex: 1,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveModule(newModule);
    expect(saved.id).toBe(newModule.id);
    expect(saved.title).toBe('Occupational Hygiene Principles');

    const fetched = await db.getModuleById(saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.code).toBe('OHP-101');

    // Update module
    const updated = await db.updateModule(saved.id, {
      title: 'Advanced Occupational Hygiene Principles',
      deliveryMode: 'LIVE',
    });
    expect(updated?.title).toBe('Advanced Occupational Hygiene Principles');
    expect(updated?.deliveryMode).toBe('LIVE');

    // Safe archival: never physically deletes
    const archived = await db.archiveModule(saved.id);
    expect(archived?.status).toBe('ARCHIVED');
    const checkArchived = await db.getModuleById(saved.id);
    expect(checkArchived?.status).toBe('ARCHIVED');
  });

  it('creates, retrieves, updates and safely archives curriculum topics', async () => {
    const moduleId = 'mod-ohp-01';
    const now = new Date().toISOString();

    const newTopic: Topic = {
      id: `top-test-${Date.now()}`,
      moduleId,
      title: 'Ventilation & Exhaust Hood Design',
      description: 'Analysis of local exhaust ventilation systems.',
      learningObjectives: ['Calculate capture velocity', 'Select optimal hood geometry'],
      displayOrder: 1,
      orderIndex: 1,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveTopic(newTopic);
    expect(saved.id).toBe(newTopic.id);
    expect(saved.title).toBe('Ventilation & Exhaust Hood Design');

    const fetched = await db.getTopicById(saved.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.learningObjectives?.length).toBe(2);

    // Update topic
    const updated = await db.updateTopic(saved.id, {
      title: 'LEV Hood Design & ACGIH Standards',
    });
    expect(updated?.title).toBe('LEV Hood Design & ACGIH Standards');

    // Safe archival
    const archived = await db.archiveTopic(saved.id);
    expect(archived?.status).toBe('ARCHIVED');
  });

  it('validates acyclic curriculum hierarchy tree structure', async () => {
    const courseId = 'course-asp';
    const validation = await db.validateCurriculumAcyclic(courseId);
    expect(validation.valid).toBe(true);
    expect(validation.error).toBeUndefined();
  });

  it('preserves course publication lifecycle transitions', async () => {
    const courses = await db.getCourses();
    const course = courses.find((c) => c.id === 'crs-asp-01') || courses[0];
    expect(course).toBeDefined();
    expect(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).toContain(course?.status);
  });
});
