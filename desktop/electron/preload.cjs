const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  openProject: () => ipcRenderer.invoke('file:open-project'),
  openMidi: () => ipcRenderer.invoke('file:open-midi'),
  openAudio: () => ipcRenderer.invoke('file:open-audio'),
  openTuning: () => ipcRenderer.invoke('file:open-tuning'),
  saveMidi: payload => ipcRenderer.invoke('file:save-midi', payload),
  saveAudio: payload => ipcRenderer.invoke('file:save-audio', payload),
  writeExportLog: payload => ipcRenderer.invoke('diagnostics:write-export-log', payload),
  saveDiagnosticLog: payload => ipcRenderer.invoke('diagnostics:save-log', payload),
  resolveAsset: payload => ipcRenderer.invoke('file:resolve-asset', payload),
  saveProject: payload => ipcRenderer.invoke('file:save-project', payload),
  saveTuning: payload => ipcRenderer.invoke('file:save-tuning', payload),
  openSf2: () => ipcRenderer.invoke('file:open-sf2'),
  readSf2: filePath => ipcRenderer.invoke('file:read-sf2', filePath),
  readAudio: filePath => ipcRenderer.invoke('file:read-audio', filePath),
  readBuiltinSound: relativePath => ipcRenderer.invoke('file:read-builtin-sound', relativePath)
})
