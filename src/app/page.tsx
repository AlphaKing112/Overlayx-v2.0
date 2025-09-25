"use client";

import { useState, useEffect } from 'react';
import { authenticatedFetch } from '@/lib/client-auth';
import { OverlaySettings, DEFAULT_OVERLAY_SETTINGS, LocationDisplayMode, MinimapPosition } from '@/types/settings';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useRenderPerformance } from '@/lib/performance';
import '@/styles/admin.css';

export default function AdminPage() {
  // Performance monitoring
  useRenderPerformance('AdminPage');
  
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [settings, setSettings] = useState<OverlaySettings>(DEFAULT_OVERLAY_SETTINGS);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    const duration = message.includes('✓') ? 1500 : 3000;
    setTimeout(() => setShowToast(false), duration);
  };

  // Check for existing session
  useEffect(() => {
    const savedAuth = localStorage.getItem('admin_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Load settings when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      authenticatedFetch('/api/get-settings')
        .then(res => {
          if (!res.ok) {
            if (res.status === 401) {
              // Not authenticated - use default settings
              console.log('Not authenticated, using default settings');
              setSettings(DEFAULT_OVERLAY_SETTINGS);
              return null;
            }
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          if (data) {
            setSettings(data);
          }
        })
        .catch((error) => {
          console.error('Failed to load settings:', error);
          showToastMessage('Failed to load settings. Using defaults.');
          setSettings(DEFAULT_OVERLAY_SETTINGS);
        })
        .finally(() => setIsLoading(false));
    }
  }, [isAuthenticated]);

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
        localStorage.setItem('admin_authenticated', 'true');
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
    localStorage.removeItem('admin_authenticated');
    setPassword('');
    setSettings(DEFAULT_OVERLAY_SETTINGS);
    showToastMessage('Successfully logged out');
  };

  // === ⚙️ SETTINGS HANDLERS ===
  const handleSettingsChange = async (newSettings: Partial<OverlaySettings>) => {
    let updatedSettings = { ...settings, ...newSettings };
    
    // Auto-disable minimap settings when location is hidden
    if (newSettings.locationDisplay === 'hidden') {
      updatedSettings = {
        ...updatedSettings,
        showMinimap: false,
        minimapSpeedBased: false,
      };
    }
    // Auto-enable minimapSpeedBased when city is selected
    if (newSettings.locationDisplay === 'city') {
      updatedSettings = {
        ...updatedSettings,
        minimapSpeedBased: true,
      };
    }
    // Auto-disable minimapSpeedBased when state or country is selected
    if (newSettings.locationDisplay === 'state' || newSettings.locationDisplay === 'country') {
      updatedSettings = {
        ...updatedSettings,
        minimapSpeedBased: false,
      };
    }
    
    setSettings(updatedSettings);
    
    // Auto-save on every change
    try {
      const response = await authenticatedFetch('/api/save-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated - this is expected when not logged in
          console.log('Not authenticated, settings not saved');
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      showToastMessage('Saved');
    } catch (error) {
      console.warn('Auto-save warning (settings may still be saved):', error);
    }
  };

  // === 🎨 RENDER LOGIN FORM ===
  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <div className="admin-container">
        <div className="admin-content">
          <div className="admin-login">
            <h1>🎮 Stream Control Panel</h1>
            <p>Configure your live streaming overlay</p>
            
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

  // === 🎨 RENDER ADMIN PANEL ===
  // Clamp function and max offset calculations for Speedmeter
  function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
  }
  const overlayWidth = 1920;
  const overlayHeight = 1080;
  const speedmeterSize = settings.speedmeterSize ?? 140;
  const maxX = Math.floor(overlayWidth / 2 - speedmeterSize / 2);
  const maxY = Math.floor(overlayHeight / 2 - speedmeterSize / 2);
  return (
    <ErrorBoundary>
      <div className="admin-container">
      <div className="admin-content">
        {/* Header */}
        <div className="admin-header">
          <div className="header-main">
            <h1>🎮 Stream Control</h1>
            <p>Configure your live streaming overlay</p>
          </div>
          <div className="header-actions">
            <a 
              href="/overlay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="preview-btn"
            >
              <span className="btn-icon">🖥️</span>
              <span className="btn-text">Preview</span>
            </a>
            <button onClick={handleLogout} className="logout-btn">
              <span className="btn-icon">🚪</span>
              <span className="btn-text">Logout</span>
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <span>Loading settings...</span>
          </div>
        )}

        {/* Settings Container */}
        <div className="settings-container">
          <div className="settings-header">
            <h2 style={{ display: 'inline-block', marginRight: 12 }}>
              Overlay Settings
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/refresh-overlays', { method: 'POST' });
                    if (res.ok) {
                      showToastMessage('Refresh event sent to overlays!');
                    } else {
                      showToastMessage('Failed to refresh overlays.');
                    }
                  } catch {
                    showToastMessage('Failed to refresh overlays.');
                  }
                }}
                className="refresh-btn modern-green"
                style={{
                  marginLeft: 8,
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 13,
                  border: 'none',
                  boxShadow: '0 1px 4px rgba(34,197,94,0.10)',
                  transition: 'background 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                  verticalAlign: 'middle',
                  WebkitTextFillColor: '#fff', // Force white text even inside gradient headings
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'linear-gradient(90deg, #16a34a 0%, #22c55e 100%)')}
                onMouseOut={e => (e.currentTarget.style.background = 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)')}
                title="Force all overlays to reload"
              >
                <span className="btn-icon" style={{ fontSize: 14, marginRight: 4, color: '#fff', WebkitTextFillColor: '#fff' }}>🔄</span>
                <span className="btn-text" style={{ color: '#fff', WebkitTextFillColor: '#fff' }}>Refresh</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch('/api/save-settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(DEFAULT_OVERLAY_SETTINGS),
                    });
                    if (res.ok) {
                      showToastMessage('Overlay settings reset to defaults!');
                      // Reload settings from server
                      const getRes = await fetch('/api/get-settings');
                      if (getRes.ok) {
                        const data = await getRes.json();
                        setSettings({ ...DEFAULT_OVERLAY_SETTINGS, ...data });
                      }
                    } else {
                      showToastMessage('Failed to reset settings.');
                    }
                  } catch {
                    showToastMessage('Failed to reset settings.');
                  }
                }}
                style={{
                  marginLeft: 8,
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: 'none',
                  color: '#22c55e',
                  fontWeight: 600,
                  fontSize: 13,
                  border: '1.5px solid #22c55e',
                  boxShadow: 'none',
                  transition: 'background 0.2s, color 0.2s, border 0.2s',
                  cursor: 'pointer',
                  verticalAlign: 'middle',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                title="Reset overlay settings to defaults"
              >
                <span className="btn-icon" style={{ fontSize: 14, marginRight: 4, color: '#22c55e' }}>↩️</span>
                <span className="btn-text" style={{ color: '#22c55e' }}>Reset to Defaults</span>
              </button>
            </h2>
            <p>Toggle features on/off for your stream</p>
          </div>

          <div className="settings-list">

            {/* Custom URLs List (Redesigned) */}
            <div className="custom-urls-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 22 }}>Custom URL Overlays</h3>
                <button className="add-url-btn" type="button" onClick={() => {
                  const newUrls = [...(settings.customUrls || []), { url: '', zoom: 1, offsetX: 0, offsetY: 0, enabled: true }];
                  handleSettingsChange({ customUrls: newUrls });
                }}>+ Add URL Overlay</button>
              </div>
              <div className="custom-urls-list">
                {(settings.customUrls || []).map((overlay, idx) => (
                  <div className="url-card" key={idx}>
                    <button className="remove-btn" type="button" onClick={() => {
                      const newUrls = settings.customUrls.slice();
                      newUrls.splice(idx, 1);
                      handleSettingsChange({ customUrls: newUrls });
                    }} title="Remove Overlay">✕</button>
                    <div className="url-input-row">
                      <span className="url-label">URL #{idx + 1}</span>
                      <input
                        type="text"
                        value={overlay.url}
                        onChange={e => {
                          const newUrls = settings.customUrls.slice();
                          newUrls[idx] = { ...overlay, url: e.target.value };
                          handleSettingsChange({ customUrls: newUrls });
                        }}
                        placeholder="https://your-link.com"
                        className="url-input"
                      />
                    </div>
                    <div style={{ margin: '8px 0 0 0', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        type="button"
                        className={overlay.enabled ? 'enable-btn enabled' : 'enable-btn disabled'}
                        onClick={() => {
                          const newUrls = settings.customUrls.slice();
                          newUrls[idx] = { ...overlay, enabled: !overlay.enabled };
                          handleSettingsChange({ customUrls: newUrls });
                        }}
                        title={overlay.enabled ? 'Disable Overlay' : 'Enable Overlay'}
                      >
                        {overlay.enabled ? '🟢 Enabled' : '🔴 Disabled'}
                      </button>
                    </div>
                    <div className="url-controls-row">
                      <label className="zoom-label">Zoom:
                        <input
                          type="range"
                          min={0.1}
                          max={5.0}
                          step={0.01}
                          value={overlay.zoom ?? 1}
                          onChange={e => {
                            const newUrls = settings.customUrls.slice();
                            newUrls[idx] = { ...overlay, zoom: Number(e.target.value) };
                            handleSettingsChange({ customUrls: newUrls });
                          }}
                          className="zoom-slider"
                        />
                        <input
                          type="number"
                          min={0.1}
                          max={5.0}
                          step={0.01}
                          value={overlay.zoom ?? 1}
                          onChange={e => {
                            const newUrls = settings.customUrls.slice();
                            newUrls[idx] = { ...overlay, zoom: Number(e.target.value) };
                            handleSettingsChange({ customUrls: newUrls });
                          }}
                          className="zoom-input"
                        />
                        x
                      </label>
                      <div className="move-btns">
                        <button type="button" onClick={() => {
                          const newUrls = settings.customUrls.slice();
                          newUrls[idx] = { ...overlay, offsetY: overlay.offsetY - 5 };
                          handleSettingsChange({ customUrls: newUrls });
                        }} title="Up" className="move-btn">↑</button>
                        <div style={{ display: 'flex', flexDirection: 'row' }}>
                          <button type="button" onClick={() => {
                            const newUrls = settings.customUrls.slice();
                            newUrls[idx] = { ...overlay, offsetX: overlay.offsetX - 5 };
                            handleSettingsChange({ customUrls: newUrls });
                          }} title="Left" className="move-btn">←</button>
                          <button type="button" onClick={() => {
                            const newUrls = settings.customUrls.slice();
                            newUrls[idx] = { ...overlay, offsetX: overlay.offsetX + 5 };
                            handleSettingsChange({ customUrls: newUrls });
                          }} title="Right" className="move-btn">→</button>
                        </div>
                        <button type="button" onClick={() => {
                          const newUrls = settings.customUrls.slice();
                          newUrls[idx] = { ...overlay, offsetY: overlay.offsetY + 5 };
                          handleSettingsChange({ customUrls: newUrls });
                        }} title="Down" className="move-btn">↓</button>
                      </div>
                    </div>
                    <div className="offset-display">X: {overlay.offsetX ?? 0}px, Y: {overlay.offsetY ?? 0}px</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overlay Background Toggle */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">🎨</div>
                <div className="setting-details">
                  <h3>Overlay Background</h3>
                  <p>Show or hide the background behind location, weather, time, and date overlays</p>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.showOverlayBackground}
                    onChange={e => handleSettingsChange({ showOverlayBackground: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Location Display */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">📍</div>
                <div className="setting-details">
                  <h3>Location Display</h3>
                  <p>Choose location format or hide completely</p>
                </div>
              </div>
              <div className="setting-control">
                <div className="location-options">
                  <label className={`location-option ${settings.locationDisplay === 'city' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="locationDisplay"
                      value="city"
                      checked={settings.locationDisplay === 'city'}
                      onChange={(e) => handleSettingsChange({ locationDisplay: e.target.value as LocationDisplayMode })}
                    />
                    <span className="option-icon">🏙️</span>
                    <span className="option-text">City</span>
                  </label>
                  
                  <label className={`location-option ${settings.locationDisplay === 'state' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="locationDisplay"
                      value="state"
                      checked={settings.locationDisplay === 'state'}
                      onChange={(e) => handleSettingsChange({ locationDisplay: e.target.value as LocationDisplayMode })}
                    />
                    <span className="option-icon">🗺️</span>
                    <span className="option-text">State</span>
                  </label>
                  
                  <label className={`location-option ${settings.locationDisplay === 'country' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="locationDisplay"
                      value="country"
                      checked={settings.locationDisplay === 'country'}
                      onChange={(e) => handleSettingsChange({ locationDisplay: e.target.value as LocationDisplayMode })}
                    />
                    <span className="option-icon">🌍</span>
                    <span className="option-text">Country</span>
                  </label>
                  
                  <label className={`location-option ${settings.locationDisplay === 'hidden' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="locationDisplay"
                      value="hidden"
                      checked={settings.locationDisplay === 'hidden'}
                      onChange={(e) => handleSettingsChange({ locationDisplay: e.target.value as LocationDisplayMode })}
                    />
                    <span className="option-icon">🚫</span>
                    <span className="option-text">Hidden</span>
                  </label>
                </div>
              </div>
            </div>

            {/* GPS Minimap - Only show if location is not hidden */}
            {settings.locationDisplay && settings.locationDisplay !== 'hidden' && (
              <div className="setting-item sub-setting">
                <div className="setting-info">
                  <div className="setting-icon">🗺️</div>
                  <div className="setting-details">
                    <h3>GPS Minimap</h3>
                    <p>Show live location map</p>
                  </div>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.showMinimap}
                      onChange={(e) => handleSettingsChange({ showMinimap: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            )}

            {/* Auto-show when moving - Only show if location is not hidden */}
            {settings.locationDisplay && settings.locationDisplay !== 'hidden' && (
              <div className="setting-item sub-setting">
                <div className="setting-info">
                  <div className="setting-icon">🏃</div>
                  <div className="setting-details">
                    <h3>Auto-show when moving</h3>
                    <p>Display minimap only when traveling</p>
                  </div>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.minimapSpeedBased}
                      onChange={(e) => handleSettingsChange({ minimapSpeedBased: e.target.checked })}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            )}

            {/* Minimap sub-options: Only show if minimap is enabled */}
            {settings.showMinimap && (
              <>
                {/* Minimap Position */}
                <div className="setting-item sub-setting">
                  <div className="setting-info">
                    <div className="setting-icon">📍</div>
                    <div className="setting-details">
                      <h3>Minimap Position</h3>
                      <p>Move the minimap to any corner of the overlay</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <div className="minimap-position-buttons-grid">
                      {[
                        { value: 'top-left', label: 'Top Left' },
                        { value: 'top-right', label: 'Top Right' },
                        { value: 'bottom-left', label: 'Bottom Left' },
                        { value: 'bottom-right', label: 'Bottom Right' },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          className={`minimap-pos-btn-square${settings.minimapPosition === option.value ? ' selected' : ''}`}
                          onClick={() => handleSettingsChange({ minimapPosition: option.value as MinimapPosition })}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Minimap Size */}
                <div className="setting-item sub-setting">
                  <div className="setting-info">
                    <div className="setting-icon">📏</div>
                    <div className="setting-details">
                      <h3>Minimap Size</h3>
                      <p>Scale the minimap overlay (in pixels)</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <input
                      type="range"
                      min={100}
                      max={400}
                      step={1}
                      value={settings.mapboxMinimapSize ?? 200}
                      onChange={e => handleSettingsChange({ mapboxMinimapSize: Number(e.target.value) })}
                      style={{ width: 160 }}
                    />
                    <input
                      type="number"
                      min={100}
                      max={400}
                      step={1}
                      value={settings.mapboxMinimapSize ?? 200}
                      onChange={e => handleSettingsChange({ mapboxMinimapSize: Number(e.target.value) })}
                      style={{ width: 60, marginLeft: 8 }}
                    />
                    <span style={{ marginLeft: 4 }}>px</span>
                  </div>
                </div>

                {/* Minimap Dark Mode Toggle */}
                <div className="setting-item sub-setting">
                  <div className="setting-info">
                    <div className="setting-icon">🌑</div>
                    <div className="setting-details">
                      <h3>Minimap Dark Mode</h3>
                      <p>Switch the minimap to a dark style</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={settings.minimapDarkMode}
                        onChange={e => handleSettingsChange({ minimapDarkMode: e.target.checked })}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Weather Display */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">🌤️</div>
                <div className="setting-details">
                  <h3>Weather Display</h3>
                  <p>Show temperature and conditions</p>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.showWeather}
                    onChange={(e) => handleSettingsChange({ showWeather: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Show Date Toggle */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">📅</div>
                <div className="setting-details">
                  <h3>Show Date</h3>
                  <p>Show or hide the date on the info display</p>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.showDate}
                    onChange={e => handleSettingsChange({ showDate: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Speedmeter Display Toggle */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">🏎️</div>
                <div className="setting-details">
                  <h3>Speedmeter Overlay</h3>
                  <p>Show or hide the speedmeter overlay on your stream</p>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.showSpeedmeter}
                    onChange={e => handleSettingsChange({ showSpeedmeter: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>

            {/* Speedmeter Options - Only show if speedmeter is enabled */}
            {settings.showSpeedmeter && (
              <>
                {/* Speedmeter Position Controls */}
                <div className="setting-item sub-setting">
                  <div className="setting-info">
                    <div className="setting-icon">↔️</div>
                    <div className="setting-details">
                      <h3>Speedmeter Position</h3>
                      <p>Move the speedmeter overlay</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div>
                        <button type="button" onClick={() => handleSettingsChange({ speedmeterOffsetY: clamp((settings.speedmeterOffsetY ?? 0) - 5, -maxY, maxY) })} title="Up">⬆️</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'row', gap: 4 }}>
                        <button type="button" onClick={() => handleSettingsChange({ speedmeterOffsetX: clamp((settings.speedmeterOffsetX ?? 0) - 5, -maxX, maxX) })} title="Left">⬅️</button>
                        <button type="button" onClick={() => handleSettingsChange({ speedmeterOffsetX: clamp((settings.speedmeterOffsetX ?? 0) + 5, -maxX, maxX) })} title="Right">➡️</button>
                      </div>
                      <div>
                        <button type="button" onClick={() => handleSettingsChange({ speedmeterOffsetY: clamp((settings.speedmeterOffsetY ?? 0) + 5, -maxY, maxY) })} title="Down">⬇️</button>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4, color: '#666' }}>
                        X: {settings.speedmeterOffsetX ?? 0}px, Y: {settings.speedmeterOffsetY ?? 0}px
                      </div>
                    </div>
                  </div>
                </div>

                {/* Speedmeter Size Slider */}
                <div className="setting-item sub-setting">
                  <div className="setting-info">
                    <div className="setting-icon">📏</div>
                    <div className="setting-details">
                      <h3>Speedmeter Size</h3>
                      <p>Scale the speedmeter overlay (in pixels)</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <input
                      type="range"
                      min={80}
                      max={320}
                      step={1}
                      value={settings.speedmeterSize ?? 140}
                      onChange={e => handleSettingsChange({ speedmeterSize: Number(e.target.value) })}
                      style={{ width: 160 }}
                    />
                    <input
                      type="number"
                      min={80}
                      max={320}
                      step={1}
                      value={settings.speedmeterSize ?? 140}
                      onChange={e => handleSettingsChange({ speedmeterSize: Number(e.target.value) })}
                      style={{ width: 60, marginLeft: 8 }}
                    />
                    <span style={{ marginLeft: 4 }}>px</span>
                  </div>
                </div>

                {/* Speedmeter Speed Test Button */}
                <div className="setting-item sub-setting">
                  <div className="setting-info">
                    <div className="setting-icon">🧪</div>
                    <div className="setting-details">
                      <h3>Speed Test Animation</h3>
                      <p>Animate the speedmeter for testing purposes</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <button
                      type="button"
                      onClick={() => handleSettingsChange({ speedTestActive: !settings.speedTestActive })}
                      style={{ padding: '8px 18px', fontSize: 16 }}
                    >
                      {settings.speedTestActive ? 'Stop Speed Test' : 'Start Speed Test'}
                    </button>
                  </div>
                </div>

                {/* Speedmeter Center Button */}
                <div className="setting-item sub-setting">
                  <div className="setting-info">
                    <div className="setting-icon">🎯</div>
                    <div className="setting-details">
                      <h3>Center Speedmeter</h3>
                      <p>Reset the speedmeter overlay to the center</p>
                    </div>
                  </div>
                  <div className="setting-control">
                    <button
                      type="button"
                      onClick={() => handleSettingsChange({ speedmeterOffsetX: 0, speedmeterOffsetY: 0 })}
                      style={{ padding: '8px 18px', fontSize: 16 }}
                    >
                      Center Speedmeter
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Info Display Position Buttons */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">↔️</div>
                <div className="setting-details">
                  <h3>Info Display Position</h3>
                  <p>Move the info display to the left or right of the overlay</p>
                </div>
              </div>
              <div className="setting-control">
                <div className="info-pos-buttons-row" style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                  ].map(option => (
                    <button
                      key={option.value}
                      type="button"
                      className={`info-pos-btn-square${settings.infoDisplayPosition === option.value ? ' selected' : ''}`}
                      onClick={() => handleSettingsChange({ infoDisplayPosition: option.value as 'left' | 'right' })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Battery Overlay Toggle */}
            <div className="setting-item">
              <div className="setting-info">
                <div className="setting-icon">🔋</div>
                <div className="setting-details">
                  <h3>Battery Overlay</h3>
                  <p>Show or hide the battery overlay on your stream</p>
                </div>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.showBatteryOverlay}
                    onChange={e => handleSettingsChange({ showBatteryOverlay: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
                {/* Battery Overlay Position Controls */}
                <div className="battery-move-controls-row" style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="battery-move-btn-square"
                    aria-label="up"
                    onClick={() => handleSettingsChange({ batteryOffsetY: (settings.batteryOffsetY || 0) - 5 })}
                  >↑</button>
                  <button
                    type="button"
                    className="battery-move-btn-square"
                    aria-label="down"
                    onClick={() => handleSettingsChange({ batteryOffsetY: (settings.batteryOffsetY || 0) + 5 })}
                  >↓</button>
                  <button
                    type="button"
                    className="battery-move-btn-square"
                    aria-label="left"
                    onClick={() => handleSettingsChange({ batteryOffsetX: (settings.batteryOffsetX || 0) - 5 })}
                  >←</button>
                  <button
                    type="button"
                    className="battery-move-btn-square"
                    aria-label="right"
                    onClick={() => handleSettingsChange({ batteryOffsetX: (settings.batteryOffsetX || 0) + 5 })}
                  >→</button>
                </div>
                {/* Battery Overlay Scale Slider */}
                <div style={{ marginTop: 8, width: 160 }}>
                  <label htmlFor="battery-scale-slider">Battery Size</label>
                  <input
                    id="battery-scale-slider"
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.01}
                    value={settings.batteryScale ?? 1}
                    onChange={e => handleSettingsChange({ batteryScale: Number(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                  <span style={{ marginLeft: 8 }}>{(settings.batteryScale ?? 1).toFixed(2)}x</span>
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* Footer */}
        <div className="admin-footer">
          <div className="footer-content">
            <div className="footer-status">
              <div className="status-indicator"></div>
              <span>Auto-save enabled</span>
            </div>
          </div>
        </div>
      </div> {/* <-- Properly close admin-content here */}

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