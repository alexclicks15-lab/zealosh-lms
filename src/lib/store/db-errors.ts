// Zealosh LMS — Database Persistence Errors & Failure Classifications

export type DatabaseFailureCategory =
  | 'DATABASE_UNAVAILABLE'
  | 'CONNECTION_TIMEOUT'
  | 'CONFIGURATION_ERROR'
  | 'PERMISSION_DENIED'
  | 'CONSTRAINT_VIOLATION'
  | 'CONCURRENCY_CONFLICT'
  | 'PERSISTENCE_FAILED'
  | 'SCHEMA_MISSING';

export class DatabasePersistenceError extends Error {
  public readonly operation: string;
  public readonly entityType: string;
  public readonly category: DatabaseFailureCategory;
  public readonly retryable: boolean;
  public readonly cause?: unknown;

  constructor(
    message: string,
    params: {
      operation: string;
      entityType: string;
      category?: DatabaseFailureCategory;
      retryable?: boolean;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = 'DatabasePersistenceError';
    this.operation = params.operation;
    this.entityType = params.entityType;
    this.category = params.category || 'PERSISTENCE_FAILED';
    this.retryable = params.retryable ?? false;
    this.cause = params.cause;
  }
}

export function classifyDatabaseError(error: unknown): { category: DatabaseFailureCategory; retryable: boolean } {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (
    (msg.includes('relation') && (msg.includes('does not exist') || msg.includes('undefined table'))) ||
    msg.includes('42p01') ||
    msg.includes('pgrst205') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('missing table')
  ) {
    return { category: 'SCHEMA_MISSING', retryable: false };
  }

  if (
    msg.includes('fetch failed') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('network') ||
    msg.includes('connection') ||
    msg.includes('timeout')
  ) {
    return { category: 'DATABASE_UNAVAILABLE', retryable: true };
  }
  if (
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('rls') ||
    msg.includes('jwt') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('insufficient_privilege')
  ) {
    return { category: 'PERMISSION_DENIED', retryable: false };
  }
  if (
    msg.includes('violates foreign key') ||
    msg.includes('violates check constraint') ||
    msg.includes('violates unique constraint') ||
    msg.includes('duplicate key') ||
    msg.includes('chk_') ||
    msg.includes('fk_')
  ) {
    return { category: 'CONSTRAINT_VIOLATION', retryable: false };
  }
  if (
    msg.includes('conflict') ||
    msg.includes('serialization') ||
    msg.includes('deadlock') ||
    msg.includes('could not serialize access')
  ) {
    return { category: 'CONCURRENCY_CONFLICT', retryable: true };
  }
  return { category: 'PERSISTENCE_FAILED', retryable: false };
}

