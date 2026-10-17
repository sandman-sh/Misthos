import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from './db';

export interface User {
  id: string;
  email: string;
  name: string;
  wallet_address?: string | null;
  role: 'client' | 'contractor';
  created_at: number;
}

export interface Session {
  token: string;
  user_id: string;
  expires_at: number;
}

const SESSION_COOKIE_NAME = 'misthos_session';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_EXPIRY_MS;

  const insert = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  insert.run(token, userId, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: new Date(expiresAt)
  });

  return token;
}

export async function getSessionUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const row = db.prepare(`
      SELECT u.id, u.email, u.name, u.wallet_address, u.role, u.created_at, s.expires_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ?
    `).get(token) as (User & { expires_at: number }) | undefined;

    if (!row) return null;

    if (row.expires_at < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      wallet_address: row.wallet_address,
      role: row.role,
      created_at: row.created_at
    };
  } catch (error) {
    console.error('Error fetching session user:', error);
    return null;
  }
}

export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      cookieStore.delete(SESSION_COOKIE_NAME);
    }
  } catch (error) {
    console.error('Error destroying session:', error);
  }
}

export async function updateUserWallet(userId: string, walletAddress: string): Promise<void> {
  db.prepare(`
    UPDATE users SET wallet_address = ? WHERE id = ?
  `).run(walletAddress.toLowerCase(), userId);
}

export async function loginOrCreateWithWallet(
  walletAddress: string,
  role: 'client' | 'contractor' = 'client'
): Promise<User> {
  const normalized = walletAddress.toLowerCase().trim();
  
  // Check if a user with this wallet already exists
  let user = db.prepare(`
    SELECT id, email, name, wallet_address, role, created_at
    FROM users WHERE wallet_address = ?
  `).get(normalized) as User | undefined;

  if (!user) {
    const userId = crypto.randomUUID();
    const short = normalized.slice(2, 8).toUpperCase();
    const name = `Operator 0x${short}`;
    const syntheticEmail = `${normalized.slice(0, 10)}@arc.wallet`;
    const now = Date.now();
    const dummyHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, wallet_address, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, syntheticEmail, dummyHash, name, normalized, role, now);

    user = {
      id: userId,
      email: syntheticEmail,
      name,
      wallet_address: normalized,
      role,
      created_at: now,
    };
  }

  return user;
}
