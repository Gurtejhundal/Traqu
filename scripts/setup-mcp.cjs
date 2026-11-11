const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(process.env.TRAQU_MCP_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-m', 'venv', '.venv-mcp']);
run(path.join(root, '.venv-mcp', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), ['-m', 'pip', 'install', '-r', 'backend/requirements-mcp.txt']);
console.log('Traqu MCP is ready. Run node scripts/mcp.cjs --print-config for connection settings.');
