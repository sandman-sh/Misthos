// test/wallet-auth-test.mjs
// Test direct Web3 wallet login and auto-user profile creation

import assert from 'assert';
import { ethers } from 'ethers';

const BASE_URL = 'http://localhost:3000';

async function testWalletLogin() {
  console.log('--- TESTING DIRECT WEB3 WALLET LOGIN ---');

  // Generate a new random EVM wallet
  const randomWallet = ethers.Wallet.createRandom();
  console.log(`1. Generated test wallet: ${randomWallet.address}`);

  // Test 1: Direct 1-click login with new wallet address
  console.log('2. Requesting direct wallet login...');
  const res = await fetch(`${BASE_URL}/api/auth/wallet-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: randomWallet.address,
      role: 'contractor',
    }),
  });

  const data = await res.json();
  assert.strictEqual(res.status, 200, `Wallet login failed: ${JSON.stringify(data)}`);
  assert.strictEqual(data.success, true);
  assert(data.user.id, 'User ID should be generated');
  assert.strictEqual(data.user.wallet_address, randomWallet.address.toLowerCase());
  assert.strictEqual(data.user.role, 'contractor');
  console.log(`✓ Auto-created user profile: "${data.user.name}" (${data.user.email})`);

  // Test 2: Check session cookie validity with /api/auth/me
  const cookie = res.headers.get('set-cookie');
  assert(cookie, 'Expected session cookie to be set');

  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  const meData = await meRes.json();
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meData.authenticated, true);
  assert.strictEqual(meData.user.wallet_address, randomWallet.address.toLowerCase());
  console.log('✓ Successfully authenticated session via direct wallet login!');

  // Test 3: Idempotent login (logging in again with same wallet returns existing profile)
  console.log('3. Logging in again with same wallet...');
  const res2 = await fetch(`${BASE_URL}/api/auth/wallet-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: randomWallet.address,
    }),
  });
  const data2 = await res2.json();
  assert.strictEqual(data2.user.id, data.user.id, 'Expected same user ID on subsequent wallet login');
  console.log('✓ Idempotent wallet login verified!');

  console.log('\n====================================================');
  console.log('✓ ALL DIRECT WALLET LOGIN TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

testWalletLogin().catch((err) => {
  console.error('Wallet login test failed:', err);
  process.exit(1);
});
