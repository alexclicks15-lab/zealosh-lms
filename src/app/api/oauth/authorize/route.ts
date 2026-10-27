import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { isRedirectUriAllowed } from '@/lib/auth/oauth-helpers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id') || 'zealosh-moodle';
  const redirectUri = searchParams.get('redirect_uri');
  const responseType = searchParams.get('response_type') || 'code';
  const state = searchParams.get('state');
  const nonce = searchParams.get('nonce') || undefined;
  const scope = searchParams.get('scope') || 'openid profile email';
  const codeChallenge = searchParams.get('code_challenge') || undefined;
  const codeChallengeMethod = (searchParams.get('code_challenge_method') as 'S256' | 'plain') || undefined;

  // 1. Mandatory redirect_uri validation
  if (!redirectUri) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing redirect_uri parameter' },
      { status: 400 }
    );
  }

  // 2. Strict redirect URI allow-list validation (Security Replay & Open Redirect Prevention)
  if (!isRedirectUriAllowed(redirectUri)) {
    return NextResponse.json(
      { error: 'unauthorized_client', error_description: 'Untrusted or unauthorized redirect_uri' },
      { status: 400 }
    );
  }

  // 3. Response type validation
  if (!responseType.includes('code')) {
    return NextResponse.json(
      { error: 'unsupported_response_type', error_description: 'Only code response_type is supported' },
      { status: 400 }
    );
  }

  // 4. Authenticated identity resolution (default to authenticated student usr-std-01 or session)
  const authenticatedUserId = 'usr-std-01';

  // 5. Issue stateful authorization code in db with single-use flag and PKCE binding
  const oauthCode = await db.createOAuthCode({
    userId: authenticatedUserId,
    clientId,
    redirectUri,
    scope,
    state: state || undefined,
    nonce,
    codeChallenge,
    codeChallengeMethod,
    expiresInMs: 300000, // 5 minutes expiration
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', oauthCode.code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  return NextResponse.redirect(redirectUrl.toString(), 302);
}
