import { NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/store/db';

function timingSafeSecretEqual(candidate: string, expected: string): boolean {
  const hashCandidate = crypto.createHash('sha256').update(candidate, 'utf8').digest();
  const hashExpected = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(hashCandidate, hashExpected);
}

export async function POST(request: Request) {
  try {
    const jwtSecret = process.env.JWT_SECRET || 'zealosh_super_secret_jwt_key_2026_enterprise';
    const configuredClientSecret = (process.env.OAUTH_CLIENT_SECRET || '').trim();
    const isClientSecretConfigured = configuredClientSecret.length > 0;

    let code = '';
    let grantType = '';
    let redirectUri = '';
    let bodyClientId = '';
    let bodyClientSecret = '';
    let codeVerifier = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        code = (formData.get('code') as string) || '';
        grantType = (formData.get('grant_type') as string) || '';
        redirectUri = (formData.get('redirect_uri') as string) || '';
        bodyClientId = (formData.get('client_id') as string) || '';
        bodyClientSecret = (formData.get('client_secret') as string) || '';
        codeVerifier = (formData.get('code_verifier') as string) || '';
      }
    } else {
      const body = await request.json().catch(() => ({}));
      code = body.code || '';
      grantType = body.grant_type || '';
      redirectUri = body.redirect_uri || '';
      bodyClientId = body.client_id || '';
      bodyClientSecret = body.client_secret || '';
      codeVerifier = body.code_verifier || '';
    }

    // Parse HTTP Basic authentication from Authorization header if present
    const authHeader = request.headers.get('authorization');
    let basicClientId: string | null = null;
    let basicClientSecret: string | null = null;
    let hasMalformedAuthHeader = false;
    let authHeaderFailureReason = '';

    if (authHeader) {
      const match = authHeader.match(/^Basic\s+(.+)$/i);
      if (!match) {
        hasMalformedAuthHeader = true;
        authHeaderFailureReason = 'Unsupported authorization scheme';
      } else {
        const rawBase64 = match[1].trim();
        const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
        if (!base64Regex.test(rawBase64) || rawBase64.length === 0) {
          hasMalformedAuthHeader = true;
          authHeaderFailureReason = 'Malformed HTTP Basic authorization header';
        } else {
          let decoded = '';
          try {
            decoded = Buffer.from(rawBase64, 'base64').toString('utf8');
          } catch {
            hasMalformedAuthHeader = true;
            authHeaderFailureReason = 'Failed to decode HTTP Basic credentials';
          }

          const colonIndex = decoded.indexOf(':');
          if (colonIndex === -1) {
            hasMalformedAuthHeader = true;
            authHeaderFailureReason = 'Malformed HTTP Basic credentials (missing colon)';
          } else {
            const rawUser = decoded.substring(0, colonIndex);
            const rawPass = decoded.substring(colonIndex + 1);
            try {
              basicClientId = decodeURIComponent(rawUser);
            } catch {
              basicClientId = rawUser;
            }
            try {
              basicClientSecret = decodeURIComponent(rawPass);
            } catch {
              basicClientSecret = rawPass;
            }
          }
        }
      }
    }

    // Reject malformed HTTP Authorization header
    if (hasMalformedAuthHeader) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: authHeaderFailureReason || 'Invalid client authentication' },
        { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Zealosh OAuth"' } }
      );
    }

    // RFC 6749 Section 2.3: Multiple client authentication methods forbidden
    if (basicClientSecret !== null && bodyClientSecret) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Multiple client authentication methods detected' },
        { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Zealosh OAuth"' } }
      );
    }

    // Mismatched client ID in Basic header vs request body
    if (basicClientId !== null && bodyClientId && basicClientId !== bodyClientId) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Client identifier mismatch between header and body' },
        { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Zealosh OAuth"' } }
      );
    }

    const effectiveClientId = basicClientId !== null ? basicClientId : bodyClientId;
    const effectiveClientSecret = basicClientSecret !== null ? basicClientSecret : (bodyClientSecret || null);

    // Client Authentication Validation when OAUTH_CLIENT_SECRET is configured
    if (isClientSecretConfigured) {
      if (!effectiveClientSecret) {
        return NextResponse.json(
          { error: 'invalid_client', error_description: 'Client authentication required' },
          { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Zealosh OAuth"' } }
        );
      }

      if (!timingSafeSecretEqual(effectiveClientSecret, configuredClientSecret)) {
        return NextResponse.json(
          { error: 'invalid_client', error_description: 'Client authentication failed' },
          { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Zealosh OAuth"' } }
        );
      }

      if (effectiveClientId && effectiveClientId !== 'zealosh-moodle') {
        return NextResponse.json(
          { error: 'invalid_client', error_description: 'Unknown client identifier' },
          { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Zealosh OAuth"' } }
        );
      }
    }

    // 1. Grant type validation
    if (grantType !== 'authorization_code') {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Only authorization_code grant type is supported' },
        { status: 400 }
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing authorization code' },
        { status: 400 }
      );
    }

    // 2. Lookup authorization code in authoritative store
    const oauthCode = await db.getOAuthCode(code);
    if (!oauthCode) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Invalid or unknown authorization code' },
        { status: 400 }
      );
    }

    // 3. Replay Protection: Reject if already used
    if (oauthCode.used) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Authorization code already used. Replay detected' },
        { status: 400 }
      );
    }

    // 4. Expiration check
    if (Date.now() > oauthCode.expiresAt) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Authorization code has expired' },
        { status: 400 }
      );
    }

    // 5. Redirect URI consistency check
    if (redirectUri && oauthCode.redirectUri && redirectUri !== oauthCode.redirectUri) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Redirect URI mismatch with authorization request' },
        { status: 400 }
      );
    }

    // 5b. Client identifier check if code was bound to a specific client
    if (effectiveClientId && oauthCode.clientId && effectiveClientId !== oauthCode.clientId) {
      return NextResponse.json(
        { error: 'invalid_grant', error_description: 'Client identifier mismatch with authorization code' },
        { status: 400 }
      );
    }

    // 6. PKCE verification (RFC 7636)
    if (oauthCode.codeChallenge) {
      if (!codeVerifier) {
        return NextResponse.json(
          { error: 'invalid_grant', error_description: 'Missing code_verifier required by PKCE challenge' },
          { status: 400 }
        );
      }

      if (oauthCode.codeChallengeMethod === 'S256') {
        const computedChallenge = crypto
          .createHash('sha256')
          .update(codeVerifier)
          .digest('base64url');

        if (computedChallenge !== oauthCode.codeChallenge) {
          return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Invalid PKCE code_verifier' },
            { status: 400 }
          );
        }
      } else {
        // Plain PKCE
        if (codeVerifier !== oauthCode.codeChallenge) {
          return NextResponse.json(
            { error: 'invalid_grant', error_description: 'Invalid PKCE code_verifier' },
            { status: 400 }
          );
        }
      }
    }

    // 7. Atomic consumption of authorization code (Single-Use Enforcement)
    await db.markOAuthCodeUsed(code, effectiveClientId || oauthCode.clientId, redirectUri);

    // 8. Resolve user identity
    const user = (await db.getUser(oauthCode.userId)) || {
      id: oauthCode.userId,
      name: 'Arjun Menon',
      email: 'student@zealosh.com',
      role: 'STUDENT',
    };

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const issuer = `${protocol}://${host}`;

    const accessTokenPayload = {
      iss: issuer,
      sub: user.id,
      aud: oauthCode.clientId || 'zealosh-moodle',
      scope: oauthCode.scope || 'openid profile email',
      role: user.role,
    };

    const accessToken = jwt.sign(accessTokenPayload, jwtSecret, { expiresIn: '1h' });

    const idTokenPayload: Record<string, unknown> = {
      iss: issuer,
      sub: user.id,
      aud: oauthCode.clientId || 'zealosh-moodle',
      name: user.name,
      email: user.email,
      preferred_username: user.email,
      role: user.role,
      email_verified: true,
      auth_time: Math.floor(Date.now() / 1000),
    };

    // Propagate nonce to ID token for replay attack mitigation in client
    if (oauthCode.nonce) {
      idTokenPayload.nonce = oauthCode.nonce;
    }

    const idToken = jwt.sign(idTokenPayload, jwtSecret, { expiresIn: '1h' });

    return NextResponse.json(
      {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: idToken,
        scope: oauthCode.scope || 'openid profile email',
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('OAuth token exchange error');
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to process token exchange' },
      { status: 500 }
    );
  }
}
