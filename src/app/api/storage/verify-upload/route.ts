// Zealosh LMS — Object Upload Verification Handler
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db } from '@/lib/store/db';
import { isSupabaseConfigured, getSupabaseAdminClient } from '@/lib/supabase';

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
    const { assetId, objectKey, checksumSha256 } = body;

    let asset = assetId ? await db.getMediaAsset(assetId) : null;
    if (!asset && objectKey) {
      asset = await db.getMediaAssetByObjectKey(objectKey);
    }

    if (!asset) {
      return NextResponse.json({ error: 'Media asset record not found' }, { status: 404 });
    }

    // Ownership check: only owner or admin can verify
    if (asset.ownerUserId !== payload.userId && payload.role !== 'SUPER_ADMIN' && payload.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized to verify asset belonging to another user' }, { status: 403 });
    }

    asset.status = 'AVAILABLE';
    if (checksumSha256) asset.checksumSha256 = checksumSha256;
    asset.updatedAt = new Date().toISOString();

    await db.saveMediaAsset(asset);

    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      try {
        const admin = getSupabaseAdminClient();
        if (admin) {
          await admin
            .from('media_assets')
            .update({
              status: 'AVAILABLE',
              checksum_sha256: asset.checksumSha256 || null,
              updated_at: asset.updatedAt,
            })
            .eq('id', asset.id);
        }
      } catch {
        // Fallback
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Media asset verified and activated successfully',
      asset,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to verify upload' }, { status: 500 });
  }
}

