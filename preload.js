const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startCalibration: () => ipcRenderer.send('start-calibration'),
    startTracking: () => ipcRenderer.send('start-tracking'),
    stopTracking: () => ipcRenderer.send('stop-tracking'),
    onTrackerData: (callback) => ipcRenderer.on('tracker-data', (event, value) => callback(value)),
    onClickEvent: (callback) => ipcRenderer.on('click-event', (event, value) => callback(value))
});
