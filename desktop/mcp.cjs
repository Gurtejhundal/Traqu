const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');
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
  if (previous) fs.writeFileSync(`${file}.traqu-backup-${Date.now()}-${randomUUID()}`, previous, { mode: 0o600 });
  const temporary = `${file}.traqu-${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${text.trimEnd()}\n\n${block}`, { mode: 0o600 });
  fs.renameSync(temporary, file);
  return { connected: true, readOnly: !options.allowWrite };
}
module.exports = { connectionConfig, connectCodex };

const CLIENTS = Object.freeze({
  codex: 'Codex', 'claude-desktop': 'Claude Desktop', 'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI', antigravity: 'Antigravity', cursor: 'Cursor',
});
function clientFile(client, { home = os.homedir(), platform = process.platform, appData } = {}) {
  switch (client) {
    case 'claude-desktop':
      if (platform === 'linux') throw new Error('In Claude Desktop, open Settings → Developer → Edit Config and paste the copied configuration. Linux installations can use different settings locations.');
      return path.join(platform === 'darwin' ? path.join(home, 'Library', 'Application Support') : (appData || path.join(home, 'AppData', 'Roaming')), 'Claude', 'claude_desktop_config.json');
    case 'claude-code': return path.join(home, '.claude.json');
    case 'gemini-cli': return path.join(home, '.gemini', 'settings.json');
    case 'antigravity': return path.join(home, '.gemini', 'config', 'mcp_config.json');
    case 'cursor': return path.join(home, '.cursor', 'mcp.json');
    default: throw new Error('Choose a supported AI app.');
  }
}
function validObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function configForClient(options, client) {
  if (!Object.hasOwn(CLIENTS, client)) throw new Error('Choose a supported AI app.');
  const config = connectionConfig(options);
  return client === 'claude-code' ? { type: 'stdio', ...config } : config;
}
function connectClient(options, client) {
  if (client === 'codex') return connectCodex(options);
  const config = configForClient(options, client);
  if (!fs.existsSync(config.command)) throw new Error('The bundled AI connection is missing. Reinstall the latest Traqu version.');
  const file = clientFile(client, options);
  const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  let settings;
  try { settings = previous.trim() ? JSON.parse(previous) : {}; }
  catch { throw new Error('This settings file contains comments or invalid JSON. Use Copy configuration and merge it in your AI app’s MCP settings. Nothing was changed.'); }
  if (!validObject(settings) || (settings.mcpServers !== undefined && !validObject(settings.mcpServers))) throw new Error('Unexpected AI settings format. Use Copy configuration instead. Nothing was changed.');
  const existing = settings.mcpServers?.traqu;
  // Only update this exact executable/workspace. Never replace someone else's server.
  if (existing && (existing.command !== config.command || !Array.isArray(existing.args) || JSON.stringify(existing.args.filter(arg => arg !== '--allow-write')) !== JSON.stringify(config.args.filter(arg => arg !== '--allow-write')))) throw new Error('A different Traqu connection already exists. Remove it in the AI app first, or merge the copied configuration yourself. Nothing was changed.');
  settings.mcpServers = { ...settings.mcpServers, traqu: config };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (previous) fs.writeFileSync(`${file}.traqu-backup-${Date.now()}-${randomUUID()}`, previous, { mode: 0o600 });
  const temporary = `${file}.traqu-${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(settings, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, file);
  return { configured: true, readOnly: !options.allowWrite, client: CLIENTS[client] };
}
module.exports = { ...module.exports, CLIENTS, clientFile, configForClient, connectClient };
