// Settings validation utility to prevent malicious entries

import { OverlaySettings, DEFAULT_OVERLAY_SETTINGS, SETTINGS_CONFIG } from '@/types/settings';



/**
 * Validates and sanitizes settings object
 * Removes any malicious or unknown properties
 */
export function validateAndSanitizeSettings(input: unknown): OverlaySettings {
  if (!input || typeof input !== 'object') {
    throw new Error('Settings must be an object');
  }

  const settings = input as Record<string, unknown>;
  const cleanSettings: Partial<OverlaySettings> = {};
  const rejectedKeys: string[] = [];

  // Validate each field according to schema
  for (const [key, expectedType] of Object.entries(SETTINGS_CONFIG)) {
    const value = settings[key];
    
    if (value !== undefined) {
      if (expectedType === 'boolean' && typeof value === 'boolean') {
        (cleanSettings as Record<string, unknown>)[key] = value;
      } else if (expectedType === 'string' && typeof value === 'string') {
        (cleanSettings as Record<string, unknown>)[key] = value;
      } else if (expectedType === 'number' && typeof value === 'number') {
        (cleanSettings as Record<string, unknown>)[key] = value;
      } else if (expectedType === 'object' && Array.isArray(value)) {
        // Validate customUrls array
        (cleanSettings as Record<string, unknown>)[key] = value.filter(item =>
          item && typeof item.url === 'string' &&
          typeof item.zoom === 'number' &&
          typeof item.offsetX === 'number' &&
          typeof item.offsetY === 'number'
        ).map(item => ({
          ...item,
          enabled: typeof item.enabled === 'boolean' ? item.enabled : true
        }));
      } else {
        console.warn(`Invalid type for ${key}: expected ${expectedType}, got ${typeof value}`);
        rejectedKeys.push(key);
      }
    }
  }

  // Log any rejected keys (potential malicious entries)
  for (const key of Object.keys(settings)) {
    if (!(key in SETTINGS_CONFIG)) {
      rejectedKeys.push(key);
    }
  }

  if (rejectedKeys.length > 0) {
    console.warn('🚨 Rejected malicious/invalid settings keys:', rejectedKeys);
  }

  // Ensure all required settings are present with defaults
  const completeSettings: OverlaySettings = {
    locationDisplay: cleanSettings.locationDisplay ?? DEFAULT_OVERLAY_SETTINGS.locationDisplay,
    showWeather: cleanSettings.showWeather ?? DEFAULT_OVERLAY_SETTINGS.showWeather,
    showMinimap: cleanSettings.showMinimap ?? DEFAULT_OVERLAY_SETTINGS.showMinimap,
    minimapSpeedBased: cleanSettings.minimapSpeedBased ?? DEFAULT_OVERLAY_SETTINGS.minimapSpeedBased,
    showOverlayBackground: cleanSettings.showOverlayBackground ?? DEFAULT_OVERLAY_SETTINGS.showOverlayBackground,
    mapboxMinimapSize: cleanSettings.mapboxMinimapSize ?? DEFAULT_OVERLAY_SETTINGS.mapboxMinimapSize,
    minimapPosition: cleanSettings.minimapPosition ?? DEFAULT_OVERLAY_SETTINGS.minimapPosition,
    minimapDarkMode: cleanSettings.minimapDarkMode ?? DEFAULT_OVERLAY_SETTINGS.minimapDarkMode,
    showDate: cleanSettings.showDate ?? DEFAULT_OVERLAY_SETTINGS.showDate,
    infoDisplayPosition: cleanSettings.infoDisplayPosition ?? DEFAULT_OVERLAY_SETTINGS.infoDisplayPosition,
    customUrls: cleanSettings.customUrls ?? DEFAULT_OVERLAY_SETTINGS.customUrls,
    showSpeedmeter: cleanSettings.showSpeedmeter ?? DEFAULT_OVERLAY_SETTINGS.showSpeedmeter,
    speedmeterOffsetX: cleanSettings.speedmeterOffsetX ?? DEFAULT_OVERLAY_SETTINGS.speedmeterOffsetX,
    speedmeterOffsetY: cleanSettings.speedmeterOffsetY ?? DEFAULT_OVERLAY_SETTINGS.speedmeterOffsetY,
    speedmeterSize: cleanSettings.speedmeterSize ?? DEFAULT_OVERLAY_SETTINGS.speedmeterSize,
    speedTestActive: cleanSettings.speedTestActive ?? DEFAULT_OVERLAY_SETTINGS.speedTestActive,
    showBatteryOverlay: cleanSettings.showBatteryOverlay ?? DEFAULT_OVERLAY_SETTINGS.showBatteryOverlay,
    batteryOffsetX: cleanSettings.batteryOffsetX ?? DEFAULT_OVERLAY_SETTINGS.batteryOffsetX,
    batteryOffsetY: cleanSettings.batteryOffsetY ?? DEFAULT_OVERLAY_SETTINGS.batteryOffsetY,
    batteryScale: cleanSettings.batteryScale ?? DEFAULT_OVERLAY_SETTINGS.batteryScale,
  };

  return completeSettings;
}

/**
 * Check if settings object contains any suspicious keys
 */
export function detectMaliciousKeys(settings: unknown): string[] {
  if (!settings || typeof settings !== 'object') {
    return [];
  }

  const maliciousKeys: string[] = [];
  const settingsObj = settings as Record<string, unknown>;

  for (const key of Object.keys(settingsObj)) {
    if (!(key in SETTINGS_CONFIG)) {
      maliciousKeys.push(key);
    }
  }

  return maliciousKeys;
} 