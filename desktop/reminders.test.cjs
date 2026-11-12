const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { reminderFor, createReminders } = require('./reminders.cjs');
const profile = {onboarding_completed:true,reminder_enabled:true,desktop_notifications:true,reminder_time:'19:00',timezone:'Asia/Kolkata'};
test('desktop reminders require consent and use the chosen timezone, delivery window and day', () => {
 const now = new Date('2026-11-12T13:30:00Z');
 assert.equal(reminderFor(profile,now,null),'2026-11-12');
 for (const change of [{onboarding_completed:false},{reminder_enabled:false},{desktop_notifications:false},{timezone:'invalid'},{reminder_time:'25:00'}]) assert.equal(reminderFor({...profile,...change},now,null),null);
 assert.equal(reminderFor(profile,new Date('2026-11-12T13:29:00Z'),null),null);
 assert.equal(reminderFor(profile,new Date('2026-11-12T13:45:00Z'),null),null);
 assert.equal(reminderFor(profile,now,'2026-11-12'),null);
});
test('delivery is deduplicated across simultaneous ticks and app restarts, and disabling takes effect', async () => {
 const dataDir = fs.mkdtempSync(path.join(os.tmpdir(),'traqu-reminder-')); let shown=0,enabled=true;
 const options={dataDir,readProfile:async()=>({...profile,desktop_notifications:enabled}),show:()=>{shown++;return true;},now:()=>new Date('2026-11-12T13:30:00Z')};
 try {
  let tick=createReminders(options);await Promise.all([tick(),tick()]);await tick();assert.equal(shown,1);
  tick=createReminders(options);await tick();assert.equal(shown,1);
  enabled=false;await createReminders({...options,now:()=>new Date('2026-11-13T13:30:00Z')})();assert.equal(shown,1);
 } finally {fs.rmSync(dataDir,{recursive:true,force:true});}
});
