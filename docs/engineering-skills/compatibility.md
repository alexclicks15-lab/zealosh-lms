# Antigravity Engineering Intelligence System — Compatibility & Platform Adaptations

**Document Version:** 1.0.0  
**Host Environment:** Windows 10/11 x64 / PowerShell 7 / Git Bash 2.46+ / Node.js 20+ / TypeScript 5.6+  
**Scope:** Operating System, Toolchain, Command Shell, and Runtime Compatibility Adaptations.

---

## 1. Operating System & Filesystem Adaptations

### 1.1 Windows Path Separators & Shell Invocation
- **Finding:** Windows uses backslashes (`\`) for file system paths, while Node.js and Bash tools expect forward slashes (`/`). Direct execution of Bash commands in PowerShell can fail when passing unquoted flags or nested subshells.
- **Adaptation:**
  - Standardized all markdown links to GitHub-style forward-slash URIs (`file:///C:/Users/...`).
  - Standardized shell script validation to use the explicit Git Bash interpreter:
    ```powershell
    & "C:\Program Files\Git\usr\bin\bash.exe" -n deploy/[script-name].sh
    ```
  - Standardized Git commands to invoke `C:\Program Files\Git\mingw64\bin\git.exe` directly to prevent fork-bomb recursion bugs caused by Windows shim wrappers.

### 1.2 POSIX File Flags Mismatch in Security Scanners
- **Finding:** Tools attempting to use POSIX-only open flags (`fs.constants.O_NOFOLLOW` and `fs.constants.O_NONBLOCK`) throw unhandled `SafeInputError` exceptions on Windows NTFS filesystems.
- **Adaptation:**
  - Patched test runners to conditionally skip non-applicable POSIX symlink tests when running on `win32` platform (`!HAS_SAFE_INPUT_OPEN`), preserving programmatic file scanning capabilities.

---

## 2. Toolchain & Runtime Adaptations

### 2.1 Next.js 14 App Router vs. Traditional Frameworks
- **Finding:** Skills written for generic Express/Fastify apps attempt to modify `routes.js` or create Express middleware.
- **Adaptation:**
  - Adapted `nextjs-fullstack-architecture` and `api-design-and-security` to generate Next.js 14 App Router route handlers (`src/app/api/.../route.ts`) using Web Standard `Request` and `NextResponse`.
  - Enforced single-read constraints on Web Standard `Request` streams (creating fresh `Request` instances for replay tests).

### 2.2 Vitest 5.0.5 vs. Jest / Mocha
- **Finding:** Upstream skills often supply test templates expecting Jest (`jest.fn()`, `beforeAll()`).
- **Adaptation:**
  - Standardized test suites on Vitest syntax (`import { describe, it, expect, vi } from 'vitest'`).
  - Handled CommonJS / ESM interop warnings by maintaining compatible configuration.

### 2.3 Containerized vs. Host-Native CLI Tools (Nginx & Terraform)
- **Finding:** `nginx` and `terraform` CLI binaries are intentionally not installed directly on the Windows development workstation; Nginx runs inside a Linux Docker container, and Terraform runs in staging CI/CD.
- **Adaptation:**
  - Distinguished actual executed CLI verifications (Vitest, TypeScript `tsc`, Next.js build, Bash `-n`) from architectural syntax and configuration audits (Nginx configs, Terraform outputs).
  - Explicitly avoided claiming CLI execution for uninstalled host tools.

---

## 3. Unsupported Capabilities Ledger

| Capability | Unsupported Reason | Safe Alternative / Workaround Implemented |
| :--- | :--- | :--- |
| **Direct Host `nginx -t`** | Nginx binary not installed on Windows host | Structural syntax audit + containerized deployment validation |
| **Direct Host `terraform plan`**| Terraform binary not installed on Windows host | HCL configuration & output validation against target schema |
| **POSIX `O_NOFOLLOW` symlinks** | Windows NTFS filesystem limitation | Verified path canonicalization via `path.resolve()` |
| **Automatic Tool Invocation without Shell**| Antigravity executes commands via explicit tools | Standardized `run_command` and Vitest test runner scripts |
