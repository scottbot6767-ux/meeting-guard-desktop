/**
 * detector/macos.js
 * Reads Zoom and Google Chrome (Meet) state on macOS via AppleScript.
 *
 * Zoom exposes its UI through the macOS Accessibility tree.
 * We query the meeting toolbar buttons by name — same way VoiceOver sees them.
 *
 * REQUIRED: System Preferences → Privacy & Security → Accessibility
 *           → Meeting Guard must be checked ON
 */

const { exec } = require('child_process');

// ── AppleScript runner ───────────────────────────────────────────────────────
function runScript(script) {
  return new Promise((resolve) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout) => {
      resolve(err ? '' : stdout.trim());
    });
  });
}

// ── Is a process running? ────────────────────────────────────────────────────
async function isRunning(appName) {
  const result = await runScript(`
    tell application "System Events"
      return (name of processes) contains "${appName}"
    end tell
  `);
  return result === 'true';
}

// ── Zoom state ───────────────────────────────────────────────────────────────
async function getZoomState() {
  const running = await isRunning('zoom.us');
  if (!running) return { platform: null };

  // Query the meeting toolbar. Zoom's toolbar buttons have predictable names:
  //   "Mute Audio"   → mic is ON  (click to mute)
  //   "Unmute Audio" → mic is OFF (click to unmute = currently muted)
  //   "Start Video"  → cam is OFF
  //   "Stop Video"   → cam is ON
  //   "Stop Share"   → screen sharing is active
  const script = `
    tell application "System Events"
      tell process "zoom.us"
        set result to {}

        -- Check mute state
        try
          set muteBtn to button "Unmute Audio" of toolbar 1 of window 1
          set end of result to "muted"
        end try
        try
          set muteBtn to button "Mute Audio" of toolbar 1 of window 1
          set end of result to "unmuted"
        end try

        -- Check screen share
        try
          set shareBtn to button "Stop Share" of toolbar 1 of window 1
          set end of result to "sharing"
        end try

        -- Check cam
        try
          set camBtn to button "Start Video" of toolbar 1 of window 1
          set end of result to "cam_off"
        end try

        -- Check if actually in a meeting (toolbar exists)
        try
          set t to toolbar 1 of window 1
          set end of result to "in_meeting"
        end try

        return result as string
      end tell
    end tell
  `;

  const raw = await runScript(script);

  return {
    platform: 'zoom',
    inMeeting: raw.includes('in_meeting'),
    muted: raw.includes('muted') && !raw.includes('unmuted'),
    screenSharing: raw.includes('sharing'),
    camOff: raw.includes('cam_off'),
    lobbyWaiting: false, // AppleScript can't easily detect waiting room; use polling below
  };
}

// ── Zoom waiting room (separate check via window title/content) ──────────────
async function getZoomLobby() {
  const script = `
    tell application "System Events"
      tell process "zoom.us"
        try
          set winNames to name of every window
          set winNames to winNames as string
          return winNames
        on error
          return ""
        end try
      end tell
    end tell
  `;
  const raw = await runScript(script);
  // Zoom opens a "Waiting Room" panel or title when someone is waiting
  return raw.toLowerCase().includes('waiting');
}

// ── Chrome / Meet state ──────────────────────────────────────────────────────
// For browser-based meetings we ask Chrome to evaluate JS in the active tab.
// This requires Accessibility access AND "Allow JavaScript from Apple Events" in Chrome DevTools.
// As a simpler fallback we just check if a Meet tab is focused.
async function getMeetState() {
  const script = `
    tell application "System Events"
      return (name of processes) contains "Google Chrome"
    end tell
  `;
  const chromeRunning = (await runScript(script)) === 'true';
  if (!chromeRunning) return { platform: null };

  // Check if any Chrome window title contains "Meet" (rough heuristic)
  const titleScript = `
    tell application "Google Chrome"
      try
        set t to title of active tab of front window
        return t
      on error
        return ""
      end try
    end tell
  `;
  const title = await runScript(titleScript);
  if (!title.toLowerCase().includes('meet')) return { platform: null };

  // Meet is open — we can't reliably read mute state from AppleScript alone
  // without "Allow JavaScript from Apple Events". Signal that Meet is active
  // so the user knows to rely on the Chrome extension for detailed state.
  return {
    platform: 'meet_browser',
    inMeeting: true,
    browserOnly: true, // detailed state from Chrome extension
  };
}

// ── Main export ──────────────────────────────────────────────────────────────
async function detect() {
  const zoom = await getZoomState();
  if (zoom.inMeeting) {
    zoom.lobbyWaiting = await getZoomLobby();
    return zoom;
  }

  const meet = await getMeetState();
  if (meet?.inMeeting) return meet;

  return { platform: null };
}

module.exports = { detect };
