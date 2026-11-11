const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const python = process.env.TRAQO_BACKEND_PYTHON || path.join(root, '.venv-desktop', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const result = spawnSync(python, [
  '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--name', 'traqo-backend',
  '--distpath', 'dist/backend', '--workpath', 'build/pyinstaller', '--specpath', 'build',
  '--paths', 'backend', '--collect-all', 'pdfplumber', '--collect-all', 'pypdfium2',
  '--collect-submodules', 'uvicorn', '--collect-all', 'tzdata', '--hidden-import', 'main',
  'backend/desktop_server.py',
], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const mcp = spawnSync(python, [
  '-m', 'PyInstaller', '--noconfirm', '--clean', '--onedir', '--name', 'traqu-mcp',
  '--distpath', 'dist/backend', '--workpath', 'build/pyinstaller-mcp', '--specpath', 'build',
  '--paths', 'backend', '--collect-submodules', 'mcp.server', '--collect-submodules', 'mcp.shared', '--collect-all', 'tzdata',
  '--collect-all', 'pdfplumber', '--collect-all', 'pypdfium2',
  '--hidden-import', 'main', '--hidden-import', 'db',
  '--add-data', `${path.join(root, 'frontend/public/agents/SKILL.md')}${require('node:path').delimiter}agents`,
  'backend/mcp_server.py',
], { cwd: root, stdio: 'inherit' });
if (mcp.error) throw mcp.error;
process.exit(mcp.status ?? 1);
