// ==============================================================================
// Zealosh LMS — Health & Diagnostics Endpoint Unit Test Suite
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getHealth } from '@/app/api/health/route';

describe('Zealosh LMS — Health & Diagnostics Probes (/api/health)', () => {
  it('1. should return instant HTTP 200 for liveness probe with correlationId', async () => {
    const req = new NextRequest('http://localhost:3000/api/health?type=liveness');
    const res = await getHealth(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('UP');
    expect(data.correlationId).toMatch(/^corr-/);
    expect(data.timestamp).toBeDefined();
    expect(res.headers.get('x-correlation-id')).toBe(data.correlationId);
  });

  it('2. should return standard health overview with database status', async () => {
    const req = new NextRequest('http://localhost:3000/api/health');
    const res = await getHealth(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(['HEALTHY', 'DEGRADED']).toContain(data.status);
    expect(data.services.application).toBe('HEALTHY');
    expect(data.services.database).toBeDefined();
    expect(data.correlationId).toMatch(/^corr-/);
  });

  it('3. should verify response is completely scrubbed of any secrets', async () => {
    const req = new NextRequest('http://localhost:3000/api/health?type=readiness');
    const res = await getHealth(req);
    const text = await res.text();

    expect(text).not.toContain('password');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('Bearer');
    expect(text).not.toContain('postgres://');
  });
});

