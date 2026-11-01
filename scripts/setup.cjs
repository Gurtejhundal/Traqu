const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const venv = path.join(root, '.venv-desktop');
const python = path.join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' && command === 'npm' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!existsSync(python)) {
  // Set TRAQO_PYTHON to a Python 3.11–3.13 executable if python3 is unavailable.
  run(process.env.TRAQO_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-m', 'venv', venv]);
}
run(python, ['-m', 'pip', 'install', '-r', 'backend/requirements-desktop.txt']);
run('npm', ['ci', '--prefix', 'frontend']);
console.log('\nReady. Run npm start to open Traqo, or npm run dist to make an installer.');
