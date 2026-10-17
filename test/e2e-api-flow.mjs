// test/e2e-api-flow.mjs
// End-to-end HTTP API integration test against running server at http://localhost:3000

import assert from 'assert';
import { ethers } from 'ethers';

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('--- STARTING MISTHOS END-TO-END HTTP API FLOW ---');

  const randomId = Math.floor(Math.random() * 100000);
  const clientEmail = `client_${randomId}@misthos.arc`;
  const contractorEmail = `dev_${randomId}@misthos.arc`;
  const contractorWallet = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

  // 1. Sign up Client
  console.log('1. Registering Client user...');
  const clientRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: clientEmail,
      password: 'StrongPassword123!',
      name: 'Alpha Ventures Inc.',
      role: 'CLIENT',
      walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    }),
  });
  const clientData = await clientRes.json();
  assert.strictEqual(clientRes.status, 200, `Failed to signup client: ${JSON.stringify(clientData)}`);
  const clientCookie = clientRes.headers.get('set-cookie');
  console.log('✓ Client registered:', clientData.user.email);

  // 2. Sign up Contractor
  console.log('2. Registering Contractor user...');
  const devRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: contractorEmail,
      password: 'StrongPassword123!',
      name: 'ByteCraft Solutions',
      role: 'CONTRACTOR',
      walletAddress: contractorWallet,
    }),
  });
  const devData = await devRes.json();
  assert.strictEqual(devRes.status, 200, `Failed to signup contractor: ${JSON.stringify(devData)}`);
  const devCookie = devRes.headers.get('set-cookie');
  console.log('✓ Contractor registered:', devData.user.email);

  // 3. Client creates Contract with 2 Milestones
  console.log('3. Client creating Symbolon Contract with 2 Milestones...');
  const contractRes = await fetch(`${BASE_URL}/api/app/contracts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': clientCookie,
    },
    body: JSON.stringify({
      title: 'Decentralized Oracle Escrow Engine',
      description: 'Build and verify an automated artifact verification engine with Arc settlement.',
      contractorEmail: contractorEmail,
      contractorAddress: contractorWallet,
      escrowContractAddress: '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0',
      milestones: [
        {
          title: 'Milestone 1: EIP-712 Attestation Pipeline',
          description: 'Implement typed data signing and replay protection.',
          amount: '500',
          deliverableType: 'GITHUB_PR',
          acceptanceCriteria: 'Complete EIP-712 typed signing, unit test passing, zero security vulnerabilities.',
          verificationPolicy: 'STRICT_ORACLE',
        },
        {
          title: 'Milestone 2: Arc Testnet Deployment',
          description: 'Deploy escrow contracts to Arc Testnet and connect frontend.',
          amount: '250',
          deliverableType: 'DEPLOYMENT',
          acceptanceCriteria: 'Contracts verified on Arcscan, USDC deposit tested.',
          verificationPolicy: 'STANDARD_ORACLE',
        },
      ],
    }),
  });

  const contractData = await contractRes.json();
  assert.strictEqual(contractRes.status, 200, `Failed to create contract: ${JSON.stringify(contractData)}`);
  console.log(`✓ Contract created: ${contractData.contractId} (On-chain Escrow ID: ${contractData.onchainEscrowId})`);

  // Fetch contract details to get milestone IDs
  const contractDetailsRes = await fetch(`${BASE_URL}/api/app/contracts/${contractData.contractId}`, {
    headers: { 'Cookie': clientCookie },
  });
  const contractDetails = await contractDetailsRes.json();
  assert.strictEqual(contractDetailsRes.status, 200);
  assert.strictEqual(contractDetails.milestones.length, 2);
  const milestone1 = contractDetails.milestones[0];
  console.log(`✓ Fetched milestone details: "${milestone1.title}" (ID: ${milestone1.id}, Amount: ${milestone1.amount} USDC)`);

  // 4. Client funds the Contract
  console.log('4. Client funding contract with 750 USDC on Arc...');
  const fundRes = await fetch(`${BASE_URL}/api/app/contracts/${contractData.contractId}/fund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': clientCookie,
    },
    body: JSON.stringify({
      amount: '750',
      txHash: ethers.hexlify(ethers.randomBytes(32)),
      fundedWallet: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    }),
  });
  const fundData = await fundRes.json();
  assert.strictEqual(fundRes.status, 200, `Failed to fund contract: ${JSON.stringify(fundData)}`);
  console.log(`✓ Contract funded! Escrow funded_amount: ${fundData.funded_amount}`);

  // 5. Contractor submits deliverable
  console.log('5. Contractor submitting deliverable for Milestone 1...');
  const submitRes = await fetch(`${BASE_URL}/api/app/milestones/${milestone1.id}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': devCookie,
    },
    body: JSON.stringify({
      artifactType: 'GITHUB_PR',
      repoUrl: 'https://github.com/misthos/core',
      branch: 'feature/eip712-oracle',
      commitSha: '7f3c9a1bc4028de16f9011ab42817c093aef44b2',
      pullRequestUrl: 'https://github.com/misthos/core/pull/42',
      description: 'Completed EIP-712 typed signing implementation with full test suite passing.',
      evidenceUrls: 'https://testnet.arcscan.app',
    }),
  });
  const submitData = await submitRes.json();
  assert.strictEqual(submitRes.status, 200, `Failed to submit deliverable: ${JSON.stringify(submitData)}`);
  console.log(`✓ Deliverable submitted: Submission ID ${submitData.submissionId}`);

  // 6. Run Dual-Agent Oracle Verification
  console.log('6. Running Dual-Agent Oracle Verification pipeline...');
  const verifyRes = await fetch(`${BASE_URL}/api/app/milestones/${milestone1.id}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': clientCookie,
    },
  });
  const verifyData = await verifyRes.json();
  assert.strictEqual(verifyRes.status, 200, `Failed verification: ${JSON.stringify(verifyData)}`);
  console.log(`✓ Verification complete!`);
  console.log(`  Agent A Score: ${verifyData.evaluationReport.confidenceScore}% (Verdict: ${verifyData.evaluationReport.decisionLabel})`);
  console.log(`  Agent B Treasury Approved: ${verifyData.treasuryReview.approved}`);
  assert(verifyData.treasuryReview.attestation?.signature, 'Expected valid EIP-712 signature');
  console.log(`  EIP-712 Attestation Signature: ${verifyData.treasuryReview.attestation.signature.slice(0, 32)}...`);

  // 7. Execute Settlement on Arc Testnet
  console.log('7. Recording on-chain settlement release...');
  const settleRes = await fetch(`${BASE_URL}/api/app/milestones/${milestone1.id}/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': clientCookie,
    },
    body: JSON.stringify({
      txHash: ethers.hexlify(ethers.randomBytes(32)),
      amountReleased: '500',
      recipientWallet: contractorWallet,
    }),
  });
  const settleData = await settleRes.json();
  assert.strictEqual(settleRes.status, 200, `Failed settlement: ${JSON.stringify(settleData)}`);
  console.log(`✓ Milestone settled! Status: ${settleData.milestoneStatus}, Transaction: ${settleData.txHash}`);

  // 8. Verify Overview Metrics
  console.log('8. Verifying Overview Dashboard financial metrics...');
  const overviewRes = await fetch(`${BASE_URL}/api/app/overview`, {
    headers: { 'Cookie': clientCookie },
  });
  const overviewData = await overviewRes.json();
  assert.strictEqual(overviewRes.status, 200);
  console.log('  Overview Metrics:', overviewData.metrics);
  assert.strictEqual(overviewData.metrics.totalFunded, '750.00');
  assert.strictEqual(overviewData.metrics.paymentsReleased, '500.00');
  assert.strictEqual(overviewData.metrics.fundsLocked, '250.00');
  console.log('✓ All financial metrics reconciled with integer precision!');

  console.log('\n====================================================');
  console.log('✓ ALL END-TO-END HTTP API FLOWS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

main().catch((err) => {
  console.error('E2E test failed:', err);
  process.exit(1);
});
