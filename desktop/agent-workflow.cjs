const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
const locations = { 'gemini-cli': ['.gemini','skills'], antigravity: ['.gemini','config','skills'], cursor: ['.cursor','skills'] };
async function installWorkflow({client,root,resourcesPath,packaged,home=os.homedir(),run=execFile}) {
  if (client === 'codex' || client === 'claude-code') {
    const binary = client === 'codex' ? 'codex' : 'claude';
    const commands = client === 'codex'
      ? [['plugin','marketplace','add','Gurtejhundal/Traqu'],['plugin','add','traqu@traqu']]
      : [['plugin','marketplace','add','Gurtejhundal/Traqu'],['plugin','install','traqu@traqu','--scope','user']];
    try { for (const args of commands) await run(binary,args,{timeout:60000,maxBuffer:1024*1024,windowsHide:true}); }
    catch { throw new Error(`Could not finish plugin installation. Ensure the ${binary} CLI is installed, then use Copy install steps. Your MCP settings and roadmaps were not changed.`); }
    return {installed:true,kind:'plugin'};
  }
  if (!Object.hasOwn(locations,client)) throw new Error('This app uses the chat prompt instead of an agent skill.');
  const source = path.join(packaged ? path.join(resourcesPath,'agent-workflow') : path.join(root,'plugins','traqu'), 'skills','traqu','SKILL.md');
  const text = fs.readFileSync(source,'utf8');
  const directory = path.join(home,...locations[client],'traqu');
  const file = path.join(directory,'SKILL.md');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink() || fs.readFileSync(file,'utf8') !== text) throw new Error('A different Traqu skill already exists. Keep or remove it in your agent’s settings before installing this one.');
  } else fs.writeFileSync(file,text,{flag:'wx',mode:0o600});
  return {installed:true,kind:'skill'};
}
module.exports = {installWorkflow};
