import { ethers } from 'ethers';
import crypto from 'crypto';
import {
  ARC_TESTNET,
  EIP712_TYPES,
  AttestationDecision,
} from '@/lib/arc-config';
import { EvaluationReport } from './evaluator-agent';

export interface TreasurySettlementRequest {
  escrowId: string;
  milestoneId: number;
  contractId: string;
  milestoneDbId: string;
  evaluationReport: EvaluationReport;
  agreedMilestoneAmount: string; // base units or human readable
  escrowContractAddress: string;
}

export interface SignedOracleAttestation {
  attestationPayload: {
    escrowId: string;
    milestoneId: number;
    deliverableHash: string;
    policyHash: string;
    decision: number;
    authorizedAmount: string; // string representation of bigint base units
    nonce: number;
    expiry: number;
  };
  signature: string;
  oracleAddress: string;
  decisionLabel: string;
}

/**
 * Get or derive server Oracle wallet for signing EIP-712 attestations.
 */
export function getOracleWallet(): ethers.Wallet {
  // Server-side oracle key. Never fall back to a hardcoded key in production paths:
  // a wrong key would sign attestations the on-chain contract correctly rejects.
  const privateKey =
    process.env.ORACLE_PRIVATE_KEY || process.env.ORACLE_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      'Oracle signing key is not configured. Set ORACLE_PRIVATE_KEY (or ORACLE_SIGNER_PRIVATE_KEY) in .env.local. This key must match the oracle address set when MisthosEscrow was deployed.'
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('Oracle signing key is malformed (expected 0x-prefixed 32-byte hex).');
  }
  return new ethers.Wallet(privateKey);
}

export function getOracleAddress(): string {
  return getOracleWallet().address;
}

/**
 * Agent B: Client Treasury Agent
 * Enforces corporate payment invariants and signs EIP-712 attestations.
 */
export async function executeTreasuryReview(
  req: TreasurySettlementRequest
): Promise<{
  approved: boolean;
  reason: string;
  attestation?: SignedOracleAttestation;
}> {
  const { evaluationReport, escrowId, milestoneId, agreedMilestoneAmount, escrowContractAddress } = req;

  // Rule 1: Decision check from Agent A
  if (evaluationReport.decision !== AttestationDecision.APPROVED) {
    return {
      approved: false,
      reason: `Treasury review blocked: Evaluation agent verdict was ${evaluationReport.decisionLabel} (Confidence: ${evaluationReport.confidenceScore}%). Remediation required.`,
    };
  }

  // Rule 2: Invariant Check on Failing Tests
  if (evaluationReport.testResults.failed > 0) {
    return {
      approved: false,
      reason: 'Treasury policy violation: Cannot approve milestone release while automated tests or criteria are failing.',
    };
  }

  // Rule 3: Security check
  if (evaluationReport.securityFindings.riskScore === 'HIGH') {
    return {
      approved: false,
      reason: 'Treasury security alert: High risk security flags detected in deliverable artifact.',
    };
  }

  // Rule 4: Payout amount verification
  const authorizedAmountBigInt = BigInt(agreedMilestoneAmount);
  if (authorizedAmountBigInt <= BigInt(0)) {
    return {
      approved: false,
      reason: 'Invalid milestone payout amount: Amount must be greater than 0 USDC.',
    };
  }

  // Format bytes32 hashes
  const bytes32EscrowId = escrowId.startsWith('0x')
    ? ethers.zeroPadValue(escrowId, 32)
    : ethers.id(escrowId);

  const deliverableHash = '0x' + crypto.createHash('sha256').update(evaluationReport.commitSha).digest('hex');
  const policyHash = evaluationReport.specVersionHash;

  // Generate unique nonce and expiry (1 hour validity)
  const nonce = Date.now() + Math.floor(Math.random() * 1000);
  const expiry = Math.floor(Date.now() / 1000) + 3600;

  const oracleWallet = getOracleWallet();

  const domain = {
    name: ARC_TESTNET.eip712Domain.name,
    version: ARC_TESTNET.eip712Domain.version,
    chainId: ARC_TESTNET.chainId,
    verifyingContract: escrowContractAddress || ethers.ZeroAddress,
  };

  const attestationPayload = {
    escrowId: bytes32EscrowId,
    milestoneId,
    deliverableHash,
    policyHash,
    decision: AttestationDecision.APPROVED,
    authorizedAmount: authorizedAmountBigInt.toString(),
    nonce,
    expiry,
  };

  // Sign EIP-712 Typed Data
  const signature = await oracleWallet.signTypedData(
    domain,
    EIP712_TYPES,
    {
      escrowId: bytes32EscrowId,
      milestoneId: BigInt(milestoneId),
      deliverableHash,
      policyHash,
      decision: AttestationDecision.APPROVED,
      authorizedAmount: authorizedAmountBigInt,
      nonce: BigInt(nonce),
      expiry: BigInt(expiry),
    }
  );

  return {
    approved: true,
    reason: 'Treasury policy requirements fully satisfied. Signed EIP-712 oracle attestation issued.',
    attestation: {
      attestationPayload,
      signature,
      oracleAddress: oracleWallet.address,
      decisionLabel: 'APPROVED',
    },
  };
}
