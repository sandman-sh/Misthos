import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ethers } from 'ethers';
import { getSessionUser } from '@/lib/auth';
import db from '@/lib/db';
import { parseUSDC } from '@/lib/arc-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contracts = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM milestones m WHERE m.contract_id = c.id) as milestone_count,
        (SELECT COUNT(*) FROM milestones m WHERE m.contract_id = c.id AND m.status = 'PAID') as completed_milestone_count,
        (SELECT COALESCE(SUM(CAST(m.paid_amount AS INTEGER)), 0) FROM milestones m WHERE m.contract_id = c.id) as total_paid
      FROM contracts c
      WHERE c.client_id = ? OR c.contractor_id = ?
        OR (c.contractor_address = ? AND ? <> '')
        OR (c.client_address = ? AND ? <> '')
      ORDER BY c.created_at DESC
    `).all(
      user.id,
      user.id,
      (user.wallet_address || '').toLowerCase(),
      (user.wallet_address || '').toLowerCase(),
      (user.wallet_address || '').toLowerCase(),
      (user.wallet_address || '').toLowerCase()
    ) as any[];

    return NextResponse.json({ contracts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      description,
      projectBrief,
      contractorAddress,
      clientAddress,
      milestones,
      verificationPolicy,
      txHash,
      onchainEscrowId,
      escrowContractAddress,
    } = body;

    if (!title || !contractorAddress || !milestones || milestones.length === 0) {
      return NextResponse.json(
        { error: 'Title, contractor address, and at least one milestone are required.' },
        { status: 400 }
      );
    }

    // Validate contractor address format
    if (!ethers.isAddress(contractorAddress)) {
      return NextResponse.json(
        { error: 'Invalid contractor EVM address format.' },
        { status: 400 }
      );
    }

    // Sum milestone amounts in integer base units
    let calculatedTotalBase = BigInt(0);
    for (const m of milestones) {
      const amountBase = parseUSDC(m.amount.toString());
      if (amountBase <= BigInt(0)) {
        return NextResponse.json(
          { error: `Milestone "${m.title}" must have an amount greater than 0.` },
          { status: 400 }
        );
      }
      calculatedTotalBase += amountBase;
    }

    const contractId = crypto.randomUUID();
    const effectiveClientAddress = (clientAddress || user.wallet_address || ethers.ZeroAddress).toLowerCase();
    const effectiveContractorAddress = contractorAddress.toLowerCase();
    const effectiveEscrowId = onchainEscrowId || ethers.id(contractId);
    const now = Date.now();

    // Check if contractor is an existing registered user
    const contractorUser = db.prepare(`
      SELECT id FROM users WHERE LOWER(wallet_address) = ?
    `).get(effectiveContractorAddress) as { id: string } | undefined;

    // Use transaction for atomic persistence
    const insertContract = db.transaction(() => {
      db.prepare(`
        INSERT INTO contracts (
          id, title, description, project_brief,
          client_id, client_address, contractor_id, contractor_address,
          total_amount, funded_amount, status,
          escrow_contract_address, onchain_escrow_id,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        contractId,
        title.trim(),
        description || '',
        projectBrief || '',
        user.id,
        effectiveClientAddress,
        contractorUser ? contractorUser.id : null,
        effectiveContractorAddress,
        calculatedTotalBase.toString(),
        '0',
        'AWAITING_FUNDING',
        escrowContractAddress || '',
        effectiveEscrowId,
        now,
        now
      );

      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        const milestoneId = crypto.randomUUID();
        const mAmountBase = parseUSDC(m.amount.toString());

        db.prepare(`
          INSERT INTO milestones (
            id, contract_id, order_index, title, description,
            amount, due_date, deliverable_type, acceptance_criteria,
            verification_policy, evidence_requirements, status, allow_resubmission,
            funded_amount, paid_amount, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          milestoneId,
          contractId,
          i,
          m.title.trim(),
          m.description || '',
          mAmountBase.toString(),
          m.dueDate ? new Date(m.dueDate).getTime() : null,
          m.deliverableType || 'GITHUB_PR',
          m.acceptanceCriteria || 'Deliverable code must pass all automated test assertions.',
          verificationPolicy || 'Dual-agent evaluation with EIP-712 cryptographic attestation.',
          m.evidenceRequirements || 'GitHub PR URL, commit SHA, and test report.',
          'PENDING',
          m.allowResubmission === false ? 0 : 1,
          '0',
          '0',
          now,
          now
        );
      }

      // Record transaction if deployment/escrow creation txHash was passed
      if (txHash) {
        db.prepare(`
          INSERT INTO transactions (
            id, contract_id, tx_hash, tx_type, amount,
            sender, recipient, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          contractId,
          txHash,
          'ESCROW_CREATE',
          calculatedTotalBase.toString(),
          effectiveClientAddress,
          effectiveContractorAddress,
          'CONFIRMED',
          now
        );
      }

      // Audit event
      db.prepare(`
        INSERT INTO audit_events (
          id, entity_type, entity_id, actor_id, action, metadata, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        'CONTRACT',
        contractId,
        user.id,
        'CREATE',
        JSON.stringify({ title, totalAmount: calculatedTotalBase.toString(), milestoneCount: milestones.length }),
        now
      );
    });

    insertContract();

    return NextResponse.json({
      success: true,
      contractId,
      onchainEscrowId: effectiveEscrowId,
    });
  } catch (error: any) {
    console.error('Contract create error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
