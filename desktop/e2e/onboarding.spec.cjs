const {test,expect,_electron:electron}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
test('quick setup, optional reminders, inbox and dedicated agent workflows persist without losing work',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'traqu-welcome-'));let app;
 const env={...process.env,TRAQO_DATA_DIR:path.join(folder,'data'),TRAQU_BACKUP_DIR:path.join(folder,'backup')};delete env.ELECTRON_RUN_AS_NODE;
 async function launch(){app=await electron.launch({executablePath:process.env.TRAQO_TEST_EXECUTABLE||require('electron'),args:[...(process.env.TRAQO_TEST_NO_SANDBOX==='1'?['--no-sandbox']:[]),...(process.env.TRAQO_TEST_EXECUTABLE?[]:[path.resolve(__dirname,'../..')])],env});const page=await app.firstWindow();await page.waitForURL(/127\.0\.0\.1/);return page;}
 try{
  let page=await launch();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await expect(page.getByRole('heading',{name:'Hey, what should we call you?'})).toBeVisible();
  await page.getByLabel('What should we call you?',{exact:true}).fill('Alex');
  await page.getByLabel('Setup photo file').setInputFiles(path.resolve(__dirname,'../resources/icon.png'));
  await expect(page.getByAltText('Your chosen photo')).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'Coding',exact:true}).click();
  await page.getByRole('button',{name:'Prepare for an internship',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByLabel('Daily reminder in Traqu')).not.toBeChecked();
  await page.getByLabel('Daily reminder in Traqu').check();await page.getByLabel('Reminder time',{exact:true}).fill('00:00');
  const notificationSupport=await page.evaluate(()=>window.traquDesktop.notifications());
  if(notificationSupport.supported) await expect(page.getByLabel('Also send a desktop notification')).not.toBeChecked();
  else await expect(page.getByText('Desktop notifications are unavailable here. Your in-app reminder still works.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Make myself at home',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your roadmaps',exact:true})).toBeVisible();
  let profile=await page.evaluate(async()=> (await fetch('/api/profile')).json());
  expect(profile.name).toBe('Alex');expect(profile.interests).toEqual(['Coding']);expect(profile.goal).toBe('Prepare for an internship');expect(profile.avatar).toMatch(/^data:image\/jpeg/);expect(profile.desktop_notifications).toBe(false);expect(profile.onboarding_completed).toBe(true);
  await page.getByRole('button',{name:/Notifications/}).click();
  await expect(page.getByRole('heading',{name:'Bring your AI along',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'One small step today',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Explore AI connections',exact:false}).click();
  await expect(page.getByRole('navigation',{name:'Profile sections'}).getByRole('button',{name:'AI connections',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('button',{name:'Save settings',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Install Traqu plugin',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Copy install steps',exact:true}).click();
  await expect(page.getByLabel('AI connection text')).toHaveValue(/codex plugin add traqu@traqu/);
  for(const client of ['claude-code','cursor','gemini-cli','antigravity']){
   await page.getByLabel('Your AI app',{exact:true}).selectOption(client);
   await expect(page.getByRole('button',{name:/Install Traqu (plugin|skill)/})).toBeVisible();
  }
  await page.getByLabel('Your AI app',{exact:true}).selectOption('claude-desktop');
  await expect(page.getByRole('button',{name:/Install Traqu (plugin|skill)/})).toHaveCount(0);
  await page.getByRole('button',{name:/Notifications/}).click();
  await page.getByRole('button',{name:'Dismiss all',exact:true}).click();
  await expect(page.getByText('All caught up. A little breathing room.',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Notifications',exact:true})).toBeFocused();
  await page.getByRole('navigation',{name:'Profile sections'}).getByRole('button',{name:'Preferences',exact:true}).click();
  await page.getByLabel('Daily reminder in Traqu').uncheck();await page.getByRole('button',{name:'Save settings',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('navigation',{name:'Profile sections'}).getByRole('button',{name:'AI connections',exact:true}).click();
  await expect(page.getByRole('button',{name:'Copy chat prompt',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await app.close();app=null;page=await launch();
  await expect(page.getByRole('heading',{name:'Your roadmaps',exact:true})).toBeVisible();
  profile=await page.evaluate(async()=> (await fetch('/api/profile')).json());expect(profile.reminder_enabled).toBe(false);expect(profile.notifications_seen).toContain('ai-connection');expect(profile.name).toBe('Alex');
  expect(errors).toEqual([]);
 }finally{if(app)await app.close();fs.rmSync(folder,{recursive:true,force:true});}
});
