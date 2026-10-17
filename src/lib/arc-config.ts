/**
 * Misthos Arc Testnet & Blockchain Configuration
 * Official Circle / Arc Network Parameters
 */

export interface ArcNetworkConfig {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    usdc: string;
    escrow?: string;
  };
  eip712Domain: {
    name: string;
    version: string;
  };
}

export const ARC_TESTNET: ArcNetworkConfig = {
  chainId: 5042002,
  chainIdHex: '0x4cef52',
  chainName: 'Arc Testnet',
  rpcUrls: [
    process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.solidrpc.io/public/evm/5042002',
    'https://rpc.testnet.arc.network',
    'https://arc-node.thecanteenapp.com/'
  ],
  blockExplorerUrls: [
    process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || 'https://testnet.arcscan.app'
  ],
  nativeCurrency: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6
  },
  contracts: {
    // On Arc, USDC is the native gas token and ERC-20 standard interface
    usdc: process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || '0x3600000000000000000000000000000000000000',
    escrow: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS || ''
  },
  eip712Domain: {
    name: 'MisthosEscrow',
    version: '1'
  }
};

export const EIP712_TYPES = {
  MilestoneAttestation: [
    { name: 'escrowId', type: 'bytes32' },
    { name: 'milestoneId', type: 'uint256' },
    { name: 'deliverableHash', type: 'bytes32' },
    { name: 'policyHash', type: 'bytes32' },
    { name: 'decision', type: 'uint8' },
    { name: 'authorizedAmount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' }
  ]
};

export enum AttestationDecision {
  NONE = 0,
  APPROVED = 1,
  REJECTED = 2,
  ESCALATED = 3
}

/**
 * Format integer USDC base units (6 decimals) into human-readable string.
 * Never use raw float arithmetic for financial settlements.
 */
export function formatUSDC(baseUnits: bigint | number | string): string {
  const b = typeof baseUnits === 'bigint' ? baseUnits : BigInt(baseUnits || 0);
  const isNegative = b < BigInt(0);
  const abs = isNegative ? -b : b;
  const whole = abs / BigInt(1000000);
  const fraction = abs % BigInt(1000000);
  const fractionStr = fraction.toString().padStart(6, '0').slice(0, 2); // 2 decimal display
  return `${isNegative ? '-' : ''}${whole.toLocaleString('en-US')}.${fractionStr}`;
}

/**
 * Parse human-readable USDC decimal input into integer base units (6 decimals).
 */
export function parseUSDC(amountStr: string): bigint {
  const clean = amountStr.trim().replace(/,/g, '');
  if (!clean || isNaN(Number(clean))) return BigInt(0);
  const parts = clean.split('.');
  const whole = BigInt(parts[0] || '0');
  let fractionStr = parts[1] || '0';
  if (fractionStr.length > 6) {
    fractionStr = fractionStr.slice(0, 6);
  } else {
    fractionStr = fractionStr.padEnd(6, '0');
  }
  const fraction = BigInt(fractionStr);
  return whole * BigInt(1000000) + fraction;
}

export function formatAddress(address: string, chars = 4): string {
  if (!address || address.length < 10) return address || '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function getExplorerTxUrl(txHash: string): string {
  const base = ARC_TESTNET.blockExplorerUrls[0].replace(/\/+$/, '');
  return `${base}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address: string): string {
  const base = ARC_TESTNET.blockExplorerUrls[0].replace(/\/+$/, '');
  return `${base}/address/${address}`;
}
