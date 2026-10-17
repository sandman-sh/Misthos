import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { txHash, senderAddress } = await req.json();

    if (!txHash) {
      return NextResponse.json({ error: 'Transaction hash is required.' }, { status: 400 });
    }

    const milestone = db.prepare(`
      SELECT m.*, c.id as contract_id, c.client_id, c.contractor_id, c.contractor_address, c.client_address, c.total_amount
      FROM milestones m
      JOIN contracts c ON m.contract_id = c.id
      WHERE m.id = ?
    `).get(id) as any;

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Only the client (payer) may release the milestone settlement.
    const isClient =
      milestone.client_id === user.id ||
      (user.wallet_address &&
        milestone.client_address &&
        milestone.client_address.toLowerCase() === user.wallet_address.toLowerCase());

    if (!isClient) {
      return NextResponse.json(
        { error: 'Only the client can settle this milestone payment.' },
        { status: 403 }
      );
    }

    const now = Date.now();

    const settleTx = db.transaction(() => {
      // Mark milestone as PAID
      db.prepare(`
        UPDATE milestones
        SET status = 'PAID', paid_amount = amount, onchain_tx_hash = ?, updated_at = ?
        WHERE id = ?
      `).run(txHash, now, id);

      // Record transaction
      db.prepare(`
        INSERT INTO transactions (
          id, contract_id, milestone_id, tx_hash, tx_type, amount,
          sender, recipient, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        milestone.contract_id,
        id,
        txHash,
        'MILESTONE_PAYOUT',
        milestone.amount,
        senderAddress || milestone.client_address,
        milestone.contractor_address,
        'CONFIRMED',
        now
      );

      // Check if all milestones are paid for this contract
      const unpaidMilestones = db.prepare(`
        SELECT count(*) as count FROM milestones
        WHERE contract_id = ? AND status != 'PAID'
      `).get(milestone.contract_id) as any;

      const newContractStatus = (unpaidMilestones?.count === 0) ? 'COMPLETED' : 'PARTIALLY_SETTLED';

      db.prepare(`
        UPDATE contracts
        SET status = ?, updated_at = ?
        WHERE id = ?
      `).run(newContractStatus, now, milestone.contract_id);

      // Audit event
      db.prepare(`
        INSERT INTO audit_events (
          id, entity_type, entity_id, actor_id, action, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        'MILESTONE',
        id,
        user.id,
        'SETTLE_PAYOUT',
        JSON.stringify({ txHash, amount: milestone.amount, contractStatus: newContractStatus }),
        now
      );
    });

    settleTx();

    return NextResponse.json({
      success: true,
      milestoneStatus: 'PAID',
      txHash,
    });
  } catch (error: any) {
    console.error('Settle error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
