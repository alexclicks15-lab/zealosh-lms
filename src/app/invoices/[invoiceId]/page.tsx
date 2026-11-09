'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, 
  Printer, 
  Download, 
  CheckCircle2, 
  Building, 
  FileText, 
  ShieldCheck, 
  Receipt,
  Calendar,
  CreditCard
} from 'lucide-react';
import { InvoiceRecord } from '@/types';

export default function InvoiceDetailsPage({
  params,
}: {
  params: { invoiceId: string };
}) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${encodeURIComponent(params.invoiceId)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Invoice not found');
        }
        return res.json();
      })
      .then((data) => {
        setInvoice(data.invoice);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.invoiceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f9f3] py-16 px-4 text-center">
        <div className="w-10 h-10 border-4 border-[#4f8c4c] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-base font-bold text-slate-900">Loading Official Tax Invoice...</h2>
        <p className="text-xs text-gray-500 mt-1">Retrieving verified payment and tax records from Zealosh billing engine.</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#f4f9f3] py-16 px-4">
        <div className="max-w-xl mx-auto bg-white/95 backdrop-blur-md rounded-2xl border border-red-200 p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Invoice Unavailable</h1>
          <p className="text-xs text-red-600 mt-2">{error || 'Invoice record could not be found'}</p>
          <div className="mt-6">
            <Link
              href="/student"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4f8c4c] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Student Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cgstAmount = Math.round((invoice.taxAmount / 2) * 100) / 100;
  const sgstAmount = Math.round((invoice.taxAmount - cgstAmount) * 100) / 100;

  return (
    <div className="min-h-screen bg-[#f4f9f3] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation & Action Bar (Hidden in Print) */}
        <div className="mb-6 flex items-center justify-between print:hidden">
          <Link
            href="/student"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#4f8c4c] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student Dashboard</span>
          </Link>

          <button
            onClick={() => window.print()}
            className="neomorphic-button inline-flex items-center gap-2 bg-[#1e481c] hover:bg-[#2e682a] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save PDF Invoice</span>
          </button>
        </div>

        {/* Invoice Paper Document */}
        <div className="bg-white rounded-2xl border border-[#e2efe1] shadow-lg overflow-hidden p-8 sm:p-12 print:shadow-none print:border-none print:p-0">
          {/* Header Block */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-8 border-b border-[#e2efe1] gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Image
                  src="/logo.png"
                  alt="Zealosh Training & Consultants"
                  width={140}
                  height={40}
                  className="h-10 w-auto object-contain"
                />
              </div>
              <p className="text-xs text-gray-500 font-medium">Zealosh Training & Consultants Pvt. Ltd.</p>
              <p className="text-[11px] text-gray-400">
                GSTIN: <span className="font-mono font-bold text-gray-600">{invoice.providerGstin}</span>
                {invoice.providerGstinVerified ? (
                  <span className="ml-1 text-[10px] text-green-600 font-semibold">(Verified Statutory Registration)</span>
                ) : (
                  <span className="ml-1 text-[10px] text-amber-600 font-medium">(Staging Registration — Verification Pending)</span>
                )}
                {' • '}HSN/SAC: <span className="font-mono font-bold text-gray-600">{invoice.hsnCode}</span>
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-flex items-center gap-1 bg-[#e1f0df] text-[#3a7536] text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                <CheckCircle2 className="w-3 h-3" />
                TAX INVOICE & FEE RECEIPT
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{invoice.invoiceNumber}</h1>
              <p className="text-xs text-gray-400 mt-0.5">Date of Issue: <span className="font-semibold text-gray-600">{new Date(invoice.issuedAt).toLocaleDateString()}</span></p>
              <p className="text-xs text-gray-400">Payment Status: <span className="font-bold text-[#3a7536]">{invoice.status}</span></p>
            </div>
          </div>

          {/* Billing Context Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-8 border-b border-[#e2efe1]">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Bill To (Student / Sponsor)</h3>
              <div className="text-xs text-slate-900 font-bold text-base mb-1">{invoice.userName}</div>
              <p className="text-xs text-gray-600">{invoice.userEmail}</p>
              {invoice.billingAddress?.companyName && (
                <p className="text-xs text-gray-600 font-medium">{invoice.billingAddress.companyName}</p>
              )}
              {invoice.billingAddress?.street && (
                <p className="text-xs text-gray-500">{invoice.billingAddress.street}, {invoice.billingAddress.city}, {invoice.billingAddress.state}</p>
              )}
              {invoice.billingAddress?.taxId && (
                <p className="text-[11px] font-mono text-gray-500 mt-1">Client GSTIN / Tax ID: <span className="font-bold">{invoice.billingAddress.taxId}</span></p>
              )}
            </div>

            <div className="sm:text-right">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Transaction Details</h3>
              <p className="text-xs text-gray-500">Order Reference: <span className="font-mono font-bold text-gray-700">{invoice.orderId}</span></p>
              <p className="text-xs text-gray-500 mt-1">Payment Method: <span className="font-medium text-gray-700">{invoice.paymentMethod || 'Razorpay Gateway'}</span></p>
              <p className="text-xs text-gray-500 mt-1">Transaction Ref: <span className="font-mono text-gray-700">{invoice.transactionRef || 'N/A'}</span></p>
              <p className="text-xs text-gray-500 mt-1">Cohort Batch: <span className="font-medium text-gray-700">{invoice.batchName}</span></p>
            </div>
          </div>

          {/* Itemized Line Items Table */}
          <div className="py-8 border-b border-[#e2efe1]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f4f9f3] text-gray-500 uppercase border-b border-[#e2efe1]">
                <tr>
                  <th className="py-3 px-4">Item & Description</th>
                  <th className="py-3 px-4 text-center">HSN/SAC</th>
                  <th className="py-3 px-4 text-right">Taxable Value</th>
                  <th className="py-3 px-4 text-right">GST (18%)</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2efe1]">
                <tr>
                  <td className="py-4 px-4">
                    <div className="font-bold text-sm text-slate-900">{invoice.courseTitle}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Cohort Enrollment & Certification Access — {invoice.batchName}</div>
                  </td>
                  <td className="py-4 px-4 text-center font-mono text-gray-600">{invoice.hsnCode}</td>
                  <td className="py-4 px-4 text-right font-mono font-semibold">
                    {invoice.currency === 'INR' ? '₹' : '$'}{invoice.subtotal.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-semibold text-gray-600">
                    {invoice.currency === 'INR' ? '₹' : '$'}{invoice.taxAmount.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-black text-sm text-[#3a7536]">
                    {invoice.currency === 'INR' ? '₹' : '$'}{invoice.totalAmount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tax Breakdown & Totals */}
          <div className="py-8 flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="max-w-xs text-xs text-gray-500">
              <h4 className="font-bold text-slate-900 mb-1">Statutory Tax Note</h4>
              <p className="text-[11px] leading-relaxed">
                Services provided are categorized under SAC 999293 (Higher education and professional HSE certifications). All tuition fees are fully credited and subject to Indian GST regulations.
                {!invoice.providerGstinVerified && ' Note: Official statutory registration is pending final GST authority confirmation.'}
              </p>
            </div>

            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (Taxable Value):</span>
                <span className="font-mono font-semibold">{invoice.currency === 'INR' ? '₹' : '$'}{invoice.subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[11px]">
                <span>CGST (9.0%):</span>
                <span className="font-mono">{invoice.currency === 'INR' ? '₹' : '$'}{cgstAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[11px]">
                <span>SGST (9.0%):</span>
                <span className="font-mono">{invoice.currency === 'INR' ? '₹' : '$'}{sgstAmount.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-[#e2efe1] flex justify-between text-sm font-black text-slate-900">
                <span>Total Amount Paid:</span>
                <span className="font-mono text-base text-[#3a7536]">{invoice.currency === 'INR' ? '₹' : '$'}{invoice.totalAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Footer Signature & Verification Block */}
          <div className="pt-8 border-t border-[#e2efe1] flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-4 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
              <span>Cryptographically verified invoice issued by Zealosh Central Governance Engine.</span>
            </div>
            <div className="font-mono text-[11px]">
              Computer-generated document. No physical signature required.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
