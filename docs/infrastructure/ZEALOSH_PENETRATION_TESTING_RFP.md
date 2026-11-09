# Request for Proposal (RFP) & Procurement Specification: Independent Security Assessment & Penetration Testing

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Procurement Reference:** ZL-SEC-RFP-2026-01  
**Target Release:** Production Staging Phase 7 / Pre-Launch Gate D  
**Security Standard:** OWASP ASVS v4.0.3 Level 2 & OWASP WSTG v4.2  
**Date:** November 2026  
**Confidentiality Level:** Restricted / Proprietary  

---

## 1. Executive Summary & Objective

**Zealosh Training & Consultants** (Kollam, Kerala, India) requests formal proposals from accredited independent cybersecurity assessment firms to perform a comprehensive grey-box and black-box web application, API, infrastructure, and database Row-Level Security (RLS) penetration test on the **Zealosh LMS & Certification Examination Platform**.

The objective of this engagement is to evaluate the defensive posture of the platform prior to production release, identify any exploitable vulnerabilities or authorization bypasses, verify multi-role access control and exam integrity mechanisms, and obtain formal security certification.

---

## 2. Assessment Scope & Target Assets

The security audit encompasses all web applications, API routes, media servers, and database authorization layers across the three-node staging infrastructure:

| Scope Target | Asset Identifier / URL | Technology Stack | In-Scope Vectors & Focus Areas |
| :--- | :--- | :--- | :--- |
| **Target 1: LMS Core Web Application** | `https://app.zealosh.com`<br/>(Staging IP / FQDN) | Next.js 14 App Router, React Server Components, TypeScript | Authentication, session hijacking, JWT tampering, SSRF, XSS (stored/reflected in Visual PageBuilder CMS), CSRF, client hydration tampering, role privilege escalation. |
| **Target 2: REST & Webhook APIs** | `https://app.zealosh.com/api/*` | Next.js Route Handlers, Node.js 20 LTS | Insecure Direct Object References (IDOR), API rate-limiting bypass, HMAC-SHA256 webhook spoofing, input validation, SQL injection attempts, sensitive data exposure in error stacks. |
| **Target 3: HSE Certification Exam Engine** | `https://app.zealosh.com/exam/*` | Custom Anti-Cheat Engine, Fullscreen API, PGlite / Supabase | Anti-cheat bypass, exam timer manipulation, question leakage, concurrent session spoofing, grade tampering, client-side score injection. |
| **Target 4: Live Virtual Classroom (Zealosh VC)** | `https://vc.zealosh.com`<br/>`turn.zealosh.com` | BigBlueButton 4.0, FreeSWITCH, WebRTC (DTLS-SRTP), coturn | Unauthorized room creation, join token forgery (SHA-1 checksum tampering), moderator privilege escalation, unauthenticated recording access, WebRTC UDP buffer injection. |
| **Target 5: Database & Row-Level Security (RLS)** | Supabase PostgreSQL 15+ Core | PostgreSQL RLS Policies, PostgREST, GoTrue Auth | Multi-role authorization boundaries (Student, Faculty, Exam Reviewer, Finance, Admin), tenant isolation, direct PostgREST exploit attempts using anonymous or student JWTs. |
| **Target 6: AI Inference Boundary Isolation** | Server 3 Private Host (`10.0.0.3`) | Ollama LLM Daemon (Port 11434) | Verification of complete private network isolation: confirming port 11434 is unreachable from the public internet; testing prompt injection resilience and PII sanitization. |

### Exclusions & Out-of-Scope Items
- Volumetric Denial of Service (DDoS) against Cloudflare edge infrastructure.
- Physical attacks against third-party cloud data centers (OVHcloud, Hetzner, AWS).
- Social engineering, phishing, or spear-phishing targeting Zealosh employees or instructors.
- Third-party payment gateway internals (Razorpay / Stripe sandbox endpoints).

---

## 3. Compliance Frameworks & Testing Methodology

Testing must strictly adhere to the following international security standards:

1. **OWASP ASVS v4.0.3 (Application Security Verification Standard) — Level 2 (Applications that contain sensitive data and transactions):**
   - V1: Architecture, Design and Threat Modeling
   - V2: Authentication Verification
   - V3: Session Management
   - V4: Access Control
   - V5: Validation, Sanitization and Encoding
   - V6: Stored Cryptography
   - V7: Error Handling and Logging
   - V8: Data Protection
   - V9: Communication Verification
   - V10: Malicious Code Search
   - V11: Business Logic Verification
   - V12: File and Resource Verification
   - V13: API and Web Service Verification
   - V14: Configuration Verification
