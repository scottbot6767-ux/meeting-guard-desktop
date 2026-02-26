# Meeting Guard — Desktop

System-level overlay alerts for Zoom desktop and Google Meet. Works over full-screen apps.

## What It Does

A transparent always-on-top window sits over your entire screen and shows:

- **YOU ARE MUTED** — red pulsing border when mic is off
- **STILL SHARING YOUR SCREEN** — orange border while presenting
- **PEOPLE WAITING IN YOUR LOBBY** — blue banner when participants are in waiting room
- **CAMERA IS OFF** — optional alert

Works with the **Zoom desktop app** (not just the web client). Reads Zoom's actual toolbar buttons via macOS Accessibility APIs — no hacks, no screen capture, no OCR.

## Setup

### 1. Install deps & run

```bash
cd meeting-guard-desktop
npm install
npm start
```

### 2. Grant Accessibility Permission (macOS — required)

Zoom's UI can only be read if Meeting Guard has Accessibility access:

1. Open **System Settings** → **Privacy & Security** → **Accessibility**
2. Click the **+** button and add **Meeting Guard** (or your terminal / `Electron` during dev)
3. Toggle it ON

Without this, Zoom state detection won't work (the app will still run, just no Zoom alerts).

### 3. Windows

No extra permissions needed. UI Automation is available to all apps by default.

## How It Works

```
Every 1 second:
  detector/macos.js runs AppleScript →
    queries Zoom's accessibility tree →
    reads toolbar button names ("Unmute Audio" = muted, "Stop Share" = sharing)
  
  main.js receives state →
    sends to overlay window via IPC
  
  overlay.js renders →
    colored border + banner appears over everything
```

**Why AppleScript?** Zoom exposes its UI through macOS Accessibility — the same API VoiceOver uses. Button names like "Mute Audio" / "Unmute Audio" are reliable and don't depend on screen position or pixel color.

## Building a distributable

```bash
npm run build:mac   # creates .dmg
npm run build:win   # creates .exe installer
```

## File Structure

```
meeting-guard-desktop/
  main.js          Electron main — creates overlay, runs poll loop
  preload.js       IPC bridge (contextIsolation)
  overlay.html     Transparent overlay window
  overlay.js       Renderer — draws border + banners from state
  detector/
    index.js       Routes to platform-specific detector
    macos.js       AppleScript — reads Zoom + Chrome state
    windows.js     PowerShell + UI Automation — reads Zoom state
```

## Limitations

| Feature | macOS | Windows |
|---|---|---|
| Zoom desktop mute | ✅ | ✅ |
| Zoom desktop screen share | ✅ | ✅ |
| Zoom waiting room | ✅ | ✅ |
| Google Meet (browser) | Partial (detects tab open) | — |
| Full-screen overlay | ✅ | ✅ |

For full Google Meet support (mute state etc.) use the **Chrome extension** alongside this app — they're designed to complement each other.
