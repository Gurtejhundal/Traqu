const fs = require('node:fs');
const path = require('node:path');
const {createHash, randomUUID} = require('node:crypto');
const MAX_BYTES = 8 * 1024 * 1024;
function inside(parent, child) { const relative = path.relative(path.resolve(parent), path.resolve(child)); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
function createRecovery({dataDir, documentsDir, backupDir, readWorkspace}) {
  const settings = path.join(dataDir, 'backup-settings.json');
  let saved = {}; try { saved = JSON.parse(fs.readFileSync(settings,'utf8')); } catch { /* First launch. */ }
  let directory = backupDir || saved.directory || path.join(documentsDir, 'Traqu Backups');
  let lastSaved = null, error = '', queue = Promise.resolve();
  function status() {
    const file = path.join(directory, 'Traqu-workspace-latest.json');
    let available = false;
    try { available = fs.statSync(file).isFile(); if (!lastSaved) lastSaved = fs.statSync(file).mtime.toISOString(); } catch { /* Not backed up yet. */ }
    return {directory, file:available ? file : null, lastSaved, error};
  }
  async function writeBackup() {
    try {
      if (inside(dataDir, directory)) throw new Error('Choose a backup folder outside Traqu’s app data folder.');
      const payload = await readWorkspace();
      if (payload?.format !== 'traqu-workspace' || payload.version !== 1 || !Array.isArray(payload.roadmaps)) throw new Error('Workspace backup validation failed. The previous backup was kept.');
      if(payload.roadmaps.length>100 || payload.roadmaps.reduce((count,roadmap)=>count+(roadmap.tasks?.length||0),0)>10000)throw new Error('Workspace exceeds the full restore limit. Export your roadmaps individually before updating or uninstalling.');
      const content = JSON.stringify(payload, null, 2);
      if (Buffer.byteLength(content) > MAX_BYTES) throw new Error('Workspace backup exceeds 8 MB. Export your roadmaps individually before updating or uninstalling.');
      fs.mkdirSync(directory,{recursive:true,mode:0o700});
      const latest = path.join(directory,'Traqu-workspace-latest.json');
      let previous = ''; try { previous = fs.readFileSync(latest,'utf8'); } catch { /* First backup. */ }
      // A fresh reinstall must not replace the recovery copy with an empty library.
      if (payload.roadmaps.length === 0 && previous) {
        try { if (JSON.parse(previous).roadmaps?.length > 0) { lastSaved=fs.statSync(latest).mtime.toISOString();error='';return {...status(),preservedNonEmpty:true}; } } catch { /* Replace invalid old output with a verified payload. */ }
      }
      const digest = text => createHash('sha256').update(text).digest('hex');
      if (digest(previous) !== digest(content)) {
        const version = path.join(directory,`Traqu-workspace-${Date.now()}-${randomUUID()}.json`);
        fs.writeFileSync(version,content,{mode:0o600,flag:'wx'});
        const temporary = `${latest}.${randomUUID()}.tmp`;
        fs.writeFileSync(temporary,content,{mode:0o600}); fs.renameSync(temporary,latest);
        const history = fs.readdirSync(directory).filter(name=>/^Traqu-workspace-\d{13}-[a-f0-9-]+\.json$/.test(name)).sort();
        for (const name of history.slice(0,-20)) fs.unlinkSync(path.join(directory,name));
      }
      lastSaved = fs.statSync(latest).mtime.toISOString(); error = ''; return status();
    } catch (failure) { error = failure.message; throw failure; }
  }
  function save() { const task = queue.catch(()=>{}).then(writeBackup); queue = task; return task; }
  async function chooseDirectory(next) {
    if (inside(dataDir,next)) throw new Error('Choose a folder outside Traqu’s app data folder.');
    await queue.catch(()=>{}); directory = path.resolve(next); lastSaved = null;
    fs.writeFileSync(settings,JSON.stringify({directory}),{mode:0o600}); return save();
  }
  return {status,save,chooseDirectory};
}
function newerVersion(candidate,current) {
  const parse = value => /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value)?.slice(1).map(Number);
  const a=parse(candidate),b=parse(current);if(!a||!b)return false;
  for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;
}
function updateAsset(release,platform,arch,linuxTarget='AppImage') {
  const name = platform==='win32' ? `Traqu-Windows-${arch}.exe` : platform==='darwin' ? `Traqu-macOS-${arch}.dmg` : arch==='x64' ? `Traqu-Linux-x64.${linuxTarget}` : null;
  const asset = release.assets?.find(item=>item.name===name);
  if(!asset)throw new Error('No installer is available for this device architecture. Open the release page from Traqu’s website.');
  const url=new URL(asset.browser_download_url);
  if(url.origin!=='https://github.com'||!url.pathname.startsWith('/Gurtejhundal/Traqu/releases/download/'))throw new Error('Unexpected update location. Download from the official repository.');
  return url.href;
}
module.exports={createRecovery,newerVersion,updateAsset,MAX_BYTES};
