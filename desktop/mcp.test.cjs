const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { connectionConfig, connectCodex } = require('./mcp.cjs');
test('bundled command is standalone on Windows and macOS', () => {
  for (const platform of ['win32', 'darwin']) {
    const config = connectionConfig({ packaged:true, resourcesPath:'/Applications/Traqu resources', dataDir:'/private/plans', platform, allowWrite:true });
    assert.ok(config.command.endsWith(platform === 'win32' ? 'traqu-mcp.exe' : 'traqu-mcp'));
    assert.deepEqual(config.args, ['--data-dir','/private/plans','--allow-write']);
  }
});
test('Codex settings preserve other servers, back up settings and update owned connection', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'traqu-connect-'));
  const previous = process.env.CODEX_HOME;
  process.env.CODEX_HOME = folder;
  try {
    const command = path.join(folder,'backend','traqu-mcp','traqu-mcp');
    fs.mkdirSync(path.dirname(command),{recursive:true});fs.writeFileSync(command,'');
    const settings = 'model = "example"\n[mcp_servers.other]\ncommand = "other"\n';
    fs.writeFileSync(path.join(folder,'config.toml'),settings);
    const options = {packaged:true, resourcesPath:folder, dataDir:folder, platform:'linux'};
    connectCodex(options); connectCodex({...options,allowWrite:true});
    const text = fs.readFileSync(path.join(folder,'config.toml'),'utf8');
    assert.ok(text.startsWith(settings.trimEnd()));
    assert.equal((text.match(/\[mcp_servers.traqu\]/g)||[]).length,1);
    assert.ok(text.includes('--allow-write'));
    assert.ok(fs.readdirSync(folder).some(name=>name.startsWith('config.toml.traqu-backup-')));
    fs.writeFileSync(path.join(folder,'config.toml'),'[mcp_servers.traqu]\ncommand="manual"\n');
    assert.throws(()=>connectCodex(options),/manually configured/);
    assert.ok(fs.readFileSync(path.join(folder,'config.toml'),'utf8').includes('manual'));
  } finally { if(previous === undefined) delete process.env.CODEX_HOME; else process.env.CODEX_HOME=previous; fs.rmSync(folder,{recursive:true,force:true}); }
});
