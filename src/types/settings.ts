// Centralized settings types and constants

export type LocationDisplayMode = 'city' | 'state' | 'country' | 'hidden';

export type MinimapPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type InfoDisplayPosition = 'left' | 'right';

export interface OverlayUrl {
  url: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  enabled: boolean;
}

export interface OverlaySettings {
  locationDisplay: LocationDisplayMode;
  showWeather: boolean;
  showMinimap: boolean;
  minimapSpeedBased: boolean;
  showOverlayBackground: boolean; // NEW: Toggle overlay background
  mapboxMinimapSize: number; // NEW: Minimap size in px
  minimapPosition: MinimapPosition; // NEW: Minimap position
  minimapDarkMode: boolean; // NEW: Minimap dark mode
  showDate: boolean; // NEW: Toggle date display
  infoDisplayPosition: InfoDisplayPosition; // NEW: Info display position
  customUrls: OverlayUrl[];
  showSpeedmeter?: boolean;
  speedmeterOffsetX?: number;
  speedmeterOffsetY?: number;
  speedmeterSize?: number;
  speedTestActive?: boolean;
  showBatteryOverlay?: boolean;
  batteryOffsetX?: number;
  batteryOffsetY?: number;
  batteryScale?: number;
}

// Default settings (single source of truth)
export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  locationDisplay: 'city',
  showWeather: true,
  showMinimap: false,
  minimapSpeedBased: false,
  showOverlayBackground: true, // NEW: Default to background ON
  mapboxMinimapSize: 200, // NEW: Default minimap size
  minimapPosition: 'top-right', // NEW: Default minimap position
  minimapDarkMode: false, // NEW: Default minimap dark mode off
  showDate: true, // NEW: Default to show date
  infoDisplayPosition: 'right', // NEW: Default info display position
  customUrls: [], // overlays will default to enabled: true when created
  showSpeedmeter: true,
  speedmeterOffsetX: 0,
  speedmeterOffsetY: 0,
  speedmeterSize: 140,
  speedTestActive: false,
  showBatteryOverlay: true,
  batteryOffsetX: 0,
  batteryOffsetY: 0,
  batteryScale: 1,
};

// Valid settings schema for validation
export const SETTINGS_CONFIG: Record<keyof OverlaySettings, 'boolean' | 'string' | 'number' | 'object'> = {
  locationDisplay: 'string',
  showWeather: 'boolean',
  showMinimap: 'boolean',
  minimapSpeedBased: 'boolean',
  showOverlayBackground: 'boolean', // NEW
  mapboxMinimapSize: 'number', // NEW
  minimapPosition: 'string', // NEW
  minimapDarkMode: 'boolean', // NEW
  showDate: 'boolean', // NEW
  infoDisplayPosition: 'string', // NEW
  customUrls: 'object',
  showSpeedmeter: 'boolean',
  speedmeterOffsetX: 'number',
  speedmeterOffsetY: 'number',
  speedmeterSize: 'number',
  speedTestActive: 'boolean',
  showBatteryOverlay: 'boolean',
  batteryOffsetX: 'number',
  batteryOffsetY: 'number',
  batteryScale: 'number',
};



// SSE message types
export interface SettingsUpdateMessage {
  type: 'settings_update';
  timestamp: number;
  // All OverlaySettings properties will be spread here
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  timestamp: number;
}

export type SSEMessage = SettingsUpdateMessage | HeartbeatMessage; 