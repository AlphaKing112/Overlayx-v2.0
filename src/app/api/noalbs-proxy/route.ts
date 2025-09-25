import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_NOALBS_STATS_URL;
  if (!url) {
    return NextResponse.json({ error: 'NOALBS stats URL not configured' }, { status: 500 });
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch NOALBS stats' }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
} 