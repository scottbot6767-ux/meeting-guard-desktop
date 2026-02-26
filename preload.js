/**
 * preload.js
 * Exposes a safe IPC bridge to the renderer.
 * contextIsolation is ON — renderer can't touch Node directly.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('meetingGuard', {
  onStateUpdate: (cb) => ipcRenderer.on('state-update', (_e, state) => cb(state)),
  getState: () => ipcRenderer.invoke('get-state'),
});
