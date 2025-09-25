import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { DEFAULT_OVERLAY_SETTINGS } from '@/types/settings';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const settings = await kv.get('overlay_settings');
    const merged = { ...DEFAULT_OVERLAY_SETTINGS, ...(settings || {}) };
    return new NextResponse(
      JSON.stringify(merged),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
} 