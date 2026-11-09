import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { eventOutboxService } from '@/lib/events/event-outbox-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceDomain = searchParams.get('sourceDomain') || undefined;
    const eventType = searchParams.get('eventType') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const records = await db.getEventOutboxRecords({
      sourceDomain,
      eventType,
      status,
      limit,
    });

    return NextResponse.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await eventOutboxService.publishEvent(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, envelope: result.envelope, deliveriesCount: result.deliveriesCount }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

