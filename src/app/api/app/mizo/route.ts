import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { mizoAgentTurn } from '@/lib/agents/mizo-agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const message = String(body.message || '').trim();
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }

  try {
    const result = await mizoAgentTurn(user.id, message, history);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('MIZO error:', e);
    return NextResponse.json({ error: e.message || 'MIZO encountered an error.' }, { status: 500 });
  }
}
