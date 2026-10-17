import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import { parseUSDC } from '@/lib/arc-config';

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
    const { txHash, amount, senderAddress } = await req.json();

    if (!txHash || !amount) {
      return NextResponse.json(
        { error: 'Transaction hash and funded amount are required.' },
        { status: 400 }
      );
    }

    const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id) as any;
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const fundedAmountBase = parseUSDC(amount.toString());
    const existingFundedBase = BigInt(contract.funded_amount || '0');
    const newTotalFundedBase = existingFundedBase + fundedAmountBase;
    const totalAmountBase = BigInt(contract.total_amount || '0');

    const newStatus = newTotalFundedBase >= totalAmountBase ? 'ACTIVE' : 'AWAITING_FUNDING';
    const now = Date.now();

    const updateTx = db.transaction(() => {
      // Update contract funded amount
      db.prepare(`
        UPDATE contracts
        SET funded_amount = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(newTotalFundedBase.toString(), newStatus, now, id);

      // Update milestone status to FUNDED sequentially
      let remainingFunding = newTotalFundedBase;
      const milestones = db.prepare(`
        SELECT id, amount, status FROM milestones
        WHERE contract_id = ?
        ORDER BY order_index ASC
      `).all(id) as any[];

      for (const m of milestones) {
        const mAmount = BigInt(m.amount);
        if (remainingFunding >= mAmount && m.status === 'PENDING') {
          db.prepare('UPDATE milestones SET status = ?, funded_amount = ?, updated_at = ? WHERE id = ?')
            .run('FUNDED', m.amount, now, m.id);
        }
        if (remainingFunding >= mAmount) {
          remainingFunding -= mAmount;
        } else {
          remainingFunding = BigInt(0);
        }
      }

      // Record transaction
      db.prepare(`
        INSERT INTO transactions (
          id, contract_id, tx_hash, tx_type, amount,
          sender, recipient, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        id,
        txHash,
        'FUND',
        fundedAmountBase.toString(),
        senderAddress || user.wallet_address || contract.client_address,
        contract.escrow_contract_address || contract.client_address,
        'CONFIRMED',
        now
      );

      // Audit event
      db.prepare(`
        INSERT INTO audit_events (
          id, entity_type, entity_id, actor_id, action, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        'CONTRACT',
        id,
        user.id,
        'FUND',
        JSON.stringify({ txHash, amount: fundedAmountBase.toString(), newStatus }),
        now
      );
    });

    updateTx();

    return NextResponse.json({
      success: true,
      fundedAmount: newTotalFundedBase.toString(),
      status: newStatus,
    });
  } catch (error: any) {
    console.error('Fund error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
