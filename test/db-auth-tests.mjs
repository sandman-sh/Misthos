import assert from 'assert';
import crypto from 'crypto';
import rawDb from '../src/lib/db.ts';
import { hashPassword, verifyPassword } from '../src/lib/auth.ts';

const db = rawDb.default || rawDb;

console.log('--- RUNNING DATABASE & AUTH INTEGRATION TESTS ---');

async function runDbAuthTests() {
  const testEmail = `test-${Date.now()}@misthos.test`;
  const rawPassword = 'SuperSecretPassword123!';

  // 1. Password Hashing
  console.log('Test 1: Testing bcrypt password hashing and verification...');
  const hash = await hashPassword(rawPassword);
  assert(hash !== rawPassword, 'Hash must not equal raw password');
  const validMatch = await verifyPassword(rawPassword, hash);
  assert.strictEqual(validMatch, true, 'Correct password must verify');
  const invalidMatch = await verifyPassword('WrongPassword', hash);
  assert.strictEqual(invalidMatch, false, 'Wrong password must fail');
  console.log('✓ Password hashing and verification working correctly.');

  // 2. User Insertion
  console.log('\nTest 2: Creating user in persistent SQLite database...');
  const userId = crypto.randomUUID();
  const testWallet = '0x1234567890123456789012345678901234567890';
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, wallet_address, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, testEmail, hash, 'Test Architect', testWallet, 'client', Date.now());

  const fetchedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert(fetchedUser, 'User must exist in DB');
  assert.strictEqual(fetchedUser.email, testEmail);
  console.log(`✓ User created and retrieved successfully: ${fetchedUser.name} (${fetchedUser.id})`);

  // 3. Contract & Milestones Creation
  console.log('\nTest 3: Creating escrow contract and linked milestones in SQLite...');
  const contractId = crypto.randomUUID();
  const contractorWallet = '0x9876543210987654321098765432109876543210';
  const now = Date.now();

  db.prepare(`
    INSERT INTO contracts (
      id, title, description, project_brief, client_id, client_address,
      contractor_id, contractor_address, total_amount, funded_amount, status,
      onchain_escrow_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    contractId,
    'Arc Escrow Core Test',
    'Test description',
    'Test brief',
    userId,
    testWallet,
    null,
    contractorWallet,
    '1000000000', // 1,000 USDC
    '0',
    'AWAITING_FUNDING',
    '0xabcdef123456',
    now,
    now
  );

  const milestoneId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO milestones (
      id, contract_id, order_index, title, description, amount,
      deliverable_type, acceptance_criteria, status, funded_amount, paid_amount,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    milestoneId,
    contractId,
    0,
    'Milestone 1 Test',
    'Test description',
    '1000000000',
    'GITHUB_PR',
    'All tests pass',
    'PENDING',
    '0',
    '0',
    now,
    now
  );

  const fetchedContract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
  assert(fetchedContract, 'Contract must exist');
  assert.strictEqual(fetchedContract.total_amount, '1000000000');

  const fetchedMilestone = db.prepare('SELECT * FROM milestones WHERE id = ?').get(milestoneId);
  assert(fetchedMilestone, 'Milestone must exist');
  assert.strictEqual(fetchedMilestone.contract_id, contractId);
  console.log(`✓ Escrow contract and milestones persisted with integer USDC units.`);

  // 4. Record Funding Transaction
  console.log('\nTest 4: Recording funding on-chain transaction...');
  const txHash = '0x' + crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO transactions (
      id, contract_id, tx_hash, tx_type, amount, sender, recipient, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    contractId,
    txHash,
    'FUND',
    '1000000000',
    testWallet,
    contractorWallet,
    'CONFIRMED',
    now
  );

  const tx = db.prepare('SELECT * FROM transactions WHERE tx_hash = ?').get(txHash);
  assert(tx, 'Transaction must be recorded');
  assert.strictEqual(tx.status, 'CONFIRMED');
  console.log(`✓ Transaction recorded and linked to Arcscan explorer: ${tx.tx_hash.slice(0, 16)}...`);

  console.log('\n--- ALL DATABASE & AUTH INTEGRATION TESTS PASSED! ---');
}

runDbAuthTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
