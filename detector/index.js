/**
 * detector/index.js
 * Routes to the right platform-specific detector.
 * Returns a normalized state object consumed by main.js.
 */

const platform = process.platform;

let detector;
if (platform === 'darwin') {
  detector = require('./macos');
} else if (platform === 'win32') {
  detector = require('./windows');
} else {
  // Linux: no desktop Zoom support, return empty
  detector = { detect: async () => ({ platform: null }) };
}

module.exports = detector;
