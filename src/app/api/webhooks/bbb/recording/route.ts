// Zealosh LMS — BigBlueButton Recording Webhook Route
// POST /api/webhooks/bbb/recording — Authenticates and ingests BBB recording notifications
// Supports both:
// 1. Official BigBlueButton Recording-Ready Callbacks (meta_bbb-recording-ready-url HS256 signed_parameters JWT)
// 2. Official bbb-webhooks Event Callbacks (?checksum= HASH(callbackUrl + rawBody + salt))
// 3. Documented API Gateway / Proxy Headers (Authorization: Bearer, X-BBB-Signature: sha256)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { classroomProvider, ClassroomRecordingMetadata } from '@/lib/classroom';
import {
  recordingIngestionService,
  IngestRecordingPayload,
} from '@/lib/storage/recording-ingestion-service';

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    const { searchParams } = new URL(request.url);
    const contentType = request.headers.get('content-type') || '';
    const isFormUrlEncoded =
      contentType.includes('application/x-www-form-urlencoded') ||
      rawBody.startsWith('signed_parameters=') ||
      rawBody.startsWith('event=');

    let formParams: URLSearchParams | null = null;
    if (isFormUrlEncoded) {
      try {
        formParams = new URLSearchParams(rawBody);
      } catch {}
    }

    const signedParameters = formParams?.get('signed_parameters');

    // ==========================================================================
    // MECHANISM B: BigBlueButton Recording-Ready URL Callback (signed_parameters JWT)
    // Documented in official BBB API: meta_bbb-recording-ready-url
    // ==========================================================================
    if (signedParameters !== null && signedParameters !== undefined) {
      // Conflicting Credentials Check:
      // If client also passed an authorization header, signature header, or checksum parameter, check for conflicting credentials
      const authHeader = request.headers.get('authorization');
      const sigHeader =
        request.headers.get('x-bbb-signature') || request.headers.get('x-zealosh-signature');
      const checksumParam = searchParams.get('checksum');

      if (authHeader || sigHeader || checksumParam) {
        const secondaryAuth = recordingIngestionService.verifyWebhookAuth(
          request.headers,
          rawBody,
          searchParams,
          request.url
        );
        if (!secondaryAuth.authenticated) {
          return NextResponse.json(
            { error: 'Unauthorized: Conflicting invalid authentication credentials' },
            { status: 401 }
          );
        }
      }

      // Verify HS256 signed_parameters JWT
      const jwtResult = recordingIngestionService.verifyRecordingReadyJwt(signedParameters);
      if (!jwtResult.valid || !jwtResult.payload) {
        return NextResponse.json(
          { error: jwtResult.error || 'Unauthorized: Invalid signed_parameters JWT' },
          { status: jwtResult.statusCode || 401 }
        );
      }

      const { meeting_id, record_id } = jwtResult.payload;

      // Validate meeting_id against trusted internal LiveSession
      const session = await db.getLiveSessionByMeetingId(meeting_id);
      if (!session) {
        // Return HTTP 410 Gone / 404 per BigBlueButton documentation for unknown or deleted meeting
        return NextResponse.json(
          { error: `No internal LiveSession found for meeting ID: ${meeting_id}` },
          { status: 410 }
        );
      }

      // Query classroom provider for authoritative recording metadata
      let upstreamRecording: ClassroomRecordingMetadata | undefined;
      try {
        const recordings = await classroomProvider.getRecordings({
          meetingId: meeting_id,
          recordId: record_id,
        });
        upstreamRecording = recordings.find(
          (r) => r.recordId === record_id
        );
      } catch (err: any) {
        upstreamRecording = undefined;
      }

      // Construct authoritative ingestion payload
      // SECURITY INVARIANT: Course ID, Batch ID, and Session ID are derived SOLELY from trusted internal session
      const isPublished = Boolean(
        upstreamRecording?.published || upstreamRecording?.state === 'published'
      );
      const playbackUrl = upstreamRecording?.playbackUrl || undefined;

      const ingestPayload: IngestRecordingPayload = {
        recordId: record_id,
        recordID: record_id,
        meetingId: meeting_id,
        meetingID: meeting_id,
        sessionId: session.id,
        courseId: session.courseId,
        batchId: session.batchId,
        name: upstreamRecording?.name || session.title,
        state: upstreamRecording?.state || (isPublished && playbackUrl ? 'published' : 'processing'),
        published: isPublished,
        playbackUrl: playbackUrl,
        durationSeconds: upstreamRecording?.durationSeconds,
        length: upstreamRecording?.lengthMinutes,
        startTime: upstreamRecording?.startTime,
        endTime: upstreamRecording?.endTime,
        metadata: {
          sessionId: session.id,
          courseId: session.courseId,
          batchId: session.batchId,
        },
      };

      const result = await recordingIngestionService.ingestRecording(ingestPayload, {
        source: 'RECORDING_READY_CALLBACK',
      });

      if (result.status === 'REJECTED' || result.status === 'FAILED') {
        return NextResponse.json(
          { success: false, status: result.status, error: result.error || result.message },
          { status: result.statusCode || 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          status: result.status,
          action: result.action,
          recordingId: result.recordingId,
          sessionId: result.sessionId,
          courseId: result.courseId,
          batchId: result.batchId,
          recordingStatus: result.recordingStatus,
          result,
        },
        { status: 200 }
      );
    }

    // ==========================================================================
    // MECHANISM A & C: bbb-webhooks & Gateway Header Authentication
    // ==========================================================================
    // 1. Verify Cryptographic Authenticity against Documented BBB Webhook & Gateway Contracts
    const authResult = recordingIngestionService.verifyWebhookAuth(
      request.headers,
      rawBody,
      searchParams,
      request.url
    );

    if (!authResult.authenticated) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized: Invalid BigBlueButton signature or token' },
        { status: 401 }
      );
    }

    // 2. Parse Payload (supports standard bbb-webhooks form-urlencoded, standard event arrays, and JSON)
    let payload: any;

    if (isFormUrlEncoded) {
      const eventStr = formParams?.get('event');
      if (!eventStr) {
        return NextResponse.json(
          { error: 'Malformed form-encoded payload: missing event parameter' },
          { status: 400 }
        );
      }
      try {
        payload = JSON.parse(eventStr);
      } catch {
        return NextResponse.json(
          { error: 'Invalid form-encoded JSON payload' },
          { status: 400 }
        );
      }
    } else {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
      }
    }

    // 3. Process Authoritative Ingestion
    const result = await recordingIngestionService.ingestRecording(payload, {
      source: 'WEBHOOK_DELIVERY',
    });

    if (result.status === 'REJECTED' || result.status === 'FAILED') {
      return NextResponse.json(
        {
          success: false,
          status: result.status,
          error: result.error || result.message || result.reason,
          message: result.message || result.error,
          result,
        },
        { status: result.statusCode || (result.status === 'REJECTED' ? 400 : 500) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: result.status,
        action: result.action,
        recordingId: result.recordingId,
        sessionId: result.sessionId,
        courseId: result.courseId,
        batchId: result.batchId,
        recordingStatus: result.recordingStatus,
        result,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Internal error processing recording webhook' },
      { status: 500 }
    );
  }
}
