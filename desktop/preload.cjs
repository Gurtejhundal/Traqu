const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('traquDesktop', Object.freeze({
  connectCodex: allowWrite => ipcRenderer.invoke('traqu:connect-codex', allowWrite),
  savePDF: document => ipcRenderer.invoke('traqu:save-pdf', document),
}));
