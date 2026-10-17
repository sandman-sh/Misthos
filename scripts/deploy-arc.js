// scripts/deploy-arc.js
// Deployment script for MisthosEscrow on Arc Testnet (Chain ID: 5042002)

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('====================================================');
  console.log('   MISTHOS ESCROW — ARC TESTNET DEPLOYMENT');
  console.log('====================================================\n');

  // Load environment variables or defaults
  const rpcUrl = process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.solidrpc.io/public/evm/5042002';
  const usdcAddress = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || '0x3600000000000000000000000000000000000000';
  const oracleSigner = process.env.ORACLE_SIGNER_ADDRESS || '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.ORACLE_SIGNER_PRIVATE_KEY;

  if (!deployerKey) {
    console.error('ERROR: DEPLOYER_PRIVATE_KEY or ORACLE_SIGNER_PRIVATE_KEY must be set in environment.');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(deployerKey, provider);

  const network = await provider.getNetwork();
  console.log(`Connected Network: Chain ID ${network.chainId}`);
  console.log(`Deployer Address: ${wallet.address}`);
  
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer Gas Balance: ${ethers.formatEther(balance)} native tokens\n`);

  // Read compiled contract artifact
  const artifactPath = path.resolve(__dirname, '../src/contracts/MisthosEscrow.json');
  if (!fs.existsSync(artifactPath)) {
    console.error('ERROR: Compiled artifact src/contracts/MisthosEscrow.json not found. Run "npm run compile" first.');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  console.log('Deploying MisthosEscrow...');
  console.log(`  - Target USDC Token: ${usdcAddress}`);
  console.log(`  - Authorized Oracle Signer: ${oracleSigner}`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(usdcAddress, oracleSigner);

  console.log('Transaction submitted. Waiting for confirmation on Arc...');
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  console.log('\n====================================================');
  console.log(`✓ MISTHOS ESCROW DEPLOYED TO ARC TESTNET!`);
  console.log(`  Contract Address: ${deployedAddress}`);
  console.log(`  Explorer URL: https://testnet.arcscan.app/address/${deployedAddress}`);
  console.log('====================================================\n');
  console.log('To connect your application to this deployment, update your .env:');
  console.log(`NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS=${deployedAddress}\n`);
}

main().catch((err) => {
  console.error('Deployment failed:', err);
  process.exit(1);
});
