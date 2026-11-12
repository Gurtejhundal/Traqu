const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('traquDesktop', Object.freeze({
  notifications: () => ipcRenderer.invoke('traqu:notifications'),
  storage: action => ipcRenderer.invoke('traqu:storage', action),
  updates: action => ipcRenderer.invoke('traqu:updates', action),
  aiConnection: payload => ipcRenderer.invoke('traqu:ai-connection', payload),
  savePDF: document => ipcRenderer.invoke('traqu:save-pdf', document),
}));
