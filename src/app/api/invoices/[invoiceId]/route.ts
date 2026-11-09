import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

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

export async function GET(
  request: Request,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const invoice = await db.getInvoice(params.invoiceId);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const isPrivileged = userPayload.role === 'SUPER_ADMIN' || userPayload.role === 'ORG_ADMIN';
    if (!isPrivileged && invoice.userId !== userPayload.userId) {
      return NextResponse.json({ error: 'Forbidden: Access to this invoice is restricted' }, { status: 403 });
    }

    const creditNotes = await db.getCreditNotes(invoice.id);
    const creditNote = creditNotes.length > 0 ? creditNotes[0] : (invoice.creditNoteId ? await db.getCreditNote(invoice.creditNoteId) : null);
    return NextResponse.json({
      invoice,
      creditNote: creditNote || null,
      creditNotes: creditNotes || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
