import { ethers } from 'ethers';
import { ARC_TESTNET, parseUSDC } from '@/lib/arc-config';
import MisthosArtifact from '@/contracts/MisthosEscrow.json';

export interface CreateEscrowParams {
  escrowId: string;
  contractorAddress: string;
  oracleAddress: string;
  milestoneAmounts: string[]; // in USDC base units (6 decimals)
  criteriaHashes: string[]; // 32-byte hex strings
  signer: ethers.Signer;
}

export interface FundEscrowParams {
  escrowId: string;
  amount: string; // in USDC base units
  signer: ethers.Signer;
}

export interface ReleaseMilestoneParams {
  attestationPayload: {
    escrowId: string;
    milestoneId: number;
    deliverableHash: string;
    policyHash: string;
    decision: number;
    authorizedAmount: string;
    nonce: number;
    expiry: number;
  };
  signature: string;
  signer: ethers.Signer;
}

/**
 * Get the deployed MisthosEscrow contract instance.
 */
export function getEscrowContract(
  contractAddress?: string,
  runner?: ethers.ContractRunner
): ethers.Contract {
  const address = contractAddress || ARC_TESTNET.contracts.escrow;
  if (!address) {
    throw new Error('Escrow contract address is not configured.');
  }
  const provider = runner || new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrls[0]);
  return new ethers.Contract(address, MisthosArtifact.abi, provider);
}

/**
 * Deploy MisthosEscrow contract to Arc Testnet using a signer.
 */
export async function deployEscrowContract(
  signer: ethers.Signer,
  oracleAddress: string
): Promise<{ address: string; txHash: string }> {
  const factory = new ethers.ContractFactory(
    MisthosArtifact.abi,
    MisthosArtifact.bytecode,
    signer
  );

  const usdcAddress = ARC_TESTNET.contracts.usdc;
  const contract = await factory.deploy(usdcAddress, oracleAddress);
  await contract.waitForDeployment();
  const deployedAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  return {
    address: deployedAddress,
    txHash: deployTx ? deployTx.hash : '',
  };
}

/**
 * Create escrow agreement on-chain.
 */
export async function executeCreateEscrowOnChain(
  params: CreateEscrowParams
): Promise<{ txHash: string }> {
  const { escrowId, contractorAddress, oracleAddress, milestoneAmounts, criteriaHashes, signer } = params;
  const contract = getEscrowContract(undefined, signer);

  const bytes32EscrowId = escrowId.startsWith('0x')
    ? ethers.zeroPadValue(escrowId, 32)
    : ethers.id(escrowId);

  const amountsBigInt = milestoneAmounts.map(a => BigInt(a));
  const hashesBytes32 = criteriaHashes.map(h =>
    h.startsWith('0x') ? ethers.zeroPadValue(h, 32) : ethers.id(h)
  );

  const tx = await contract.createEscrow(
    bytes32EscrowId,
    contractorAddress,
    oracleAddress,
    amountsBigInt,
    hashesBytes32
  );

  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

/**
 * Fund escrow agreement on-chain.
 * Handles both ERC-20 approve+transfer and Arc native USDC.
 */
export async function executeFundEscrowOnChain(
  params: FundEscrowParams
): Promise<{ txHash: string }> {
  const { escrowId, amount, signer } = params;
  const contract = getEscrowContract(undefined, signer);
  const escrowAddress = await contract.getAddress();
  const amountBigInt = BigInt(amount);

  const bytes32EscrowId = escrowId.startsWith('0x')
    ? ethers.zeroPadValue(escrowId, 32)
    : ethers.id(escrowId);

  // First approve USDC if required
  try {
    const erc20Abi = [
      'function allowance(address,address) view returns (uint256)',
      'function approve(address,uint256) returns (bool)'
    ];
    const usdcContract = new ethers.Contract(ARC_TESTNET.contracts.usdc, erc20Abi, signer);
    const signerAddress = await signer.getAddress();
    const allowance = await usdcContract.allowance(signerAddress, escrowAddress);

    if (allowance < amountBigInt) {
      const approveTx = await usdcContract.approve(escrowAddress, amountBigInt);
      await approveTx.wait();
    }
  } catch (err) {
    console.warn('ERC20 approval notice (Arc native token handling):', err);
  }

  // Call fundEscrow
  const tx = await contract.fundEscrow(bytes32EscrowId, amountBigInt);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}

/**
 * Release milestone on-chain using verified EIP-712 attestation.
 */
export async function executeReleaseMilestoneOnChain(
  params: ReleaseMilestoneParams
): Promise<{ txHash: string }> {
  const { attestationPayload, signature, signer } = params;
  const contract = getEscrowContract(undefined, signer);

  const formattedPayload = {
    escrowId: attestationPayload.escrowId,
    milestoneId: BigInt(attestationPayload.milestoneId),
    deliverableHash: attestationPayload.deliverableHash,
    policyHash: attestationPayload.policyHash,
    decision: attestationPayload.decision,
    authorizedAmount: BigInt(attestationPayload.authorizedAmount),
    nonce: BigInt(attestationPayload.nonce),
    expiry: BigInt(attestationPayload.expiry),
  };

  const tx = await contract.releaseMilestone(formattedPayload, signature);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}
