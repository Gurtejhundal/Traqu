const { app, BrowserWindow, Menu, dialog, shell, session, ipcMain } = require('electron');
const { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, renameSync } = require('node:fs');
const path = require('node:path');
const { startBackend } = require('./backend.cjs');
const { isWorkspaceURL, isExternalURL, validWindowState, workspaceDirectoryOverride } = require('./policy.cjs');

app.setName('Traqu');
// Reuse the existing database when upgrading from the old display name.
const dataOverride = workspaceDirectoryOverride(app.getPath('appData'), process.env.TRAQO_DATA_DIR);
if (dataOverride) app.setPath('userData', dataOverride);
const root = path.resolve(__dirname, '..');
let window;
let backend;
let log;
let recovery;
let backupTimer;
let backupDebounce;
let quitting = false;
let shutdownComplete = false;
let starting = true;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });
  app.whenReady().then(launch).catch(fail);
}

function navigate(route) {
  if (backend && window && !window.isDestroyed()) window.loadURL(`${backend.origin}${route}`).catch(fail);
}

function menu() {
  const mac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(mac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'File', submenu: [
      { label: 'New Roadmap', accelerator: 'CmdOrCtrl+N', click: () => navigate('/import') },
      { label: 'Roadmap Library', accelerator: 'CmdOrCtrl+Shift+L', click: () => navigate('/') },
      { type: 'separator' },
      { label: 'Show Data Folder', click: () => shell.openPath(app.getPath('userData')) },
      { label: 'Show Logs', click: () => shell.openPath(path.join(app.getPath('userData'), 'logs')) },
      { type: 'separator' }, { role: mac ? 'close' : 'quit' },
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [
      { label: 'Reload Workspace', accelerator: 'CmdOrCtrl+R', click: () => window?.webContents.reload() },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
      ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : []),
    ] },
    { role: 'windowMenu' },
    { label: 'Help', submenu: [
      { label: 'Traqu on GitHub', click: () => shell.openExternal('https://github.com/Gurtejhundal/Traqu') },
      ...(!mac ? [{ label: 'About Traqu', click: () => dialog.showMessageBox(window, {
        type: 'info', title: 'About Traqu', message: `Traqu ${app.getVersion()}`,
        detail: 'Your plans, at your pace.\nA private roadmap workspace on your computer.\n\nLinux · Windows · macOS',
      }) }] : []),
    ] },
  ]));
}

function createWindow() {
  let state = {};
  try { state = validWindowState(JSON.parse(readFileSync(path.join(app.getPath('userData'), 'window.json'), 'utf8'))); } catch { /* First launch. */ }
  window = new BrowserWindow({
    width: state.width || 1280, height: state.height || 840,
    minWidth: 860, minHeight: 600, show: false, title: 'Traqu',
    backgroundColor: '#ffffff', icon: path.join(__dirname, 'resources', 'icon.png'),
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: true },
  });
  if (state.maximized) window.maximize();
  window.once('ready-to-show', () => window.show());
  window.on('close', () => {
    const bounds = window.getNormalBounds();
    try { writeFileSync(path.join(app.getPath('userData'), 'window.json'), JSON.stringify({ ...bounds, maximized: window.isMaximized() })); } catch { /* A read-only settings directory must not prevent exit. */ }
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!backend || !isWorkspaceURL(url, backend.origin)) {
      event.preventDefault();
      if (isExternalURL(url)) shell.openExternal(url);
    }
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (!backend || !isWorkspaceURL(url, backend.origin)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalURL(url) && (!backend || !isWorkspaceURL(url, backend.origin))) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting) fail(new Error(`The workspace renderer stopped (${details.reason}). Reopen Traqu to continue.`));
  });
  window.on('closed', () => { window = null; });
  return window;
}

