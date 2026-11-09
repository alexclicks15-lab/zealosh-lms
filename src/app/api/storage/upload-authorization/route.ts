// Zealosh LMS — Direct Object Storage Pre-Signed Upload Authorization Handler
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { objectStorageClient } from '@/lib/storage/s3-storage-client';

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/zealosh_token=([^;]+)/);
  if (match) return match[1];
  return null;
}

export async function POST(request: Request) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const { filename, contentType, sizeBytes, category = 'general', metadata } = body;

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    if (!contentType || typeof contentType !== 'string') {
      return NextResponse.json({ error: 'ContentType is required' }, { status: 400 });
    }

    if (!sizeBytes || typeof sizeBytes !== 'number' || sizeBytes <= 0) {
      return NextResponse.json({ error: 'Valid positive sizeBytes is required' }, { status: 400 });
    }

    // Role-based Category Authorization Guard
    if (payload.role === 'STUDENT') {
      const allowedStudentCategories = ['student-documents', 'avatars', 'general'];
      if (!allowedStudentCategories.includes(category)) {
        return NextResponse.json(
          { error: `Students are not authorized to upload to the '${category}' category` },
          { status: 403 }
        );
      }
    }

    const result = await objectStorageClient.createUploadAuthorization({
      filename,
      contentType,
      sizeBytes,
      category: category as any,
      ownerUserId: payload.userId,
      metadata: {
        ...metadata,
        uploaderRole: payload.role,
        uploaderEmail: payload.email,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    const isValidationError =
      err.message?.includes('Unsupported') ||
      err.message?.includes('exceeds maximum') ||
      err.message?.includes('prohibited');

    return NextResponse.json(
      { error: err.message || 'Failed to authorize object upload' },
      { status: isValidationError ? 400 : 500 }
    );
  }
}

