import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const contract = db.prepare(`
      SELECT c.*,
        u_client.name as client_name,
        u_client.email as client_email,
        u_contractor.name as contractor_name,
        u_contractor.email as contractor_email
      FROM contracts c
      LEFT JOIN users u_client ON c.client_id = u_client.id
      LEFT JOIN users u_contractor ON c.contractor_id = u_contractor.id
      WHERE c.id = ?
    `).get(id) as any;

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Authorization check
    const isClient = contract.client_id === user.id ||
      (user.wallet_address && contract.client_address &&
        contract.client_address.toLowerCase() === user.wallet_address.toLowerCase());
    const isContractor = contract.contractor_id === user.id ||
      (user.wallet_address && contract.contractor_address &&
        contract.contractor_address.toLowerCase() === user.wallet_address.toLowerCase());

    if (!isClient && !isContractor) {
      return NextResponse.json({ error: 'Access denied to this contract.' }, { status: 403 });
    }

    // Milestones with submission and report details
    const milestones = db.prepare(`
      SELECT m.*,
        (SELECT s.id FROM submissions s WHERE s.milestone_id = m.id ORDER BY s.submitted_at DESC LIMIT 1) as latest_submission_id,
        (SELECT s.status FROM submissions s WHERE s.milestone_id = m.id ORDER BY s.submitted_at DESC LIMIT 1) as submission_status,
        (SELECT r.confidence_score FROM verification_reports r WHERE r.milestone_id = m.id ORDER BY r.created_at DESC LIMIT 1) as verification_score,
        (SELECT r.decision FROM verification_reports r WHERE r.milestone_id = m.id ORDER BY r.created_at DESC LIMIT 1) as verification_decision
      FROM milestones m
      WHERE m.contract_id = ?
      ORDER BY m.order_index ASC
    `).all(id) as any[];

    // Transactions associated with this contract
    const transactions = db.prepare(`
      SELECT * FROM transactions
      WHERE contract_id = ?
      ORDER BY created_at DESC
    `).all(id) as any[];

    return NextResponse.json({
      contract,
      milestones,
      transactions,
      userRole: isClient ? 'client' : (isContractor ? 'contractor' : 'viewer'),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
