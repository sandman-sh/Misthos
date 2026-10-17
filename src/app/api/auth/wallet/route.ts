import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, updateUserWallet } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { walletAddress } = await req.json();
    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required.' }, { status: 400 });
    }

    await updateUserWallet(user.id, walletAddress);

    return NextResponse.json({
      success: true,
      wallet_address: walletAddress.toLowerCase(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
