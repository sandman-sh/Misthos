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

    const milestone = db.prepare(`
      SELECT m.*, c.title as contract_title, c.client_id, c.contractor_id,
        c.client_address, c.contractor_address, c.onchain_escrow_id,
        c.escrow_contract_address
      FROM milestones m
      JOIN contracts c ON m.contract_id = c.id
      WHERE m.id = ?
    `).get(id) as any;

    if (!milestone) {
      return NextResponse.json({ error: 'Milestone not found' }, { status: 404 });
    }

    // Submissions for this milestone
    const submissions = db.prepare(`
      SELECT s.*, u.name as contractor_name
      FROM submissions s
      JOIN users u ON s.contractor_id = u.id
      WHERE s.milestone_id = ?
      ORDER BY s.submitted_at DESC
    `).all(id) as any[];

    // Verification reports
    const reports = db.prepare(`
      SELECT * FROM verification_reports
      WHERE milestone_id = ?
      ORDER BY created_at DESC
    `).all(id) as any[];

    // Parse JSON columns in reports
    const parsedReports = reports.map((r) => ({
      ...r,
      checks_executed: r.checks_executed ? JSON.parse(r.checks_executed) : [],
      test_results: r.test_results ? JSON.parse(r.test_results) : null,
      security_findings: r.security_findings ? JSON.parse(r.security_findings) : null,
    }));

    const isClient = milestone.client_id === user.id ||
      (user.wallet_address && milestone.client_address &&
        milestone.client_address.toLowerCase() === user.wallet_address.toLowerCase());
    const isContractor = milestone.contractor_id === user.id ||
      (user.wallet_address && milestone.contractor_address.toLowerCase() === user.wallet_address.toLowerCase());

    const attemptCount = (db.prepare(
      'SELECT COUNT(*) as c FROM submissions WHERE milestone_id = ?'
    ).get(id) as any)?.c || 0;
    return NextResponse.json({
      milestone,
      submissions,
      reports: parsedReports,
      userRole: isClient ? 'client' : (isContractor ? 'contractor' : 'viewer'),
      resubmissionsAllowed: milestone.allow_resubmission !== 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
