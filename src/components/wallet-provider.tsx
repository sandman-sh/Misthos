'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { ARC_TESTNET, formatUSDC } from '@/lib/arc-config';

interface WalletContextType {
  address: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  isConnecting: boolean;
  usdcBalance: string;
  nativeBalance: string;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToArcTestnet: () => Promise<void>;
  getSigner: () => Promise<ethers.Signer | null>;
  getProvider: () => ethers.Provider | null;
  refreshBalances: () => Promise<void>;
  loginWithWallet: (role?: 'client' | 'contractor') => Promise<{ success: boolean; user?: any; error?: string }>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState<string>('0.00');
  const [nativeBalance, setNativeBalance] = useState<string>('0.00');

  const isCorrectNetwork = chainId === ARC_TESTNET.chainId;

  const refreshBalances = useCallback(async () => {
    if (!address) return;

    try {
      // Use Arc Testnet RPC provider to fetch live balance.
      // The public gateway does not support batched JSON-RPC, so disable client-side batching.
      const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrls[0], ARC_TESTNET.chainId, {
        staticNetwork: true,
        batchMaxCount: 1,
      });
      
      // On Arc, USDC is the native gas token
      const balance = await provider.getBalance(address);
      setNativeBalance(ethers.formatUnits(balance, ARC_TESTNET.nativeCurrency.decimals));
      
      // Also query ERC-20 interface if contract exists
      try {
        const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
        const usdcContract = new ethers.Contract(ARC_TESTNET.contracts.usdc, usdcAbi, provider);
        const erc20Bal = await usdcContract.balanceOf(address);
        setUsdcBalance(formatUSDC(erc20Bal));
      } catch {
        // Fallback to native balance as USDC is native on Arc
        setUsdcBalance(formatUSDC(balance));
      }
    } catch (err) {
      console.warn('Failed to refresh balances:', err);
    }
  }, [address]);

  const switchToArcTestnet = useCallback(async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('No EVM wallet detected. Please install MetaMask or another EVM wallet.');
      return;
    }

    const ethereum = (window as any).ethereum;

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_TESTNET.chainIdHex }],
      });
    } catch (switchError: any) {
      // Error 4902 indicates that the chain has not been added to the wallet
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: ARC_TESTNET.chainIdHex,
                chainName: ARC_TESTNET.chainName,
                rpcUrls: ARC_TESTNET.rpcUrls,
                nativeCurrency: ARC_TESTNET.nativeCurrency,
                blockExplorerUrls: ARC_TESTNET.blockExplorerUrls,
              },
            ],
          });
        } catch (addError) {
          console.error('Failed to add Arc Testnet to wallet:', addError);
          alert('Could not add Arc Testnet to your wallet.');
        }
      } else {
        console.error('Failed to switch to Arc Testnet:', switchError);
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('Please install MetaMask or a compatible EVM browser wallet to connect to Arc.');
      return;
    }

    setIsConnecting(true);
    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainHex, 16);

      if (accounts && accounts.length > 0) {
        const userAddress = accounts[0].toLowerCase();
        setAddress(userAddress);
        setChainId(currentChainId);

        if (currentChainId !== ARC_TESTNET.chainId) {
          await switchToArcTestnet();
        }

        // Notify server to associate address with user account
        fetch('/api/auth/wallet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: userAddress }),
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }, [switchToArcTestnet]);

  const loginWithWallet = useCallback(async (role: 'client' | 'contractor' = 'client') => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      return { success: false, error: 'Please install MetaMask or a compatible EVM browser wallet.' };
    }

    setIsConnecting(true);
    try {
      const ethereum = (window as any).ethereum;
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        return { success: false, error: 'No account selected in wallet.' };
      }

      const userAddress = accounts[0].toLowerCase();
      setAddress(userAddress);

      // Check / switch chain
      const currentChainHex = await ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainHex, 16);
      setChainId(currentChainId);
      if (currentChainId !== ARC_TESTNET.chainId) {
        try {
          await switchToArcTestnet();
        } catch {
          // Continue even if network switch is deferred
        }
      }

      // Request personal signature for cryptographic authentication
      const message = `Misthos Security: Sign in to Arc Milestone Escrow with wallet ${userAddress} at ${Date.now()}`;
      let signature: string | undefined;
      try {
        signature = await ethereum.request({
          method: 'personal_sign',
          params: [message, userAddress],
        });
      } catch (signErr: any) {
        // If user cancelled personal_sign, fallback to address auth on testnet
        console.warn('Personal sign skipped or declined by user, proceeding with direct address verification:', signErr);
      }

      // Call wallet login API
      const res = await fetch('/api/auth/wallet-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: userAddress,
          role,
          signature,
          message: signature ? message : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Wallet login failed on server.' };
      }

      return { success: true, user: data.user };
    } catch (err: any) {
      console.error('loginWithWallet failed:', err);
      return { success: false, error: err.message || 'Failed to authenticate wallet' };
    } finally {
      setIsConnecting(false);
    }
  }, [switchToArcTestnet]);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setUsdcBalance('0.00');
    setNativeBalance('0.00');
  }, []);

  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    if (typeof window === 'undefined' || !(window as any).ethereum || !address) {
      return null;
    }
    const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
    return browserProvider.getSigner();
  }, [address]);

  const getProvider = useCallback((): ethers.Provider | null => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      return new ethers.BrowserProvider((window as any).ethereum);
    }
    return new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrls[0]);
  }, []);

  // Listen for account/network changes
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    const ethereum = (window as any).ethereum;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAddress(accounts[0].toLowerCase());
      }
    };

    const handleChainChanged = (chainHex: string) => {
      setChainId(parseInt(chainHex, 16));
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);

    // Initial check
    ethereum
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => {
        if (accounts.length > 0) {
          setAddress(accounts[0].toLowerCase());
          ethereum.request({ method: 'eth_chainId' }).then((hex: string) => {
            setChainId(parseInt(hex, 16));
          });
        }
      })
      .catch(() => {});

    return () => {
      ethereum.removeListener('accountsChanged', handleAccountsChanged);
      ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [disconnectWallet]);

  useEffect(() => {
    if (address) {
      refreshBalances();
    }
  }, [address, chainId, refreshBalances]);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isCorrectNetwork,
        isConnecting,
        usdcBalance,
        nativeBalance,
        connectWallet,
        disconnectWallet,
        switchToArcTestnet,
        getSigner,
        getProvider,
        refreshBalances,
        loginWithWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
