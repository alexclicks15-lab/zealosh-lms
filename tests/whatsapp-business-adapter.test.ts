// tests/whatsapp-business-adapter.test.ts
// Vitest suite for Meta WhatsApp Business API Adapter & Webhook Verification

import { describe, it, expect, beforeEach } from 'vitest';
import { createHmac } from 'crypto';
import { WhatsAppBusinessAdapter } from '@/lib/adapters/whatsapp-adapter';
import { db } from '@/lib/store/db';

describe('Meta WhatsApp Business API (WABA) Adapter', () => {
  const testSecret = 'waba_test_secret_key_12345';
  const testVerifyToken = 'waba_challenge_verify_token_secure';
  const testPhoneId = '109876543210987';
  const testAccessToken = 'EAABtesting_token_valid';

  let adapter: WhatsAppBusinessAdapter;

  beforeEach(() => {
    (db as any).whatsappOptIns?.clear();
    (db as any).whatsappMessageLogs?.clear();

    adapter = new WhatsAppBusinessAdapter({
      phoneNumberId: testPhoneId,
      accessToken: testAccessToken,
      appSecret: testSecret,
      verifyToken: testVerifyToken,
      apiVersion: 'v20.0',
    });
  });

  it('correctly reports configuration status based on provided credentials', () => {
    expect(adapter.isConfigured()).toBe(true);

    const emptyAdapter = new WhatsAppBusinessAdapter({
      phoneNumberId: '',
      accessToken: '',
      appSecret: '',
    });
    expect(emptyAdapter.isConfigured()).toBe(false);
  });

  it('validates Meta webhook challenge handshake on subscription request', () => {
    const validChallenge = adapter.verifyWebhookChallenge(
      'subscribe',
      testVerifyToken,
      '1155993322'
    );
    expect(validChallenge).toBe('1155993322');

    const invalidToken = adapter.verifyWebhookChallenge(
      'subscribe',
      'wrong-verify-token',
      '1155993322'
    );
    expect(invalidToken).toBeNull();

    const invalidMode = adapter.verifyWebhookChallenge(
      'unsubscribe',
      testVerifyToken,
      '1155993322'
    );
    expect(invalidMode).toBeNull();
  });

  it('verifies X-Hub-Signature-256 HMAC-SHA256 signatures cryptographically', () => {
    const rawPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [{ id: testPhoneId, changes: [] }],
    });

    const validHmac = createHmac('sha256', testSecret)
      .update(rawPayload, 'utf8')
      .digest('hex');

    const signatureHeader = `sha256=${validHmac}`;

    expect(adapter.verifySignature(rawPayload, signatureHeader)).toBe(true);
    expect(adapter.verifySignature(rawPayload, 'sha256=invalidtamperedhash')).toBe(false);
    expect(adapter.verifySignature(rawPayload, null)).toBe(false);
  });

  it('manages user opt-in/opt-out status and prevents messaging opted-out numbers', async () => {
    const phone = '+919876543210';
    const userId = `usr-wa-${Date.now()}`;

    // Explicit opt-out
    await adapter.setOptInStatus(phone, false, 'STUDENT_PORTAL', userId);
    const optIn = await adapter.getOptInStatus(phone);
    expect(optIn?.optedIn).toBe(false);

    // Attempting to send message should be blocked
    const sendResult = await adapter.sendTemplateMessage({
      phoneNumber: phone,
      templateName: 'class_reminder',
      userId,
    });

    expect(sendResult.success).toBe(false);
    expect(sendResult.status).toBe('FAILED');
    expect(sendResult.error).toContain('OPTED_OUT');

    // User opts in
    await adapter.setOptInStatus(phone, true, 'ENROLLMENT_CHECKOUT', userId);
    const updatedOptIn = await adapter.getOptInStatus(phone);
    expect(updatedOptIn?.optedIn).toBe(true);
  });

  it('processes inbound opt-out keyword "STOP" automatically via webhook', async () => {
    const phone = '919876543210';
    const rawPayload = JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: testPhoneId,
          changes: [
            {
              field: 'messages',
              value: {
                messages: [
                  {
                    from: phone,
                    id: 'wamid.HBgLMTIzNDU2Nzg5MA==',
                    timestamp: '1762700000',
                    text: { body: 'STOP' },
                    type: 'text',
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    const validHmac = createHmac('sha256', testSecret)
      .update(rawPayload, 'utf8')
      .digest('hex');

    const result = await adapter.processInboundWebhook(rawPayload, `sha256=${validHmac}`);
    expect(result.processed).toBe(true);

    const optIn = await adapter.getOptInStatus(`+${phone}`);
    expect(optIn?.optedIn).toBe(false);
    expect(optIn?.optInSource).toBe('WHATSAPP_INBOUND_KEYWORD');
  });

  it('logs outbound template messages honestly without fake simulated success', async () => {
    const unconfigured = new WhatsAppBusinessAdapter({
      phoneNumberId: '',
      accessToken: '',
      appSecret: '',
    });

    const phone = '+919988776655';
    await unconfigured.setOptInStatus(phone, true, 'TEST');

    const result = await unconfigured.sendTemplateMessage({
      phoneNumber: phone,
      templateName: 'exam_scheduled',
      parameters: [{ type: 'text', text: 'NEBOSH IGC 1' }],
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('QUEUED');
    expect(result.error).toContain('PROVIDER_UNCONFIGURED');

    const logs = await unconfigured.getMessageLogs(phone);
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('QUEUED');
  });
});

