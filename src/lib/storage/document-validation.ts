// Zealosh LMS — Admissions Document Upload Security & Validation
// Architecture: ADR-002 & Master Security Constitution
// Defense-in-depth: Magic byte verification, path traversal sanitization, and configurable file size ceiling

import { PlatformSettings } from '@/types';

export const DEFAULT_MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PERMISSIBLE_DOCUMENT_CEILING_BYTES = 100 * 1024 * 1024; // 100 MB safe upper bound

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

/**
 * Returns the effective maximum allowable document size in bytes.
 * Validates inputs to ensure only positive, safe integers within system bounds are honored.
 */
export function getMaxDocumentSizeBytes(settings?: Partial<PlatformSettings> | null): number {
  if (
    settings?.maxDocumentSizeBytes &&
    typeof settings.maxDocumentSizeBytes === 'number' &&
    Number.isInteger(settings.maxDocumentSizeBytes) &&
    settings.maxDocumentSizeBytes > 0 &&
    settings.maxDocumentSizeBytes <= MAX_PERMISSIBLE_DOCUMENT_CEILING_BYTES
  ) {
    return settings.maxDocumentSizeBytes;
  }

  if (process.env.MAX_DOCUMENT_SIZE_BYTES) {
    const parsed = parseInt(process.env.MAX_DOCUMENT_SIZE_BYTES, 10);
    if (
      !isNaN(parsed) &&
      Number.isInteger(parsed) &&
      parsed > 0 &&
      parsed <= MAX_PERMISSIBLE_DOCUMENT_CEILING_BYTES
    ) {
      return parsed;
    }
  }

  return DEFAULT_MAX_DOCUMENT_SIZE_BYTES;
}

/**
 * Strict path traversal and filename sanitization.
 * Strips null bytes, directory separators (\ and /), consecutive dots, and shell meta-characters.
 */
export function sanitizeFilename(rawFilename?: string): string {
  if (!rawFilename || typeof rawFilename !== 'string') {
    return 'document.pdf';
  }

  // Remove null bytes and control characters
  let clean = rawFilename.replace(/[\0\x00-\x1f\x7f]/g, '');
  // Normalize Windows slashes to forward slashes and extract basename
  clean = clean.replace(/\\/g, '/');
  clean = clean.split('/').pop() || 'document.pdf';
  // Remove consecutive dots to prevent traversal
  clean = clean.replace(/\.{2,}/g, '.');
  // Allow only alphanumeric characters, periods, dashes, and underscores
  clean = clean.replace(/[^\w\.\-_]/g, '_');

  if (!clean || clean === '.' || clean === '..') {
    clean = 'document.pdf';
  }
  return clean;
}

export interface MagicByteCheckResult {
  valid: boolean;
  detectedType?: string;
  isExecutable?: boolean;
  error?: string;
}

/**
 * Validates document magic bytes (file signature) against declared MIME type.
 * Explicitly rejects executable formats (PE/MZ, ELF, Mach-O, scripts #!, Java class bytecode).
 */
