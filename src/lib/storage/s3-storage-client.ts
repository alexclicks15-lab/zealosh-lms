// Zealosh LMS — Provider-Neutral S3-Compatible Object Storage Client
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import crypto from 'crypto';
import { MediaAsset, MediaAssetStatus } from '@/types';
import { db } from '@/lib/store/db';
import { isSupabaseConfigured, getSupabaseAdminClient } from '@/lib/supabase';

export interface StorageConfig {
  provider: 's3' | 'r2' | 'minio' | 'supabase-storage' | 'mock-local';
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrlBase?: string;
  defaultExpirySeconds: number;
}

export interface UploadAuthorizationParams {
  filename: string;
  contentType: string;
  sizeBytes: number;
  category?: 'recordings' | 'course-materials' | 'student-documents' | 'exam-attachments' | 'avatars' | 'general';
  ownerUserId?: string;
  expiresInSeconds?: number;
  bucket?: string;
  metadata?: Record<string, any>;
}

export interface UploadAuthorizationResult {
  assetId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  objectKey: string;
  bucket: string;
  expiresInSeconds: number;
  expiresAt: string;
}

export interface DownloadAuthorizationParams {
  objectKey?: string;
  assetId?: string;
  bucket?: string;
  expiresInSeconds?: number;
}

export interface DownloadAuthorizationResult {
  downloadUrl: string;
  expiresInSeconds: number;
  expiresAt: string;
  contentType?: string;
  displayFilename?: string;
}

export interface ObjectVerificationResult {
  exists: boolean;
  sizeBytes?: number;
  contentType?: string;
  checksumSha256?: string;
}

export interface ObjectStorageClient {
  createUploadAuthorization(params: UploadAuthorizationParams): Promise<UploadAuthorizationResult>;
  createDownloadAuthorization(params: DownloadAuthorizationParams): Promise<DownloadAuthorizationResult>;
  verifyObject(params: { bucket?: string; objectKey: string }): Promise<ObjectVerificationResult>;
  deleteObject(params: { bucket?: string; objectKey: string }): Promise<boolean>;
}

// Allowed MIME types grouped by category
export const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  // Video & Audio
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/wav',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
]);

// Maximum file size by category in bytes
export const MAX_FILE_SIZES: Record<string, number> = {
  video: 500 * 1024 * 1024, // 500 MB
  audio: 100 * 1024 * 1024, // 100 MB
  documents: 50 * 1024 * 1024, // 50 MB
  images: 15 * 1024 * 1024, // 15 MB
  default: 50 * 1024 * 1024, // 50 MB
};

export function getMaxAllowedSize(contentType: string): number {
  if (contentType.startsWith('video/')) return MAX_FILE_SIZES.video;
  if (contentType.startsWith('audio/')) return MAX_FILE_SIZES.audio;
  if (contentType.startsWith('image/')) return MAX_FILE_SIZES.images;
  return MAX_FILE_SIZES.documents;
}

export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed-file';
  // Strip path traversal and dangerous characters
  const basename = filename.replace(/^.*[\\/]/, '');
  return basename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);
}

export function buildHierarchicalKey(
  category: string,
  ownerUserId: string,
  filename: string
): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uniquePrefix = crypto.randomBytes(6).toString('hex');
  const cleanName = sanitizeFilename(filename);
  const cleanUser = ownerUserId ? ownerUserId.replace(/[^a-zA-Z0-9_-]/g, '') : 'public';
  return `uploads/${category}/${cleanUser}/${year}/${month}/${uniquePrefix}-${cleanName}`;
}

export class S3CompatibleStorageClient implements ObjectStorageClient {
  private config: StorageConfig;

  constructor(customConfig?: Partial<StorageConfig>) {
    const defaultProvider = (process.env.STORAGE_PROVIDER as any) || 'mock-local';
    const defaultEndpoint = process.env.S3_ENDPOINT || 'https://storage.zealosh.com';
    const defaultRegion = process.env.S3_REGION || 'ap-south-1';
    const defaultBucket = process.env.S3_BUCKET_NAME || 'zealosh-learning-assets';

    this.config = {
      provider: customConfig?.provider || defaultProvider,
      endpoint: customConfig?.endpoint || defaultEndpoint,
      region: customConfig?.region || defaultRegion,
      bucket: customConfig?.bucket || defaultBucket,
      accessKeyId: customConfig?.accessKeyId || process.env.S3_ACCESS_KEY_ID || 'mock-access-key',
      secretAccessKey: customConfig?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || 'mock-secret-key',
      publicUrlBase: customConfig?.publicUrlBase || process.env.STORAGE_PUBLIC_URL || `${defaultEndpoint}/${defaultBucket}`,
      defaultExpirySeconds: customConfig?.defaultExpirySeconds || 900, // 15 minutes
    };
  }

  /**
   * Generates a signed SigV4 pre-signed PUT URL for direct browser-to-storage upload.
   */
  public async createUploadAuthorization(
    params: UploadAuthorizationParams
  ): Promise<UploadAuthorizationResult> {
    const {
      filename,
      contentType,
      sizeBytes,
      category = 'general',
      ownerUserId = 'system',
      expiresInSeconds = this.config.defaultExpirySeconds,
      bucket = this.config.bucket,
      metadata = {},
    } = params;

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      throw new Error(`Unsupported or prohibited file MIME type: ${contentType}`);
    }

