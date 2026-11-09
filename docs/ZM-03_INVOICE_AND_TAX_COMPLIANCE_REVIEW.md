# Zealosh LMS — ZM-03 & ZM-03.1 Invoice & Tax Compliance Review Specification

**Milestones:** ZM-03 & ZM-03.1  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** CGST Act 2017 Section 31/34, Rules 46/53 Tax Invoicing & IGST Act Section 2(6), 13, 16 Export of Services (LUT)  
**Authoritative Implementation:** [`src/lib/tax/tax-engine.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/tax/tax-engine.ts) & [`src/lib/store/db.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts)

---

## 1. Statutory GST Compliance (CGST Act Section 31 & Rule 46)

Zealosh Training & Consultants operates out of Kollam, Kerala, India (State Code: `32`, GSTIN: `32AABCZ1234F1Z5`). Every completed payment order generates an immutable tax invoice meeting all 16 mandatory requirements of Rule 46 of the CGST Rules, 2017:

1. **Supplier Name, Registered Address, and GSTIN.**
2. **Consecutive Serial Number (`INV-YYYY-XXXX`):** Bounded strictly to $\le 16$ characters per Rule 46(b), unique per financial year.
3. **Date of Issue.**
4. **Recipient Name and Billing Address.**
5. **Recipient GSTIN / State Code:** Recorded if registered B2B corporate candidate.
6. **HSN / SAC Code:** `999293` (Commercial Training & Coaching Services).
7. **Description of Services:** Course Masterclass Title & Cohort Batch Name.
8. **Total Taxable Value (Subtotal):** Rounded to 2 decimal places (paise precision).
9. **Tax Rate & Amount Breakdown:** Exact CGST, SGST, and IGST components.
10. **Place of Supply:** State name and numeric code (e.g. `Kerala (32)`).
11. **Statutory Export Notice / LUT ARN:** Embedded when zero-rated supply applies.
12. **Signature / Digital Signature Notice:** Issued automatically by trusted backend authority.

---

## 2. Tax Computation & Determination Engine (`tax-engine.ts`)

| Tax Treatment | Billing Geography | SAC Code | CGST Rate | SGST Rate | IGST Rate | Total Tax | Statutory Authority & Rule Applied |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INTRA_STATE_GST** | Kerala (State Code `32`) | `999293` | 9.0% | 9.0% | 0.0% | 18.0% | CGST Act Section 9(1) read with KGST Act (Kerala State 32) |
| **INTER_STATE_GST** | Other Indian States | `999293` | 0.0% | 0.0% | 18.0% | 18.0% | IGST Act 2017 Section 5(1) read with Section 12 |
| **EXPORT_ZERO_RATED_LUT** | Overseas (USD/EUR/GBP) | `999293` | 0.0% | 0.0% | 0.0% | 0.0% | IGST Act Section 16(3)(a) read with Rule 96A under verified LUT |
| **EXPORT_TAXABLE** | Overseas without active LUT | `999293` | 0.0% | 0.0% | 18.0% | 18.0% | IGST Act Section 16(3)(b) (Taxable Export under IGST refund claim) |
| **TAX_REVIEW_REQUIRED** | Ambiguous geography / INR forex mismatch | `999293` | — | — | — | — | Fail-closed compliance queue for manual finance review |

---

## 3. Export of Services 5-Condition Verification (IGST Act Section 2(6))

Under Section 2(6) of the IGST Act, 2017, the supply of any service qualifies as an "export of services" only when all five statutory conditions are satisfied:

1. **Supplier Location:** The supplier of service is located in India (Zealosh, Kollam, Kerala).
2. **Recipient Location:** The recipient of service is located outside India (verified from billing country).
3. **Place of Supply:** The place of supply of service is outside India (evaluated under Section 13(2) of the IGST Act as the location of the recipient).
4. **Convertible Foreign Exchange:** Payment for the service is received in convertible foreign exchange (USD, EUR, GBP; domestic INR payments fail this condition).
5. **Establishments of Distinct Persons:** The supplier and recipient are not merely establishments of a distinct person per Section 8 of the IGST Act.

When all five conditions pass and a verified, active Letter of Undertaking (LUT) is configured, the supply is zero-rated (`EXPORT_ZERO_RATED_LUT`). If the LUT is unverified, expired, or missing, the transaction defaults safely to `EXPORT_TAXABLE` (18% IGST) in accordance with Section 16(3)(b).

---

## 4. Statutory Credit Notes & Financial Reconciliation (Rule 53)

- **Credit Note Generation:** Administrative refunds trigger automated issuance of a sequential Credit Note (`CN-YYYY-XXXX`) adhering to Rule 53 of the CGST Rules, 2017.
- **Length Constraint:** Credit note numbers are strictly validated against the 16-character limit.
- **Relationship Mapping:** Linked 1-to-many to the original invoice, supporting partial or incremental adjustments.
- **Non-Destructive Accounting:** Original tax invoices are never deleted; their status is updated to `REFUNDED` with audit trails preserved.
