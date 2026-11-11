const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('traquDesktop', Object.freeze({
  aiConnection: payload => ipcRenderer.invoke('traqu:ai-connection', payload),
  savePDF: document => ipcRenderer.invoke('traqu:save-pdf', document),
}));
