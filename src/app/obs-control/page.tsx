"use client";

import { useState, useEffect, useRef } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import '@/styles/admin.css';

// Import OBS WebSocket client
import OBSWebSocket from 'obs-websocket-js';

interface OBSScene {
  name: string;
  sources: OBSSource[];
}

interface OBSSource {
  name: string;
  type: string;
  visible?: boolean;
  id?: number;
}

export default function OBSControlPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // OBS connection settings
  const [obsHost, setObsHost] = useState('localhost');
  const [obsPort, setObsPort] = useState('4455');
  const [obsPassword, setObsPassword] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [scenes, setScenes] = useState<OBSScene[]>([]);
  const [currentScene, setCurrentScene] = useState('');
  const [currentSceneSources, setCurrentSceneSources] = useState<OBSSource[]>([]);

  // Bitrate monitoring
  const [bitrateMonitorEnabled, setBitrateMonitorEnabled] = useState(false);
  const [currentBitrate, setCurrentBitrate] = useState<number>(0);
  const [lowBitrateThreshold, setLowBitrateThreshold] = useState<number>(500);
  const [lowBitrateScene, setLowBitrateScene] = useState<string>('');
  const [offlineScene, setOfflineScene] = useState<string>('');
  const [liveScene, setLiveScene] = useState<string>('');
  const bitrateMonitoringInterval = useRef<NodeJS.Timeout | null>(null);

  // OBS WebSocket client instance
  const obsClient = useRef<OBSWebSocket | null>(null);

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Check for existing session
  useEffect(() => {
    const savedAuth = localStorage.getItem('obs_admin_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    const savedHost = localStorage.getItem('obs_host');
    const savedPort = localStorage.getItem('obs_port');
    if (savedHost) setObsHost(savedHost);
    if (savedPort) setObsPort(savedPort);
  }, []);

  const handleLogin = async () => {
    if (!password.trim()) {
      showToastMessage('Please enter a password');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      
      if (response.ok) {
        setIsAuthenticated(true);
        localStorage.setItem('obs_admin_authenticated', 'true');
        setPassword('');
        showToastMessage('Successfully logged in!');
      } else {
        showToastMessage('Incorrect password. Please try again.');
      }
    } catch {
      showToastMessage('Login failed. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setConnected(false);
    localStorage.removeItem('obs_admin_authenticated');
    setPassword('');
    showToastMessage('Successfully logged out');
  };

  const connectToOBS = async () => {
    setIsLoading(true);
    try {
      // Initialize OBS WebSocket client if not already done
      if (!obsClient.current) {
        obsClient.current = new OBSWebSocket();
      }

      // Build connection URL
      const url = `ws://${obsHost}:${obsPort}`;
      
      // Connect to OBS
      await obsClient.current.connect(url, obsPassword || undefined);

      setConnected(true);
      localStorage.setItem('obs_host', obsHost);
      localStorage.setItem('obs_port', obsPort);
      
      // Get current scene list
      try {
        const scenesResponse = await obsClient.current.call('GetSceneList');
        console.log('Full Scenes Response:', JSON.stringify(scenesResponse, null, 2));
        
        // Handle both API response structures (v4 and v5)
        let sceneList: any[] = [];
        if ((scenesResponse as any).scenes) {
          sceneList = (scenesResponse as any).scenes;
        } else if ((scenesResponse as any).sceneList) {
          sceneList = (scenesResponse as any).sceneList;
        } else if (Array.isArray(scenesResponse)) {
          sceneList = scenesResponse as any[];
        }
        
        console.log('Scene List:', sceneList);
        
        setScenes(sceneList);
        
        const currentSceneName = (scenesResponse as any).currentProgramSceneName || 
                                  (scenesResponse as any).currentPreviewSceneName || 
                                  sceneList[0]?.sceneName ||
                                  sceneList[0]?.name || 
                                  '';
        setCurrentScene(currentSceneName);
        
        console.log('Current Scene:', currentSceneName);
        
        // Get sources for current scene
        if (currentSceneName) {
          await getSceneSources(currentSceneName);
        }
      } catch (err) {
        console.error('Failed to get scenes:', err);
      }

      // Get streaming status
      try {
        const streamStatus = await obsClient.current.call('GetStreamStatus');
        setStreaming(streamStatus.outputActive);
      } catch (err) {
        console.error('Failed to get streaming status:', err);
      }

      // Get recording status
      try {
        const recordStatus = await obsClient.current.call('GetRecordStatus');
        setRecording(recordStatus.outputActive || false);
      } catch (err) {
        console.error('Failed to get recording status:', err);
      }

      showToastMessage('Connected to OBS!');
    } catch (error: any) {
      console.error('OBS connection error:', error);
      setConnected(false);
      showToastMessage(`Failed to connect to OBS: ${error.message || 'Check your settings and ensure OBS WebSocket is enabled'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStreaming = async () => {
    if (!obsClient.current || !connected) {
      showToastMessage('Not connected to OBS');
      return;
    }

    try {
      if (streaming) {
        await obsClient.current.call('StopStream');
        setStreaming(false);
        showToastMessage('Stream stopped');
      } else {
        await obsClient.current.call('StartStream');
        setStreaming(true);
        showToastMessage('Stream started');
      }
    } catch (error: any) {
      showToastMessage(`Failed to toggle streaming: ${error.message}`);
    }
  };

  const toggleRecording = async () => {
    if (!obsClient.current || !connected) {
      showToastMessage('Not connected to OBS');
      return;
    }

    try {
      if (recording) {
        await obsClient.current.call('StopRecord');
        setRecording(false);
        showToastMessage('Recording stopped');
      } else {
        await obsClient.current.call('StartRecord');
        setRecording(true);
        showToastMessage('Recording started');
      }
    } catch (error: any) {
      showToastMessage(`Failed to toggle recording: ${error.message}`);
    }
  };

  const getSceneSources = async (sceneName: string) => {
    if (!obsClient.current || !connected) {
      return;
    }

    try {
      const response = await obsClient.current.call('GetSceneItemList', {
        sceneName: sceneName,
      });
      
      if (response.sceneItems) {
        const sources = response.sceneItems.map((item: any) => ({
          name: item.sourceName || item.name,
          type: item.sourceType || 'unknown',
          visible: item.sceneItemEnabled !== false,
          id: item.sceneItemId,
        }));
        setCurrentSceneSources(sources);
      }
    } catch (error: any) {
      console.error('Failed to get scene sources:', error);
      setCurrentSceneSources([]);
    }
  };

  const toggleSourceVisibility = async (sourceName: string, visible: boolean) => {
    if (!obsClient.current || !connected) {
      showToastMessage('Not connected to OBS');
      return;
    }

    const source = currentSceneSources.find(s => s.name === sourceName);
    if (!source || source.id === undefined) {
      showToastMessage(`Source "${sourceName}" not found`);
      return;
    }

    try {
      await obsClient.current.call('SetSceneItemEnabled', {
        sceneName: currentScene,
        sceneItemId: source.id,
        sceneItemEnabled: !visible,
      });
      
      // Update local state
      setCurrentSceneSources(prev => 
        prev.map(src => src.name === sourceName ? { ...src, visible: !visible } : src)
      );
      
      showToastMessage(`${sourceName} ${!visible ? 'shown' : 'hidden'}`);
    } catch (error: any) {
      showToastMessage(`Failed to toggle source: ${error.message}`);
    }
  };

  const switchScene = async (sceneName: string) => {
    if (!obsClient.current || !connected) {
      showToastMessage('Not connected to OBS');
      return;
    }

    try {
      await obsClient.current.call('SetCurrentProgramScene', {
        sceneName: sceneName,
      });
      setCurrentScene(sceneName);
      await getSceneSources(sceneName);
      showToastMessage(`Switched to: ${sceneName}`);
    } catch (error: any) {
      showToastMessage(`Failed to switch scene: ${error.message}`);
    }
  };

  const disconnectFromOBS = async () => {
    try {
      // Stop bitrate monitoring
      stopBitrateMonitoring();
      
      if (obsClient.current) {
        await obsClient.current.disconnect();
        obsClient.current = null;
      }
      setConnected(false);
      setScenes([]);
      setCurrentScene('');
      setCurrentSceneSources([]);
      setStreaming(false);
      setRecording(false);
      setCurrentBitrate(0);
      showToastMessage('Disconnected from OBS');
    } catch (error: any) {
      console.error('Error disconnecting from OBS:', error);
      setConnected(false);
      setCurrentSceneSources([]);
      setCurrentBitrate(0);
      showToastMessage('Disconnected from OBS (with errors)');
    }
  };

  const handleConnectDisconnect = async () => {
    if (connected) {
      await disconnectFromOBS();
    } else {
      await connectToOBS();
    }
  };

  // Check bitrate and switch scenes automatically
  const checkBitrateAndSwitchScene = async () => {
    if (!obsClient.current || !connected) return;

    try {
      // Get stream status
      const status = await obsClient.current.call('GetStreamStatus');
      const isStreaming = status.outputActive;
      
      // Try to get bitrate from Belabox/NOALBS if configured
      const noalbsUrl = process.env.NEXT_PUBLIC_NOALBS_STATS_URL;
      const publisherKey = process.env.NEXT_PUBLIC_SRT_PUBLISHER_KEY;
      
      let bitrate = 0;
      let publisherConnected = false;
      
      if (noalbsUrl) {
        try {
          console.log('[Bitrate Monitor] Fetching from NOALBS:', noalbsUrl);
          const response = await fetch('/api/noalbs-proxy', {
            signal: AbortSignal.timeout(3000) // 3 second timeout
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[Bitrate Monitor] NOALBS Response:', JSON.stringify(data, null, 2));
            
            // Try to find the publisher in the data
            if (data.publishers && publisherKey) {
              const publisher = data.publishers[publisherKey];
              if (publisher) {
                bitrate = publisher.bitrate || 0;
                publisherConnected = publisher.connected || false;
                console.log(`[Bitrate Monitor] Found publisher ${publisherKey}: bitrate=${bitrate}, connected=${publisherConnected}`);
              } else {
                console.log(`[Bitrate Monitor] Publisher ${publisherKey} not found in data`);
              }
            } else {
              console.log('[Bitrate Monitor] No publishers data or missing key');
            }
          } else if (response.status === 404) {
            // Belabox URL doesn't exist - don't spam logs, just use OBS
            console.log('[Bitrate Monitor] Belabox URL not found - using OBS stream status');
          } else {
            console.warn(`[Bitrate Monitor] NOALBS API returned ${response.status}`);
          }
        } catch {
          console.log('[Bitrate Monitor] Using OBS stream status (Belabox unavailable)');
        }
      } else {
        console.log('[Bitrate Monitor] NOALBS URL not configured');
      }
      
      // Fallback: Try to get bitrate from OBS stats
      if (bitrate === 0) {
        try {
          let stats: any = null;
          try {
            stats = await obsClient.current.call('GetStats');
          } catch {
            console.log('[Bitrate Monitor] GetStats not available');
          }
          
          if (stats) {
            bitrate = stats.kbps || stats.kbpsTotal || stats.outputBandwidth || 
                      stats.videoBitratePerSec || stats.audioBitratePerSec || 0;
          }
        } catch (err) {
          console.error('[Bitrate Monitor] Failed to get OBS stats:', err);
        }
      }
      
      setCurrentBitrate(bitrate);

      console.log(`[Bitrate Monitor] Current: ${bitrate} kbps, Threshold: ${lowBitrateThreshold} kbps, OBS Streaming: ${isStreaming}, Publisher Connected: ${publisherConnected}`);
      console.log(`[Bitrate Monitor] Current Scene: ${currentScene}`);
      console.log(`[Bitrate Monitor] Configured - Live: ${liveScene}, Offline: ${offlineScene}, Low Bitrate: ${lowBitrateScene}`);

      // Determine if stream is actually offline
      // If Belabox is configured and we have data, use it
      // Otherwise, just use OBS streaming status
      const hasBelaboxData = noalbsUrl && publisherKey;
      const isOnline = hasBelaboxData
        ? isStreaming && (publisherConnected || bitrate > 0)
        : isStreaming; // Fallback to OBS only if no Belabox configured
      
      console.log(`[Bitrate Monitor] isOnline=${isOnline}, isStreaming=${isStreaming}, publisherConnected=${publisherConnected}, bitrate=${bitrate}`);
      
      if (!isOnline) {
        // Stream is offline - switch to offline scene if configured
        if (offlineScene && currentScene !== offlineScene) {
          console.log(`[Bitrate Monitor] Bitrate: ${bitrate}, switching to offline scene: ${offlineScene}`);
          try {
            await obsClient.current.call('SetCurrentProgramScene', {
              sceneName: offlineScene,
            });
            setCurrentScene(offlineScene);
            showToastMessage(`Stream offline - switched to ${offlineScene}`);
            await getSceneSources(offlineScene);
            console.log(`[Bitrate Monitor] Successfully switched to offline scene`);
          } catch (err) {
            console.error(`[Bitrate Monitor] Failed to switch to offline scene:`, err);
          }
        }
      } else if (isOnline && (bitrate === 0 || bitrate >= lowBitrateThreshold)) {
        // Stream is live and good - switch to live scene if configured
        // Bitrate === 0 means Belabox not available, so just check OBS streaming
        if (liveScene && currentScene !== liveScene && currentScene !== lowBitrateScene) {
          console.log(`[Bitrate Monitor] Stream live (${bitrate} kbps), switching to live scene: ${liveScene}`);
          try {
            await obsClient.current.call('SetCurrentProgramScene', {
              sceneName: liveScene,
            });
            setCurrentScene(liveScene);
            showToastMessage(`Stream live - switched to ${liveScene}`);
            await getSceneSources(liveScene);
            console.log(`[Bitrate Monitor] Successfully switched to live scene`);
          } catch (err) {
            console.error(`[Bitrate Monitor] Failed to switch to live scene:`, err);
          }
        }
      } else if (bitrate > 0 && bitrate < lowBitrateThreshold) {
        // Low bitrate - switch to low bitrate scene if configured
        if (lowBitrateScene && currentScene !== lowBitrateScene) {
          console.log(`[Bitrate Monitor] Bitrate: ${bitrate} kbps (threshold: ${lowBitrateThreshold} kbps), switching to low bitrate scene: ${lowBitrateScene}`);
          console.log(`[Bitrate Monitor] Current scene: "${currentScene}" vs Low bitrate scene: "${lowBitrateScene}"`);
          try {
            await obsClient.current.call('SetCurrentProgramScene', {
              sceneName: lowBitrateScene,
            });
            setCurrentScene(lowBitrateScene);
            showToastMessage(`Low bitrate (${bitrate} kbps) - switched to ${lowBitrateScene}`);
            await getSceneSources(lowBitrateScene);
            console.log(`[Bitrate Monitor] Successfully switched to low bitrate scene`);
          } catch (err) {
            console.error(`[Bitrate Monitor] Failed to switch to low bitrate scene:`, err);
          }
        } else if (!lowBitrateScene) {
          console.log(`[Bitrate Monitor] Low bitrate detected but no scene configured`);
        } else if (currentScene === lowBitrateScene) {
          console.log(`[Bitrate Monitor] Already on low bitrate scene: ${lowBitrateScene}`);
        }
      } else if (bitrate >= lowBitrateThreshold) {
        // Good bitrate - could switch back to a normal scene if desired
        console.log(`[Bitrate Monitor] Good bitrate: ${bitrate} kbps (>= ${lowBitrateThreshold} kbps)`);
      }
    } catch (error) {
      console.error('[Bitrate Monitor] Failed to check bitrate:', error);
    }
  };

  // Start/stop bitrate monitoring
  const startBitrateMonitoring = () => {
    if (bitrateMonitoringInterval.current) {
      clearInterval(bitrateMonitoringInterval.current);
    }
    
    bitrateMonitoringInterval.current = setInterval(checkBitrateAndSwitchScene, 5000); // Check every 5 seconds
    checkBitrateAndSwitchScene(); // Check immediately
  };

  const stopBitrateMonitoring = () => {
    if (bitrateMonitoringInterval.current) {
      clearInterval(bitrateMonitoringInterval.current);
      bitrateMonitoringInterval.current = null;
    }
  };

  // Auto-start/stop monitoring based on enabled state
  useEffect(() => {
    if (bitrateMonitorEnabled && connected) {
      startBitrateMonitoring();
    } else {
      stopBitrateMonitoring();
    }

    return () => {
      stopBitrateMonitoring();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitrateMonitorEnabled, connected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (obsClient.current) {
        obsClient.current.disconnect().catch(console.error);
      }
      stopBitrateMonitoring();
    };
  }, []);

  // Render login form if not authenticated
  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <div className="admin-container">
        <div className="admin-content">
          <div className="admin-login">
            <h1>🎮 OBS Control Panel</h1>
            <p>Control your OBS Studio from here</p>
            
            <div className="form-group">
              <label htmlFor="password">Admin Password:</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleLogin()}
                placeholder="Enter password"
                disabled={isLoading}
                className={isLoading ? 'loading' : ''}
              />
            </div>
            
            <button 
              onClick={handleLogin} 
              disabled={isLoading}
              className={`primary ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? '🔄 Logging in...' : '🔐 Access Panel'}
            </button>
          </div>
        </div>

        {showToast && (
          <div className={`toast ${toastMessage.includes('Failed') ? 'error' : 'success'}`}>
            {toastMessage}
          </div>
        )}
      </div>
      </ErrorBoundary>
    );
  }

  // Render OBS control panel
  return (
    <ErrorBoundary>
      <div className="admin-container">
      <div className="admin-content">
        {/* Header */}
        <div className="admin-header">
          <div className="header-main">
            <h1>🎮 OBS Control Panel</h1>
            <p>Control your OBS Studio</p>
          </div>
          <div className="header-actions">
            <button onClick={handleLogout} className="logout-btn">
              <span className="btn-icon">🚪</span>
              <span className="btn-text">Logout</span>
            </button>
          </div>
        </div>

        {/* OBS Connection Section */}
        <div className="settings-container" style={{ marginBottom: 30 }}>
          <div className="settings-header">
            <h2>OBS Connection</h2>
            <p>Connect to your OBS WebSocket server</p>
          </div>

          <div className="settings-list">
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">🌐</div>
                <div className="setting-details">
                  <h3>WebSocket Host</h3>
                  <p>OBS WebSocket server address</p>
                </div>
              </div>
              <div className="setting-control">
                <input
                  type="text"
                  value={obsHost}
                  onChange={(e) => setObsHost(e.target.value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '2px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">🔌</div>
                <div className="setting-details">
                  <h3>WebSocket Port</h3>
                  <p>OBS WebSocket server port (default: 4455)</p>
                </div>
              </div>
              <div className="setting-control">
                <input
                  type="text"
                  value={obsPort}
                  onChange={(e) => setObsPort(e.target.value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '2px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">🔑</div>
                <div className="setting-details">
                  <h3>WebSocket Password</h3>
                  <p>Optional OBS WebSocket password</p>
                </div>
              </div>
              <div className="setting-control">
                <input
                  type="password"
                  value={obsPassword}
                  onChange={(e) => setObsPassword(e.target.value)}
                  placeholder="Leave empty if no password"
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '2px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">{connected ? '🟢' : '🔴'}</div>
                <div className="setting-details">
                  <h3>Connection Status</h3>
                  <p>{connected ? 'Connected to OBS' : 'Not connected to OBS'}</p>
                </div>
              </div>
              <div className="setting-control">
                <button
                  onClick={handleConnectDisconnect}
                  disabled={isLoading}
                  className="primary"
                  style={{
                    background: connected 
                      ? 'linear-gradient(45deg, #dc2626, #b91c1c)' 
                      : 'linear-gradient(45deg, #22c55e, #16a34a)',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: 'auto',
                  }}
                >
                  {connected ? '⛔ Disconnect' : '🔌 Connect to OBS'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* OBS Control Section */}
        {connected && (
          <div className="settings-container" style={{ marginBottom: 30 }}>
            <div className="settings-header">
              <h2>Quick Controls</h2>
              <p>Control streaming and recording</p>
            </div>

            <div className="settings-list">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-icon">📡</div>
                  <div className="setting-details">
                    <h3>Streaming Status</h3>
                    <p>{streaming ? 'Currently streaming' : 'Not streaming'}</p>
                  </div>
                </div>
                <div className="setting-control">
                  <button
                    onClick={toggleStreaming}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: streaming
                        ? 'linear-gradient(45deg, #dc2626, #b91c1c)'
                        : 'linear-gradient(45deg, #22c55e, #16a34a)',
                      color: 'white',
                    }}
                  >
                    {streaming ? '⏹️ Stop Streaming' : '▶️ Start Streaming'}
                  </button>
                </div>
              </div>

              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-icon">🎬</div>
                  <div className="setting-details">
                    <h3>Recording Status</h3>
                    <p>{recording ? 'Currently recording' : 'Not recording'}</p>
                  </div>
                </div>
                <div className="setting-control">
                  <button
                    onClick={toggleRecording}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '12px',
                      border: 'none',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: recording
                        ? 'linear-gradient(45deg, #dc2626, #b91c1c)'
                        : 'linear-gradient(45deg, #3b82f6, #2563eb)',
                      color: 'white',
                    }}
                  >
                    {recording ? '⏹️ Stop Recording' : '🔴 Start Recording'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Scene Control Section */}
        {connected && scenes.length > 0 && (
          <div className="settings-container" style={{ marginBottom: 30 }}>
            <div className="settings-header">
              <h2>🎭 Scene Control</h2>
              <p>Switch scenes and control sources</p>
            </div>

            <div className="settings-list">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-icon">🎭</div>
                  <div className="setting-details">
                    <h3>Switch Scene</h3>
                    <p>{currentScene || 'Select a scene'}</p>
                  </div>
                </div>
                <div className="setting-control">
                  <select
                    value={currentScene}
                    onChange={(e) => switchScene(e.target.value)}
                    className="select-control"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '2px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      fontSize: 14,
                      minWidth: 200,
                    }}
                    >
                      {scenes.map((scene, index) => {
                        const sceneName = (scene as any).name || (scene as any).sceneName || `Scene ${index + 1}`;
                        return (
                          <option key={`scene-${sceneName}-${index}`} value={sceneName}>
                            {sceneName}
                          </option>
                        );
                      })}
                    </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sources Control Section */}
        {connected && currentSceneSources.length > 0 && (
          <div className="settings-container" style={{ marginBottom: 30 }}>
            <div className="settings-header">
              <h2>🎬 Sources Control</h2>
              <p>Toggle visibility of sources in the current scene</p>
            </div>

            <div className="settings-list">
              {currentSceneSources.map((source, index) => (
                <div key={`source-${source.name}-${index}`} className="setting-item">
                  <div className="setting-info">
                    <div className="setting-icon">
                      {source.visible ? '👁️' : '🙈'}
                    </div>
                    <div className="setting-details">
                      <h3>{source.name}</h3>
                      <p>{source.type} • {source.visible ? 'Visible' : 'Hidden'}</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <button
                      onClick={() => toggleSourceVisibility(source.name, source.visible || false)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: source.visible
                          ? 'linear-gradient(45deg, #22c55e, #16a34a)'
                          : 'linear-gradient(45deg, #dc2626, #b91c1c)',
                        color: 'white',
                      }}
                    >
                      {source.visible ? '👁️ Hide' : '🙈 Show'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bitrate Monitoring Section */}
        {connected && scenes.length > 0 && (
          <div className="settings-container" style={{ marginBottom: 30 }}>
            <div className="settings-header">
              <h2>📡 Bitrate Monitoring</h2>
              <p>Automatically switch scenes when bitrate drops or stream goes offline</p>
            </div>

            <div className="settings-list">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-icon">📊</div>
                  <div className="setting-details">
                    <h3>Enable Bitrate Monitoring</h3>
                    <p>Automatically monitor stream bitrate and switch scenes</p>
                  </div>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={bitrateMonitorEnabled}
                      onChange={(e) => setBitrateMonitorEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              {bitrateMonitorEnabled && (
                <>
                  <div className="setting-item sub-setting">
                    <div className="setting-info">
                      <div className="setting-icon">📉</div>
                      <div className="setting-details">
                        <h3>Current Bitrate</h3>
                        <p>{currentBitrate > 0 ? `${currentBitrate} kbps` : 'No bitrate data (check OBS stream status)'}</p>
                      </div>
                    </div>
                    <div className="setting-control">
                      <div style={{ 
                        padding: '8px 12px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        fontSize: 12,
                        color: '#93c5fd'
                      }}>
                        Configure scenes below to enable auto-switching
                      </div>
                    </div>
                  </div>

                  <div className="setting-item sub-setting">
                    <div className="setting-info">
                      <div className="setting-icon">⚙️</div>
                      <div className="setting-details">
                        <h3>Low Bitrate Threshold (kbps)</h3>
                        <p>Switch scene when bitrate drops below this value</p>
                      </div>
                    </div>
                    <div className="setting-control">
                      <input
                        type="number"
                        value={lowBitrateThreshold}
                        onChange={(e) => setLowBitrateThreshold(Number(e.target.value))}
                        min={0}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '2px solid rgba(255,255,255,0.1)',
                          color: '#fff',
                          fontSize: 14,
                          width: 100,
                        }}
                      />
                    </div>
                  </div>

                  <div className="setting-item sub-setting">
                    <div className="setting-info">
                      <div className="setting-icon">🟢</div>
                      <div className="setting-details">
                        <h3>Live Scene</h3>
                        <p>Scene to switch to when stream is live and healthy</p>
                      </div>
                    </div>
                    <div className="setting-control">
                      <select
                        value={liveScene}
                        onChange={(e) => setLiveScene(e.target.value)}
                        className="select-control"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '2px solid rgba(255,255,255,0.1)',
                          color: '#fff',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: 14,
                          minWidth: 150,
                        }}
                      >
                        <option value="">Select scene...</option>
                        {scenes.map((scene, index) => {
                          const sceneName = (scene as any).name || (scene as any).sceneName || `Scene ${index + 1}`;
                          return (
                            <option key={`live-scene-${sceneName}-${index}`} value={sceneName}>
                              {sceneName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="setting-item sub-setting">
                    <div className="setting-info">
                      <div className="setting-icon">🟡</div>
                      <div className="setting-details">
                        <h3>Low Bitrate Scene</h3>
                        <p>Scene to switch to when bitrate is low</p>
                      </div>
                    </div>
                    <div className="setting-control">
                      <select
                        value={lowBitrateScene}
                        onChange={(e) => setLowBitrateScene(e.target.value)}
                        className="select-control"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '2px solid rgba(255,255,255,0.1)',
                          color: '#fff',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: 14,
                          minWidth: 150,
                        }}
                      >
                        <option value="">Select scene...</option>
                        {scenes.map((scene, index) => {
                          const sceneName = (scene as any).name || (scene as any).sceneName || `Scene ${index + 1}`;
                          return (
                            <option key={`low-bitrate-scene-${sceneName}-${index}`} value={sceneName}>
                              {sceneName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="setting-item sub-setting">
                    <div className="setting-info">
                      <div className="setting-icon">🔴</div>
                      <div className="setting-details">
                        <h3>Offline Scene</h3>
                        <p>Scene to switch to when stream is offline or bitrate is 0</p>
                      </div>
                    </div>
                    <div className="setting-control">
                      <select
                        value={offlineScene}
                        onChange={(e) => setOfflineScene(e.target.value)}
                        className="select-control"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '2px solid rgba(255,255,255,0.1)',
                          color: '#fff',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontSize: 14,
                          minWidth: 150,
                        }}
                      >
                        <option value="">Select scene...</option>
                        {scenes.map((scene, index) => {
                          const sceneName = (scene as any).name || (scene as any).sceneName || `Scene ${index + 1}`;
                          return (
                            <option key={`offline-scene-${sceneName}-${index}`} value={sceneName}>
                              {sceneName}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Setup Instructions */}
        {!connected && (
          <div className="settings-container">
            <div className="settings-header">
              <h2>Setup Instructions</h2>
              <p>How to enable OBS WebSocket server</p>
            </div>

            <div className="settings-list">
              <div className="setting-item">
                <div className="setting-info">
                  <div className="setting-icon">📋</div>
                  <div className="setting-details">
                    <h3>Install OBS WebSocket</h3>
                    <p>Download and install the OBS WebSocket plugin</p>
                    <div className="info-box" style={{ marginTop: 16 }}>
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
                        <strong>Steps:</strong><br />
                        1. Go to <a href="https://github.com/obsproject/obs-websocket" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>obs-websocket GitHub</a><br />
                        2. Download the latest release<br />
                        3. Install the plugin in OBS Studio<br />
                        4. Enable WebSocket in OBS Settings &gt;&gt; WebSocket<br />
                        5. Set a password (optional but recommended)<br />
                        6. Click &quot;Connect to OBS&quot; above
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className={`toast ${toastMessage.includes('Failed') ? 'error' : 'success'}`}>
          <span className="toast-icon">{toastMessage.includes('Failed') ? '❌' : '✓'}</span>
          <span className="toast-text">{toastMessage}</span>
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}

