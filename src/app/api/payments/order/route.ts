import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { PaymentGateway, BillingAddress } from '@/types';

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
      return NextResponse.json({ error: 'Authentication required to initiate payment' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, batchId, offeringId, currency = 'INR', gateway = 'RAZORPAY', billingAddress } = body;

    if (!courseId || !batchId) {
      return NextResponse.json(
        { error: 'Missing required fields: courseId and batchId are required' },
        { status: 400 }
      );
    }

    const targetUserId = (userPayload.role === 'SUPER_ADMIN' || userPayload.role === 'ORG_ADMIN') && body.userId
      ? body.userId
      : userPayload.userId;

    const order = await db.createPaymentOrder({
      userId: targetUserId,
      courseId,
      batchId,
      offeringId,
      currency: currency as 'INR' | 'USD',
      gateway: gateway as PaymentGateway,
      billingAddress: billingAddress as BillingAddress,
    });

    return NextResponse.json(
      {
        success: true,
        order,
        gatewayConfig: {
          keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_zealosh_mock',
          currency: order.currency,
          amount: order.amount,
          name: 'Zealosh Training & Consultants',
          description: `Enrollment Fee — ${courseId}`,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    const status = err.message.includes('Prerequisite') || err.message.includes('capacity') || err.message.includes('cannot accept')
      ? 400
      : err.message.includes('not found')
      ? 404
      : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (orderId) {
      const order = await db.getPaymentOrder(orderId);
      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      if (
        userPayload.role !== 'SUPER_ADMIN' &&
        userPayload.role !== 'ORG_ADMIN' &&
        order.userId !== userPayload.userId
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ order });
    }

    const isPrivileged = userPayload.role === 'SUPER_ADMIN' || userPayload.role === 'ORG_ADMIN';
    const orders = await db.listPaymentOrders(isPrivileged ? undefined : userPayload.userId);

    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
