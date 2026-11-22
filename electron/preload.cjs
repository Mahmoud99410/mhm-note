const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mhm', {
  http: (req) => ipcRenderer.invoke('http', req),
  googleSignIn: (o) => ipcRenderer.invoke('google-signin', o),
  googleToken: (o) => ipcRenderer.invoke('google-token', o),
  googleSignOut: () => ipcRenderer.invoke('google-signout'),
  bioAvailable: () => ipcRenderer.invoke('bio-available'),
  bioVerify: (reason) => ipcRenderer.invoke('bio-verify', reason),
  secureSet: (k, v) => ipcRenderer.invoke('secure-set', k, v),
  secureGet: (k) => ipcRenderer.invoke('secure-get', k),
  secureDel: (k) => ipcRenderer.invoke('secure-del', k),
  saveFile: (o) => ipcRenderer.invoke('save-file', o),
  openTemp: (o) => ipcRenderer.invoke('open-temp', o),
  printPdf: (html) => ipcRenderer.invoke('print-pdf', html),
  flash: () => ipcRenderer.invoke('flash'),
});