async function launch() {
  const dataDir = app.getPath('userData');
  mkdirSync(path.join(dataDir, 'logs'), { recursive: true });
  const logPath = path.join(dataDir, 'logs', 'desktop.log');
  if (existsSync(logPath) && statSync(logPath).size > 2 * 1024 * 1024) renameSync(logPath, `${logPath}.previous`);
  log = createWriteStream(logPath, { flags: 'a' });
  log.on('error', () => {});
  log.write(`\n${new Date().toISOString()} Traqu ${app.getVersion()} ${process.platform}/${process.arch}\n`);
  menu();
  function privateSender(event) {
    if (!backend || event.sender !== window?.webContents || event.senderFrame?.parent
        || !isWorkspaceURL(event.senderFrame?.url || '', backend.origin)) throw new Error('Private workspace required.');
  }
  ipcMain.handle('traqu:storage', async (event, action) => {
    privateSender(event);
    if (!recovery) throw new Error('Local backups are still starting.');
    if (action === 'status') return recovery.status();
    if (action === 'save') return recovery.save();
    if (action === 'open') { const result = await shell.openPath(recovery.status().directory); if(result) throw new Error(result); return recovery.status(); }
    if (action === 'choose') {
      const result = await dialog.showOpenDialog(window,{title:'Choose your recovery backup folder',properties:['openDirectory','createDirectory'],defaultPath:recovery.status().directory});
      return result.canceled ? {canceled:true} : recovery.chooseDirectory(result.filePaths[0]);
    }
    if (action === 'restore') {
      const result = await dialog.showOpenDialog(window,{title:'Restore a Traqu workspace backup',defaultPath:recovery.status().directory,properties:['openFile'],filters:[{name:'Traqu JSON backup',extensions:['json']}]});
      if(result.canceled) return {canceled:true};
      const file=result.filePaths[0];
      if(statSync(file).size>8*1024*1024)throw new Error('Choose a workspace backup up to 8 MB.');
      const form=new FormData();form.append('file',new Blob([readFileSync(file)],{type:'application/json'}),path.basename(file));
      const response=await fetch(`${backend.origin}/api/backup/restore-file`,{method:'POST',body:form,headers:{'X-Traqo-Desktop-Token':backend.token},signal:AbortSignal.timeout(30000)});
      const data=await response.json();if(!response.ok)throw new Error(data.detail||'Restore failed. Your existing plans were kept.');
      await recovery.save();return data;
    }
    throw new Error('Unknown storage action.');
  });
  ipcMain.handle('traqu:updates', async (event, action) => {
    privateSender(event);
    if(!['check','download'].includes(action))throw new Error('Unknown update action.');
    const {newerVersion,updateAsset}=require('./recovery.cjs');
    const response=await fetch('https://api.github.com/repos/Gurtejhundal/Traqu/releases/latest',{headers:{'Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Could not check releases. Try again when you are online.');
    const release=await response.json();
    const available=!release.draft&&!release.prerelease&&newerVersion(release.tag_name,app.getVersion());
    if(action==='download'&&available){
      const url=updateAsset(release,process.platform,process.arch,process.env.APPIMAGE?'AppImage':'deb');
      await recovery.save();
      await shell.openExternal(url);
      return {available:true,version:release.tag_name,downloaded:false,opened:true};
    }
    return {available,version:release.tag_name,current:app.getVersion()};
  });
  ipcMain.handle('traqu:ai-connection', async (event, payload) => {
    if (!backend || event.sender !== window?.webContents || event.senderFrame?.parent
        || !isWorkspaceURL(event.senderFrame?.url || '', backend.origin)) throw new Error('Private workspace required.');
    const { CLIENTS, configForClient, connectClient } = require('./mcp.cjs');
    if (!payload || !Object.hasOwn(CLIENTS, payload.client) || typeof payload.allowWrite !== 'boolean'
        || !['connect', 'config'].includes(payload.action)) throw new Error('Choose a supported AI app and access mode.');
    const options = { packaged: app.isPackaged, resourcesPath: process.resourcesPath, root,
      dataDir: app.getPath('userData'), appData: app.getPath('appData'), allowWrite: payload.allowWrite };
    if (payload.action === 'config') return { config: { mcpServers: { traqu: configForClient(options, payload.client) } } };
    const name = CLIENTS[payload.client];
    const confirmation = await dialog.showMessageBox(window, { type: 'question',
      message: `Set up Traqu for ${name}?`,
      detail: `${payload.allowWrite ? `${name} can read and edit your local roadmaps and tasks.` : `${name} can read your local roadmaps and tasks.`}\nThis adds a connection to its settings and backs up previous settings. Restart ${name} afterward. Your AI app must be installed and signed in separately.`,
      buttons: ['Cancel', 'Set up'], defaultId: 0, cancelId: 0 });
    if (confirmation.response !== 1) return { canceled: true };
    return connectClient(options, payload.client);
  });
  ipcMain.handle('traqu:save-pdf', async (event, payload) => {
    if (!backend || event.sender !== window?.webContents || event.senderFrame?.parent
        || !isWorkspaceURL(event.senderFrame?.url || '', backend.origin)) throw new Error('Private workspace required.');
    const { createPrintHTML } = await import('./print.mjs');
    const html = createPrintHTML(payload);
    const filename = path.basename(payload.name).replace(/[\\/:*?"<>|]/g, '_').slice(0,160) || 'Traqu';
    const destination = await dialog.showSaveDialog(window, { title: 'Save PDF',
      defaultPath: path.join(app.getPath('downloads'), `${filename.replace(/\s+/g,'_')}_Roadmap.pdf`),
      filters: [{ name: 'PDF document', extensions: ['pdf'] }],
    });
    if (destination.canceled || !destination.filePath) return { canceled: true };
    const printWindow = new BrowserWindow({ show: false, webPreferences: {
      sandbox: true, contextIsolation: true, nodeIntegration: false, partition: `traqu-print-${Date.now()}`,
    } });
    printWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    printWindow.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, done) => done({ cancel: true }));
    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(html).toString('base64')}`);
      const bytes = await printWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, generateTaggedPDF: true });
      await require('node:fs/promises').writeFile(destination.filePath, bytes);
      return { canceled: false };
    } finally { printWindow.destroy(); }
  });
  await createWindow().loadFile(path.join(__dirname, 'splash.html'));
  backend = await startBackend({
    packaged: app.isPackaged, resourcesPath: process.resourcesPath, root, dataDir, log,
    onExit: () => { if (!starting && !quitting) fail(new Error('The local service stopped unexpectedly. Reopen Traqu. Your saved roadmaps remain in the data folder.')); },
  });
  if (quitting) { await backend.stop(); return; }
  // Copy buttons need sanitized clipboard writes. Keep reads and all other
  // permissions denied, and accept writes only from the private workspace.
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(
    contents === window?.webContents && permission === 'clipboard-sanitized-write'
      && isWorkspaceURL(details.requestingUrl || contents.getURL(), backend.origin)
  ));
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin) => (
    contents === window?.webContents && permission === 'clipboard-sanitized-write'
      && isWorkspaceURL(origin, backend.origin)
  ));
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    // Keep the credential in the main process, outside renderer JavaScript.
    for (const key of Object.keys(details.requestHeaders)) {
      if (key.toLowerCase() === 'x-traqo-desktop-token') delete details.requestHeaders[key];
    }
    if (isWorkspaceURL(details.url, backend.origin)) details.requestHeaders['X-Traqo-Desktop-Token'] = backend.token;
    callback({ requestHeaders: details.requestHeaders });
  });
  session.defaultSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({ title: 'Save file', defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())) });
  });
  recovery = require('./recovery.cjs').createRecovery({dataDir,documentsDir:app.getPath('documents'),backupDir:process.env.TRAQU_BACKUP_DIR,
    readWorkspace: async () => {
      const response=await fetch(`${backend.origin}/api/backup`,{headers:{'X-Traqo-Desktop-Token':backend.token},signal:AbortSignal.timeout(10000)});
      const data=await response.json();if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Could not save a recovery backup.');return data;
    }});
  const automaticBackup=()=>recovery.save().catch(error=>log?.write(`Backup: ${error.message}\n`));
  await automaticBackup();
  backupTimer=setInterval(automaticBackup,30000);
  session.defaultSession.webRequest.onCompleted(details=>{
    if(isWorkspaceURL(details.url,backend.origin)&&['POST','PUT','PATCH','DELETE'].includes(details.method)&&details.statusCode>=200&&details.statusCode<300){
      clearTimeout(backupDebounce);backupDebounce=setTimeout(automaticBackup,1000);
    }
  });
  starting = false;
  if (window && !window.isDestroyed()) await window.loadURL(backend.origin);
  app.on('activate', () => {
    if (!window) { createWindow(); navigate('/'); }
    else window.show();
  });
}

async function fail(error) {
  log?.write(`${error.stack || error}\n`);
  if (quitting) return;
  quitting = true;
  await dialog.showMessageBox({
    type: 'error', title: 'Traqu could not open the workspace', message: error.message,
    detail: `Your data is stored in:\n${app.getPath('userData')}\n\nSee logs/desktop.log for details.${app.isPackaged ? '' : '\nFor development, run npm run setup first.'}`,
  });
  app.quit();
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin' || starting) app.quit(); });
app.on('before-quit', (event) => {
  quitting = true;
  if (shutdownComplete) return;
  event.preventDefault();
  clearInterval(backupTimer);clearTimeout(backupDebounce);
  Promise.resolve(recovery?.save()).catch(error=>log?.write(`Final backup: ${error.message}\n`)).then(()=>backend?.stop()).finally(() => {
    shutdownComplete = true;
    log?.end();
    app.quit();
  });
});
