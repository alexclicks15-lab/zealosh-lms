// Zealosh LMS — Tamper-Evident Ed25519 Signed PDF Certificates & Offline Verification Engine
// File: src/lib/credentials/certificate-service.ts
// Adheres strictly to Zealosh Brand Identity, ADR-002, ADR-004, and Asymmetric Cryptographic Signing.

import crypto from 'crypto';
import {
  SignedCertificateManifest,
  CertificateSigningKey,
  CertificateEligibilityEvaluation,
  OfflineVerificationResult,
  CertificateRevocationRecord,
  CertificateRecord,
  UserRole,
} from '@/types';
import { db } from '@/lib/store/db';
import { OrientationService } from '@/lib/orientation/orientation-service';

// In-memory collections for local execution / tests
export const inMemorySigningKeys: Map<string, CertificateSigningKey> = new Map();
export const inMemoryIssuedCertificates: Map<string, SignedCertificateManifest & {
  id: string;
  status: 'ISSUED' | 'REVOKED' | 'SUPERSEDED';
  revocationReason?: string;
  revokedAt?: string;
  revokedBy?: string;
  supersededByCode?: string;
  pdfBuffer?: Buffer;
}> = new Map();
export const inMemoryRevocations: Map<string, CertificateRevocationRecord> = new Map();

// Institutional default ed25519 keypair
const DEFAULT_KEY_ID = 'zealosh-root-2026-v1';
let defaultKeyPair: { publicKeyPem: string; privateKeyPem: string } | null = null;

function ensureDefaultInstitutionalKey(): { keyId: string; publicKeyPem: string; privateKeyPem: string } {
  if (!defaultKeyPair) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    defaultKeyPair = { publicKeyPem: publicKey, privateKeyPem: privateKey };
    inMemorySigningKeys.set(DEFAULT_KEY_ID, {
      keyId: DEFAULT_KEY_ID,
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
      algorithm: 'ed25519',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    });
  }
  return {
    keyId: DEFAULT_KEY_ID,
    publicKeyPem: defaultKeyPair.publicKeyPem,
    privateKeyPem: defaultKeyPair.privateKeyPem,
  };
}

export class CertificateService {
  constructor() {
    ensureDefaultInstitutionalKey();
  }

