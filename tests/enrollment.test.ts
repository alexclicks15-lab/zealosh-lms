import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/lib/store/db';

describe('Transactional Enrollment & Batch Capacity Invariants', () => {
  it('should successfully enroll student into an active batch with available seats', async () => {
    const res = await db.enrollStudent({
      userId: 'usr-admin-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
    });

    expect(res.success).toBe(true);
    expect(res.enrollment).toBeDefined();
    expect(res.enrollment.status).toBe('ACTIVE');
    expect(res.enrollment.courseId).toBe('crs-asp-01');
  });

  it('should enforce idempotency and not create duplicate enrollments for same user and batch', async () => {
    const batchBefore = db.batches.get('btc-asp-nov26')!;
    const initialSeats = batchBefore.enrolledCount;

    // First call for student Arjun (already enrolled in seed)
    const res = await db.enrollStudent({
      userId: 'usr-std-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
    });

    expect(res.success).toBe(true);
    // Batch seat count must not increment on idempotent re-call
    const batchAfter = db.batches.get('btc-asp-nov26')!;
    expect(batchAfter.enrolledCount).toBe(initialSeats);
  });

  it('should reject enrollment when batch reaches full capacity (Capacity Limit Guard)', async () => {
    // btc-asp-full was configured with capacity 10 and enrolledCount 10
    await expect(
      db.enrollStudent({
        userId: 'usr-admin-01',
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-full',
      })
    ).rejects.toThrow('BATCH_CAPACITY_EXCEEDED');
  });

  it('should record an immutable audit log entry for completed enrollment', async () => {
    const initialAuditCount = db.auditLogs.length;

    await db.enrollStudent({
      userId: 'usr-inst-01',
      courseId: 'crs-csp-02',
      batchId: 'btc-csp-nov26',
    });

    expect(db.auditLogs.length).toBeGreaterThan(initialAuditCount);
    const latestLog = db.auditLogs[0];
    expect(latestLog.action).toBe('COURSE_ENROLLMENT_COMPLETED');
    expect(latestLog.entityType).toBe('ENROLLMENT');
  });
});
