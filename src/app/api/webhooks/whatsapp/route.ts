import { NextResponse } from 'next/server';
import { whatsappAdapter } from '@/lib/adapters/whatsapp-adapter';

/**
 * GET: Meta Webhook Verification Challenge
 * Responds to Meta verification handshake when setting up webhook subscription
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode') || undefined;
    const token = searchParams.get('hub.verify_token') || undefined;
    const challenge = searchParams.get('hub.challenge') || undefined;

    const verifiedChallenge = whatsappAdapter.verifyWebhookChallenge(mode, token, challenge);
    if (verifiedChallenge) {
      return new NextResponse(verifiedChallenge, { status: 200 });
    }

    return new NextResponse('Forbidden: Webhook verification failed', { status: 403 });
  } catch (error: any) {
    return new NextResponse(error.message || 'Webhook verification error', { status: 500 });
  }
}

/**
 * POST: Meta Inbound Messages & Delivery Receipts
 * Enforces X-Hub-Signature-256 HMAC cryptographic verification
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    // If appSecret is configured in environment, enforce strict HMAC signature verification
    if (process.env.META_WABA_APP_SECRET) {
      const isValid = whatsappAdapter.verifySignature(rawBody, signature);
      if (!isValid) {
        return NextResponse.json({ error: 'Unauthorized: Invalid X-Hub-Signature-256' }, { status: 401 });
      }
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const result = await whatsappAdapter.handleWebhookEvent(payload);
    return NextResponse.json({
      success: true,
      processedCount: result.processedCount,
      optOutDetected: result.optOutDetected,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Webhook processing failed' }, { status: 500 });
  }
}

