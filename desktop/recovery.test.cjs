const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createRecovery,newerVersion,updateAsset}=require('./recovery.cjs');
test('recovery survives deleted app data, retains progress/history/photo, and protects a reinstall from empty output',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'traqu-recovery-'));
 try{
  const dataDir=path.join(root,'app-data'),documentsDir=path.join(root,'Documents');fs.mkdirSync(dataDir);
  let payload={format:'traqu-workspace',version:1,roadmaps:[{name:'C++',tasks:[{title:'Vectors',is_done:true}]}],profile:{avatar:'photo'},activity:[{event_key:'real-event',is_done:true}]};
  const options={dataDir,documentsDir,readWorkspace:async()=>payload};const store=createRecovery(options);
  await store.save();const file=store.status().file;const first=fs.readFileSync(file,'utf8');
  assert.ok(!file.startsWith(dataDir));await store.save();assert.equal(fs.readdirSync(store.status().directory).filter(n=>/^Traqu-workspace-\d/.test(n)).length,1);
  payload={...payload,roadmaps:[]};await store.save();assert.equal(fs.readFileSync(file,'utf8'),first);
  fs.rmSync(dataDir,{recursive:true});fs.mkdirSync(dataDir);
  const reinstalled=createRecovery(options);await reinstalled.save();assert.equal(fs.readFileSync(reinstalled.status().file,'utf8'),first);
  const restored=JSON.parse(first);assert.equal(restored.roadmaps[0].tasks[0].is_done,true);assert.equal(restored.profile.avatar,'photo');assert.equal(restored.activity[0].event_key,'real-event');
  await assert.rejects(()=>reinstalled.chooseDirectory(path.join(dataDir,'backups')),/outside/);
  payload={invalid:true};await assert.rejects(()=>reinstalled.save(),/validation/);assert.equal(fs.readFileSync(file,'utf8'),first);
  assert.ok(reinstalled.status().error);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('update comparison and installers are architecture-specific and restricted to the official repository',()=>{
 assert.equal(newerVersion('v1.6.2','1.6.1'),true);assert.equal(newerVersion('v1.5.0','1.6.2'),false);assert.equal(newerVersion('v1.6.2-beta','1.6.1'),false);
 const release={assets:[{name:'Traqu-Windows-arm64.exe',browser_download_url:'https://github.com/Gurtejhundal/Traqu/releases/download/v1.6.2/Traqu-Windows-arm64.exe'},{name:'Traqu-Linux-x64.deb',browser_download_url:'https://github.com/Gurtejhundal/Traqu/releases/download/v1.6.2/Traqu-Linux-x64.deb'}]};
 assert.ok(updateAsset(release,'win32','arm64').endsWith('arm64.exe'));assert.ok(updateAsset(release,'linux','x64','deb').endsWith('.deb'));assert.throws(()=>updateAsset(release,'linux','arm64'),/No installer/);
 release.assets[0].browser_download_url='https://evil.example/installer.exe';assert.throws(()=>updateAsset(release,'win32','arm64'),/Unexpected/);
});
