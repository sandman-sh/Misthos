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

    const transactions = db.prepare(`
      SELECT t.*, c.title as contract_title, m.title as milestone_title
      FROM transactions t
      LEFT JOIN contracts c ON t.contract_id = c.id
      LEFT JOIN milestones m ON t.milestone_id = m.id
      WHERE (c.client_id = ? OR c.contractor_id = ?)
      ORDER BY t.created_at DESC
    `).all(user.id, user.id) as any[];

    return NextResponse.json({ transactions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
