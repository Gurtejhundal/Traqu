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
const { CLIENTS, clientFile, configForClient, connectClient } = require('./mcp.cjs');
test('each JSON client preserves other settings and scopes and protects conflicting entries', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'traqu-clients-'));
  try {
    const command = path.join(folder, 'backend', 'traqu-mcp', 'traqu-mcp');
    fs.mkdirSync(path.dirname(command), {recursive:true}); fs.writeFileSync(command, '');
    const options = {packaged:true, resourcesPath:folder, dataDir:path.join(folder,'private plans'), home:folder, platform:'darwin'};
    for (const client of Object.keys(CLIENTS).filter(name => name !== 'codex')) {
      const file = clientFile(client, options);
      fs.mkdirSync(path.dirname(file), {recursive:true});
      const other = {theme:'dark', projects:{'/my-project':{mcpServers:{existing:{command:'project'}}}}, mcpServers:{other:{command:'keep-me'}}};
      fs.writeFileSync(file, JSON.stringify(other));
      connectClient(options, client);
      connectClient({...options, allowWrite:true}, client);
      const result = JSON.parse(fs.readFileSync(file,'utf8'));
      assert.deepEqual(result.projects, other.projects);
      assert.equal(result.theme, 'dark'); assert.equal(result.mcpServers.other.command, 'keep-me');
      assert.ok(result.mcpServers.traqu.args.includes('--allow-write'));
      assert.equal(result.mcpServers.traqu.type, client === 'claude-code' ? 'stdio' : undefined);
      const conflict = JSON.stringify({mcpServers:{traqu:{command:'someone-else',args:[]}}});
      fs.writeFileSync(file, conflict);
      assert.throws(() => connectClient(options,client), /different Traqu/);
      assert.equal(fs.readFileSync(file,'utf8'), conflict);
      fs.writeFileSync(file, '{ // settings with comments\n}');
      assert.throws(() => connectClient(options,client), /comments or invalid/);
      assert.equal(fs.readFileSync(file,'utf8'), '{ // settings with comments\n}');
    }
    assert.throws(() => clientFile('unknown', options), /supported/);
    assert.throws(() => clientFile('claude-desktop', {...options, platform:'linux'}), /Edit Config/);
    assert.throws(() => configForClient(options, 'unknown'), /supported/);
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
});
