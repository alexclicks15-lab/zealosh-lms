import { NextResponse } from 'next/server';
import { getCanonicalBaseUrl } from '@/lib/auth/oauth-helpers';

export async function GET(request: Request) {
  // Canonical base URL resolution strictly validates against configured environment
  // and ignores arbitrary client-supplied forwarded host headers
  const baseUrl = getCanonicalBaseUrl(request);

  const configuration = {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    userinfo_endpoint: `${baseUrl}/api/oauth/userinfo`,
    jwks_uri: `${baseUrl}/api/oauth/jwks`,
    response_types_supported: ['code', 'token', 'id_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256', 'RS256'],
    scopes_supported: ['openid', 'profile', 'email'],
    token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
    claims_supported: ['sub', 'iss', 'name', 'email', 'preferred_username', 'role', 'email_verified'],
  };

  return NextResponse.json(configuration, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