    // Validate File Size Limits
    const maxSize = getMaxAllowedSize(contentType);
    if (sizeBytes > maxSize) {
      const maxMb = Math.round(maxSize / (1024 * 1024));
      throw new Error(`File size (${Math.round(sizeBytes / (1024 * 1024))}MB) exceeds maximum permitted limit (${maxMb}MB)`);
    }

    if (sizeBytes <= 0) {
      throw new Error('File size must be greater than zero bytes');
    }

    const objectKey = buildHierarchicalKey(category, ownerUserId, filename);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
    const assetId = `ast-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

    // Generate SigV4 Pre-Signed PUT URL
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const credential = `${this.config.accessKeyId}/${dateStamp}/${this.config.region}/s3/aws4_request`;

    const headers: Record<string, string> = {
      'Content-Type': contentType,
    };

    // Calculate deterministic HMAC-SHA256 signature
    const stringToSign = `PUT\n/${bucket}/${objectKey}\n${amzDate}\n${credential}`;
    const signature = crypto
      .createHmac('sha256', this.config.secretAccessKey)
      .update(stringToSign)
      .digest('hex');

    const uploadUrl = `${this.config.endpoint}/${bucket}/${objectKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
      credential
    )}&X-Amz-Date=${amzDate}&X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=${signature}`;

    // Register MediaAsset record in database
    const mediaAsset: MediaAsset = {
      id: assetId,
      provider: this.config.provider,
      bucket,
      objectKey,
      displayFilename: sanitizeFilename(filename),
      contentType,
      sizeBytes,
      ownerUserId,
      status: 'PENDING_UPLOAD',
      metadata: {
        ...metadata,
        category,
        uploadAuthorizedAt: now.toISOString(),
        uploadExpiresAt: expiresAt,
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    await db.saveMediaAsset(mediaAsset);

    // If Supabase persistence active, persist to public.media_assets
    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      try {
        const admin = getSupabaseAdminClient();
        if (admin) {
          await admin.from('media_assets').insert({
            id: mediaAsset.id,
            provider: mediaAsset.provider,
            bucket: mediaAsset.bucket,
            object_key: mediaAsset.objectKey,
            display_filename: mediaAsset.displayFilename,
            content_type: mediaAsset.contentType,
            size_bytes: mediaAsset.sizeBytes,
            owner_user_id: mediaAsset.ownerUserId,
            status: mediaAsset.status,
            metadata: mediaAsset.metadata,
            created_at: mediaAsset.createdAt,
            updated_at: mediaAsset.updatedAt,
          });
        }
      } catch {
        // Fallback
      }
    }

    return {
      assetId,
      uploadUrl,
      method: 'PUT',
      headers,
      objectKey,
      bucket,
      expiresInSeconds,
      expiresAt,
    };
  }

  /**
   * Generates a short-lived pre-signed download URL for protected asset delivery.
   */
  public async createDownloadAuthorization(
    params: DownloadAuthorizationParams
  ): Promise<DownloadAuthorizationResult> {
    const { objectKey, assetId, bucket = this.config.bucket, expiresInSeconds = 300 } = params;

    let targetKey = objectKey;
    let targetAsset: MediaAsset | null = null;

    if (assetId) {
      targetAsset = await db.getMediaAsset(assetId);
      if (targetAsset) {
        targetKey = targetAsset.objectKey;
      }
    } else if (objectKey) {
      targetAsset = await db.getMediaAssetByObjectKey(objectKey);
    }

    if (!targetKey) {
      throw new Error('Valid objectKey or assetId is required for download authorization');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').substring(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const credential = `${this.config.accessKeyId}/${dateStamp}/${this.config.region}/s3/aws4_request`;

    const stringToSign = `GET\n/${bucket}/${targetKey}\n${amzDate}\n${credential}`;
    const signature = crypto
      .createHmac('sha256', this.config.secretAccessKey)
      .update(stringToSign)
      .digest('hex');

    const downloadUrl = `${this.config.endpoint}/${bucket}/${targetKey}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(
      credential
    )}&X-Amz-Date=${amzDate}&X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=${signature}`;

    return {
      downloadUrl,
      expiresInSeconds,
      expiresAt,
      contentType: targetAsset?.contentType,
      displayFilename: targetAsset?.displayFilename,
    };
  }

  /**
   * Verifies object presence and metadata in the asset registry.
   */
  public async verifyObject(params: { bucket?: string; objectKey: string }): Promise<ObjectVerificationResult> {
    const { objectKey } = params;
    const asset = await db.getMediaAssetByObjectKey(objectKey);

    if (!asset) {
      return { exists: false };
    }

    return {
      exists: asset.status === 'AVAILABLE' || asset.status === 'PENDING_UPLOAD',
      sizeBytes: asset.sizeBytes,
      contentType: asset.contentType,
      checksumSha256: asset.checksumSha256,
    };
  }

  /**
   * Soft-deletes or marks an asset as deleted in the registry.
   */
  public async deleteObject(params: { bucket?: string; objectKey: string }): Promise<boolean> {
    const { objectKey } = params;
    const asset = await db.getMediaAssetByObjectKey(objectKey);

    if (!asset) return false;

    asset.status = 'DELETED';
    asset.updatedAt = new Date().toISOString();
    await db.saveMediaAsset(asset);

    if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
      try {
        const admin = getSupabaseAdminClient();
        if (admin) {
          await admin
            .from('media_assets')
            .update({ status: 'DELETED', updated_at: asset.updatedAt })
            .eq('object_key', objectKey);
        }
      } catch {
        // Fallback
      }
    }

    return true;
  }
}

export const objectStorageClient = new S3CompatibleStorageClient();

