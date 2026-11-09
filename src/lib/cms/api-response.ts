// Zealosh LMS — CMS API Error & Response Mapper
// Maps DatabasePersistenceError and domain errors to structured Next.js HTTP responses

import { NextResponse } from 'next/server';
import { DatabasePersistenceError } from '@/lib/store/db';

export function handleCmsApiError(
  error: unknown,
  fallbackMessage: string = 'Internal server error'
): NextResponse {
  if (error instanceof DatabasePersistenceError) {
    let status = 500;
    if (error.category === 'DATABASE_UNAVAILABLE' || error.category === 'CONNECTION_TIMEOUT') {
      status = 503;
    } else if (error.category === 'PERMISSION_DENIED') {
      status = 403;
    } else if (error.category === 'CONCURRENCY_CONFLICT') {
      status = 409;
    } else if (error.category === 'CONSTRAINT_VIOLATION') {
      status = 400;
    }

    return NextResponse.json(
      {
        error: error.message,
        category: error.category,
        retryable: error.retryable,
      },
      { status }
    );
  }

  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('Conflict:')) {
    return NextResponse.json({ error: msg }, { status: 409 });
  }
  if (
    msg.includes('Forbidden') ||
    msg.includes('Insufficient') ||
    msg.includes('Self-approval forbidden')
  ) {
    return NextResponse.json({ error: msg }, { status: 403 });
  }
  if (msg.includes('not found') || msg.includes('Not found')) {
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  return NextResponse.json({ error: msg || fallbackMessage }, { status: 400 });
}

