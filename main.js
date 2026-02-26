/**
 * main.js — Electron main process
 *
 * Creates a transparent, always-on-top overlay window that covers the
 * entire screen. Polls meeting state every second and sends updates to
 * the renderer via IPC. The renderer draws the border/banners.
 */

const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const detector = require('./detector');

let overlayWin = null;
let tray = null;
let pollTimer = null;

// ── Current state ────────────────────────────────────────────────────────────
let lastState = {};

// ── Create the overlay window ─────────────────────────────────────────────────
function createOverlay() {
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;

  overlayWin = new BrowserWindow({
    x, y, width, height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,         // Never steals focus
    resizable: false,
    movable: false,
    fullscreen: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWin.setIgnoreMouseEvents(true);  // Click-through
  overlayWin.loadFile('overlay.html');

  // Stay on top of everything — including fullscreen Zoom
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Re-fit overlay if display config changes
  screen.on('display-metrics-changed', () => repositionOverlay());
}

function repositionOverlay() {
  if (!overlayWin) return;
  const display = screen.getPrimaryDisplay();
  const { x, y, width, height } = display.bounds;
  overlayWin.setBounds({ x, y, width, height });
}

// ── Polling loop ──────────────────────────────────────────────────────────────
async function poll() {
  try {
    const state = await detector.detect();

    // Only send update if something changed
    const stateKey = JSON.stringify(state);
    if (stateKey !== JSON.stringify(lastState)) {
      lastState = state;
      if (overlayWin && !overlayWin.isDestroyed()) {
        overlayWin.webContents.send('state-update', state);
      }
      updateTray(state);
    }
  } catch (e) {
    // Swallow detection errors — don't crash the app
  }
}

// ── Tray icon ─────────────────────────────────────────────────────────────────
function createTray() {
  // Simple 16x16 colored icon — swap for a real icon file in production
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('Meeting Guard');
  updateTray({ platform: null });
}

function updateTray(state) {
  if (!tray) return;
  const label = state?.platform
    ? `Meeting Guard — ${state.platform === 'zoom' ? 'Zoom' : 'Google Meet'}`
    : 'Meeting Guard — No active meeting';

  const menu = Menu.buildFromTemplate([
    { label, enabled: false },
    { type: 'separator' },
    { label: 'Quit Meeting Guard', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // macOS: don't show in dock — this is a utility overlay
  if (process.platform === 'darwin') app.dock.hide();

  createOverlay();
  createTray();

  pollTimer = setInterval(poll, 1000);
  poll(); // immediate first check
});

app.on('window-all-closed', (e) => {
  // Prevent quitting when overlay closes — only quit from tray
  e.preventDefault();
});

app.on('before-quit', () => {
  clearInterval(pollTimer);
});

// ── IPC: renderer requesting current state ────────────────────────────────────
ipcMain.handle('get-state', () => lastState);
