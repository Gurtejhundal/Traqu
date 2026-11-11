// Pure stdio launcher: npm's banners must never enter an MCP protocol stream.
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const python = path.join(root, '.venv-mcp', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  process.stderr.write('Run npm run setup:mcp in the Traqu repository first.\n');
  process.exit(1);
}
const child = spawn(python, [path.join(root, 'backend/mcp_server.py'), ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('error', error => { process.stderr.write(`${error.message}\n`); process.exit(1); });
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
