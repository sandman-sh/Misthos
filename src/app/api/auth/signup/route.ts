import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, role, walletAddress } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const userRole = role === 'contractor' ? 'contractor' : 'client';
    const createdAt = Date.now();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, wallet_address, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      normalizedEmail,
      passwordHash,
      name.trim(),
      walletAddress ? walletAddress.toLowerCase() : null,
      userRole,
      createdAt
    );

    // Create session
    await createSession(userId);

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: normalizedEmail,
        name: name.trim(),
        role: userRole,
        wallet_address: walletAddress ? walletAddress.toLowerCase() : null,
      },
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
