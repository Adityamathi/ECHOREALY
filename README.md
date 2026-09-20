# EchoRelay — Offline-First Voice Mesh & Emergency Triage PWA

Zero-install Progressive Web App for disaster emergency reporting. Victims record a voice SOS offline,
the app transcribes it locally, compresses it into a 14-byte BLE-style packet, stores it in IndexedDB,
and broadcasts it to nearby devices. Responders get a live triage map + queue.

Built for **HACKDAY 1.0 — Tech for a Better Tomorrow** (Team DECODEP).

## Features

**📱 Victim SOS Node**
- Tap **Start Recording**, tap **Stop Recording and Save** (Web Speech API, 100% offline transcription)
- Auto-extracts urgency (`CRITICAL` / `HIGH` / `MODERATE`) + category (`Medical` / `Extraction` / `Supplies` / `General`) from keywords
- GPS auto-tagging with offline queue in IndexedDB (Dexie.js)
- Typed-SOS fallback when the mic is blocked
- **Broadcast panel**: Send via Bluetooth (system share sheet), Broadcast via… (Nearby Share/WhatsApp/SMS),
  14-byte BLE advertising simulation, QR code, copy SOS link/text
- Share links embed the full SOS (`/sos?d=…`) — the phone needs no app, no account

**🚨 Responder Command Center**
- Leaflet map with pulsing color-coded pins (Red = Critical, Orange = High, Cyan = Moderate)
- Filterable triage queue (All / Critical / Unassigned / Synced) with BLE-relay badges + hop counts
- Passive BLE mesh listener (Web Bluetooth LE scan + simulation fallback) with alert chime + notification
- Online/Offline network toggle, Supabase sync trigger, demo beacon injector for live demos

**📲 Phone SOS alert page (`/sos`)**
- Full-screen emergency popup: urgency banner, transcript, category, location + Maps link
- Alert siren, vibration, and local notification — opens from QR scan or shared link

## 14-Byte BLE Packet Format

| Bytes | Field |
|---|---|
| 0–1 | Magic `0x45 0x52` (`ER`) |
| 2–3 | Uint16 Packet ID |
| 4 | Uint8 Urgency (1 = CRITICAL, 2 = HIGH, 3 = MODERATE) |
| 5 | Uint8 Category (1 = Medical, 2 = Extraction, 3 = Supplies, 4 = General) |
| 6–9 | Float32 Latitude |
| 10–13 | Float32 Longitude |

See `src/lib/bleProtocol.ts` (`encodeSosToBuffer` / `decodeBufferToSos`).

## Quick Start (one command)

```powershell
cd echorealy
npm run go
```

This builds, starts the production server on port 3001, and opens the browser at your laptop's
LAN URL. Manual alternative:

```powershell
npm run build
npx next start -H 0.0.0.0 -p 3001
```

Allow Node.js through Windows Firewall when prompted, otherwise phones can't reach the server.

## Laptop → Phone Demo Flow

1. Laptop and phone on the **same Wi-Fi**
2. Laptop: open `http://localhost:3001` (mic only works on localhost/HTTPS) → allow microphone
3. **Start Recording** → speak → **Stop Recording and Save** → message appears below
4. Broadcast panel shows green **“Phone-ready link active”** (LAN IP auto-detected)
5. **Show QR** → scan with phone camera → SOS pops up full-screen with siren
   (or **Send via Bluetooth to Phone** with the phone paired)

## Tech Stack

Next.js 14 (App Router) · React 18 · Tailwind CSS · Shadcn/Radix UI · Lucide icons ·
Dexie.js (IndexedDB) · Web Speech API · Web Bluetooth · Leaflet / react-leaflet · qrcode

## Project Structure

```
src/
  app/
    page.tsx          # entry (dynamic) → EchoRelayClient
    sos/page.tsx      # phone SOS alert page (reads ?d=)
    layout.tsx        # PWA metadata · globals.css (dark theme + Leaflet CSS)
  components/
    Header.tsx            # view switcher + network/BLE status
    VictimView.tsx        # recording + broadcast panel
    ResponderDashboard.tsx# triage queue + network controls + demo injector
    EmergencyMap.tsx      # Leaflet map (client-only, ssr:false)
    EchoRelayClient.tsx   # main client orchestrator
  lib/
    db.ts             # Dexie SosPacket store + helpers
    bleProtocol.ts    # 14-byte encoder/decoder
    shareUtils.ts     # SOS link encode/decode, system share, clipboard, LAN IP detect
    useSpeechToText.ts# offline transcription + keyword triage
    useBleMesh.ts     # BLE scan/advertise + simulation mode
public/
  manifest.json sw.js icon-*.png   # PWA assets
start.ps1 / start.bat              # one-shot build + run + open browser
```
