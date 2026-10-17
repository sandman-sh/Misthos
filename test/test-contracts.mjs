import hre from 'hardhat';
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MisthosArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'contracts', 'MisthosEscrow.json'), 'utf8')
);
const MockUsdcArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'contracts', 'MockUSDC.json'), 'utf8')
);

async function main() {
  console.log('--- STARTING MISTHOS ESCROW SMART CONTRACT SUITE ---');

  const provider = new ethers.BrowserProvider(hre.network.provider);
  const signers = await provider.listAccounts();
  const deployer = signers[0];
  const client = signers[1];
  const contractor = signers[2];
  const unauthorizedUser = signers[3];

  const oracleWallet = new ethers.Wallet(
    '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
    provider
  );

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Client: ${client.address}`);
  console.log(`Contractor: ${contractor.address}`);
  console.log(`Oracle: ${oracleWallet.address}`);

  // 1. Deploy Mock USDC
  console.log('\n1. Deploying MockUSDC token (6 decimals)...');
  const MockUSDCFactory = new ethers.ContractFactory(
    MockUsdcArtifact.abi,
    MockUsdcArtifact.bytecode,
    deployer
  );
  const usdc = await MockUSDCFactory.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log(`✓ MockUSDC deployed at: ${usdcAddress}`);

  // Transfer 10,000 USDC to client
  await (await usdc.transfer(client.address, 10000n * 1000000n)).wait();
  const clientBal = await usdc.balanceOf(client.address);
  assert.strictEqual(clientBal, 10000n * 1000000n, 'Client must hold 10,000 USDC');
  console.log(`✓ Client funded with ${clientBal / 1000000n} USDC`);

  // 2. Deploy MisthosEscrow
  console.log('\n2. Deploying MisthosEscrow contract on simulated Arc Testnet (Chain ID: 5042002)...');
  const EscrowFactory = new ethers.ContractFactory(
    MisthosArtifact.abi,
    MisthosArtifact.bytecode,
    deployer
  );
  const escrow = await EscrowFactory.deploy(usdcAddress, oracleWallet.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`✓ MisthosEscrow deployed at: ${escrowAddress}`);

  // 3. Create Escrow Agreement
  console.log('\n3. Creating escrow agreement with 2 milestones (500 USDC & 250 USDC)...');
  const escrowId = ethers.id('escrow-contract-test-001');
  const milestoneAmounts = [500000000n, 250000000n]; // 500 USDC, 250 USDC
  const criteriaHashes = [
    ethers.id('Milestone 1: Passing test suites with >80% coverage'),
    ethers.id('Milestone 2: Production frontend deployment on Arc Testnet'),
  ];

  const clientEscrow = escrow.connect(client);
  const createTx = await clientEscrow.createEscrow(
    escrowId,
    contractor.address,
    oracleWallet.address,
    milestoneAmounts,
    criteriaHashes
  );
  await createTx.wait();

  const escrowData = await escrow.escrows(escrowId);
  assert.strictEqual(escrowData.client, client.address, 'Client address matches');
  assert.strictEqual(escrowData.contractor, contractor.address, 'Contractor address matches');
  assert.strictEqual(escrowData.totalAmount, 750000000n, 'Total amount equals 750 USDC');
  assert.strictEqual(escrowData.milestoneCount, 2n, 'Milestone count equals 2');
  console.log(`✓ Escrow agreement established on-chain. Total: ${escrowData.totalAmount / 1000000n} USDC`);

  // 4. Duplicate Escrow Rejection Check
  console.log('\n4. Verifying duplicate escrow creation is rejected...');
  let duplicateRejected = false;
  try {
    await clientEscrow.createEscrow(
      escrowId,
      contractor.address,
      oracleWallet.address,
      milestoneAmounts,
      criteriaHashes
    );
  } catch (err) {
    duplicateRejected = true;
  }
  assert.strictEqual(duplicateRejected, true, 'Duplicate escrow ID must revert');
  console.log('✓ Reverted: duplicate escrow creation blocked by smart contract.');

  // 5. Fund Escrow with USDC
  console.log('\n5. Funding escrow with 750 USDC...');
  const clientUsdc = usdc.connect(client);
  await (await clientUsdc.approve(escrowAddress, 750000000n)).wait();
  const fundTx = await clientEscrow.fundEscrow(escrowId, 750000000n);
  await fundTx.wait();

  const updatedEscrow = await escrow.escrows(escrowId);
  assert.strictEqual(updatedEscrow.fundedAmount, 750000000n, 'Funded amount must equal 750 USDC');
  
  const m0 = await escrow.milestones(escrowId, 0);
  assert.strictEqual(m0.status, 1n, 'Milestone 0 status must be FUNDED (1)');
  console.log(`✓ Escrow funded successfully. Escrow USDC balance: ${updatedEscrow.fundedAmount / 1000000n} USDC`);

  // 6. Release Milestone with Valid EIP-712 Oracle Attestation
  console.log('\n6. Executing milestone release with valid EIP-712 Oracle attestation...');
  const deliverableHash = ethers.id('commit-sha-7f3c9a1284');
  const policyHash = criteriaHashes[0];
  const nonce = 1001n;
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const domain = {
    name: 'MisthosEscrow',
    version: '1',
    chainId: (await provider.getNetwork()).chainId,
    verifyingContract: escrowAddress,
  };

  const types = {
    MilestoneAttestation: [
      { name: 'escrowId', type: 'bytes32' },
      { name: 'milestoneId', type: 'uint256' },
      { name: 'deliverableHash', type: 'bytes32' },
      { name: 'policyHash', type: 'bytes32' },
      { name: 'decision', type: 'uint8' },
      { name: 'authorizedAmount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
    ],
  };

  const attestationValue = {
    escrowId,
    milestoneId: 0n,
    deliverableHash,
    policyHash,
    decision: 1, // APPROVED
    authorizedAmount: 500000000n, // 500 USDC
    nonce,
    expiry,
  };

  const signature = await oracleWallet.signTypedData(domain, types, attestationValue);

  const contractorInitialBal = await usdc.balanceOf(contractor.address);
  assert.strictEqual(contractorInitialBal, 0n, 'Contractor should start with 0 USDC');

  const releasePayload = {
    escrowId,
    milestoneId: 0n,
    deliverableHash,
    policyHash,
    decision: 1,
    authorizedAmount: 500000000n,
    nonce,
    expiry,
  };

  const releaseTx = await escrow.connect(contractor).releaseMilestone(releasePayload, signature);
  await releaseTx.wait();

  const contractorPostBal = await usdc.balanceOf(contractor.address);
  assert.strictEqual(contractorPostBal, 500000000n, 'Contractor must receive 500 USDC');

  const m0Post = await escrow.milestones(escrowId, 0);
  assert.strictEqual(m0Post.paidAmount, 500000000n, 'Milestone paid amount must be 500 USDC');
  assert.strictEqual(m0Post.status, 3n, 'Milestone status must be RELEASED (3)');
  console.log(`✓ Milestone #0 paid out! Contractor received ${contractorPostBal / 1000000n} USDC on Arc.`);

  // 7. Replay Attack Prevention
  console.log('\n7. Verifying Replay Attack Prevention (reusing same attestation nonce)...');
  let replayBlocked = false;
  try {
    await escrow.connect(contractor).releaseMilestone(releasePayload, signature);
  } catch (err) {
    replayBlocked = true;
  }
  assert.strictEqual(replayBlocked, true, 'Replaying consumed nonce must revert');
  console.log('✓ Replay attack blocked: used nonce rejected by smart contract.');

  // 8. Unauthorized Signer Prevention
  console.log('\n8. Verifying Unauthorized Signer Prevention...');
  let fakeBlocked = false;
  const fakeNonce = 1002n;
  const fakeAttestation = { ...attestationValue, milestoneId: 1n, authorizedAmount: 250000000n, nonce: fakeNonce };
  const fakeSig = await unauthorizedUser.signTypedData(domain, types, fakeAttestation);
  try {
    await escrow.releaseMilestone({ ...releasePayload, milestoneId: 1n, authorizedAmount: 250000000n, nonce: fakeNonce }, fakeSig);
  } catch (err) {
    fakeBlocked = true;
  }
  assert.strictEqual(fakeBlocked, true, 'Fake oracle signature must revert');
  console.log('✓ Unauthorized oracle signature rejected.');

  // 9. Overpayment Prevention
  console.log('\n9. Verifying Overpayment Prevention (exceeding milestone cap)...');
  let overpayBlocked = false;
  const overpayNonce = 1003n;
  const overpayAttestation = { ...attestationValue, milestoneId: 1n, authorizedAmount: 500000000n, nonce: overpayNonce };
  const overpaySig = await oracleWallet.signTypedData(domain, types, overpayAttestation);
  try {
    await escrow.releaseMilestone({ ...releasePayload, milestoneId: 1n, authorizedAmount: 500000000n, nonce: overpayNonce }, overpaySig);
  } catch (err) {
    overpayBlocked = true;
  }
  assert.strictEqual(overpayBlocked, true, 'Payout exceeding milestone cap must revert');
  console.log('✓ Overpayment blocked: release exceeding milestone allocation rejected.');

  console.log('\n--- ALL SMART CONTRACT INVARIANT TESTS PASSED SUCCESSFULLY! ---');
}

main().catch((err) => {
  console.error('Contract test suite failed:', err);
  process.exit(1);
});
