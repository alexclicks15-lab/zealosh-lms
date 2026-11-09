// Zealosh LMS — Phase 5B Email Provider Adapter Contract
// Architecture: ADR-004 compliant provider boundary with explicit configuration gate
// Live sending is blocked with EMAIL_PROVIDER_UNCONFIGURED until institutional approval

export interface EmailSendParams {
  to: string;
  toName?: string;
  from?: string;
  fromName?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export type EmailSendStatus = 'SENT' | 'FAILED' | 'SUPPRESSED' | 'UNCONFIGURED';

export type EmailErrorClassification =
  | 'TRANSIENT_NETWORK'
  | 'RATE_LIMIT'
  | 'INVALID_RECIPIENT'
  | 'AUTH_FAILURE'
  | 'PERMANENT_REJECTION'
  | 'SUPPRESSED'
  | 'UNCONFIGURED';

export interface EmailSendResult {
  success: boolean;
  provider: string;
  status: EmailSendStatus;
  providerMessageId?: string;
  error?: string;
  errorClassification?: EmailErrorClassification;
  isRetryable?: boolean;
}

export interface EmailProviderAdapter {
  readonly name: string;
  isConfigured(): boolean;
  sendEmail(params: EmailSendParams): Promise<EmailSendResult>;
}

/**
 * Default Unconfigured Provider Adapter
 * Safeguards institutional safety: rejects live dispatch with explicit status
 */
export class UnconfiguredEmailProviderAdapter implements EmailProviderAdapter {
  public readonly name = 'unconfigured';

  public isConfigured(): boolean {
    return false;
  }

  public async sendEmail(params: EmailSendParams): Promise<EmailSendResult> {
    return {
      success: false,
      provider: this.name,
      status: 'UNCONFIGURED',
      error: 'EMAIL_PROVIDER_UNCONFIGURED: No approved email delivery provider configured for live dispatch.',
      errorClassification: 'UNCONFIGURED',
      isRetryable: false,
    };
  }
}

/**
 * Mock / Sandbox Email Provider Adapter
 * Used exclusively for automated unit and integration test fixtures
 */
export class MockEmailProviderAdapter implements EmailProviderAdapter {
  public readonly name = 'mock';
  public sentMails: Array<EmailSendParams & { id: string; timestamp: string }> = [];
  public shouldFail: boolean = false;
  public failureClassification: EmailErrorClassification = 'TRANSIENT_NETWORK';
  public failureMessage: string = 'Simulated transient connection failure';

  public isConfigured(): boolean {
    return true;
  }

  public async sendEmail(params: EmailSendParams): Promise<EmailSendResult> {
    if (this.shouldFail) {
      return {
        success: false,
        provider: this.name,
        status: 'FAILED',
        error: this.failureMessage,
        errorClassification: this.failureClassification,
        isRetryable: this.failureClassification === 'TRANSIENT_NETWORK' || this.failureClassification === 'RATE_LIMIT',
      };
    }

    const providerMessageId = `mock-msg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    this.sentMails.push({
      ...params,
      id: providerMessageId,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      provider: this.name,
      status: 'SENT',
      providerMessageId,
    };
  }

  public setFailure(
    shouldFail: boolean,
    classification: EmailErrorClassification = 'TRANSIENT_NETWORK',
    message: string = 'Simulated transient connection failure'
  ): void {
    this.shouldFail = shouldFail;
    this.failureClassification = classification;
    this.failureMessage = message;
  }

  public clear(): void {
    this.sentMails = [];
    this.shouldFail = false;
  }
}

// Global mock instance for testing
export const mockEmailAdapter = new MockEmailProviderAdapter();

/**
 * Resolves the configured email provider adapter based on environment variables
 */
export function getEmailProviderAdapter(): EmailProviderAdapter {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();

  if (provider === 'mock') {
    return mockEmailAdapter;
  }

  // Future providers (e.g. 'resend', 'sendgrid', 'smtp') will be resolved here
  // when approved credentials and sender verification are provided.

  return new UnconfiguredEmailProviderAdapter();
}
