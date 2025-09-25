import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    if (typeof data.level !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid battery level' }, { status: 400 });
    }
    const batteryData = {
      level: data.level,
      timestamp: new Date().toISOString(),
      charging: typeof data.charging === 'boolean' ? data.charging : false,
    };
    await kv.set('latest_battery', batteryData);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  const latestBattery = await kv.get('latest_battery');
  if (!latestBattery) {
    return NextResponse.json({ level: null, charging: false, timestamp: null });
  }
  return NextResponse.json(latestBattery);
} 