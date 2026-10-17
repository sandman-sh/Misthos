import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import crypto from 'crypto';
import db from '@/lib/db';
import { loginOrCreateWithWallet, createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { walletAddress, role, signature, message } = await req.json();

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Valid EVM wallet address is required.' },
        { status: 400 }
      );
    }

    // If signature & challenge message are provided, verify cryptographically
    if (signature && message) {
      try {
        const recovered = ethers.verifyMessage(message, signature);
        if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
          return NextResponse.json(
            { error: 'Invalid wallet signature verification failed.' },
            { status: 401 }
          );
        }
      } catch (sigErr: any) {
        return NextResponse.json(
          { error: 'Cryptographic signature verification error: ' + sigErr.message },
          { status: 400 }
        );
      }
    }

    const effectiveRole = role === 'contractor' ? 'contractor' : 'client';
    const user = await loginOrCreateWithWallet(walletAddress, effectiveRole);

    // Establish persistent authenticated session
    await createSession(user.id);

    // Record audit event
    const now = Date.now();
    db.prepare(`
      INSERT INTO audit_events (
        id, entity_type, entity_id, actor_id, action, metadata, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'USER',
      user.id,
      user.id,
      'WALLET_LOGIN',
      JSON.stringify({ walletAddress: user.wallet_address, role: user.role }),
      now
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        wallet_address: user.wallet_address,
      },
    });
  } catch (error: any) {
    console.error('Wallet login error:', error);
    return NextResponse.json(
      { error: error.message || 'Server error during wallet login' },
      { status: 500 }
    );
  }
}