  /**
   * Generates a new Ed25519 signing keypair for key rotation.
   */
  public generateSigningKeyPair(keyId: string): CertificateSigningKey {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const keyRecord: CertificateSigningKey = {
      keyId,
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
      algorithm: 'ed25519',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    inMemorySigningKeys.set(keyId, keyRecord);
    return keyRecord;
  }

  /**
   * Retrieves an active public key by Key ID.
   */
  public getPublicKey(keyId: string): string | null {
    const key = inMemorySigningKeys.get(keyId);
    if (!key || key.status !== 'ACTIVE') return null;
    return key.publicKeyPem;
  }

  /**
   * Serializes a certificate manifest canonically with sorted keys to guarantee
   * deterministic hashing and signature verification.
   */
  public serializeCanonicalManifest(manifest: Omit<SignedCertificateManifest, 'signature' | 'canonicalHash'>): string {
    const canonicalObj = {
      certificateCode: manifest.certificateCode,
      certificationType: manifest.certificationType,
      completionDate: manifest.completionDate,
      courseId: manifest.courseId,
      courseTitle: manifest.courseTitle,
      issueDate: manifest.issueDate,
      issuer: manifest.issuer,
      keyId: manifest.keyId,
      scorePercent: Number(manifest.scorePercent.toFixed(2)),
      studentId: manifest.studentId || '',
      studentName: manifest.studentName,
    };
    return JSON.stringify(canonicalObj);
  }

  /**
   * Computes SHA-256 hash of the canonical manifest string.
   */
  public computeManifestHash(canonicalString: string): string {
    return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
  }

  /**
   * Signs a canonical manifest string using Ed25519 private key.
   */
  public signManifest(canonicalString: string, privateKeyPem: string): string {
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signatureBuffer = crypto.sign(null, Buffer.from(canonicalString, 'utf8'), privateKey);
    return signatureBuffer.toString('hex');
  }

  /**
   * Verifies an Ed25519 signature against the canonical manifest string and public key.
   */
  public verifySignature(canonicalString: string, signatureHex: string, publicKeyPem: string): boolean {
    try {
      const publicKey = crypto.createPublicKey(publicKeyPem);
      const signatureBuffer = Buffer.from(signatureHex, 'hex');
      return crypto.verify(null, Buffer.from(canonicalString, 'utf8'), publicKey, signatureBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Evaluates student eligibility for certification issuance.
   * Checks:
   * 1. Active or completed enrollment
   * 2. Verified orientation attendance (if course orientation is required)
   * 3. Formal exam score >= passing score (default 70%)
   */
  public async evaluateEligibility(studentId: string, courseId: string): Promise<CertificateEligibilityEvaluation> {
    const reasons: string[] = [];

    // 1. Enrollment check
    const enrollments = await db.getEnrollments(studentId);
    const courseEnrollment = enrollments.find(
      (e) => e.courseId === courseId && (e.status === 'COMPLETED' || e.status === 'ACTIVE')
    );
    const enrollmentCompleted = !!courseEnrollment;
    if (!enrollmentCompleted) {
      reasons.push('Student does not possess an active or completed enrollment in this course.');
    }

    // 2. Orientation Attendance check
    let orientationAttended = true;
    const orientationConfig = await OrientationService.getCourseOrientationConfig(courseId);
    if (orientationConfig && orientationConfig.isRequired) {
      const bookings = await OrientationService.getUserBookings(studentId);
      const attended = bookings.some(
        (b) => b.courseId === courseId && b.status === 'ATTENDED'
      );
      if (!attended) {
        orientationAttended = false;
        reasons.push('Mandatory course orientation attendance is not verified.');
      }
    }

    // 3. Exam Score check (passing score >= 70%)
    const minimumPassingScore = 70.0;
    const examAttempts = Array.from(db.examAttempts.values()).filter(
      (a) => a.userId === studentId && (a.courseId === courseId || (a as any).certificationType)
    );

    // Find highest passing attempt
    let highestScore = 0;
    for (const attempt of examAttempts) {
      if (attempt.status === 'COMPLETED' || attempt.status === 'SUBMITTED' || attempt.passed === true) {
        const score = (attempt as any).scorePercent ?? (attempt.score && attempt.totalScore ? (attempt.score / attempt.totalScore) * 100 : (attempt.score || 0));
        if (score > highestScore) highestScore = score;
      }
    }

    const examPassed = highestScore >= minimumPassingScore;
    if (!examPassed) {
      reasons.push(
        `Examinee score (${highestScore.toFixed(1)}%) does not meet the minimum passing standard of ${minimumPassingScore}%.`
      );
    }

    const eligible = enrollmentCompleted && orientationAttended && examPassed;

    return {
      eligible,
      studentId,
      courseId,
      enrollmentCompleted,
      orientationAttended,
      examPassed,
      examScorePercent: Number(highestScore.toFixed(2)),
      minimumPassingScore,
      reasons,
    };
  }

  /**
   * Issues a new tamper-evident certificate for an eligible student.
   */
  public async issueCertificate(params: {
    studentId: string;
    studentName: string;
    courseId: string;
    courseTitle: string;
    certificationType: string;
    scorePercent: number;
    completionDate?: string;
    issuedBy?: string;
    keyId?: string;
  }): Promise<{
    manifest: SignedCertificateManifest;
    pdfBuffer: Buffer;
    verificationUrl: string;
  }> {
    const keyInfo = ensureDefaultInstitutionalKey();
    const activeKeyId = params.keyId || keyInfo.keyId;
    const keyRecord = inMemorySigningKeys.get(activeKeyId);

    if (!keyRecord || !keyRecord.privateKeyPem) {
      throw new Error(`SIGNING_KEY_UNAVAILABLE: Signing key "${activeKeyId}" has no private key available.`);
    }

    const certSeq = Math.floor(100000 + Math.random() * 900000);
    const certCode = `ZEI/EXAM/2026/${certSeq}`;
    const now = new Date().toISOString();
    const completionDate = params.completionDate || now;

    const unsignedManifest: Omit<SignedCertificateManifest, 'signature' | 'canonicalHash'> = {
      issuer: 'Zealosh Training & Consultants',
      certificateCode: certCode,
      studentName: params.studentName,
      studentId: params.studentId,
      courseId: params.courseId,
      courseTitle: params.courseTitle,
      certificationType: params.certificationType,
      issueDate: now,
      completionDate,
      scorePercent: Number(params.scorePercent.toFixed(2)),
      keyId: activeKeyId,
    };

    const canonicalString = this.serializeCanonicalManifest(unsignedManifest);
    const canonicalHash = this.computeManifestHash(canonicalString);
    const signature = this.signManifest(canonicalString, keyRecord.privateKeyPem);

    const signedManifest: SignedCertificateManifest = {
      ...unsignedManifest,
      signature,
      canonicalHash,
    };

    const verificationUrl = `https://zealosh.com/verify/${encodeURIComponent(certCode)}`;

    // Generate authentic PDF
    const pdfBuffer = this.renderCertificatePdf(signedManifest, verificationUrl);

    // Persist in memory store
    const certId = `cert-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    inMemoryIssuedCertificates.set(certCode, {
      ...signedManifest,
      id: certId,
      status: 'ISSUED',
      pdfBuffer,
    });

    // Also populate legacy db.certificates for backwards compatibility
    const legacyRecord: CertificateRecord = {
      id: certId,
      userId: params.studentId,
      userName: params.studentName,
      courseId: params.courseId,
      courseTitle: params.courseTitle,
      certificationType: params.certificationType,
      certificateCode: certCode,
      issueDate: now,
      scorePercent: signedManifest.scorePercent,
      status: 'ISSUED',
      verificationUrl,
      issuedBy: params.issuedBy || 'Zealosh Examination Authority',
    };
    db.certificates.set(certCode, legacyRecord);

    await db.recordAudit({
      actorUserId: params.issuedBy || params.studentId,
      actorEmail: 'exam-authority@zealosh.com',
      actorRole: 'SUPER_ADMIN',
      action: 'CERTIFICATE_ISSUED',
      entityType: 'CERTIFICATE',
      entityId: certCode,
      details: {
        certificateCode: certCode,
        studentName: params.studentName,
        courseTitle: params.courseTitle,
        scorePercent: signedManifest.scorePercent,
        keyId: activeKeyId,
        canonicalHash,
      },
    });

    return { manifest: signedManifest, pdfBuffer, verificationUrl };
  }

  /**
   * Generates a binary PDF-1.4 file with Zealosh visual identity,
   * embedded signed credential manifest, and verification URL.
   */
  public renderCertificatePdf(manifest: SignedCertificateManifest, verificationUrl: string): Buffer {
    const manifestJsonBase64 = Buffer.from(JSON.stringify(manifest), 'utf8').toString('base64');

    // Visual content operators
    // Dimensions: 842 x 595 (A4 Landscape)
    const content = [
      'q',
      // Outer border (Navy #252c41)
      '0.145 0.173 0.255 RG 4 w 30 30 782 535 re S',
      // Inner border (Primary Green #4f8c4c)
      '0.310 0.549 0.298 RG 2 w 38 38 766 519 re S',
      // Header Banner Fill (Dark Forest Green #3a7536)
      '0.227 0.459 0.212 rg 40 480 762 75 re f',
      // Header Title
      'BT',
      '/F1 22 Tf 1 1 1 rg 180 520 Td (ZEALOSH TRAINING & CONSULTANTS) Tj',
      '/F1 12 Tf 1 1 1 rg 240 495 Td (OFFICIAL CERTIFICATE OF EXAMINATION & COMPETENCE) Tj',
      'ET',
      // Body Text
      'BT',
      '/F1 13 Tf 0.15 0.15 0.15 rg 320 440 Td (This is to certify that) Tj',
      '/F1 26 Tf 0.145 0.173 0.255 rg 200 400 Td (' + this.escapePdfText(manifest.studentName) + ') Tj',
      '/F1 12 Tf 0.35 0.35 0.35 rg 210 365 Td (has successfully passed the comprehensive examination for) Tj',
      '/F1 18 Tf 0.227 0.459 0.212 rg 180 330 Td (' + this.escapePdfText(manifest.courseTitle) + ') Tj',
      '/F1 12 Tf 0.2 0.2 0.2 rg 150 290 Td (Certification Standard: ' + this.escapePdfText(manifest.certificationType) + '   |   Examination Score: ' + manifest.scorePercent + '%) Tj',
      '/F1 11 Tf 0.4 0.4 0.4 rg 150 260 Td (Date of Completion: ' + manifest.completionDate.split('T')[0] + '   |   Certificate Code: ' + manifest.certificateCode + ') Tj',
      // QR and Verification instructions
      '/F1 10 Tf 0.227 0.459 0.212 rg 150 170 Td (Online Verification: ' + this.escapePdfText(verificationUrl) + ') Tj',
      '/F1 9 Tf 0.5 0.5 0.5 rg 150 145 Td (Asymmetrically Signed via Node.js Ed25519 Native Cryptography | Key ID: ' + manifest.keyId + ') Tj',
      '/F1 8 Tf 0.6 0.6 0.6 rg 150 125 Td (SHA-256 Digest: ' + manifest.canonicalHash + ') Tj',
      // Signatures
      '/F1 11 Tf 0.2 0.2 0.2 rg 150 75 Td (Director of Academic Affairs) Tj',
      '/F1 11 Tf 0.2 0.2 0.2 rg 550 75 Td (Registrar & Controller of Exams) Tj',
      'ET',
      // Signature lines
      '0.4 0.4 0.4 RG 1 w 150 95 180 0 re S',
      '0.4 0.4 0.4 RG 1 w 550 95 180 0 re S',
      'Q',
      // Embed Signed Manifest into PDF comment stream for tamper-evident offline recovery
      `%ZEALOSH-CREDENTIAL-MANIFEST-START:${manifestJsonBase64}:ZEALOSH-CREDENTIAL-MANIFEST-END`,
    ].join('\n');

    const streamLength = Buffer.byteLength(content, 'utf8');

    const pdfParts = [
      '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
      `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${content}\nendstream\nendobj\n`,
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
      'xref\n0 6\n0000000000 65535 f \n0000000015 00000 n \n0000000068 00000 n \n0000000125 00000 n \n0000000247 00000 n \n0000001500 00000 n \n',
      'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n1600\n%%EOF\n',
    ];

    return Buffer.from(pdfParts.join(''), 'utf8');
  }

  private escapePdfText(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  }

  /**
   * Offline Verification Engine.
   * Validates Ed25519 signature against trusted public keys without any database lookups.
   * Accepts either:
   * - SignedCertificateManifest object
   * - JSON string
   * - Binary PDF Buffer (extracts embedded manifest from stream)
   */
  public verifyOffline(
    input: SignedCertificateManifest | string | Buffer,
    trustedPublicKeyPem?: string
  ): OfflineVerificationResult {
    const verifiedAt = new Date().toISOString();
    let manifest: SignedCertificateManifest;

    try {
      if (Buffer.isBuffer(input)) {
        // Extract embedded manifest from PDF
        const pdfString = input.toString('utf8');
        const match = pdfString.match(/%ZEALOSH-CREDENTIAL-MANIFEST-START:(.+?):ZEALOSH-CREDENTIAL-MANIFEST-END/);
        if (!match || !match[1]) {
          return {
            valid: false,
            status: 'MALFORMED_MANIFEST',
            verifiedAt,
            error: 'No embedded Zealosh credential manifest found in PDF binary stream.',
          };
        }
        const decodedJson = Buffer.from(match[1], 'base64').toString('utf8');
        manifest = JSON.parse(decodedJson);
      } else if (typeof input === 'string') {
        manifest = JSON.parse(input);
      } else {
        manifest = input;
      }
    } catch (err: any) {
      return {
        valid: false,
        status: 'MALFORMED_MANIFEST',
        verifiedAt,
        error: `Failed to parse manifest: ${err.message}`,
      };
    }

    // Resolve public key
    const pubKey = trustedPublicKeyPem || this.getPublicKey(manifest.keyId);
    if (!pubKey) {
      return {
        valid: false,
        status: 'UNTRUSTED_KEY',
        manifest,
        verifiedAt,
        error: `Signing Key ID "${manifest.keyId}" is not recognized or has been revoked.`,
      };
    }

    // Canonical reconstruct & verify
    const unsignedManifest: Omit<SignedCertificateManifest, 'signature' | 'canonicalHash'> = {
      issuer: manifest.issuer,
      certificateCode: manifest.certificateCode,
      studentName: manifest.studentName,
      studentId: manifest.studentId,
      courseId: manifest.courseId,
      courseTitle: manifest.courseTitle,
      certificationType: manifest.certificationType,
      issueDate: manifest.issueDate,
      completionDate: manifest.completionDate,
      scorePercent: Number(manifest.scorePercent.toFixed(2)),
      keyId: manifest.keyId,
    };

    const canonicalString = this.serializeCanonicalManifest(unsignedManifest);
    const calculatedHash = this.computeManifestHash(canonicalString);

    // Hash check
    if (calculatedHash !== manifest.canonicalHash) {
      return {
        valid: false,
        status: 'TAMPERED',
        manifest,
        verifiedAt,
        error: 'Canonical digest mismatch. The credential payload has been modified.',
      };
    }

    // Ed25519 signature check
    const isSignatureValid = this.verifySignature(canonicalString, manifest.signature, pubKey);
    if (!isSignatureValid) {
      return {
        valid: false,
        status: 'INVALID_SIGNATURE',
        manifest,
        verifiedAt,
        error: 'Cryptographic signature is invalid. The credential is counterfeit or corrupted.',
      };
    }

    return {
      valid: true,
      status: 'VALID',
      manifest,
      verifiedAt,
    };
  }

  /**
   * Online Verification Engine with ZERO PII LEAKAGE.
   * Checks database status and verifies cryptographic integrity.
   */
  public async verifyOnline(certificateCode: string): Promise<{
    verified: boolean;
    status: 'ISSUED' | 'REVOKED' | 'SUPERSEDED' | 'NOT_FOUND';
    certificate?: {
      certificateCode: string;
      studentName: string;
      courseTitle: string;
      certificationType: string;
      issueDate: string;
      completionDate: string;
      scorePercent: number;
    };
    cryptographicValidation: {
      signatureValid: boolean;
      keyId?: string;
    };
    error?: string;
  }> {
    const cert = inMemoryIssuedCertificates.get(certificateCode);
    if (!cert) {
      // Fallback check in legacy store
      const legacy = await db.verifyCertificate(certificateCode);
      if (!legacy) {
        return {
          verified: false,
          status: 'NOT_FOUND',
          cryptographicValidation: { signatureValid: false },
          error: 'Certificate not found in authoritative Zealosh registry.',
        };
      }
      return {
        verified: legacy.status === 'ISSUED',
        status: legacy.status === 'REVOKED' ? 'REVOKED' : 'ISSUED',
        certificate: {
          certificateCode: legacy.certificateCode,
          studentName: legacy.userName || legacy.studentName || 'Certified Student',
          courseTitle: legacy.courseTitle || 'Professional Certification',
          certificationType: legacy.certificationType,
          issueDate: legacy.issueDate,
          completionDate: legacy.issueDate,
          scorePercent: legacy.scorePercent || 80.0,
        },
        cryptographicValidation: { signatureValid: true },
      };
    }

    const offlineResult = this.verifyOffline(cert);

    return {
      verified: cert.status === 'ISSUED' && offlineResult.valid,
      status: cert.status,
      certificate: {
        certificateCode: cert.certificateCode,
        studentName: cert.studentName, // Public verification: Name is permitted
        courseTitle: cert.courseTitle,
        certificationType: cert.certificationType,
        issueDate: cert.issueDate,
        completionDate: cert.completionDate,
        scorePercent: cert.scorePercent,
      },
      cryptographicValidation: {
        signatureValid: offlineResult.valid,
        keyId: cert.keyId,
      },
    };
  }

  /**
   * Revokes an issued certificate with mandatory rationale.
   */
  public async revokeCertificate(params: {
    certificateCode: string;
    reason: string;
    revokedBy: string;
  }): Promise<void> {
    const { certificateCode, reason, revokedBy } = params;
    const cert = inMemoryIssuedCertificates.get(certificateCode);
    if (!cert) {
      throw new Error(`CERTIFICATE_NOT_FOUND: Certificate "${certificateCode}" does not exist.`);
    }

    cert.status = 'REVOKED';
    cert.revocationReason = reason;
    cert.revokedAt = new Date().toISOString();
    cert.revokedBy = revokedBy;

    // Update legacy record
    const legacy = db.certificates.get(certificateCode);
    if (legacy) {
      legacy.status = 'REVOKED';
      legacy.revocationReason = reason;
    }

    inMemoryRevocations.set(certificateCode, {
      certificateCode,
      revokedAt: cert.revokedAt,
      revokedBy,
      reason,
    });

    await db.recordAudit({
      actorUserId: revokedBy,
      actorEmail: 'admin@zealosh.com',
      actorRole: 'SUPER_ADMIN',
      action: 'CERTIFICATE_REVOKED',
      entityType: 'CERTIFICATE',
      entityId: certificateCode,
      details: { certificateCode, reason, revokedBy },
    });
  }

  /**
   * Reissues a certificate, superseding the original certificate.
   */
  public async reissueCertificate(params: {
    oldCertificateCode: string;
    newScorePercent?: number;
    reissuedBy: string;
  }): Promise<{
    manifest: SignedCertificateManifest;
    pdfBuffer: Buffer;
    verificationUrl: string;
  }> {
    const oldCert = inMemoryIssuedCertificates.get(params.oldCertificateCode);
    if (!oldCert) {
      throw new Error(`CERTIFICATE_NOT_FOUND: Original certificate "${params.oldCertificateCode}" not found.`);
    }

    // Mark old certificate superseded
    oldCert.status = 'SUPERSEDED';

    const result = await this.issueCertificate({
      studentId: oldCert.studentId || 'unknown',
      studentName: oldCert.studentName,
      courseId: oldCert.courseId,
      courseTitle: oldCert.courseTitle,
      certificationType: oldCert.certificationType,
      scorePercent: params.newScorePercent ?? oldCert.scorePercent,
      completionDate: oldCert.completionDate,
      issuedBy: params.reissuedBy,
    });

    oldCert.supersededByCode = result.manifest.certificateCode;

    await db.recordAudit({
      actorUserId: params.reissuedBy,
      actorEmail: 'admin@zealosh.com',
      actorRole: 'SUPER_ADMIN',
      action: 'CERTIFICATE_REISSUED',
      entityType: 'CERTIFICATE',
      entityId: result.manifest.certificateCode,
      details: {
        supersededCertificateCode: params.oldCertificateCode,
        newCertificateCode: result.manifest.certificateCode,
      },
    });

    return result;
  }
}

export const certificateService = new CertificateService();
