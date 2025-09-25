import { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import { addConnection, removeConnection } from '@/lib/settings-broadcast';
import { DEFAULT_OVERLAY_SETTINGS } from '@/types/settings';

// === 📡 SERVER-SENT EVENTS STREAM ===
export async function GET(request: NextRequest): Promise<Response> {
  // Debug: Log incoming request headers and cookies
  console.log('[DEBUG] Incoming SSE request');
  const headersArr: [string, string][] = [];
  request.headers.forEach((value, key) => {
    headersArr.push([key, value]);
  });
  try {
    const cookieHeader = request.headers.get('cookie');
  } catch (e) {
    console.error('[DEBUG] Error reading cookies:', e);
  }

  const encoder = new TextEncoder();

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      let lastModified = 0;
      const connectionId = `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`[SSE] New connection established: ${connectionId}`);

      // Register this connection with the broadcast system
      addConnection(controller, connectionId);

      // Function to send SSE data
      const sendSSE = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch (error) {
          console.error(`[SSE] Failed to send data to ${connectionId}:`, error);
        }
      };

      // Function to check for settings updates
      const checkForUpdates = async () => {
        try {
          // Always send the real settings from KV, merged with defaults
          const [settings, modifiedTimestamp] = await Promise.all([
            kv.get('overlay_settings'),
            kv.get('overlay_settings_modified')
          ]);
          const mergedSettings = { ...DEFAULT_OVERLAY_SETTINGS, ...(settings || {}) };
          const currentModified = modifiedTimestamp as number || Date.now();

          if (currentModified > lastModified) {
            lastModified = currentModified;
            const settingsUpdate = {
              ...mergedSettings,
              type: 'settings_update',
              timestamp: currentModified
            };
            sendSSE(JSON.stringify(settingsUpdate));
            console.log(`[DEBUG] Sent settings update to ${connectionId}`);
          }
        } catch (error) {
          console.error('Error checking settings:', error);
        }
      };

      // Send initial connection message and current settings
      sendSSE(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
      // Send current settings immediately
      await checkForUpdates();

      // Check for updates every 2 seconds
      const interval = setInterval(checkForUpdates, 2000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Connection closed: ${connectionId}`);
        clearInterval(interval);
        removeConnection(connectionId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
} 