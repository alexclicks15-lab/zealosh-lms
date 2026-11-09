import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * OpenID Connect JSON Web Key Set (JWKS) Endpoint (RFC 7517)
 * GET /api/oauth/jwks
 *
 * Exposes public keys used by the OpenID Provider.
 * When tokens are signed with symmetric HMAC (HS256), the keys array
 * is published as empty in compliance with RFC 7517 security requirements
 * (symmetric secrets must never be exposed over JWKS endpoints).
 */
export async function GET() {
  return NextResponse.json(
    { keys: [] },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

