# FINANCIAL SCOPE DEFERRAL REGISTER
## Controlling Institutional Decision Enforcement

In strict compliance with the institution's scope boundary, the following domains are formally deferred to a dedicated future finance milestone:

1. **Statutory GST Tax Determination:** Intra-state, inter-state, and export calculations in `src/lib/tax/tax-engine.ts` remain preserved but unactivated for live commerce.
2. **Statutory Invoicing:** Sequence numbering (`INV-YYYY-XXXX`) and CBIC Rule 46 compliance.
3. **Statutory Credit Notes:** Refund adjustments (`CN-YYYY-XXXX`) and CBIC Rule 53 compliance.
4. **Live Refund Processing:** `ZealoshDatabase.processRefund` is held dormant.
5. **Payment Gateway Routing & Settlement:** Production merchant keys and live gateway webhooks.
6. **Accounting & Ledgers:** Financial reconciliation and reporting.

**Status:** **PRESERVED IN CODE — DORMANT & NOT ACTIVATED IN PRODUCTION**.
