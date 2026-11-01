const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { createInterface } = require('node:readline');
const path = require('node:path');

function backendCommand({ packaged, resourcesPath, root, platform = process.platform, python = process.env.TRAQO_BACKEND_PYTHON }) {
  if (packaged) return [path.join(resourcesPath, 'backend', 'traqo-backend', platform === 'win32' ? 'traqo-backend.exe' : 'traqo-backend'), []];
  return [python || path.join(root, '.venv-desktop', platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'), [path.join(root, 'backend', 'desktop_server.py')]];
}

async function startBackend({ packaged, resourcesPath, root, dataDir, log, onExit }) {
  const token = randomBytes(32).toString('hex');
  const [command, args] = backendCommand({ packaged, resourcesPath, root });
  const child = spawn(command, args, {
    cwd: packaged ? resourcesPath : root,
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      TRAQO_DATA_DIR: dataDir,
      TRAQO_FRONTEND_DIR: packaged ? path.join(resourcesPath, 'frontend') : path.join(root, 'frontend', 'dist'),
      TRAQO_DESKTOP_TOKEN: token,
      PYTHONUNBUFFERED: '1',
      PYTHONNOUSERSITE: '1',
    },
  });
  let stopping = false;
  let exited = false;
  let origin;
  child.stderr.on('data', (chunk) => log.write(chunk));
  child.stdin.on('error', () => {});
  const ready = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      exited = true;
      reject(new Error(`Local service stopped (${code ?? signal}).`));
      if (!stopping) onExit?.(code, signal);
    });
    createInterface({ input: child.stdout }).on('line', (line) => {
      log.write(`${line}\n`);
      try {
        const event = JSON.parse(line);
        if (event.event === 'listening' && Number.isInteger(event.port) && event.port > 0 && event.port < 65536) {
          origin = `http://127.0.0.1:${event.port}`;
          resolve();
        }
      } catch { /* Non-protocol diagnostic output belongs in the log. */ }
    });
  });
  async function stop() {
    stopping = true;
    if (exited || !child.pid) return;
    await new Promise((resolve) => {
      const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 7000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
      child.stdin.end();
    });
  }
  let startupTimer;
  try {
    await Promise.race([
      ready,
      new Promise((_, reject) => { startupTimer = setTimeout(() => reject(new Error('Local service startup timed out.')), 45000); }),
    ]);
    const deadline = Date.now() + 45000;
    while (true) {
      if (exited) throw new Error('Local service stopped during startup.');
      try {
        const response = await fetch(`${origin}/api/`, {
          headers: { 'X-Traqo-Desktop-Token': token }, signal: AbortSignal.timeout(1500),
        });
        const body = await response.json();
        if (response.ok && body.message === 'Welcome to Roadmap Tracer API') break;
      } catch { /* Wait until schema initialization and migrations finish. */ }
      if (Date.now() > deadline) throw new Error('The local workspace did not become ready.');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { origin, token, stop, pid: child.pid };
  } catch (error) {
    await stop();
    throw error;
  } finally {
    clearTimeout(startupTimer);
  }
}

module.exports = { backendCommand, startBackend };