2. **OWASP WSTG v4.2 (Web Security Testing Guide):** Systematic test execution covering Information Gathering, Configuration, Identity Management, Authentication, Authorization, Session Management, Data Validation, Error Handling, Cryptography, Business Logic, and Client-Side testing.
3. **Common Vulnerability Scoring System (CVSS v3.1):** All discovered vulnerabilities must be scored with CVSS v3.1 base and temporal vectors.

---

## 4. Testing Modes & Provided Artifacts

Zealosh will conduct a phased **Grey-Box Assessment**:

1. **Phase 1: Unauthenticated Black-Box Scan & Reconnaissance:** External perimeter mapping, SSL/TLS handshake security, open port enumeration, and public route scanning.
2. **Phase 2: Authenticated Grey-Box Deep Assessment:**
   - Zealosh will provide credentials for five discrete testing roles:
     - `learner_test@zealosh.com` (Standard Student)
     - `instructor_test@zealosh.com` (Faculty Member)
     - `reviewer_test@zealosh.com` (Exam Reviewer)
     - `finance_test@zealosh.com` (Financial Auditor)
     - `admin_test@zealosh.com` (System Administrator)
   - Testing will focus heavily on **vertical and horizontal privilege escalation**, verifying that a learner cannot access draft courses, other learners' exam submissions, financial billing data, or administrative endpoints.
3. **Phase 3: Source Code Assisted Verification (Targeted White-Box):** High-risk routes (e.g., HMAC webhook validators, SHA-1 checksum generators, and database RLS policies) will be reviewed with source code access to verify defense-in-depth.

---

## 5. Rules of Engagement & Operational Guardrails

1. **Authorized Testing Window:** 5 consecutive business days, scheduled between 09:00 IST and 21:00 IST.
2. **Source IP Whitelisting:** The vendor must provide static tester egress IP addresses 48 hours prior to testing for whitelisting in Cloudflare WAF and host firewalls.
3. **Safe Exploitation:** Testing must not destroy persistent data, cause operational outages, or disrupt existing staging data. Any destructive payload testing must be cleared with the Lead Architect.
4. **Immediate Critical Escalation:** If a Critical severity vulnerability (CVSS >= 9.0) or active Remote Code Execution (RCE) / total database bypass is discovered, the tester must notify Zealosh Lead Security Architect within **2 hours** via secure signal/phone before continuing testing.

---

## 6. Required Vendor Qualifications

Proposals will only be accepted from security consultancies meeting the following minimum criteria:
1. Empaneled with **CERT-In (Indian Computer Emergency Response Team)** OR holding active **CREST (Council of Registered Ethical Security Testers)** accreditation.
2. Lead assessment engineers must hold active industry certifications (OSCP, OSEP, OSWE, CISSP, or CEH Master).
3. Demonstrated track record in auditing Next.js / React Server Components and PostgreSQL Row-Level Security architectures.

---

## 7. Deliverables & Acceptance Criteria

The selected vendor must provide:
1. **Executive Summary Report:** High-level posture assessment, business risk evaluation, and overall maturity grade for executive leadership and board review.
2. **Detailed Technical Report:**
   - Complete inventory of tested endpoints and test cases.
   - Comprehensive vulnerability register sorted by CVSS v3.1 severity.
   - Exact, step-by-step reproducible Proof-of-Concept (PoC) scripts, cURL commands, or HTTP request/response transcripts.
   - Actionable, code-level remediation recommendations.
3. **Complimentary 30-Day Re-Testing:** Verification of all reported vulnerabilities following remediation by Zealosh engineering, with an updated report.
4. **Formal Letter of Attestation / Security Certificate:** Official clearance document certifying that the platform has achieved OWASP ASVS Level 2 compliance with zero Critical or High vulnerabilities remaining.

---

## 8. Proposal Submission Instructions

Interested vendors should submit proposals including:
- Company background and CERT-In / CREST accreditation certificates.
- Lead tester bios and certification credentials.
- Fixed-price commercial proposal (in INR) inclusive of GST.
- Sample anonymized penetration test report.

Submissions should be addressed to:  
**Procurement & Security Gating Committee**  
Zealosh Training & Consultants  
Kollam, Kerala, India  
Email: `security@zealosh.com` / `procurement@zealosh.com`  

