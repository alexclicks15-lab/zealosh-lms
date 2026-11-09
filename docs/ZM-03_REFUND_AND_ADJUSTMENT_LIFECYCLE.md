# Zealosh LMS — ZM-03 & ZM-03.1 Refund & Adjustment Lifecycle Specification

**Milestones:** ZM-03 & ZM-03.1  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Refund Processing, Enrollment Revocation, Batch Capacity Restoration, Academic History Preservation & Statutory Credit Notes  
**Authoritative Implementation:** [`src/lib/store/db.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts) (`processRefund`)

---

## 1. Refund Execution Protocol

When an authorized Administrator (`SUPER_ADMIN` or `ORG_ADMIN`) executes an administrative refund:

```
Admin Requests Refund
         |
         v
Validate Order Status is PAID (Prevent duplicate refunds)
         |
         v
Issue Statutory Credit Note (CN-YYYY-XXXX <= 16 chars)
         |
         v
Update Invoice Status to REFUNDED (Link credit note 1-to-many)
         |
         v
Check Enrollment Status: If ACTIVE -> Revoke (status: REVOKED)
         |
         v
Restore Batch Capacity Safely: Decrement enrolledCount (clamped >= 0)
         |
         v
Preserve Academic History: Examination diagnostic records intact (BDR-20)
         |
         v
Update Payment Order: status = 'REFUNDED', refundStatus = 'COMPLETED'
         |
         v
Log Immutable Audit Trail Event (PAYMENT_REFUNDED)
```

---

## 2. Cohort Batch Capacity & Anti-Double-Decrement Guard

- **Active Status Guard:** The cohort batch seat counter (`batch.enrolledCount`) is decremented **only** if the corresponding enrollment was in `ACTIVE` status. If an enrollment was already cancelled, withdrawn, or revoked prior to refund processing, the counter is not decremented again.
- **Non-Negative Guarantee:** Decrement operations are strictly clamped with `Math.max(0, batch.enrolledCount - 1)`, guaranteeing that capacity counts never become negative due to race conditions or duplicate refund attempts.
- **Repeat Protection:** Calling `processRefund` on an already refunded order throws `Payment order [id] has already been refunded`, preventing duplicate credit notes or erroneous capacity inflation.

---

## 3. Academic Diagnostic & Examination Preservation (BDR-20)

Under institutional policy BDR-20:
- Financial refunds revoke course enrollment and live classroom access.
- However, **all candidate examination attempts, question answer logs, domain breakdowns, and proctoring audit trails are permanently preserved**.
- This satisfies BCSP accreditation requirements and statutory audit standards mandating historical verification of HSE assessment attempts regardless of commercial settlement status.

---

## 4. Statutory Credit Notes & Invoicing Relationship

- Sequential credit notes (`CN-YYYY-XXXX`) generated under Section 34 of the CGST Act, 2017.
- Length bounded strictly to $\le 16$ characters.
- Invoices support multiple credit notes via `creditNotes: InvoiceCreditNote[]`, maintaining complete historical lineage of adjustments.
