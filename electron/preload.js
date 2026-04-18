const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  scanPorts: () => ipcRenderer.invoke('port:scan'),
  killProcess: (pid) => ipcRenderer.invoke('port:kill', pid),
  closeAllPorts: () => ipcRenderer.invoke('port:closeAll'),
  registerPort: (info) => ipcRenderer.invoke('port:register', info),
  unregisterPort: (port) => ipcRenderer.invoke('port:unregister', port),
  getRegisteredPorts: () => ipcRenderer.invoke('port:getRegistered'),
  onPortUpdate: (callback) => {
    ipcRenderer.on('port:update', (event, data) => callback(data))
  },
  minimizeToTray: () => ipcRenderer.send('tray:minimize'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings)
})
