import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_NOALBS_STATS_URL;
  if (!url) {
    return NextResponse.json({ error: 'NOALBS stats URL not configured' }, { status: 500 });
  }
  
  try {
    // Check if URL already ends with /stats
    const hasStatsEndpoint = url.endsWith('/stats');
    const baseUrl = hasStatsEndpoint ? url.replace('/stats', '') : url;
    
    // Try different endpoints that Belabox/NOALBS might use
    const endpoints = [
      '/stats',           // SLS standard endpoint
      '/api/streams',      // NOALBS API endpoint
      '',                  // Root of the URL
    ];
    
    for (const endpoint of endpoints) {
      let timeout: NodeJS.Timeout | null = null;
      try {
        // Don't double-add /stats if URL already has it
        const fullUrl = hasStatsEndpoint && endpoint === '' 
          ? url 
          : `${baseUrl}${endpoint}`;
        
        console.log(`[NOALBS] Trying: ${fullUrl}`);
        
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        const res = await fetch(fullUrl, {
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        
        clearTimeout(timeout);
        timeout = null;
        
        if (res.ok) {
          const data = await res.json();
          console.log(`[NOALBS] Successfully fetched from ${fullUrl}`);
          return NextResponse.json(data);
        } else {
          console.log(`[NOALBS] ${fullUrl} returned status ${res.status}`);
        }
      } catch (err: any) {
        if (timeout) clearTimeout(timeout);
        
        if (err.name === 'AbortError') {
          console.log(`[NOALBS] Request timed out for endpoint ${endpoint}`);
        } else {
          console.log(`[NOALBS] Failed to fetch from endpoint ${endpoint}:`, err);
        }
        continue;
      }
    }
    
    // If all endpoints failed
    return NextResponse.json({ 
      error: 'Failed to fetch from NOALBS/Belabox', 
      attemptedUrl: url,
      baseUrl: baseUrl,
      details: 'Tried multiple endpoints'
    }, { status: 404 });
    
  } catch (error) {
    console.error('[NOALBS] Proxy error:', error);
    return NextResponse.json({ 
      error: 'Proxy error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 