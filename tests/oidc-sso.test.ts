import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/store/db';

const JWT_SECRET = process.env.JWT_SECRET || 'zealosh_super_secret_jwt_key_2026_enterprise';

describe('OpenID Connect (OIDC) & OAuth2 SSO Integration Suite', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  it('should produce standard OpenID Connect discovery structure', async () => {
    const { GET } = await import('@/app/.well-known/openid-configuration/route');
    const req = new Request('http://localhost:3000/.well-known/openid-configuration');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.issuer).toBe('http://localhost:3000');
    expect(data.authorization_endpoint).toBe('http://localhost:3000/api/oauth/authorize');
    expect(data.token_endpoint).toBe('http://localhost:3000/api/oauth/token');
    expect(data.userinfo_endpoint).toBe('http://localhost:3000/api/oauth/userinfo');
    expect(data.scopes_supported).toContain('openid');
    expect(data.scopes_supported).toContain('email');
    expect(data.scopes_supported).toContain('profile');
    expect(data.response_types_supported).toContain('code');
  });

  it('should authorize valid request and redirect with code and state', async () => {
    const { GET } = await import('@/app/api/oauth/authorize/route');
    const redirectTarget = 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php';
    const authUrl = `http://localhost:3000/api/oauth/authorize?client_id=zealosh-moodle&redirect_uri=${encodeURIComponent(
      redirectTarget
    )}&response_type=code&state=xyz_state_456&nonce=nonce_789`;

    const req = new Request(authUrl);
    const res = await GET(req);
    expect(res.status).toBe(302);

    const location = res.headers.get('location');
    expect(location).toBeDefined();

    const redirectUrl = new URL(location!);
    const code = redirectUrl.searchParams.get('code');
    const state = redirectUrl.searchParams.get('state');

    expect(state).toBe('xyz_state_456');
    expect(code).toBeDefined();
    expect(code?.startsWith('zc_')).toBe(true);

    // Verify code exists in authoritative db store
    const codeRecord = await db.getOAuthCode(code!);
    expect(codeRecord).toBeDefined();
    expect(codeRecord?.userId).toBe('usr-std-01');
    expect(codeRecord?.nonce).toBe('nonce_789');
    expect(codeRecord?.used).toBe(false);
  });

  it('should reject unauthorized or untrusted redirect_uri', async () => {
    const { GET } = await import('@/app/api/oauth/authorize/route');
    const maliciousUri = 'https://attacker.evil.com/steal-code';
    const authUrl = `http://localhost:3000/api/oauth/authorize?client_id=zealosh-moodle&redirect_uri=${encodeURIComponent(
      maliciousUri
    )}&response_type=code`;

    const req = new Request(authUrl);
    const res = await GET(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBe('unauthorized_client');
  });

  it('should exchange valid authorization code for access_token and id_token with nonce', async () => {
    // 1. Issue code
    const oauthCode = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: 'zealosh-moodle',
      redirectUri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
      nonce: 'secure_nonce_abc',
    });

    // 2. Exchange code
    const { POST } = await import('@/app/api/oauth/token/route');
    const req = new Request('http://localhost:3000/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: oauthCode.code,
        grant_type: 'authorization_code',
        redirect_uri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
        client_id: 'zealosh-moodle',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.token_type).toBe('Bearer');
    expect(data.access_token).toBeDefined();
    expect(data.id_token).toBeDefined();
    expect(data.expires_in).toBe(3600);

    // Verify access token claims
    const verifiedAccess = jwt.verify(data.access_token, JWT_SECRET) as any;
    expect(verifiedAccess.sub).toBe('usr-std-01');
    expect(verifiedAccess.aud).toBe('zealosh-moodle');

    // Verify ID token claims & nonce propagation
    const verifiedId = jwt.verify(data.id_token, JWT_SECRET) as any;
    expect(verifiedId.sub).toBe('usr-std-01');
    expect(verifiedId.email).toBe('student@zealosh.com');
    expect(verifiedId.name).toBe('Arjun Menon');
    expect(verifiedId.nonce).toBe('secure_nonce_abc');
    expect(verifiedId.email_verified).toBe(true);
  });

  it('should enforce single-use authorization code and reject replay attacks', async () => {
    const oauthCode = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: 'zealosh-moodle',
      redirectUri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
    });

    const { POST } = await import('@/app/api/oauth/token/route');
    const tokenRequestBody = JSON.stringify({
      code: oauthCode.code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
    });

    // First exchange must succeed
    const firstReq = new Request('http://localhost:3000/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: tokenRequestBody,
    });
    const firstRes = await POST(firstReq);
    expect(firstRes.status).toBe(200);

    // Second exchange (replay attempt) MUST fail with invalid_grant
    const replayReq = new Request('http://localhost:3000/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: tokenRequestBody,
    });
    const replayRes = await POST(replayReq);
    expect(replayRes.status).toBe(400);

    const errorData = await replayRes.json();
    expect(errorData.error).toBe('invalid_grant');
    expect(errorData.error_description).toContain('Replay detected');
  });

  it('should reject expired authorization codes', async () => {
    const oauthCode = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: 'zealosh-moodle',
      redirectUri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
      expiresInMs: -1000, // already expired
    });

    const { POST } = await import('@/app/api/oauth/token/route');
    const req = new Request('http://localhost:3000/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: oauthCode.code,
        grant_type: 'authorization_code',
        redirect_uri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const errorData = await res.json();
    expect(errorData.error).toBe('invalid_grant');
    expect(errorData.error_description).toContain('expired');
  });

  it('should verify PKCE code_challenge (S256) and reject invalid verifier', async () => {
    const codeVerifier = 'high_entropy_random_verifier_string_1234567890';
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const oauthCode = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: 'zealosh-moodle',
      redirectUri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
      codeChallenge,
      codeChallengeMethod: 'S256',
    });

    const { POST } = await import('@/app/api/oauth/token/route');

    // 1. Attempt with invalid verifier must be rejected
    const badReq = new Request('http://localhost:3000/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: oauthCode.code,
        grant_type: 'authorization_code',
        code_verifier: 'wrong_verifier_token',
      }),
    });
    const badRes = await POST(badReq);
    expect(badRes.status).toBe(400);
    const badData = await badRes.json();
    expect(badData.error).toBe('invalid_grant');

    // 2. Attempt with correct verifier must succeed
    const goodReq = new Request('http://localhost:3000/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: oauthCode.code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });
    const goodRes = await POST(goodReq);
    expect(goodRes.status).toBe(200);

    const goodData = await goodRes.json();
    expect(goodData.access_token).toBeDefined();
  });

  it('should return user claims from valid Bearer token on userinfo endpoint', async () => {
    const testToken = jwt.sign(
      {
        sub: 'usr-inst-01',
        name: 'Vishnu Rajendran, CSP, CRSP',
        email: 'vishnu@zealosh.com',
        role: 'INSTRUCTOR',
      },
      JWT_SECRET
    );

    const { GET } = await import('@/app/api/oauth/userinfo/route');
    const req = new Request('http://localhost:3000/api/oauth/userinfo', {
      headers: { Authorization: `Bearer ${testToken}` },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const user = await res.json();
    expect(user.sub).toBe('usr-inst-01');
    expect(user.email).toBe('vishnu@zealosh.com');
    expect(user.name).toBe('Vishnu Rajendran, CSP, CRSP');
    expect(user.email_verified).toBe(true);
  });

  it('should reject userinfo request with missing or invalid Bearer token', async () => {
    const { GET } = await import('@/app/api/oauth/userinfo/route');

    // Missing header
    const noHeaderReq = new Request('http://localhost:3000/api/oauth/userinfo');
    const noHeaderRes = await GET(noHeaderReq);
    expect(noHeaderRes.status).toBe(401);

    // Malformed token
    const badTokenReq = new Request('http://localhost:3000/api/oauth/userinfo', {
      headers: { Authorization: 'Bearer totally_fake_token' },
    });
    const badTokenRes = await GET(badTokenReq);
    expect(badTokenRes.status).toBe(401);
  });

  it('should exchange authorization code using application/x-www-form-urlencoded (Moodle Core client standard)', async () => {
    const oauthCode = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: 'zealosh-moodle',
      redirectUri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
      nonce: 'moodle_nonce_xyz',
    });

    const { POST } = await import('@/app/api/oauth/token/route');
    const formParams = new URLSearchParams({
      code: oauthCode.code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
      client_id: 'zealosh-moodle',
    });

    const req = new Request('http://localhost:3000/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formParams.toString(),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.access_token).toBeDefined();
    expect(data.id_token).toBeDefined();
    expect(data.token_type).toBe('Bearer');

    const decodedId = jwt.verify(data.id_token, JWT_SECRET) as any;
    expect(decodedId.sub).toBe('usr-std-01');
    expect(decodedId.nonce).toBe('moodle_nonce_xyz');
    expect(decodedId.aud).toBe('zealosh-moodle');
  });

  it('should reject authorization code exchange if redirect_uri does not match original request', async () => {
    const oauthCode = await db.createOAuthCode({
      userId: 'usr-std-01',
      clientId: 'zealosh-moodle',
      redirectUri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
    });

    const { POST } = await import('@/app/api/oauth/token/route');
    const req = new Request('http://localhost:3000/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: oauthCode.code,
        grant_type: 'authorization_code',
        redirect_uri: 'https://lms.zealosh.com/wrong-callback.php',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_grant');
    expect(data.error_description).toContain('Redirect URI mismatch');
  });

  it('should complete full end-to-end OIDC authentication flow for student identity', async () => {
    // 1. Authorize GET request
    const { GET: authorizeGet } = await import('@/app/api/oauth/authorize/route');
    const authUrl = 'http://localhost:3000/api/oauth/authorize?client_id=zealosh-moodle&redirect_uri=https%3A%2F%2Flms.zealosh.com%2Flearn-engine%2Fadmin%2Foauth2callback.php&response_type=code&state=moodle_state_123&nonce=moodle_nonce_456';
    const authRes = await authorizeGet(new Request(authUrl));
    expect(authRes.status).toBe(302);

    const redirectLocation = authRes.headers.get('location')!;
    const redirectUrl = new URL(redirectLocation);
    const code = redirectUrl.searchParams.get('code')!;
    const state = redirectUrl.searchParams.get('state');

    expect(state).toBe('moodle_state_123');
    expect(code).toBeDefined();

    // 2. Token POST request
    const { POST: tokenPost } = await import('@/app/api/oauth/token/route');
    const tokenRes = await tokenPost(
      new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          grant_type: 'authorization_code',
          redirect_uri: 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php',
          client_id: 'zealosh-moodle',
        }),
      })
    );
    expect(tokenRes.status).toBe(200);
    const tokens = await tokenRes.json();

    // 3. Userinfo GET request
    const { GET: userinfoGet } = await import('@/app/api/oauth/userinfo/route');
    const userinfoRes = await userinfoGet(
      new Request('http://localhost:3000/api/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
    );
    expect(userinfoRes.status).toBe(200);
    const userClaims = await userinfoRes.json();

    expect(userClaims.sub).toBe('usr-std-01');
    expect(userClaims.email).toBe('student@zealosh.com');
    expect(userClaims.name).toBe('Arjun Menon');
    expect(userClaims.preferred_username).toBe('student@zealosh.com');
  });

  describe('[SIMULATED] Environment Isolation, Hostile Forwarded-Host & Redirect Defense', () => {
    const originalEnv = process.env.ZEALOSH_ENVIRONMENT;
    const originalBase = process.env.APP_BASE_URL;

    afterEach(() => {
      process.env.ZEALOSH_ENVIRONMENT = originalEnv;
      process.env.APP_BASE_URL = originalBase;
    });

    it('should strictly reject production redirect URI when ZEALOSH_ENVIRONMENT is staging', async () => {
      process.env.ZEALOSH_ENVIRONMENT = 'staging';
      const { isRedirectUriAllowed } = await import('@/lib/auth/oauth-helpers');

      // Staging allowed
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com/learn-engine/admin/oauth2callback.php')).toBe(true);

      // Production strictly rejected on staging
      expect(isRedirectUriAllowed('https://lms.zealosh.com/learn-engine/admin/oauth2callback.php')).toBe(false);

      // External host rejected
      expect(isRedirectUriAllowed('https://evil.com/callback')).toBe(false);
    });

    it('should strictly reject staging redirect URI when ZEALOSH_ENVIRONMENT is production', async () => {
      process.env.ZEALOSH_ENVIRONMENT = 'production';
      const { isRedirectUriAllowed } = await import('@/lib/auth/oauth-helpers');

      // Production allowed
      expect(isRedirectUriAllowed('https://lms.zealosh.com/learn-engine/admin/oauth2callback.php')).toBe(true);

      // Staging strictly rejected on production
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com/learn-engine/admin/oauth2callback.php')).toBe(false);

      // External host rejected
      expect(isRedirectUriAllowed('https://evil.com/callback')).toBe(false);
    });

    it('[SIMULATED] should reject client-supplied hostile X-Forwarded-Host in OIDC discovery and strictly preserve canonical staging issuer', async () => {
      process.env.ZEALOSH_ENVIRONMENT = 'staging';
      process.env.APP_BASE_URL = 'https://lms.staging.zealosh.com';

      const { GET } = await import('@/app/.well-known/openid-configuration/route');
      const hostileReq = new Request('http://localhost:3000/.well-known/openid-configuration', {
        headers: {
          'x-forwarded-host': 'attacker-evil.com',
          'x-forwarded-proto': 'https',
          'host': 'attacker-evil.com',
        },
      });

      const res = await GET(hostileReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      // Issuer and endpoints MUST NEVER reflect the hostile forwarded host
      expect(data.issuer).toBe('https://lms.staging.zealosh.com');
      expect(data.authorization_endpoint).toBe('https://lms.staging.zealosh.com/api/oauth/authorize');
      expect(data.token_endpoint).toBe('https://lms.staging.zealosh.com/api/oauth/token');
      expect(data.userinfo_endpoint).toBe('https://lms.staging.zealosh.com/api/oauth/userinfo');
      expect(data.jwks_uri).toBe('https://lms.staging.zealosh.com/api/oauth/jwks');
      expect(data.issuer).not.toContain('attacker-evil.com');
    });

    it('[SIMULATED] should reject cross-environment host tampering in OIDC discovery (production host injected during staging)', async () => {
      process.env.ZEALOSH_ENVIRONMENT = 'staging';
      process.env.APP_BASE_URL = 'https://lms.staging.zealosh.com';

      const { GET } = await import('@/app/.well-known/openid-configuration/route');
      const tamperReq = new Request('http://localhost:3000/.well-known/openid-configuration', {
        headers: {
          'x-forwarded-host': 'lms.zealosh.com', // Attempting production crossover in staging
          'x-forwarded-proto': 'https',
        },
      });

      const res = await GET(tamperReq);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.issuer).toBe('https://lms.staging.zealosh.com');
      expect(data.issuer).not.toBe('https://lms.zealosh.com');
    });

    it('[SIMULATED] should reject hostile userinfo tricks and unapproved non-standard ports in redirect URIs', async () => {
      process.env.ZEALOSH_ENVIRONMENT = 'staging';
      const { isRedirectUriAllowed } = await import('@/lib/auth/oauth-helpers');

      // Userinfo tricks
      expect(isRedirectUriAllowed('https://attacker@lms.staging.zealosh.com/learn-engine/admin/oauth2callback.php')).toBe(false);
      expect(isRedirectUriAllowed('https://user:pass@lms.staging.zealosh.com/learn-engine/admin/oauth2callback.php')).toBe(false);
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com:password@evil.com/callback')).toBe(false);

      // Unapproved non-standard ports
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com:8080/learn-engine/admin/oauth2callback.php')).toBe(false);
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com:9999/learn-engine/admin/oauth2callback.php')).toBe(false);

      // Standard HTTPS port 443 or default is accepted
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com:443/learn-engine/admin/oauth2callback.php')).toBe(true);
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com/learn-engine/admin/oauth2callback.php')).toBe(true);

      // Path traversal or null bytes rejected
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com/learn-engine/../admin/oauth2callback.php')).toBe(false);
      expect(isRedirectUriAllowed('https://lms.staging.zealosh.com/learn-engine/%00admin/oauth2callback.php')).toBe(false);
    });
  });

  describe('Dedicated OAUTH_CLIENT_SECRET Validation & Client Authentication Suite (CP-8.5 Step B)', () => {
    const originalOAuthSecret = process.env.OAUTH_CLIENT_SECRET;
    const originalJwtSecret = process.env.JWT_SECRET;
    const testRedirectUri = 'https://lms.zealosh.com/learn-engine/admin/oauth2callback.php';

    afterEach(() => {
      if (originalOAuthSecret !== undefined) {
        process.env.OAUTH_CLIENT_SECRET = originalOAuthSecret;
      } else {
        delete process.env.OAUTH_CLIENT_SECRET;
      }
      if (originalJwtSecret !== undefined) {
        process.env.JWT_SECRET = originalJwtSecret;
      } else {
        delete process.env.JWT_SECRET;
      }
    });

    const createTestCodeWithPkce = async (clientId = 'zealosh-moodle') => {
      const codeVerifier = 'synthetic_test_code_verifier_1234567890_abcdefghij';
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      const oauthCode = await db.createOAuthCode({
        userId: 'usr-std-01',
        clientId,
        redirectUri: testRedirectUri,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });

      return { oauthCode, codeVerifier };
    };

    it('1. Correct configured client secret is accepted with valid PKCE', async () => {
      const syntheticSecret = 'synthetic_secure_moodle_client_secret_2026_alpha';
      process.env.OAUTH_CLIENT_SECRET = syntheticSecret;

      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      const req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          client_id: 'zealosh-moodle',
          client_secret: syntheticSecret,
          code_verifier: codeVerifier,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.access_token).toBeDefined();
      expect(data.id_token).toBeDefined();
      expect(data.token_type).toBe('Bearer');
    });

    it('2. Incorrect client secret is rejected with HTTP 401 invalid_client', async () => {
      const syntheticSecret = 'synthetic_secure_moodle_client_secret_2026_alpha';
      process.env.OAUTH_CLIENT_SECRET = syntheticSecret;

      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      const req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          client_id: 'zealosh-moodle',
          client_secret: 'incorrect_attacker_secret_beta',
          code_verifier: codeVerifier,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toContain('Basic');

      const data = await res.json();
      expect(data.error).toBe('invalid_client');
      expect(data.error_description).toContain('Client authentication failed');
    });

    it('3. Missing client secret is rejected when the client is configured to require one', async () => {
      const syntheticSecret = 'synthetic_secure_moodle_client_secret_2026_alpha';
      process.env.OAUTH_CLIENT_SECRET = syntheticSecret;

      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      // Request completely omits client_secret
      const req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          client_id: 'zealosh-moodle',
          code_verifier: codeVerifier,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error).toBe('invalid_client');
      expect(data.error_description).toContain('Client authentication required');
    });

    it('4. HTTP Basic authentication is parsed correctly if supported', async () => {
      const syntheticSecret = 'synthetic_secure_moodle_client_secret_2026_alpha';
      process.env.OAUTH_CLIENT_SECRET = syntheticSecret;

      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      const basicCredentials = Buffer.from(`zealosh-moodle:${syntheticSecret}`).toString('base64');
      const formParams = new URLSearchParams({
        code: oauthCode.code,
        grant_type: 'authorization_code',
        redirect_uri: testRedirectUri,
        code_verifier: codeVerifier,
      });

      const req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicCredentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formParams.toString(),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.access_token).toBeDefined();
      expect(data.id_token).toBeDefined();
    });

    it('5. Existing valid PKCE behavior remains accepted when client secret is unconfigured', async () => {
      delete process.env.OAUTH_CLIENT_SECRET;

      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      const req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          client_id: 'zealosh-moodle',
          code_verifier: codeVerifier,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.access_token).toBeDefined();
    });

    it('6. Invalid PKCE is still rejected even when client secret is completely valid', async () => {
      const syntheticSecret = 'synthetic_secure_moodle_client_secret_2026_alpha';
      process.env.OAUTH_CLIENT_SECRET = syntheticSecret;

      const { oauthCode } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      const req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          client_id: 'zealosh-moodle',
          client_secret: syntheticSecret,
          code_verifier: 'tampered_invalid_pkce_verifier_token',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toBe('invalid_grant');
      expect(data.error_description).toContain('PKCE');
    });

    it('7. JWT_SECRET is never used as a fallback client secret', async () => {
      const syntheticSecret = 'synthetic_secure_moodle_client_secret_2026_alpha';
      process.env.OAUTH_CLIENT_SECRET = syntheticSecret;
      process.env.JWT_SECRET = 'internal_signing_jwt_secret_only_never_client_secret';

      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      // Attempting to authenticate using JWT_SECRET as client_secret must be strictly rejected
      const req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          client_id: 'zealosh-moodle',
          client_secret: process.env.JWT_SECRET,
          code_verifier: codeVerifier,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error).toBe('invalid_client');
      expect(data.error_description).toContain('Client authentication failed');
    });

    it('8. Unconfigured client-secret mode preserves the explicitly intended compatibility behavior', async () => {
      process.env.OAUTH_CLIENT_SECRET = ''; // explicitly empty/unconfigured

      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      const formParams = new URLSearchParams({
        code: oauthCode.code,
        grant_type: 'authorization_code',
        redirect_uri: testRedirectUri,
        client_id: 'zealosh-moodle',
        code_verifier: codeVerifier,
      });

      const createTokenReq = () =>
        new Request('http://localhost:3000/api/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams.toString(),
        });

      const res = await POST(createTokenReq());
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.access_token).toBeDefined();
      expect(data.token_type).toBe('Bearer');

      // Code must be atomically marked used (replay attempt fails with invalid_grant)
      const replayed = await POST(createTokenReq());
      expect(replayed.status).toBe(400);
      const replayData = await replayed.json();
      expect(replayData.error).toBe('invalid_grant');
      expect(replayData.error_description).toContain('Replay detected');
    });

    it('9. Malformed authentication is rejected safely', async () => {
      const syntheticSecret = 'synthetic_secure_moodle_client_secret_2026_alpha';
      process.env.OAUTH_CLIENT_SECRET = syntheticSecret;
      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      // 9a. Corrupted base64 in Authorization header
      const badBase64Req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic !!!not-valid-base64???',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          code_verifier: codeVerifier,
        }),
      });
      const badBase64Res = await POST(badBase64Req);
      expect(badBase64Res.status).toBe(401);
      const badBase64Data = await badBase64Res.json();
      expect(badBase64Data.error).toBe('invalid_client');

      // 9b. Missing colon in decoded HTTP Basic credentials
      const noColonBase64 = Buffer.from('zealosh-moodle-without-colon').toString('base64');
      const badColonReq = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${noColonBase64}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          code_verifier: codeVerifier,
        }),
      });
      const badColonRes = await POST(badColonReq);
      expect(badColonRes.status).toBe(401);
      const badColonData = await badColonRes.json();
      expect(badColonData.error).toBe('invalid_client');

      // 9c. Multiple authentication methods (Basic header AND body client_secret)
      const multiAuthBase64 = Buffer.from(`zealosh-moodle:${syntheticSecret}`).toString('base64');
      const multiAuthReq = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${multiAuthBase64}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          client_secret: syntheticSecret,
          code_verifier: codeVerifier,
        }),
      });
      const multiAuthRes = await POST(multiAuthReq);
      expect(multiAuthRes.status).toBe(401);
      const multiAuthData = await multiAuthRes.json();
      expect(multiAuthData.error).toBe('invalid_client');

      // 9d. Unsupported auth header scheme (Bearer on token endpoint)
      const unsupportedSchemeReq = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer some_unsupported_token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          code_verifier: codeVerifier,
        }),
      });
      const unsupportedSchemeRes = await POST(unsupportedSchemeReq);
      expect(unsupportedSchemeRes.status).toBe(401);
      const unsupportedSchemeData = await unsupportedSchemeRes.json();
      expect(unsupportedSchemeData.error).toBe('invalid_client');
    });

    it('10. Secret values never appear in error bodies or logs', async () => {
      const sensitiveConfiguredSecret = 'super_secret_canary_value_configured_987654';
      const sensitiveAttemptedSecret = 'super_secret_canary_value_attempted_123456';
      process.env.OAUTH_CLIENT_SECRET = sensitiveConfiguredSecret;
      process.env.JWT_SECRET = 'super_secret_canary_jwt_signing_key_456789';

      const { oauthCode, codeVerifier } = await createTestCodeWithPkce();
      const { POST } = await import('@/app/api/oauth/token/route');

      const req = new Request('http://localhost:3000/api/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: oauthCode.code,
          grant_type: 'authorization_code',
          redirect_uri: testRedirectUri,
          client_id: 'zealosh-moodle',
          client_secret: sensitiveAttemptedSecret,
          code_verifier: codeVerifier,
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);

      const rawResponseBody = await res.text();

      // Zero secret exposure in response bodies
      expect(rawResponseBody).not.toContain(sensitiveConfiguredSecret);
      expect(rawResponseBody).not.toContain(sensitiveAttemptedSecret);
      expect(rawResponseBody).not.toContain(process.env.JWT_SECRET);
    });
  });
});
