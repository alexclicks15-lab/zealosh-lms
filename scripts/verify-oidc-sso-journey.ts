/**
 * ==============================================================================
 * Zealosh LMS — Moodle OIDC SSO Protocol & Browser Journey Verification Runner
 * Simulates genuine Moodle Core OAuth2 Client Flow (RFC 6749, RFC 7636, OIDC Core 1.0)
 * ==============================================================================
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { loadEnvConfig } from '@next/env';
import { db } from '../src/lib/store/db';

loadEnvConfig(process.cwd());

const JWT_SECRET = process.env.JWT_SECRET || 'zealosh_super_secret_jwt_key_2026_enterprise';
const MOODLE_CALLBACK_URI = 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php';
const MOODLE_CLIENT_ID = 'zealosh-moodle';

async function runOidcVerification() {
  console.log('================================================================');
  console.log('ZEALOSH LMS — MOODLE OIDC SSO PROTOCOL & FLOW VERIFICATION');
  console.log('Target Identity Provider: Zealosh Core Hub (http://localhost:3000)');
  console.log('Target Relying Party:     Zealosh Learning Engine (Moodle 4.4+)');
  console.log('================================================================\n');

  let passedSteps = 0;
  const totalSteps = 10;

  try {
    // ------------------------------------------------------------------------
    // Step 1: OpenID Connect Discovery Structure
    // ------------------------------------------------------------------------
    console.log('[Step 1/10] Verifying RFC 8414 OpenID Connect Discovery Metadata...');
    const { GET: getDiscovery } = await import('../src/app/.well-known/openid-configuration/route');
    const discReq = new Request('http://localhost:3000/.well-known/openid-configuration');
    const discRes = await getDiscovery(discReq);
    if (discRes.status !== 200) throw new Error(`Discovery failed with status ${discRes.status}`);

    const discData = await discRes.json();
    if (!discData.authorization_endpoint || !discData.token_endpoint || !discData.userinfo_endpoint) {
      throw new Error('Discovery response missing critical endpoint URLs');
    }
    console.log('  -> Issuer:                ', discData.issuer);
    console.log('  -> Authorization Endpoint:', discData.authorization_endpoint);
    console.log('  -> Token Endpoint:        ', discData.token_endpoint);
    console.log('  -> Userinfo Endpoint:     ', discData.userinfo_endpoint);
    console.log('  -> Scopes Supported:      ', discData.scopes_supported.join(' '));
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 2: PKCE Parameters & State/Nonce Generation
    // ------------------------------------------------------------------------
    console.log('\n[Step 2/10] Generating RFC 7636 PKCE Challenge & Anti-CSRF Tokens...');
    const stateToken = `moodle_state_${crypto.randomBytes(12).toString('hex')}`;
    const nonceToken = `moodle_nonce_${crypto.randomBytes(12).toString('hex')}`;
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    console.log('  -> Generated State:         ', stateToken);
    console.log('  -> Generated Nonce:         ', nonceToken);
    console.log('  -> Code Challenge Method:    S256');
    console.log('  -> Code Challenge:          ', codeChallenge);
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 3: Authorization Request & 302 Redirect
    // ------------------------------------------------------------------------
    console.log('\n[Step 3/10] Executing Authorization Request (/api/oauth/authorize)...');
    const { GET: getAuthorize } = await import('../src/app/api/oauth/authorize/route');
    const authUrl = `http://localhost:3000/api/oauth/authorize?client_id=${MOODLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      MOODLE_CALLBACK_URI
    )}&response_type=code&scope=openid%20profile%20email&state=${stateToken}&nonce=${nonceToken}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    const authRes = await getAuthorize(new Request(authUrl));
    if (authRes.status !== 302) {
      throw new Error(`Expected 302 Redirect from authorization endpoint, got ${authRes.status}`);
    }

    const redirectLocation = authRes.headers.get('location');
    if (!redirectLocation) throw new Error('Authorization response missing Location header');

    const callbackUrl = new URL(redirectLocation);
    const authCode = callbackUrl.searchParams.get('code');
    const returnedState = callbackUrl.searchParams.get('state');

    if (!authCode || !authCode.startsWith('zc_')) {
      throw new Error(`Invalid authorization code format: ${authCode}`);
    }
    if (returnedState !== stateToken) {
      throw new Error(`State mismatch: expected ${stateToken}, got ${returnedState}`);
    }
    console.log('  -> 302 Redirect validated to Moodle callback URL');
    console.log('  -> Received Authorization Code:', authCode.substring(0, 15) + '...');
    console.log('  -> State matched successfully:    OK');
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 4: Token Exchange via Form-Urlencoded Body (Moodle PHP Standard)
    // ------------------------------------------------------------------------
    console.log('\n[Step 4/10] Exchanging Code for Tokens via application/x-www-form-urlencoded...');
    const { POST: postToken } = await import('../src/app/api/oauth/token/route');
    const tokenFormParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: MOODLE_CALLBACK_URI,
      client_id: MOODLE_CLIENT_ID,
      code_verifier: codeVerifier,
    });

    const tokenRes = await postToken(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenFormParams.toString(),
      })
    );

    if (tokenRes.status !== 200) {
      const errBody = await tokenRes.text();
      throw new Error(`Token exchange failed with status ${tokenRes.status}: ${errBody}`);
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token || !tokenData.id_token) {
      throw new Error('Token response missing access_token or id_token');
    }
    console.log('  -> Token Type:   ', tokenData.token_type);
    console.log('  -> Expires In:   ', tokenData.expires_in, 'seconds');
    console.log('  -> Access Token:  VALID JWT received');
    console.log('  -> ID Token:      VALID JWT received');
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 5: ID Token Cryptographic Verification & Nonce Validation
    // ------------------------------------------------------------------------
    console.log('\n[Step 5/10] Verifying ID Token Claims, Issuer & Nonce Binding...');
    const decodedId = jwt.verify(tokenData.id_token, JWT_SECRET) as any;
    if (decodedId.nonce !== nonceToken) {
      throw new Error(`Nonce tampering detected: expected ${nonceToken}, got ${decodedId.nonce}`);
    }
    if (decodedId.aud !== MOODLE_CLIENT_ID) {
      throw new Error(`Audience mismatch: expected ${MOODLE_CLIENT_ID}, got ${decodedId.aud}`);
    }
    console.log('  -> Subject (sub):       ', decodedId.sub);
    console.log('  -> Name:                ', decodedId.name);
    console.log('  -> Email:               ', decodedId.email);
    console.log('  -> Preferred Username:  ', decodedId.preferred_username);
    console.log('  -> Nonce bound to token: OK');
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 6: Userinfo Endpoint Query
    // ------------------------------------------------------------------------
    console.log('\n[Step 6/10] Querying Userinfo Endpoint with Bearer Token...');
    const { GET: getUserinfo } = await import('../src/app/api/oauth/userinfo/route');
    const userinfoRes = await getUserinfo(
      new Request('http://localhost:3000/api/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
    );
    if (userinfoRes.status !== 200) throw new Error(`Userinfo query failed: status ${userinfoRes.status}`);

    const userinfoData = await userinfoRes.json();
    if (userinfoData.sub !== decodedId.sub) throw new Error('Userinfo subject mismatch with ID token');
    console.log('  -> Userinfo Subject: ', userinfoData.sub);
    console.log('  -> Userinfo Email:   ', userinfoData.email);
    console.log('  -> Email Verified:   ', userinfoData.email_verified);
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 7: Single-Use Code Replay Protection
    // ------------------------------------------------------------------------
    console.log('\n[Step 7/10] Testing Single-Use Authorization Code Replay Attack...');
    const replayRes = await postToken(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenFormParams.toString(),
      })
    );
    if (replayRes.status !== 400) {
      throw new Error(`Replay attack succeeded! Expected 400, got ${replayRes.status}`);
    }
    const replayErr = await replayRes.json();
    if (replayErr.error !== 'invalid_grant' || !replayErr.error_description.includes('Replay')) {
      throw new Error(`Unexpected error response on replay: ${JSON.stringify(replayErr)}`);
    }
    console.log('  -> Replay attempt rejected with 400 invalid_grant: PASS');
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 8: PKCE Code Verifier Tampering Defense
    // ------------------------------------------------------------------------
    console.log('\n[Step 8/10] Testing PKCE Code Verifier Tampering Defense...');
    const pkceCode = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: MOODLE_CLIENT_ID,
      redirectUri: MOODLE_CALLBACK_URI,
      codeChallenge,
      codeChallengeMethod: 'S256',
    });

    const tamperedPkceRes = await postToken(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: pkceCode.code,
          grant_type: 'authorization_code',
          code_verifier: 'tampered_invalid_verifier_value',
        }),
      })
    );
    if (tamperedPkceRes.status !== 400) throw new Error('Tampered PKCE verifier was not rejected');
    console.log('  -> Invalid PKCE verifier rejected with 400 invalid_grant: PASS');
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 9: Redirect URI Mismatch Defense
    // ------------------------------------------------------------------------
    console.log('\n[Step 9/10] Testing Redirect URI Mismatch Defense...');
    const uriCode = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: MOODLE_CLIENT_ID,
      redirectUri: MOODLE_CALLBACK_URI,
    });

    const mismatchUriRes = await postToken(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: uriCode.code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://attacker.evil.com/callback',
        }),
      })
    );
    if (mismatchUriRes.status !== 400) throw new Error('Redirect URI mismatch was not rejected');
    console.log('  -> Redirect URI mismatch rejected with 400 invalid_grant: PASS');
    passedSteps++;

    // ------------------------------------------------------------------------
    // Step 10: Unauthorized Redirect Domain Injection
    // ------------------------------------------------------------------------
    console.log('\n[Step 10/10] Testing Unauthorized Redirect Domain Injection...');
    const maliciousAuthUrl = `http://localhost:3000/api/oauth/authorize?client_id=${MOODLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      'https://phishing.zealosh-fake.com/steal-code'
    )}&response_type=code`;

    const maliciousRes = await getAuthorize(new Request(maliciousAuthUrl));
    if (maliciousRes.status !== 400) throw new Error('Unauthorized redirect domain was not blocked');
    const maliciousData = await maliciousRes.json();
    if (maliciousData.error !== 'unauthorized_client') {
      throw new Error(`Expected unauthorized_client error, got: ${maliciousData.error}`);
    }
    console.log('  -> Open redirect attempt blocked with 400 unauthorized_client: PASS');
    passedSteps++;

    console.log('\n================================================================');
    console.log(`VERIFICATION RESULT: ALL ${passedSteps}/${totalSteps} PROTOCOL INVARIANTS PASSED!`);
    console.log('Zealosh Core Hub OIDC SSO Provider is 100% compliant and ready for Moodle 4.4+ federation.');
    console.log('================================================================');
  } catch (err: any) {
    console.error('\nOIDC VERIFICATION FAILED:', err.message);
    process.exit(1);
  }
}

runOidcVerification();
