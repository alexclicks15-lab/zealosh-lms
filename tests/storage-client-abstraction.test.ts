// Zealosh LMS — Direct Object Storage Client Abstraction Test Suite
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import {
  objectStorageClient,
  ALLOWED_MIME_TYPES,
  getMaxAllowedSize,
  sanitizeFilename,
  buildHierarchicalKey,
} from '@/lib/storage/s3-storage-client';
import { POST as uploadAuthPost } from '@/app/api/storage/upload-authorization/route';
import { POST as verifyUploadPost } from '@/app/api/storage/verify-upload/route';
import { GET as downloadAuthGet } from '@/app/api/storage/download-authorization/route';

describe('Track 1: Direct Object Storage Client Abstraction (ZM-IMPL-08B)', () => {
  beforeEach(async () => {
    await db.resetToSeed();
  });

  it('1. should sanitize filenames and construct safe hierarchical storage keys', () => {
    const raw = '../../../etc/passwd;malicious file (1).pdf';
    const clean = sanitizeFilename(raw);
    expect(clean).not.toContain('..');
    expect(clean).not.toContain('/');
    expect(clean).not.toContain('\\');
    expect(clean).toContain('malicious_file_1_.pdf');

    const key = buildHierarchicalKey('course-materials', 'usr-inst-01', 'safety_guidelines.pdf');
    expect(key).toMatch(/^uploads\/course-materials\/usr-inst-01\/\d{4}\/\d{2}\/[a-f0-9]{12}-safety_guidelines\.pdf$/);
  });

  it('2. should enforce allowed MIME types and category size limits', () => {
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('video/mp4')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/x-msdownload')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('application/x-sh')).toBe(false);

    expect(getMaxAllowedSize('video/mp4')).toBe(500 * 1024 * 1024);
    expect(getMaxAllowedSize('image/png')).toBe(15 * 1024 * 1024);
    expect(getMaxAllowedSize('application/pdf')).toBe(50 * 1024 * 1024);
  });

  it('3. should generate valid pre-signed PUT upload authorization with SigV4 parameters', async () => {
    const result = await objectStorageClient.createUploadAuthorization({
      filename: 'nebosh_study_plan.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024 * 500, // 500 KB
      category: 'course-materials',
      ownerUserId: 'usr-inst-01',
      expiresInSeconds: 600,
    });

    expect(result.assetId).toBeDefined();
    expect(result.method).toBe('PUT');
    expect(result.uploadUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(result.uploadUrl).toContain('X-Amz-Signature=');
    expect(result.uploadUrl).toContain('X-Amz-Expires=600');
    expect(result.headers['Content-Type']).toBe('application/pdf');

    // Verify asset created with PENDING_UPLOAD status
    const asset = await db.getMediaAsset(result.assetId);
    expect(asset).toBeDefined();
    expect(asset?.status).toBe('PENDING_UPLOAD');
    expect(asset?.ownerUserId).toBe('usr-inst-01');
  });

  it('4. should reject prohibited MIME types via /api/storage/upload-authorization', async () => {
    const student = await db.getUser('usr-std-01');
    const token = signToken({ ...student! });

    const req = new Request('http://localhost:3000/api/storage/upload-authorization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filename: 'exploit.sh',
        contentType: 'application/x-sh',
        sizeBytes: 1024,
        category: 'student-documents',
      }),
    });

    const res = await uploadAuthPost(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Unsupported or prohibited file MIME type');
  });

  it('5. should enforce role-based upload category permissions (students restricted from course-materials)', async () => {
    const student = await db.getUser('usr-std-01');
    const token = signToken({ ...student! });

    const req = new Request('http://localhost:3000/api/storage/upload-authorization', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filename: 'curriculum.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
        category: 'course-materials',
      }),
    });

    const res = await uploadAuthPost(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain('Students are not authorized');
  });

  it('6. should transition asset status to AVAILABLE upon verify-upload and grant download authorization', async () => {
    const student = await db.getUser('usr-std-01');
    const token = signToken({ ...student! });

    // Step 1: Authorize upload
    const authRes = await objectStorageClient.createUploadAuthorization({
      filename: 'id_verification.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
      category: 'student-documents',
      ownerUserId: student!.id,
    });

    // Step 2: Confirm upload via verify endpoint
    const verifyReq = new Request('http://localhost:3000/api/storage/verify-upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        assetId: authRes.assetId,
        checksumSha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      }),
    });

    const verifyRes = await verifyUploadPost(verifyReq);
    expect(verifyRes.status).toBe(200);

    const verifyData = await verifyRes.json();
    expect(verifyData.success).toBe(true);
    expect(verifyData.asset.status).toBe('AVAILABLE');

    // Step 3: Get pre-signed download URL
    const dlReq = new Request(`http://localhost:3000/api/storage/download-authorization?assetId=${authRes.assetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const dlRes = await downloadAuthGet(dlReq);
    expect(dlRes.status).toBe(200);

    const dlData = await dlRes.json();
    expect(dlData.success).toBe(true);
    expect(dlData.downloadUrl).toContain('X-Amz-Signature=');
    expect(dlData.downloadUrl).toContain('id_verification.pdf');
  });
});
