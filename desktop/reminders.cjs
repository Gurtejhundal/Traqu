const fs = require('node:fs');
const path = require('node:path');

function reminderFor(profile, now, lastDay) {
  if (!profile.onboarding_completed || !profile.reminder_enabled || !profile.desktop_notifications) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(profile.reminder_time)) return null;
  let parts;
  try { parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(now).map(p => [p.type,p.value])); }
  catch { return null; }
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const [hour, minute] = profile.reminder_time.split(':').map(Number);
  const elapsed = Number(parts.hour)*60 + Number(parts.minute) - hour*60 - minute;
  return day !== lastDay && elapsed >= 0 && elapsed < 15 ? day : null;
}

function createReminders({ dataDir, readProfile, show, now = () => new Date() }) {
  const file = path.join(dataDir, 'reminder-delivery.json');
  let lastDay, busy = false;
  try { lastDay = JSON.parse(fs.readFileSync(file,'utf8')).day; } catch { /* First reminder. */ }
  return async function tick() {
    if (busy) return;
    busy = true;
    try {
      const profile = await readProfile();
      const day = reminderFor(profile, now(), lastDay);
      if (!day || !show()) return;
      lastDay = day;
      const temporary = `${file}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify({day}), {mode:0o600}); fs.renameSync(temporary,file);
    } finally { busy = false; }
  };
}
module.exports = { reminderFor, createReminders };
