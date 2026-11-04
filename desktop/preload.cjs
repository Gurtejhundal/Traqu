const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('traquDesktop', Object.freeze({
  savePDF: document => ipcRenderer.invoke('traqu:save-pdf', document),
}));
