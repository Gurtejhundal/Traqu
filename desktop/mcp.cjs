const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const START = '# BEGIN Traqu desktop MCP';
const END = '# END Traqu desktop MCP';
function connectionConfig({ packaged, resourcesPath, root, dataDir, allowWrite = false, platform = process.platform }) {
  const command = packaged ? path.join(resourcesPath, 'backend', 'traqu-mcp', platform === 'win32' ? 'traqu-mcp.exe' : 'traqu-mcp') : path.join(root, '.venv-desktop', platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const args = [...(packaged ? [] : [path.join(root, 'backend', 'mcp_server.py')]), '--data-dir', dataDir, ...(allowWrite ? ['--allow-write'] : [])];
  return { command, args };
}
function connectCodex(options) {
  const config = connectionConfig(options);
  if (!fs.existsSync(config.command)) throw new Error('The bundled AI connection is missing. Reinstall the latest Traqu version.');
  const directory = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const file = path.join(directory, 'config.toml');
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  let text = previous;
  const start = text.indexOf(START), end = text.indexOf(END);
  if (start >= 0 && end >= start) text = text.slice(0, start) + text.slice(end + END.length);
  if (/^\s*\[mcp_servers\.(?:traqu|"traqu"|'traqu')(?:\]|\.)/m.test(text)) throw new Error('Codex already has a manually configured Traqu connection. Remove that connection in Codex settings first; your other settings have not been changed.');
  const block = `${START}\n[mcp_servers.traqu]\ncommand = ${JSON.stringify(config.command)}\nargs = ${JSON.stringify(config.args)}\n${END}\n`;
  fs.mkdirSync(directory, { recursive: true });
  if (previous) fs.writeFileSync(`${file}.traqu-backup-${Date.now()}`, previous, { mode: 0o600 });
  const temporary = `${file}.traqu-${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${text.trimEnd()}\n\n${block}`, { mode: 0o600 });
  fs.renameSync(temporary, file);
  return { connected: true, readOnly: !options.allowWrite };
}
module.exports = { connectionConfig, connectCodex };
