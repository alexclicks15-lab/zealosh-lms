'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Award, 
  Calendar, 
  User, 
  FileText, 
  ArrowLeft,
  Printer,
  Building
} from 'lucide-react';
import { CertificateRecord } from '@/types';

export default function CertificateVerificationPage({
  params,
}: {
  params: { code: string };
}) {
  const [cert, setCert] = useState<CertificateRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/certificates/verify/${encodeURIComponent(params.code)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Certificate not found in registry');
        }
        return res.json();
      })
      .then((data) => {
        setCert(data.certificate);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.code]);

  return (
    <div className="min-h-screen bg-[#f4f9f3] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Navigation link */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#4f8c4c] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Zealosh LMS</span>
          </Link>

          {cert && (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 bg-white border border-[#e2efe1] px-3 py-1.5 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-gray-500" />
              <span>Print Verification Document</span>
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#e2efe1] p-12 text-center shadow-sm">
            <div className="w-10 h-10 border-4 border-[#4f8c4c] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-base font-bold text-slate-900">Verifying Credential in Authoritative Registry...</h2>
            <p className="text-xs text-gray-500 mt-1">Cross-referencing cryptographic certificate code with Zealosh compliance records.</p>
          </div>
        )}

        {/* Not Found / Error State */}
        {!loading && error && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-red-200 p-10 text-center shadow-sm">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Certificate Verification Failed</h1>
            <p className="text-sm text-red-600 mt-2 max-w-md mx-auto">{error}</p>
            <div className="mt-6 p-4 bg-gray-50 rounded-xl max-w-md mx-auto text-xs text-gray-500 text-left">
              <strong>Verification Guidance:</strong><br />
              Ensure the certificate code ({params.code}) is entered exactly as shown on the credential document (e.g., <code>ZEALOSH-ASP-2026-8941</code>).
            </div>
          </div>
        )}

        {/* Verified Credential Document */}
        {!loading && cert && (
          <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-[#e2efe1] shadow-lg overflow-hidden">
            {/* Header Status Banner */}
            <div className={`p-6 text-white flex items-center justify-between ${cert.status === 'ISSUED' ? 'bg-[#3a7536]' : 'bg-red-700'}`}>
              <div className="flex items-center gap-3">
                {cert.status === 'ISSUED' ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-200 flex-shrink-0" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-200 flex-shrink-0" />
                )}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded">
                    Official Verification
                  </span>
                  <h1 className="text-lg sm:text-xl font-extrabold mt-0.5">
                    {cert.status === 'ISSUED' ? 'Valid & Verified Certificate' : 'Certificate Revoked'}
                  </h1>
                </div>
              </div>

              <div className="text-right font-mono text-xs text-white/90">
                Code: {cert.certificateCode}
              </div>
            </div>

            {/* Certificate Body */}
            <div className="p-8 sm:p-12">
              <div className="flex justify-between items-center border-b border-[#e2efe1] pb-6 mb-8">
                <div>
                  <Image
                    src="/logo.png"
                    alt="Zealosh Training & Consultants"
                    width={180}
                    height={50}
                    className="h-10 w-auto object-contain"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wider font-semibold">
                    Academic Accreditation & Credential Governance
                  </p>
                </div>

                <div className="w-14 h-14 bg-[#e1f0df] text-[#3a7536] rounded-full flex items-center justify-center border-2 border-[#4f8c4c]/30">
                  <Award className="w-7 h-7" />
                </div>
              </div>

              <div className="text-center mb-8">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4f8c4c]">
                  This Authoritative Record Confirms That
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2 mb-1">
                  {cert.userName || cert.studentName}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Cryptographically Signed via Ed25519</span>
                </div>
              </div>

              <div className="bg-[#f4f9f3] border border-[#e2efe1] rounded-2xl p-6 mb-8 text-center">
                <p className="text-xs text-slate-600 mb-2">
                  has successfully satisfied all rigorous curriculum requirements and scored a passing threshold of
                </p>
                <div className="text-2xl font-black text-[#3a7536] mb-2">
                  {cert.scorePercent}% Score on Comprehensive Examination
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {cert.courseTitle}
                </h3>
                <span className="inline-block mt-2 text-[10px] bg-[#1e481c] text-white font-bold px-3 py-1 rounded-full">
                  Designation Track: {cert.certificationType}
                </span>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-[#e2efe1] pt-6 text-xs">
                <div>
                  <div className="text-gray-400 font-semibold uppercase text-[10px]">Date of Issuance</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {new Date(cert.issueDate).toLocaleDateString(undefined, { dateStyle: 'long' })}
                  </div>
                </div>

                <div>
                  <div className="text-gray-400 font-semibold uppercase text-[10px]">Issued By</div>
                  <div className="font-bold text-slate-900 mt-0.5">{cert.issuedBy}</div>
                </div>

                <div>
                  <div className="text-gray-400 font-semibold uppercase text-[10px]">Accreditation Authority</div>
                  <div className="font-bold text-slate-900 mt-0.5">Zealosh Training & Consultants</div>
                </div>
              </div>
            </div>

            {/* Footer Assurance */}
            <div className="bg-[#f4f9f3] border-t border-[#e2efe1] p-4 text-center text-[11px] text-gray-500 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
              <span>
                Verified cryptographically via Zealosh LMS Authoritative Data Store. Tamper-evident record.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
