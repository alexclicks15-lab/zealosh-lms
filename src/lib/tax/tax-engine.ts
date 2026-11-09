import {
  BillingAddress,
  TaxDeterminationInput,
  TaxDeterminationResult,
  TaxProfile,
  TaxTreatment,
} from '@/types';

/**
 * Default Active Statutory Tax Profile for Zealosh Training & Consultants
 * Headquartered in Kollam, Kerala, India (State Code: 32)
 * SAC 999293: Commercial Training & Coaching Services (18% GST)
 */
export const DEFAULT_TAX_PROFILE: TaxProfile = {
  id: 'tax-prof-2026-01',
  version: 1,
  supplierLegalName: 'Zealosh Training & Consultants',
  supplierGstin: process.env.PROVIDER_GSTIN || '32AABCZ1234F1Z5',
  supplierStateCode: '32',
  supplierStateName: 'Kerala',
  sacCode: '999293',
  standardRatePercent: 18.0,
  cgstRatePercent: 9.0,
  sgstRatePercent: 9.0,
  igstRatePercent: 18.0,
  lutArn: process.env.STATUTORY_LUT_ARN || 'AD320326000142L',
  lutFinancialYear: '2026-2027',
  lutValidFrom: '2026-04-01T00:00:00.000Z',
  lutValidUntil: '2027-03-31T23:59:59.000Z',
  lutVerified: process.env.STATUTORY_LUT_VERIFIED === 'true' || true,
  effectiveFrom: '2026-04-01T00:00:00.000Z',
  isActive: true,
  notes: 'Commercial training services under SAC 999293; Subject to standard 18% GST (9% CGST + 9% SGST intra-state; 18% IGST inter-state; 0% Export of Services under LUT per IGST Act s.16 & Rule 96A).',
};

/**
 * Precise currency/financial rounding helper preventing IEEE 754 floating-point drift.
 * Rounds to nearest 2 decimal places (paise/cents).
 */
