const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceDir = path.resolve(__dirname, '..');
const distDir = path.resolve(sourceDir, 'dist', 'python');
const venvDir = path.join(distDir, 'venv');

console.log('Preparing Python environment...');

// Ensure dist/python exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Copy tracker.py
fs.copyFileSync(path.join(sourceDir, 'tracker.py'), path.join(distDir, 'tracker.py'));
console.log('Copied tracker.py');

// Check if we're on macOS
const isMac = process.platform === 'darwin';

// Create a new virtual environment
console.log('Creating Python virtual environment...');
try {
    // Remove existing venv if it exists
    if (fs.existsSync(venvDir)) {
        fs.rmSync(venvDir, { recursive: true, force: true });
    }
    
    // Create new virtual environment with Python 3.11
    try {
        execSync(`python3.11 -m venv "${venvDir}"`, { stdio: 'inherit' });
    } catch (error) {
        console.log('Python 3.11 not found, falling back to system Python');
        execSync(`python3 -m venv "${venvDir}"`, { stdio: 'inherit' });
    }
    
    // Get the correct pip path
    const pipPath = path.join(venvDir, 'bin', 'pip');
    
    // Upgrade pip
    console.log('Upgrading pip...');
    execSync(`"${pipPath}" install --upgrade pip`, { stdio: 'inherit' });
    
    // Install requirements if they exist
    const requirementsPath = path.join(sourceDir, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
        console.log('Installing Python dependencies...');
        execSync(`"${pipPath}" install -r "${requirementsPath}"`, { stdio: 'inherit' });
    }
    
    // On macOS, we need to fix the Python executable path in the venv
    if (isMac) {
        console.log('Fixing Python paths for macOS...');
        const pythonBinPath = path.join(venvDir, 'bin/python');
        const python3BinPath = path.join(venvDir, 'bin/python3');
        
        // Make sure the python symlink exists
        if (!fs.existsSync(pythonBinPath) && fs.existsSync(python3BinPath)) {
            fs.symlinkSync('python3', pythonBinPath);
        }
    }
    
    console.log('Python environment prepared successfully!');
} catch (error) {
    console.error('Failed to set up Python environment:', error);
    process.exit(1);
}
