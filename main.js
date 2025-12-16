const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');

const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 500,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function startPythonTracker() {
    const pythonPath = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
    const scriptPath = path.join(__dirname, 'tracker.py');

    console.log(`Spawning Python: ${pythonPath} ${scriptPath}`);

    pythonProcess = spawn(pythonPath, [scriptPath]);

    pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const json = JSON.parse(line);
                    if (mainWindow) {
                        mainWindow.webContents.send('tracker-data', json);
                        if (json.blink_left) mainWindow.webContents.send('click-event', 'left');
                        if (json.blink_right) mainWindow.webContents.send('click-event', 'right');
                    }
                } catch (e) {
                    // console.log('Non-JSON output:', line);
                }
            }
        });
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
    });
}

ipcMain.on('start-calibration', () => {
    if (pythonProcess) {
        console.log("Sending CALIBRATE command");
        pythonProcess.stdin.write('CALIBRATE\n');
    }
});

ipcMain.on('start-tracking', () => {
    if (pythonProcess) {
        console.log("Sending START command via Button");
        pythonProcess.stdin.write('START\n');
    } else {
        console.log("Python process not available for START");
    }
});

ipcMain.on('stop-tracking', () => {
    if (pythonProcess) {
        console.log("Sending STOP command via Button");
        pythonProcess.stdin.write('STOP\n');
    }
});

app.whenReady().then(() => {
    createWindow();
    startPythonTracker();

    // Shortcuts
    globalShortcut.register('CommandOrControl+Shift+S', () => {
        if (pythonProcess) {
            console.log("Sending START command");
            pythonProcess.stdin.write('START\n');
        }
    });

    globalShortcut.register('CommandOrControl+Shift+Q', () => {
        if (pythonProcess) {
            console.log("Sending STOP command");
            pythonProcess.stdin.write('STOP\n');
        }
    });

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        if (pythonProcess) pythonProcess.kill();
        app.quit();
    }
});

app.on('before-quit', () => {
    if (pythonProcess) pythonProcess.kill();
    globalShortcut.unregisterAll();
});
