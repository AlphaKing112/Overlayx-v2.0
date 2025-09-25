import { NextResponse } from 'next/server';
import { broadcastRefresh } from '@/lib/settings-broadcast';

export async function POST() {
  try {
    broadcastRefresh();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
} 