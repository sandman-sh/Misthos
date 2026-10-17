// Verifies everything Misthos needs to run REAL end-to-end on Arc Testnet.
// Loads .env.local, checks chain, deployment, oracle key, and USDC. Exit 1 if anything missing.

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env.local loader (no dotenv dependency)
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.resolve(__dirname, '..', f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !line.trim().startsWith('#')) {
        const val = m[2].replace(/^["']|["']$/g, '');
        if (!process.env[m[1]]) process.env[m[1]] = val;
      }
    }
  }
}
loadEnv();

const RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.solidrpc.io/public/evm/5042002';
const CHAIN_ID = 5042002;
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || '0x3600000000000000000000000000000000000000';
const ESCROW = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || '';
const ORACLE_KEY = process.env.ORACLE_PRIVATE_KEY || process.env.ORACLE_SIGNER_PRIVATE_KEY || '';

const ok = [];
const missing = [];

async function main() {
  console.log('Misthos Arc Testnet live-readiness check');
  console.log('RPC:', RPC_URL);

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true, batchMaxCount: 1 });

  const net = await provider.getNetwork();
  if (Number(net.chainId) === CHAIN_ID) ok.push('Chain ID ' + net.chainId + ' (Arc Testnet)');
  else missing.push('Wrong chain: expected ' + CHAIN_ID + ', got ' + net.chainId);

  if (ESCROW && ethers.isAddress(ESCROW)) {
    const code = await provider.getCode(ESCROW);
    if (code && code !== '0x') ok.push('Escrow deployed at ' + ESCROW + ' (' + code.length / 2 + ' bytes)');
    else missing.push('Escrow address ' + ESCROW + ' has NO deployed code. Run npm run deploy:arc with a funded key.');
  } else {
    missing.push('NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS is not set. Deploy MisthosEscrow first (npm run deploy:arc).');
  }

  if (ORACLE_KEY && /^0x[0-9a-fA-F]{64}$/.test(ORACLE_KEY)) {
    const oracle = new ethers.Wallet(ORACLE_KEY, provider);
    ok.push('Oracle key loaded (address ' + oracle.address + ')');
    const bal = await provider.getBalance(oracle.address);
    ok.push('Oracle balance: ' + ethers.formatUnits(bal, 6) + ' USDC' + (bal === 0n ? ' - needs testnet USDC to deploy/pay gas' : ''));
    if (bal === 0n) missing.push('Oracle/deployer address ' + oracle.address + ' has 0 USDC. Fund it from the Arc faucet / TestMint (testmint.myproceeds.xyz) to deploy and transact.');
  } else {
    missing.push('ORACLE_PRIVATE_KEY not set/malformed in .env.local. Treasury agent cannot sign EIP-712 attestations.');
  }

  try {
    const usdc = new ethers.Contract(USDC, ['function totalSupply() view returns (uint256)'], provider);
    const ts = await usdc.totalSupply();
    ok.push('USDC reachable (totalSupply ' + ethers.formatUnits(ts, 6) + ' USDC)');
  } catch {
    missing.push('USDC at ' + USDC + ' not callable as ERC-20.');
  }

  console.log('\n--- LIVE ---');
  ok.forEach((s) => console.log('  [ok]', s));
  if (missing.length) {
    console.log('\n--- TO GO FULLY LIVE ---');
    missing.forEach((s) => console.log('  [TODO]', s));
    process.exit(1);
  }
  console.log('\nAll systems live: real funding + EIP-712 settlement on Arc Testnet is ready.');
}

main().catch((e) => { console.error('Check failed:', e.message); process.exit(1); });
