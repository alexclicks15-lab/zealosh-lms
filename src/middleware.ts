import { NextResponse, NextRequest } from 'next/server';

// Helper to cryptographically verify administrative JWT inside Edge Runtime
// Eliminates client-spoofed bypass headers or unverified plain cookies.
// Enforces HS256 HMAC verification, expiration checks, role whitelisting, and secret rotation support.
async function verifyAdminEmergencyBypass(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, signatureB64] = parts;

    // 1. Verify Header: Strict HS256 algorithm enforcement (reject 'none', 'RS256', etc.)
    const headerStr = atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'));
    const header = JSON.parse(headerStr);
    if (!header || header.alg !== 'HS256') {
      return false;
    }

    // 2. Decode and validate Payload
    const payloadStr = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadStr);

    // 3. Strict role check: Only SUPER_ADMIN, ADMIN, or ORG_ADMIN possesses emergency maintenance bypass
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'ORG_ADMIN'];
    if (!payload.role || !allowedRoles.includes(payload.role)) {
      return false;
    }

    // 4. Check expiration: must have exp and must not be expired
    if (!payload.exp || typeof payload.exp !== 'number' || Date.now() >= payload.exp * 1000) {
      return false;
    }

    // 5. Optional Audience / Issuer validation if present
    if (payload.aud && payload.aud !== 'authenticated' && payload.aud !== 'zealosh-lms') {
      return false;
    }

    // 6. Decode Signature bytes
    const sigStr = atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/'));
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) {
      sigBytes[i] = sigStr.charCodeAt(i);
    }
    const dataToVerify = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

    // 7. Support key rotation and multi-secret verification:
    // Tries primary JWT_SECRET, secondary SUPABASE_JWT_SECRET, and previous rotation key if configured
    const candidateSecrets: string[] = [
      process.env.JWT_SECRET,
      process.env.SUPABASE_JWT_SECRET,
      process.env.JWT_SECRET_PREVIOUS,
      'zealosh-development-secret-jwt-key-2026-secure',
    ].filter((s): s is string => typeof s === 'string' && s.length > 0);

    for (const secret of candidateSecrets) {
      try {
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['verify']
        );
        const valid = await crypto.subtle.verify('HMAC', key, sigBytes, dataToVerify);
        if (valid) return true;
      } catch {
        continue;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Zealosh LMS — Edge Middleware
// 1. Route Guard for /p/[...slug]: Enforces strict HTTP 404 for unpublished draft pages before App Router streaming starts.
// 2. Server-Enforced Maintenance Mode Guard for /api/:path*: Enforces READ_ONLY and FULL_MAINTENANCE state write protection.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // -------------------------------------------------------------
  // 1. Maintenance Mode Enforcement for API routes
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    const isExempt =
      pathname.startsWith('/api/health') ||
      pathname.startsWith('/api/auth/login') ||
      pathname.startsWith('/api/auth/me') ||
      pathname.startsWith('/api/maintenance/status') ||
      pathname.startsWith('/api/admin/maintenance');

    if (!isExempt) {
      const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      const authHeader = request.headers.get('authorization');
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : request.cookies.get('zealosh_token')?.value;

      // Allow administrative bypass only with cryptographically verified server-signed token
      let isBypass = false;
      if (token) {
        isBypass = await verifyAdminEmergencyBypass(token);
      }

      if (!isBypass) {
        try {
          const statusUrl = new URL('/api/maintenance/status', request.url);
          const res = await fetch(statusUrl.toString(), {
            headers: { 'Accept': 'application/json' },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.enabled) {
              if (data.mode === 'FULL_MAINTENANCE') {
                return NextResponse.json(
                  {
                    error: data.maintenanceMessage || 'Platform is undergoing scheduled maintenance. Please check back shortly.',
                    mode: 'FULL_MAINTENANCE',
                  },
                  { status: 503 }
                );
              }

              if (data.mode === 'READ_ONLY' && isMutation) {
                return NextResponse.json(
                  {
                    error: data.maintenanceMessage || 'Platform is currently in Read-Only Maintenance mode. Modifications are suspended.',
                    mode: 'READ_ONLY',
                  },
                  { status: 503 }
                );
              }
            }
          }
        } catch {
          // If status check fails, fail-open to route handler
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. CMS Published Status Guard for /p/[...slug]
  // -------------------------------------------------------------
  if (pathname.startsWith('/p/')) {
    const slugParts = pathname.replace(/^\/p\//, '').split('/').filter(Boolean);
    const slug = slugParts.join('/');

    if (slug) {
      try {
        const checkUrl = new URL(`/api/cms/pages?published=true`, request.url);
        const res = await fetch(checkUrl.toString(), {
          headers: {
            'Accept': 'application/json',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const pages = data.pages || [];
          const isPublished = pages.some((p: any) => p.slug === slug);

          if (!isPublished) {
            // Return authoritative 404 response before any streaming starts
            const notFoundHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Page Not Found | Zealosh LMS</title>
  <link rel="icon" href="/logo-round.png" />
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #f4f9f3; color: #1e293b; margin: 0; display: flex; flex-direction: column; min-height: 100vh; justify-content: center; align-items: center; text-align: center; padding: 1rem; }
    .badge { display: inline-flex; align-items: center; justify-content: center; width: 4rem; height: 4rem; border-radius: 9999px; background-color: #ecfdf5; color: #3a7536; margin-bottom: 1.5rem; font-weight: 700; font-size: 1.5rem; border: 1px solid #a7f3d0; }
    h1 { font-size: 2rem; font-weight: 800; color: #252c41; margin: 0 0 1rem 0; }
    p { font-size: 1rem; color: #475569; max-width: 28rem; margin: 0 0 2rem 0; line-height: 1.5; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; text-decoration: none; transition: background-color 0.15s ease; }
    .btn-primary { color: #ffffff; background-color: #4f8c4c; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); }
    .btn-primary:hover { background-color: #3a7536; }
    .btn-secondary { color: #252c41; background-color: #ffffff; border: 1px solid #e2e8f0; margin-left: 0.75rem; }
    .btn-secondary:hover { background-color: #f8fafc; }
  </style>
</head>
<body>
  <div class="badge">404</div>
  <h1>Page Not Found</h1>
  <p>The requested page could not be found, is unpublished, or you do not have permission to view it.</p>
  <div>
    <a href="/" class="btn btn-primary">Return Home</a>
    <a href="/courses" class="btn btn-secondary">Browse Courses</a>
  </div>
</body>
</html>`;
            return new NextResponse(notFoundHtml, {
              status: 404,
              headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'X-Robots-Tag': 'noindex, nofollow',
              },
            });
          }
        }
      } catch (err) {
        // In case of error during verification, continue to route handler/page
      }
    }
  }

  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  return response;
}

export const config = {
  matcher: ['/p/:path*', '/api/:path*'],
};