export function verifyDocumentMagicBytes(
  buffer: Buffer | Uint8Array,
  declaredMimeType: string
): MagicByteCheckResult {
  if (!buffer || buffer.length === 0) {
    return { valid: true }; // No binary content supplied (metadata-only payload)
  }

  const len = buffer.length;

  // 1. Executable & Script Signature Detection (Strict Reject)
  // Windows Portable Executable (MZ)
  if (len >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { valid: false, isExecutable: true, error: 'Executable binary files (Windows PE/MZ) are strictly forbidden.' };
  }
  // Linux ELF Executable (\x7FELF)
  if (len >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return { valid: false, isExecutable: true, error: 'Executable binary files (Linux ELF) are strictly forbidden.' };
  }
  // Unix Script Shebang (#!)
  if (len >= 2 && buffer[0] === 0x23 && buffer[1] === 0x21) {
    return { valid: false, isExecutable: true, error: 'Script files with execution shebangs (#!) are strictly forbidden.' };
  }
  // Java Bytecode (.class) 0xCAFEBABE
  if (len >= 4 && buffer[0] === 0xca && buffer[1] === 0xfe && buffer[2] === 0xba && buffer[3] === 0xbe) {
    return { valid: false, isExecutable: true, error: 'Compiled bytecode binaries are strictly forbidden.' };
  }
  // Mach-O Binaries (macOS)
  if (
    len >= 4 &&
    ((buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && buffer[3] === 0xce) ||
     (buffer[0] === 0xce && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe) ||
     (buffer[0] === 0xfe && buffer[1] === 0xed && buffer[2] === 0xfa && buffer[3] === 0xcf) ||
     (buffer[0] === 0xcf && buffer[1] === 0xfa && buffer[2] === 0xed && buffer[3] === 0xfe))
  ) {
    return { valid: false, isExecutable: true, error: 'Executable binary files (Mach-O) are strictly forbidden.' };
  }

  // 2. Validate against declared MIME type
  const normMime = declaredMimeType.toLowerCase().trim();

  if (normMime === 'application/pdf') {
    // PDF Magic Bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (len >= 5) {
      const isPdf =
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46 &&
        buffer[4] === 0x2d;
      if (!isPdf) {
        return { valid: false, error: 'Invalid file signature: Declared application/pdf does not begin with %PDF- header.' };
      }
      return { valid: true, detectedType: 'application/pdf' };
    }
  }

  if (normMime === 'image/png') {
    // PNG Magic Bytes: \x89PNG\r\n\x1a\n (89 50 4E 47 0D 0A 1A 0A)
    if (len >= 8) {
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;
      if (!isPng) {
        return { valid: false, error: 'Invalid file signature: Declared image/png does not match standard PNG header.' };
      }
      return { valid: true, detectedType: 'image/png' };
    }
  }

  if (normMime === 'image/jpeg' || normMime === 'image/jpg') {
    // JPEG Magic Bytes: FF D8 FF
    if (len >= 3) {
      const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      if (!isJpeg) {
        return { valid: false, error: 'Invalid file signature: Declared image/jpeg does not match standard JPEG SOI marker.' };
      }
      return { valid: true, detectedType: 'image/jpeg' };
    }
  }

  if (normMime === 'image/webp') {
    // WebP Magic Bytes: RIFF....WEBP
    if (len >= 12) {
      const isRiff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      const isWebp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      if (!isRiff || !isWebp) {
        return { valid: false, error: 'Invalid file signature: Declared image/webp does not match standard RIFF/WEBP header.' };
      }
      return { valid: true, detectedType: 'image/webp' };
    }
  }

  return { valid: true };
}

export interface DocumentValidationInput {
  filename?: string;
  fileName?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  fileSize?: number;
  sizeBytes?: number;
  contentBase64?: string;
  buffer?: Buffer;
  documentType?: any;
}

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
  sanitizedFilename: string;
  mimeType: string;
  fileSizeBytes: number;
}

export function validateDocumentUpload(
  doc: DocumentValidationInput,
  index: number = 0,
  maxSizeBytes: number = DEFAULT_MAX_DOCUMENT_SIZE_BYTES
): DocumentValidationResult {
  const rawFilename = doc.filename || doc.fileName || `document-${index + 1}.pdf`;
  const sanitized = sanitizeFilename(rawFilename);
  const mime = (doc.mimeType || 'application/pdf').toLowerCase().trim();
  const rawSize = doc.fileSizeBytes ?? doc.fileSize ?? doc.sizeBytes ?? 0;
  const size = Number(rawSize);

  if (size <= 0 || isNaN(size)) {
    return {
      valid: false,
      error: `Document ${rawFilename} specifies an invalid non-positive file size. Must be a positive integer.`,
      sanitizedFilename: sanitized,
      mimeType: mime,
      fileSizeBytes: 0,
    };
  }

  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return {
      valid: false,
      error: `Document ${rawFilename} has unsupported MIME type "${mime}". Allowed types: PDF, PNG, JPEG, WebP.`,
      sanitizedFilename: sanitized,
      mimeType: mime,
      fileSizeBytes: size,
    };
  }

  if (size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      error: `Document ${rawFilename} exceeds maximum allowable file size (${maxMb}MB ceiling).`,
      sanitizedFilename: sanitized,
      mimeType: mime,
      fileSizeBytes: size,
    };
  }

  // If binary content is present as Buffer or Base64, verify magic bytes
  let buffer: Buffer | null = null;
  if (doc.buffer && Buffer.isBuffer(doc.buffer)) {
    buffer = doc.buffer;
  } else if (doc.contentBase64 && typeof doc.contentBase64 === 'string') {
    try {
      buffer = Buffer.from(doc.contentBase64, 'base64');
    } catch {
      return {
        valid: false,
        error: `Document ${rawFilename} contains malformed base64 content.`,
        sanitizedFilename: sanitized,
        mimeType: mime,
        fileSizeBytes: size,
      };
    }
  }

  if (buffer) {
    const magicCheck = verifyDocumentMagicBytes(buffer, mime);
    if (!magicCheck.valid) {
      return {
        valid: false,
        error: `Document ${rawFilename} security check failed: ${magicCheck.error}`,
        sanitizedFilename: sanitized,
        mimeType: mime,
        fileSizeBytes: size,
      };
    }
  }

  return {
    valid: true,
    sanitizedFilename: sanitized,
    mimeType: mime,
    fileSizeBytes: size,
  };
}
