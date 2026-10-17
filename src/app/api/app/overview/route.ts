import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import { formatUSDC } from '@/lib/arc-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Contracts for this user
    const contracts = db.prepare(`
      SELECT * FROM contracts
      WHERE client_id = ? OR contractor_id = ?
      ORDER BY created_at DESC
    `).all(user.id, user.id) as any[];

    // Calculate totals
    let totalFundedBase = BigInt(0);
    let totalPaidBase = BigInt(0);
    let activeContractsCount = 0;

    for (const c of contracts) {
      if (c.status !== 'CANCELLED') {
        totalFundedBase += BigInt(c.funded_amount || '0');
      }
      if (['ACTIVE', 'VERIFICATION_PENDING', 'AWAITING_FUNDING'].includes(c.status)) {
        activeContractsCount++;
      }
    }

    // Query paid milestones
    const paidMilestones = db.prepare(`
      SELECT m.paid_amount
      FROM milestones m
      JOIN contracts c ON m.contract_id = c.id
      WHERE (c.client_id = ? OR c.contractor_id = ?) AND m.status = 'PAID'
    `).all(user.id, user.id) as any[];

    for (const m of paidMilestones) {
      totalPaidBase += BigInt(m.paid_amount || '0');
    }

    const lockedBase = totalFundedBase > totalPaidBase ? totalFundedBase - totalPaidBase : BigInt(0);

    // Pending verification jobs
    const pendingVerifications = db.prepare(`
      SELECT count(*) as count
      FROM submissions s
      JOIN milestones m ON s.milestone_id = m.id
      JOIN contracts c ON m.contract_id = c.id
      WHERE (c.client_id = ? OR c.contractor_id = ?) AND s.status = 'PROCESSING'
    `).get(user.id, user.id) as any;

    // Recent transactions
    const recentTransactions = db.prepare(`
      SELECT t.*, c.title as contract_title
      FROM transactions t
      LEFT JOIN contracts c ON t.contract_id = c.id
      WHERE (c.client_id = ? OR c.contractor_id = ?)
      ORDER BY t.created_at DESC
      LIMIT 5
    `).all(user.id, user.id) as any[];

    // Recent verification reports
    const recentReports = db.prepare(`
      SELECT r.*, m.title as milestone_title, c.title as contract_title
      FROM verification_reports r
      JOIN milestones m ON r.milestone_id = m.id
      JOIN contracts c ON m.contract_id = c.id
      WHERE (c.client_id = ? OR c.contractor_id = ?)
      ORDER BY r.created_at DESC
      LIMIT 5
    `).all(user.id, user.id) as any[];

    return NextResponse.json({
      metrics: {
        totalFunded: formatUSDC(totalFundedBase),
        fundsLocked: formatUSDC(lockedBase),
        paymentsReleased: formatUSDC(totalPaidBase),
        pendingVerifications: pendingVerifications?.count || 0,
        activeContracts: activeContractsCount,
        totalContracts: contracts.length,
      },
      recentTransactions,
      recentReports,
      recentContracts: contracts.slice(0, 5),
    });
  } catch (error: any) {
    console.error('Overview error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
