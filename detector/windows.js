/**
 * detector/windows.js
 * Reads Zoom state on Windows via PowerShell + UI Automation.
 *
 * UI Automation lets us walk the accessibility tree of any app,
 * same as macOS AppleScript. We look for Zoom's toolbar buttons by name.
 *
 * REQUIRED: No special permissions needed on Windows — UI Automation
 *           is available to all apps by default.
 */

const { exec } = require('child_process');

function runPS(script) {
  return new Promise((resolve) => {
    // -NonInteractive -NoProfile for speed
    exec(
      `powershell -NonInteractive -NoProfile -Command "${script.replace(/"/g, '\\"')}"`,
      { timeout: 3000 },
      (err, stdout) => resolve(err ? '' : stdout.trim())
    );
  });
}

// ── Check if Zoom is running ─────────────────────────────────────────────────
async function isZoomRunning() {
  const r = await runPS('(Get-Process -Name "Zoom" -ErrorAction SilentlyContinue) -ne $null');
  return r.toLowerCase() === 'true';
}

// ── Read Zoom toolbar via UI Automation ──────────────────────────────────────
async function getZoomState() {
  if (!(await isZoomRunning())) return { platform: null };

  // PowerShell UI Automation — walk Zoom's toolbar for button names
  const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::NameProperty, "Zoom")
$zoom = $root.FindFirst(
  [System.Windows.Automation.TreeScope]::Children, $condition)
if ($zoom -eq $null) { exit }
$buttons = $zoom.FindAll(
  [System.Windows.Automation.TreeScope]::Descendants,
  New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button))
$names = @()
foreach ($b in $buttons) { $names += $b.Current.Name }
$names -join ","
  `.trim();

  const raw = await runPS(script);
  const names = raw.toLowerCase();

  const inMeeting = names.includes('mute') || names.includes('video') || names.includes('share');

  return {
    platform: 'zoom',
    inMeeting,
    muted: names.includes('unmute audio'),
    screenSharing: names.includes('stop share'),
    camOff: names.includes('start video'),
    lobbyWaiting: names.includes('waiting room') || names.includes('admit'),
  };
}

async function detect() {
  return await getZoomState();
}

module.exports = { detect };
