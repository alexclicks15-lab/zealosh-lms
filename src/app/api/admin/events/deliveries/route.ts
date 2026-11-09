import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (eventId) {
      const deliveries = await db.getDeliveriesByEventId(eventId);
      return NextResponse.json({ success: true, count: deliveries.length, deliveries });
    }

    const allDeliveries = Array.from(db.eventDeliveries.values());
    return NextResponse.json({ success: true, count: allDeliveries.length, deliveries: allDeliveries });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

