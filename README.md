[![GitHub license](https://img.shields.io/github/license/AlphaKing112/Overlayx)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/AlphaKing112/Overlayx)](https://github.com/AlphaKing112/Overlayx)

# Livestreaming Overlay Control

A modern, real-time overlay control panel and widget system for livestreamers. Designed for use with OBS, this site lets you manage and customize overlays such as battery, weather, heart rate, minimap, and more—live, from any device.

## Features

- **Real-time overlays** for OBS and browser sources
- **Admin control panel** for instant changes (toggle overlays, move/resize, adjust settings)
- **Battery widget**: Show your phone's battery status on stream
- **Weather, location, and minimap overlays**
- **Heart rate monitor integration** (Pulsoid, Apple Watch, etc.)
- **Speedmeter and movement widgets**
- **Custom URL overlays** (add your own widgets)
- **All overlays are highly configurable** (position, size, visibility, etc.)
- **Mobile-friendly admin panel**
- **Secure admin login**

## How It Works

1. **Admin Panel**: Log in to `/` to access the control panel. Change overlay settings, toggle widgets, and see changes live.
2. **Overlay Page**: Add `/overlay` as a browser source in OBS. All widgets update instantly as you change settings.
3. **Battery Widget**: Use an iOS Shortcut to POST your phone's battery level to the overlay (see docs for setup).
4. **Custom Widgets**: Add any URL as an overlay, position and scale it as needed.

## Quick Start

1. **Clone and install:**
   ```bash
   git clone ...
   cd livestreaming-overlay-control
   npm install
   ```
2. **Configure environment:**
   - Copy `.env.example` to `.env.local` and fill in API keys as needed (Pulsoid, Mapbox, etc.)
3. **Run locally:**
   ```bash
   npm run dev
   ```
4. **Open the admin panel:**
   - Go to `http://localhost:3000` and log in with your admin password
5. **Add the overlay to OBS:**
   - Add `http://localhost:3000/overlay` as a browser source
6. **Control your overlays live!**

## Environment Variables & API Keys

To run the overlay control, you need to set up a `.env.local` file in your project root with the following keys:

```env
# RealtimeIRL API Key (for live GPS/speed data)
NEXT_PUBLIC_RTIRL_PULL_KEY=your_rtirl_pull_key_here

# LocationIQ API Key (for location names)
NEXT_PUBLIC_LOCATIONIQ_KEY=your_locationiq_api_key_here

# Pulsoid API Token (for heart rate monitor integration)
NEXT_PUBLIC_PULSOID_TOKEN=your_pulsoid_access_token_here

# Mapbox API Key (for minimap)
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here

# Vercel KV Database (for settings storage)
KV_REST_API_URL=your_vercel_kv_rest_api_url
KV_REST_API_TOKEN=your_vercel_kv_rest_api_token

# Admin Panel Password
ADMIN_PASSWORD=your_secure_admin_password_here

# API Protection (required for security)
API_SECRET=your_secure_random_api_secret_here
NEXT_PUBLIC_API_SECRET=your_secure_random_api_secret_here
```

- **You can get API keys from the respective service providers:**
  - [RealtimeIRL](https://realtimeirl.com/) for GPS/speed
  - [LocationIQ](https://locationiq.com/) for location
  - [Pulsoid](https://pulsoid.net/) for heart rate
  - [Mapbox](https://account.mapbox.com/) for minimap
  - [Vercel KV](https://vercel.com/docs/storage/vercel-kv) for settings storage
- **Set a strong admin password and API secret for security.**

## Battery Widget (iOS Setup)
- Use the provided iOS Shortcut to POST your battery level to `/api/phone-battery`.
- The overlay will display your phone's battery status in real time.

## Security Notes
- Change the default admin password before using in production.
- All settings are stored securely and can be updated live.

---

**Livestreaming Overlay Control** is open source and designed for creators who want full control over their stream overlays—no subscriptions, no bloat, just instant, live control.