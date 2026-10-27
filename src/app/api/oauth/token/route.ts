import { NextResponse } from 'next/server';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/store/db';

const JWT_SECRET = process.env.JWT_SECRET || 'zealosh_super_secret_jwt_key_2026_enterprise';

export async function POST(request: Request) {
  try {
    let code = '';
    let grantType = '';
    let redirectUri = '';
    let clientId = '';
    let codeVerifier = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      code = (formData.get('code') as string) || '';
      grantType = (formData.get('grant_type') as string) || '';
      redirectUri = (formData.get('redirect_uri') as string) || '';
      clientId = (formData.get('client_id') as string) || '';
      codeVerifier = (formData.get('code_verifier') as string) || '';
    } else {
      const body = await request.json().catch(() => ({}));
      code = body.code || '';
      grantType = body.grant_type || '';
      redirectUri = body.redirect_uri || '';
      clientId = body.client_id || '';
      codeVerifier = body.code_verifier || '';
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
    await db.markOAuthCodeUsed(code, clientId || oauthCode.clientId, redirectUri);

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

    const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, { expiresIn: '1h' });

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

    const idToken = jwt.sign(idTokenPayload, JWT_SECRET, { expiresIn: '1h' });

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
          'Pragma': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('OAuth token error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to process token exchange' },
      { status: 500 }
    );
  }
}
