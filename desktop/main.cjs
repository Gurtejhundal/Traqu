const { app, BrowserWindow, Menu, dialog, shell, session } = require('electron');
const { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, renameSync } = require('node:fs');
const path = require('node:path');
const { startBackend } = require('./backend.cjs');
const { isWorkspaceURL, isExternalURL, validWindowState } = require('./policy.cjs');

app.setName('Traqo');
if (process.env.TRAQO_DATA_DIR) app.setPath('userData', path.resolve(process.env.TRAQO_DATA_DIR));
const root = path.resolve(__dirname, '..');
let window;
let backend;
let log;
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
      { label: 'Traqo on GitHub', click: () => shell.openExternal('https://github.com/Gurtejhundal/Traqu') },
      ...(!mac ? [{ label: 'About Traqo', click: () => dialog.showMessageBox(window, {
        type: 'info', title: 'About Traqo', message: `Traqo ${app.getVersion()}`,
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
    minWidth: 860, minHeight: 600, show: false, title: 'Traqo',
    backgroundColor: '#ffffff', icon: path.join(__dirname, 'resources', 'icon.png'),
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: true },
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
    if (!quitting) fail(new Error(`The workspace renderer stopped (${details.reason}). Reopen Traqo to continue.`));
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
  log.write(`\n${new Date().toISOString()} Traqo ${app.getVersion()} ${process.platform}/${process.arch}\n`);
  menu();
  await createWindow().loadFile(path.join(__dirname, 'splash.html'));
  backend = await startBackend({
    packaged: app.isPackaged, resourcesPath: process.resourcesPath, root, dataDir, log,
    onExit: () => { if (!starting && !quitting) fail(new Error('The local service stopped unexpectedly. Reopen Traqo. Your saved roadmaps remain in the data folder.')); },
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
    type: 'error', title: 'Traqo could not open the workspace', message: error.message,
    detail: `Your data is stored in:\n${app.getPath('userData')}\n\nSee logs/desktop.log for details.${app.isPackaged ? '' : '\nFor development, run npm run setup first.'}`,
  });
  app.quit();
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin' || starting) app.quit(); });
app.on('before-quit', (event) => {
  quitting = true;
  if (shutdownComplete) return;
  event.preventDefault();
  Promise.resolve(backend?.stop()).finally(() => {
    shutdownComplete = true;
    log?.end();
    app.quit();
  });
});
