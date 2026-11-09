# Zealosh LMS — ZM-03 Row-Level Security & Permission Matrix

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Multi-Role Access Control (RBAC), RLS Policies & Candidate Isolation  
**Authoritative Reference:** [20261031000011_zealosh_exam_and_commerce_phase3.sql](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/supabase/migrations/20261031000011_zealosh_exam_and_commerce_phase3.sql)

---

## 1. Role-Based Access Control (RBAC) Hierarchy

Zealosh LMS operates under a strict four-tier institutional role hierarchy:
1. **`SUPER_ADMIN`:** Full platform governance, database maintenance, tax configuration, instructor assignments, credit note issuance, and audit log access.
2. **`ADMIN`:** Admissions review, cohort batch management, enrollment issuance, payment refunds, and evaluation queue inspection.
3. **`INSTRUCTOR`:** Live classroom delivery, coursework creation, exam rubric evaluation, and live quiz score monitoring. Strictly forbidden from modifying tax rules or revoking invoices.
4. **`STUDENT`:** Read access to enrolled courseware, participation in scheduled live sessions, taking active exams within sitting window, reading own invoices, and downloading certificates. Strictly forbidden from viewing other students' submissions, invoices, or unmasked answer keys.

---

## 2. Row-Level Security (RLS) Policy Matrix

| Table | Policy Name | Permitted Roles | SQL Guard Expression |
| :--- | :--- | :--- | :--- |
| `exam_blueprints` | `exam_blueprints_read_all` | Authenticated | `status = 'ACTIVE' OR auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR')` |
| `exam_questions` | `exam_questions_read_admin` | Staff only | `auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR')` |
| `exam_attempts` | `exam_attempts_candidate_read` | Student (Self) | `user_id = auth.uid()::text` |
| `exam_attempts` | `exam_attempts_staff_read` | Staff | `auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR')` |
| `exam_manual_evaluations` | `evaluations_read_policy` | Candidate & Staff | `user_id = auth.uid()::text OR auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR')` |
| `exam_manual_evaluations` | `evaluations_write_staff` | Staff | `auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR')` |
| `payment_orders` | `orders_candidate_read` | Candidate | `user_id = auth.uid()::text` |
| `invoices` | `invoices_candidate_read` | Candidate | `user_id = auth.uid()::text` |
| `invoice_credit_notes` | `credit_notes_read` | Candidate & Staff | `user_id = auth.uid()::text OR auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN')` |
| `invoice_credit_notes` | `credit_notes_insert_admin` | Admin only | `auth.jwt() ->> 'role' IN ('SUPER_ADMIN', 'ADMIN')` |

---

## 3. Candidate Isolation Proof

Every student endpoint verifies token claims (`auth.userId`). Passing a foreign user's ID or attempting to query another candidate's invoices returns HTTP 403 Forbidden.

