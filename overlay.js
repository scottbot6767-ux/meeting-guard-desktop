/**
 * overlay.js — Renderer process
 * Receives state updates from main via IPC and renders the overlay.
 */

const ALERTS = [
  {
    id: 'muted',
    check: s => s.muted,
    severity: 'critical',
    label: 'YOU ARE MUTED',
    sublabel: 'Nobody can hear you',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>`,
  },
  {
    id: 'screen_sharing',
    check: s => s.screenSharing,
    severity: 'warning',
    label: 'STILL SHARING YOUR SCREEN',
    sublabel: 'Everything on screen is visible',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>`,
  },
  {
    id: 'lobby_waiting',
    check: s => s.lobbyWaiting,
    severity: 'info',
    label: 'PEOPLE WAITING IN YOUR LOBBY',
    sublabel: 'Admit them when ready',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`,
  },
  {
    id: 'cam_off',
    check: s => s.camOff,
    severity: 'info',
    label: 'YOUR CAMERA IS OFF',
    sublabel: 'You are not visible to others',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h2a2 2 0 0 1 2 2v9.34"/>
    </svg>`,
  },
];

// Priority order for border color
const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 };

const border = document.getElementById('border');
const bannersEl = document.getElementById('banners');

// Track which banners are currently shown
const shown = new Set();

function render(state) {
  if (!state || !state.inMeeting) {
    // Not in a meeting — clear everything
    border.className = '';
    bannersEl.innerHTML = '';
    shown.clear();
    return;
  }

  const active = ALERTS.filter(a => a.check(state));

  // Update border — highest severity wins
  if (active.length === 0) {
    border.className = '';
  } else {
    const top = active.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
    border.className = top.severity;
  }

  // Add new banners
  const activeIds = new Set(active.map(a => a.id));

  for (const alert of active) {
    if (!shown.has(alert.id)) {
      shown.add(alert.id);
      addBanner(alert);
    }
  }

  // Remove cleared banners
  for (const id of shown) {
    if (!activeIds.has(id)) {
      shown.delete(id);
      removeBanner(id);
    }
  }
}

function addBanner(alert) {
  const el = document.createElement('div');
  el.className = `banner ${alert.severity} hidden`;
  el.dataset.id = alert.id;
  el.innerHTML = `
    <div class="stripe"></div>
    <div class="icon">${alert.icon}</div>
    <div class="text">
      <div class="label">${alert.label}</div>
      ${alert.sublabel ? `<div class="sublabel">${alert.sublabel}</div>` : ''}
    </div>
  `;
  bannersEl.appendChild(el);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.remove('hidden'));
  });
}

function removeBanner(id) {
  const el = bannersEl.querySelector(`[data-id="${id}"]`);
  if (!el) return;
  el.classList.add('hidden');
  setTimeout(() => el.remove(), 350);
}

// ── Wire up IPC ───────────────────────────────────────────────────────────────
window.meetingGuard.onStateUpdate((state) => render(state));
window.meetingGuard.getState().then((state) => render(state));
