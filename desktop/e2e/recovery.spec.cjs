const {test,expect,_electron:electron}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('external recovery restores real progress after deleting app data, and update download saves a backup first',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'traqu-reinstall-')),dataDir=path.join(root,'app-data'),backupDir=path.join(root,'Documents','Traqu Backups');let app;
 async function launch(){
  const env={...process.env,TRAQO_DATA_DIR:dataDir,TRAQU_BACKUP_DIR:backupDir};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:process.env.TRAQO_TEST_EXECUTABLE||require('electron'),args:[...(process.env.TRAQO_TEST_NO_SANDBOX==='1'?['--no-sandbox']:[]),...(process.env.TRAQO_TEST_EXECUTABLE?[]:[path.resolve(__dirname,'../..')])],env});
  const page=await app.firstWindow();await page.waitForURL(/127\.0\.0\.1/);return page;
 }
 try{
  let page=await launch();
  await page.evaluate(async()=>{
   const request=async(url,method='GET',body)=>{const response=await fetch('/api'+url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!response.ok)throw Error(await response.text());return response.json();};
   const r=await request('/roadmaps','POST',{name:'Recovered goal',text:'# Week 1\n## Day 1 · 2026-11-11\n- [ ] Practice vectors'});
   const tasks=await request(`/roadmaps/${r.id}/tasks`);
   await request(`/tasks/${tasks[0].id}/status`,'PUT',{is_done:true,timezone:'Asia/Kolkata'});
   await request(`/tasks/${tasks[0].id}/blocks`,'POST',{type:'note',data:{text:'I tested the empty case.'}});
   await request('/profile','PUT',{name:'Recovered learner'});
   await window.traquDesktop.storage('save');
  });
  const backupFile=path.join(backupDir,'Traqu-workspace-latest.json');expect(fs.existsSync(backupFile)).toBe(true);
  await app.close();app=null;fs.rmSync(dataDir,{recursive:true,force:true});
  page=await launch();
  expect(JSON.parse(fs.readFileSync(backupFile,'utf8')).roadmaps[0].name).toBe('Recovered goal');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},backupFile);
  await expect(page.getByRole('region',{name:'Backups and updates'})).toHaveCount(0);
  await page.goto(new URL('/profile',page.url()).href);
  await page.getByRole('button',{name:'Preferences',exact:true}).click();
  await expect(page.locator('.storage-path')).toBeHidden();
  await page.getByRole('button',{name:'Restore backup',exact:true}).click();
  await expect.poll(()=>page.evaluate(async()=> (await (await fetch('/api/roadmaps')).json()).length)).toBe(1);
  await page.goto(new URL('/',page.url()).href);
  await expect(page.getByRole('link',{name:'Open Recovered goal',exact:true})).toBeVisible();
  const restored=await page.evaluate(async()=>{
   const read=async path=>(await fetch('/api'+path)).json();const rows=await read('/roadmaps');return {tasks:await read(`/roadmaps/${rows[0].id}/tasks`),profile:await read('/profile'),activity:await read('/activity?timezone=Asia%2FKolkata')};
  });
  expect(restored.tasks[0].is_done).toBe(true);expect(restored.tasks[0].blocks[0].data.text).toBe('I tested the empty case.');expect(restored.profile.name).toBe('Recovered learner');expect(restored.activity.total_completions).toBe(1);
  await app.evaluate(({shell})=>{
   const original=global.fetch;
   global.fetch=async(url,...args)=>String(url).startsWith('https://api.github.com/')?new Response(JSON.stringify({tag_name:'v99.0.0',assets:[{name:process.platform==='win32'?`Traqu-Windows-${process.arch}.exe`:process.platform==='darwin'?`Traqu-macOS-${process.arch}.dmg`:'Traqu-Linux-x64.deb',browser_download_url:'https://github.com/Gurtejhundal/Traqu/releases/download/v99.0.0/test-installer'}]}),{status:200,headers:{'Content-Type':'application/json'}}):original(url,...args);
   shell.openExternal=async url=>{global.traquTestUpdateURL=url;};
  });
  await page.goto(new URL('/profile',page.url()).href);
  await page.getByRole('button',{name:'Preferences',exact:true}).click();
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();await expect(page.getByRole('button',{name:'Back up & download update',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Back up & download update',exact:true}).click();
  await expect.poll(()=>app.evaluate(()=>global.traquTestUpdateURL)).toContain('/v99.0.0/');
  expect(JSON.parse(fs.readFileSync(backupFile,'utf8')).activity.length).toBeGreaterThan(0);
 }finally{if(app)await app.close();fs.rmSync(root,{recursive:true,force:true});}
});
