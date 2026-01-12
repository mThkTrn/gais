const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let pythonProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 600,
        height: 500,
        alwaysOnTop: false,
        icon: path.join(__dirname, 'media', 'GAIS_Logo.png'),
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
    let pythonExecutable;
    let args = [];

    if (app.isPackaged) {
        // Production paths
        const pythonDir = path.join(process.resourcesPath, 'python');
        const venvDir = path.join(pythonDir, 'venv');
        
        // Determine the correct Python executable path based on the platform
        if (process.platform === 'win32') {
            pythonExecutable = path.join(venvDir, 'Scripts', 'python.exe');
        } else {
            // For macOS and Linux
            pythonExecutable = path.join(venvDir, 'bin', 'python');
            // On macOS, we might need to use 'python3' explicitly
            if (process.platform === 'darwin' && !fs.existsSync(pythonExecutable)) {
                pythonExecutable = path.join(venvDir, 'bin', 'python3');
            }
        }
        
        const scriptPath = path.join(pythonDir, 'tracker.py');
        args = [scriptPath];

        console.log(`Spawning Packaged Python: ${pythonExecutable} ${args.join(' ')}`);
        pythonProcess = spawn(pythonExecutable, args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });
    } else {
        // Development paths
        let pythonPath;
        if (process.platform === 'win32') {
            pythonPath = path.join(__dirname, 'venv', 'Scripts', 'python.exe');
        } else {
            pythonPath = path.join(__dirname, 'venv', 'bin', 'python');
            if (process.platform === 'darwin' && !fs.existsSync(pythonPath)) {
                pythonPath = path.join(__dirname, 'venv', 'bin', 'python3');
            }
        }
        
        const scriptPath = path.join(__dirname, 'tracker.py');
        console.log(`Spawning Python: ${pythonPath} ${scriptPath}`);
        pythonProcess = spawn(pythonPath, [scriptPath]);
    }

    pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const json = JSON.parse(line);
                    if (mainWindow) {
                        if (json.type === 'calibration_event') {
                            if (json.status === 'start') {
                                mainWindow.hide();
                            } else if (json.status === 'end') {
                                mainWindow.show();
                            }
                        } else {
                            mainWindow.webContents.send('tracker-data', json);
                            if (json.blink_left) mainWindow.webContents.send('click-event', 'left');
                            if (json.blink_right) mainWindow.webContents.send('click-event', 'right');
                        }
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
