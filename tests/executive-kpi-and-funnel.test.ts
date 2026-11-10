// tests/executive-kpi-and-funnel.test.ts
// Vitest suite for Executive KPI Aggregation & Admissions Funnel Analytics

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { GET } from '@/app/api/admin/reports/executive/route';
import { PaymentOrder, ExamAttempt, CertificateRecord, LeadRecord } from '@/types';

describe('Executive KPI Aggregation & Funnel Analytics', () => {
  const adminToken = signToken({
    userId: 'admin-exec-1',
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Executive Admin',
  });

  const studentToken = signToken({
    userId: 'student-regular-1',
    email: 'student@zealosh.com',
    role: 'STUDENT',
    name: 'Regular Student',
  });

  it('aggregates executive KPI summary accurately from live store collections', async () => {
    // Seed some orders and exams
    const orderId = `ord-kpi-${Date.now()}`;
    const testOrder: PaymentOrder = {
      id: orderId,
      userId: 'usr-kpi-1',
      userEmail: 'kpi-user@zealosh.com',
      userName: 'KPI Student',
      courseId: 'course-nebosh-igc',
      batchId: 'batch-kpi-01',
      offeringId: 'OFFERING_FULL',
      amount: 15000,
      currency: 'INR',
      status: 'PAID',
      gateway: 'RAZORPAY',
      createdAt: new Date().toISOString(),
    };
    (db as any).paymentOrders.set(orderId, testOrder);

    const summary = await db.getExecutiveKpiSummary();

    expect(summary).toBeDefined();
    expect(summary.grossRevenueINR).toBeGreaterThanOrEqual(15000);
    expect(summary.averageExamPassRatePercent).toBeGreaterThanOrEqual(0);
    expect(typeof summary.activeLearnersCount).toBe('number');
    expect(typeof summary.courseCompletionRatePercent).toBe('number');
  });

  it('calculates the 6-stage admissions conversion funnel with correct drop-offs', async () => {
    // Seed a lead record
    const leadId = `lead-${Date.now()}`;
    const testLead: LeadRecord = {
      id: leadId,
      fullName: 'Prospective Safety Officer',
      email: 'lead@safetycorp.com',
      phone: '+919876543210',
      courseInterest: 'course-iso-45001',
      status: 'NEW',
      source: 'WEBSITE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (db as any).leads?.set(leadId, testLead);

    const funnel = await db.getConversionFunnelReport();

    expect(funnel).toBeDefined();
    expect(funnel.stages).toHaveLength(6);

    const stageIds = funnel.stages.map((s) => s.stageId);
    expect(stageIds).toEqual([
      'LEAD',
      'APPLICATION',
      'VERIFIED',
      'ORIENTATION',
      'OFFER',
      'ADMITTED',
    ]);

    // Check stage metrics integrity
    for (const stage of funnel.stages) {
      expect(stage.count).toBeGreaterThanOrEqual(0);
      expect(stage.conversionPercentFromTop).toBeGreaterThanOrEqual(0);
      expect(stage.conversionPercentFromTop).toBeLessThanOrEqual(100);
      expect(stage.dropOffPercent).toBeGreaterThanOrEqual(0);
      expect(stage.dropOffPercent).toBeLessThanOrEqual(100);
    }
  });

  it('rejects unauthenticated requests or unauthorized student roles to executive reports', async () => {
    // No auth header
    const reqUnauth = new Request('https://zealosh.com/api/admin/reports/executive');
    const resUnauth = await GET(reqUnauth);
    expect(resUnauth.status).toBe(401);

    // Student role
    const reqForbidden = new Request('https://zealosh.com/api/admin/reports/executive', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const resForbidden = await GET(reqForbidden);
    expect(resForbidden.status).toBe(403);
  });

  it('exports sanitized CSV format preventing spreadsheet formula injection', async () => {
    const reqCsv = new Request('https://zealosh.com/api/admin/reports/executive?format=csv', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resCsv = await GET(reqCsv);

    expect(resCsv.status).toBe(200);
    expect(resCsv.headers.get('content-type')).toContain('text/csv');
    expect(resCsv.headers.get('content-disposition')).toContain('zealosh-executive-funnel.csv');

    const csvText = await resCsv.text();
    expect(csvText).toContain('"Stage Name","Stage ID","Learners Count"');
    expect(csvText).toContain('LEAD');
    expect(csvText).toContain('ADMITTED');

    // Ensure lines don't begin with dangerous formula triggers unescaped
    const lines = csvText.split('\n');
    for (const line of lines) {
      if (line.trim().length > 0) {
        expect(line.startsWith('=')).toBe(false);
        expect(line.startsWith('+')).toBe(false);
        expect(line.startsWith('@')).toBe(false);
      }
    }
  });
});