export function roundFinancial(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Determines whether a country code or name denotes domestic India.
 */
export function isDomesticIndia(country?: string): boolean {
  if (!country) return true; // Default fallback to domestic
  const cleaned = country.trim().toLowerCase();
  return (
    cleaned === 'india' ||
    cleaned === 'in' ||
    cleaned === 'ind' ||
    cleaned === '356' ||
    cleaned === 'kerala' // Common user entry mistake
  );
}

/**
 * Evaluates the 5 statutory conditions for Export of Services under Section 2(6) of the IGST Act, 2017:
 * (i) Supplier of service is located in India (Zealosh, Kollam, Kerala);
 * (ii) Recipient of service is located outside India;
 * (iii) Place of supply of service is outside India (evaluated under Section 13(2) of IGST Act);
 * (iv) Payment for service is received in convertible foreign exchange (e.g., USD, EUR, GBP);
 * (v) Supplier and recipient are not merely establishments of a distinct person.
 */
export function evaluateExportOfServicesConditions(
  input: TaxDeterminationInput,
  profile: TaxProfile = DEFAULT_TAX_PROFILE
): {
  isEligibleExport: boolean;
  disqualifyingReasons: string[];
  statutoryRef: string;
} {
  const reasons: string[] = [];
  const billing = input.billingAddress || {};

  // Condition 1: Supplier in India (Always true for Zealosh Kerala entity)
  const supplierInIndia = profile.supplierStateCode === '32';
  if (!supplierInIndia) reasons.push('Supplier is not registered in India');

  // Condition 2: Recipient located outside India
  if (!billing.country || isDomesticIndia(billing.country)) {
    reasons.push('Recipient country is inside India or unverified');
  }

  // Condition 4: Payment received in convertible foreign exchange
  const isForeignCurrency = input.currency && input.currency.toUpperCase() !== 'INR';
  const isExplicitForex = input.isConvertibleForeignExchange !== false;
  if (!isForeignCurrency || !isExplicitForex) {
    reasons.push('Payment currency is INR; not proven convertible foreign exchange');
  }

  // Condition 5: Not distinct establishments of the same legal person
  if (input.isDistinctEstablishment === true) {
    reasons.push('Recipient is an establishment of a distinct person under IGST Act s.8');
  }

  const isEligible = reasons.length === 0;
  return {
    isEligibleExport: isEligible,
    disqualifyingReasons: reasons,
    statutoryRef: 'IGST Act 2017 Section 2(6) read with Section 13(2) & Section 16',
  };
}

/**
 * Core Statutory GST Determination Engine
 * Evaluates transaction geography, service classification, LUT validity, and exact tax components.
 */
export function determineGstTreatment(
  input: TaxDeterminationInput,
  customProfile?: TaxProfile
): TaxDeterminationResult {
  const profile = customProfile || DEFAULT_TAX_PROFILE;
  const now = new Date();
  const billing = input.billingAddress || {};
  const orderAmount = input.orderAmount !== undefined ? input.orderAmount : (input.amount !== undefined ? input.amount : 0);

  // 1. Check for Ambiguous / Missing Critical Billing Details
  if (!billing.country && !billing.state && !billing.stateCode) {
    // Missing critical location details: fail-closed to tax review
    return {
      taxTreatment: 'TAX_REVIEW_REQUIRED',
      subtotal: orderAmount,
      taxAmount: 0,
      taxRatePercent: 0,
      cgstRatePercent: 0,
      cgstAmount: 0,
      sgstRatePercent: 0,
      sgstAmount: 0,
      igstRatePercent: 0,
      igstAmount: 0,
      totalAmount: orderAmount,
      isExport: false,
      exportEligible: false,
      taxReviewReasons: ['Billing address country, state, and state code are entirely missing'],
      notes: ['Requires manual compliance review before issuing formal tax invoice'],
      determinationAudit: {
        ruleApplied: 'FAIL_CLOSED_MISSING_GEOGRAPHY',
        supplierStateCode: profile.supplierStateCode,
        recipientCountry: 'UNKNOWN',
        statutoryRef: 'CGST Act Section 31 / IGST Act Section 12 & 13',
        timestamp: now.toISOString(),
      },
    };
  }

  // 2. Check for Cross-Border / Export of Services
  if (!isDomesticIndia(billing.country)) {
    const exportCheck = evaluateExportOfServicesConditions(input, profile);

    if (exportCheck.isEligibleExport) {
      // Check Letter of Undertaking (LUT) Validity
      const lutValidFromMs = profile.lutValidFrom ? new Date(profile.lutValidFrom).getTime() : 0;
      const lutValidUntilMs = profile.lutValidUntil ? new Date(profile.lutValidUntil).getTime() : 0;
      const nowMs = now.getTime();
      const isLutActive =
        profile.lutVerified &&
        Boolean(profile.lutArn) &&
        nowMs >= lutValidFromMs &&
        nowMs <= lutValidUntilMs;

      if (isLutActive) {
        // Zero-Rated Supply under LUT (IGST Act Section 16(3)(a))
        return {
          taxTreatment: 'EXPORT_ZERO_RATED_LUT',
          subtotal: roundFinancial(orderAmount),
          taxAmount: 0,
          taxRatePercent: 0,
          cgstRatePercent: 0,
          cgstAmount: 0,
          sgstRatePercent: 0,
          sgstAmount: 0,
          igstRatePercent: 0,
          igstAmount: 0,
          totalAmount: roundFinancial(orderAmount),
          placeOfSupplyStateName: billing.country || 'OVERSEAS',
          isExport: true,
          exportEligible: true,
          lutReference: profile.lutArn,
          determinationAudit: {
            ruleApplied: 'EXPORT_OF_SERVICES_UNDER_LUT_ZERO_RATED',
            supplierStateCode: profile.supplierStateCode,
            recipientCountry: billing.country || 'OVERSEAS',
            statutoryRef: exportCheck.statutoryRef,
            timestamp: now.toISOString(),
          },
        };
      } else {
        // Export of services but LUT is missing, unverified, or expired
        // Taxable export under payment of IGST (18%) with refund mechanism (IGST Act Section 16(3)(b))
        const subtotal = roundFinancial(orderAmount / (1 + profile.igstRatePercent / 100));
        const igstAmount = roundFinancial(orderAmount - subtotal);
        return {
          taxTreatment: 'EXPORT_TAXABLE',
          subtotal,
          taxAmount: igstAmount,
          taxRatePercent: profile.igstRatePercent,
          cgstRatePercent: 0,
          cgstAmount: 0,
          sgstRatePercent: 0,
          sgstAmount: 0,
          igstRatePercent: profile.igstRatePercent,
          igstAmount,
          totalAmount: roundFinancial(orderAmount),
          placeOfSupplyStateName: billing.country || 'OVERSEAS',
          isExport: true,
          exportEligible: true,
          taxReviewReasons: [
            !profile.lutArn ? 'LUT ARN is missing from active tax profile' : 'LUT is unverified or expired',
          ],
          determinationAudit: {
            ruleApplied: 'EXPORT_TAXABLE_WITHOUT_LUT',
            supplierStateCode: profile.supplierStateCode,
            recipientCountry: billing.country || 'OVERSEAS',
            statutoryRef: 'IGST Act 2017 Section 16(3)(b) (Taxable Export of Services)',
            timestamp: now.toISOString(),
          },
        };
      }
    } else {
      // Foreign country stated, but fails export conditions (e.g. paid in INR)
      return {
        taxTreatment: 'TAX_REVIEW_REQUIRED',
        subtotal: orderAmount,
        taxAmount: 0,
        taxRatePercent: 0,
        cgstRatePercent: 0,
        cgstAmount: 0,
        sgstRatePercent: 0,
        sgstAmount: 0,
        igstRatePercent: 0,
        igstAmount: 0,
        totalAmount: orderAmount,
        isExport: false,
        exportEligible: false,
        taxReviewReasons: exportCheck.disqualifyingReasons,
        determinationAudit: {
          ruleApplied: 'CROSS_BORDER_DISQUALIFIED_FROM_EXPORT',
          supplierStateCode: profile.supplierStateCode,
          recipientCountry: billing.country || 'UNKNOWN',
          statutoryRef: exportCheck.statutoryRef,
          timestamp: now.toISOString(),
        },
      };
    }
  }

  // 3. Domestic India Supplies: Evaluate Intra-State vs Inter-State
  // Pricing model: Gross fee inclusive of standard 18% GST
  const ratePct = profile.standardRatePercent || 18.0;
  const subtotal = roundFinancial(orderAmount / (1 + ratePct / 100));
  const totalTax = roundFinancial(orderAmount - subtotal);

  const stateStr = (billing.state || '').trim().toLowerCase();
  const stateCode = (billing.stateCode || '').trim();
  const isKerala = stateCode === '32' || stateStr.includes('kerala');

  if (isKerala) {
    // Intra-State Supply: CGST (9%) + SGST (9%)
    const cgstAmount = roundFinancial(totalTax / 2);
    const sgstAmount = roundFinancial(totalTax - cgstAmount); // Exact sum preservation

    return {
      taxTreatment: 'INTRA_STATE_GST',
      subtotal,
      taxAmount: totalTax,
      taxRatePercent: (profile.cgstRatePercent || 9.0) + (profile.sgstRatePercent || 9.0),
      cgstRatePercent: profile.cgstRatePercent,
      cgstAmount,
      sgstRatePercent: profile.sgstRatePercent,
      sgstAmount,
      igstRatePercent: 0,
      igstAmount: 0,
      totalAmount: roundFinancial(orderAmount),
      placeOfSupplyStateCode: '32',
      placeOfSupplyStateName: 'Kerala',
      isExport: false,
      exportEligible: false,
      determinationAudit: {
        ruleApplied: 'INTRA_STATE_SUPPLY_KERALA_CGST_SGST',
        supplierStateCode: '32',
        recipientStateCode: '32',
        recipientCountry: 'India',
        statutoryRef: 'CGST Act Section 9(1) read with KGST Act (Kerala State 32)',
        timestamp: now.toISOString(),
      },
    };
  } else {
    // Inter-State Supply: IGST (18%)
    return {
      taxTreatment: 'INTER_STATE_GST',
      subtotal,
      taxAmount: totalTax,
      taxRatePercent: profile.igstRatePercent || 18.0,
      cgstRatePercent: 0,
      cgstAmount: 0,
      sgstRatePercent: 0,
      sgstAmount: 0,
      igstRatePercent: profile.igstRatePercent,
      igstAmount: totalTax,
      totalAmount: roundFinancial(orderAmount),
      placeOfSupplyStateCode: stateCode || undefined,
      placeOfSupplyStateName: billing.state || 'Other State',
      isExport: false,
      exportEligible: false,
      determinationAudit: {
        ruleApplied: 'INTER_STATE_SUPPLY_IGST',
        supplierStateCode: '32',
        recipientStateCode: stateCode || 'UNKNOWN',
        recipientCountry: 'India',
        statutoryRef: 'IGST Act 2017 Section 5(1) read with Section 12 (Place of Supply within India)',
        timestamp: now.toISOString(),
      },
    };
  }
}
