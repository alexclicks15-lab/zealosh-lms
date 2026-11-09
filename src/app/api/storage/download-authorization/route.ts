// Zealosh LMS — Pre-Signed Download Authorization Handler
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db } from '@/lib/store/db';
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

export async function GET(request: Request) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId') || undefined;
    const objectKey = searchParams.get('objectKey') || undefined;

    if (!assetId && !objectKey) {
      return NextResponse.json({ error: 'assetId or objectKey query parameter is required' }, { status: 400 });
    }

    let asset = assetId ? await db.getMediaAsset(assetId) : null;
    if (!asset && objectKey) {
      asset = await db.getMediaAssetByObjectKey(objectKey);
    }

    if (asset && asset.status === 'DELETED') {
      return NextResponse.json({ error: 'The requested asset has been deleted' }, { status: 410 });
    }

    const result = await objectStorageClient.createDownloadAuthorization({
      assetId,
      objectKey,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to authorize download' }, { status: 500 });
  }
}

