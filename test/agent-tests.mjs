import assert from 'assert';

// Deterministic oracle key for local agent tests (never used on-chain).
process.env.ORACLE_PRIVATE_KEY =
  process.env.ORACLE_PRIVATE_KEY ||
  '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';

const { evaluateDeliverable } = await import('../src/lib/agents/evaluator-agent.ts');
const { executeTreasuryReview, getOracleAddress } = await import('../src/lib/agents/treasury-agent.ts');
const { AttestationDecision } = await import('../src/lib/arc-config.ts');

console.log('--- RUNNING DUAL-AGENT DECISION ENGINE TESTS ---');

async function runAgentTests() {
  // Test 1: Agent A approves compliant deliverable
  console.log('Test 1: Agent A evaluates compliant deliverable...');
  const compliantInput = {
    submissionId: 'sub-001',
    milestoneId: 'ms-001',
    contractId: 'ctr-001',
    artifactType: 'GITHUB_PR',
    repoUrl: 'https://github.com/circlefin/arc-escrow',
    branch: 'main',
    commitSha: 'a1b2c3d4e5f678901234567890abcdef12345678',
    pullRequestUrl: 'https://github.com/circlefin/arc-escrow/pull/12',
    description: 'Implemented smart contract tests, modular architecture, passing unit test suite with zero security flaws.',
    acceptanceCriteria: '- Smart contract tests implemented\n- Modular architecture\n- Passing unit test suite',
  };

  const reportA = await evaluateDeliverable(compliantInput);
  assert.strictEqual(reportA.decision, AttestationDecision.APPROVED, 'Should be approved');
  assert(reportA.confidenceScore >= 80, 'Confidence score should be >= 80');
  assert.strictEqual(reportA.testResults.failed, 0, 'Zero failed tests');
  assert.strictEqual(reportA.securityFindings.riskScore, 'LOW', 'Security risk should be LOW');
  console.log(`✓ Agent A passed compliant deliverable with confidence score: ${reportA.confidenceScore}%`);

  // Test 2: Agent A rejects insecure deliverable and generates remediation feedback
  console.log('\nTest 2: Agent A evaluates deliverable with security vulnerability...');
  const insecureInput = {
    submissionId: 'sub-002',
    milestoneId: 'ms-002',
    contractId: 'ctr-001',
    artifactType: 'GITHUB_PR',
    repoUrl: 'https://github.com/insecure/repo',
    description: 'Temporary bypass_auth function added for quick testing eval()',
    acceptanceCriteria: '- Strict authentication required\n- Passing audit',
  };

  const reportB = await evaluateDeliverable(insecureInput);
  assert.strictEqual(reportB.decision, AttestationDecision.REJECTED, 'Insecure deliverable must be rejected');
  assert(reportB.remediationFeedback, 'Remediation feedback must be provided');
  assert(reportB.securityFindings.riskScore === 'HIGH', 'Risk score must be HIGH');
  console.log(`✓ Agent A successfully rejected insecure deliverable and produced remediation feedback:`);
  console.log(`  Feedback preview: ${reportB.remediationFeedback.slice(0, 100)}...`);

  // Test 3: Agent B Treasury Review on Approved Deliverable
  console.log('\nTest 3: Agent B Treasury Review on approved deliverable...');
  const treasurySuccess = await executeTreasuryReview({
    escrowId: '0x1111111111111111111111111111111111111111111111111111111111111111',
    milestoneId: 0,
    contractId: 'ctr-001',
    milestoneDbId: 'ms-001',
    evaluationReport: reportA,
    agreedMilestoneAmount: '500000000', // 500 USDC
    escrowContractAddress: '0x1234567890123456789012345678901234567890',
  });

  assert.strictEqual(treasurySuccess.approved, true, 'Treasury review should approve compliant report');
  assert(treasurySuccess.attestation, 'Attestation must be issued');
  assert(treasurySuccess.attestation.signature.startsWith('0x'), 'Signature must be a valid hex string');
  assert.strictEqual(treasurySuccess.attestation.attestationPayload.authorizedAmount, '500000000');
  console.log(`✓ Agent B issued cryptographically signed EIP-712 attestation:`);
  console.log(`  Oracle Signer: ${treasurySuccess.attestation.oracleAddress}`);
  console.log(`  Signature: ${treasurySuccess.attestation.signature.slice(0, 30)}...`);
  console.log(`  Nonce: ${treasurySuccess.attestation.attestationPayload.nonce}`);

  // Test 4: Agent B Treasury Review blocks payout on rejected report
  console.log('\nTest 4: Agent B Treasury Review blocks payout on rejected deliverable...');
  const treasuryBlocked = await executeTreasuryReview({
    escrowId: '0x1111111111111111111111111111111111111111111111111111111111111111',
    milestoneId: 1,
    contractId: 'ctr-001',
    milestoneDbId: 'ms-002',
    evaluationReport: reportB,
    agreedMilestoneAmount: '250000000',
    escrowContractAddress: '0x1234567890123456789012345678901234567890',
  });

  assert.strictEqual(treasuryBlocked.approved, false, 'Treasury review must block rejected report');
  assert(!treasuryBlocked.attestation, 'No attestation should be issued');
  console.log(`✓ Agent B successfully blocked payout: "${treasuryBlocked.reason}"`);

  console.log('\n--- ALL DUAL-AGENT ENGINE TESTS PASSED SUCCESSFULLY! ---');
}

runAgentTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
