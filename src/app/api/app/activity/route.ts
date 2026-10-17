import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const events = db.prepare(`
      SELECT a.*, u.name as actor_name
      FROM audit_events a
      LEFT JOIN users u ON a.actor_id = u.id
      ORDER BY a.timestamp DESC
      LIMIT 50
    `).all() as any[];

    const parsedEvents = events.map((e) => ({
      ...e,
      metadata: e.metadata ? JSON.parse(e.metadata) : null,
    }));

    return NextResponse.json({ events: parsedEvents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
