import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { UserRole } from '@/types';

function getUserFromRequest(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: Request) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (userPayload.role !== 'SUPER_ADMIN' && userPayload.role !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Administrator privileges required for refunds' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { orderId, reason, gatewayRefundId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'A meaningful refund reason is required' }, { status: 400 });
    }

    // Process refund with real actor identity derived from verified authentication context
    const result = await db.processRefund(
      orderId,
      reason.trim(),
      userPayload.email,
      userPayload.userId,
      userPayload.role as UserRole,
      gatewayRefundId
    );

    return NextResponse.json({
      success: true,
      orderId: result.order.id,
      status: result.order.status,
      refundReason: result.order.refundReason,
      gatewayRefundId: result.order.gatewayRefundId,
      invoiceId: result.invoice.id,
      invoiceNumber: result.invoice.invoiceNumber,
      invoiceStatus: result.invoice.status,
    });
  } catch (err: any) {
    const status = err.message.includes('not found') || err.message.includes('ORDER_NOT_FOUND')
      ? 404
      : err.message.includes('INVALID_REFUND_STATE') ||
        err.message.includes('ALREADY_REFUNDED') ||
        err.message.includes('already been refunded') ||
        err.message.includes('INVALID_REFUND_REASON') ||
        err.message.includes('INVALID_ACTOR') ||
        err.message.includes('state')
      ? 400
      : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
