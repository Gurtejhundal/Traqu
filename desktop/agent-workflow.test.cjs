const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {installWorkflow}=require('./agent-workflow.cjs');
test('agent skill installation is standalone, repeatable and preserves conflicting user skills',async()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'traqu-skill-'));
 try {
  for(const [client,folder] of [['cursor','.cursor/skills'],['gemini-cli','.gemini/skills'],['antigravity','.gemini/config/skills']]){
   const options={client,home,root:path.resolve(__dirname,'..'),packaged:false};
   assert.equal((await installWorkflow(options)).kind,'skill');assert.equal((await installWorkflow(options)).installed,true);
   const file=path.join(home,folder,'traqu','SKILL.md');fs.writeFileSync(file,'My custom instructions');
   await assert.rejects(()=>installWorkflow(options),/different Traqu skill/);assert.equal(fs.readFileSync(file,'utf8'),'My custom instructions');
  }
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('plugin installation uses fixed argument lists, preserves MCP and reports missing CLIs',async()=>{
 for(const client of ['codex','claude-code']){
  const calls=[];await installWorkflow({client,run:async(...args)=>calls.push(args)});assert.equal(calls.length,2);assert.equal(calls[0][1].at(-1),'Gurtejhundal/Traqu');assert.equal(calls[1][1].includes('traqu@traqu'),true);assert.equal(calls[0][2].shell,undefined);
  await assert.rejects(()=>installWorkflow({client,run:async()=>{throw Error('missing')}}),/Copy install steps/);
 }
 await assert.rejects(()=>installWorkflow({client:'../../arbitrary'}),/chat prompt/);
});
