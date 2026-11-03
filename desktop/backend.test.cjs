const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { backendCommand } = require('./backend.cjs');
const { isWorkspaceURL, isExternalURL, validWindowState } = require('./policy.cjs');

for (const platform of ['linux', 'darwin', 'win32']) {
  test(`packaged ${platform} runs the bundled backend, without a Python installation`, () => {
    const [exe, args] = backendCommand({ packaged: true, resourcesPath: '/resources', root: '/source', platform, python: '/untrusted/python' });
    assert.equal(exe, path.join('/resources/backend/traqo-backend', platform === 'win32' ? 'traqo-backend.exe' : 'traqo-backend'));
    assert.deepEqual(args, []);
  });
}
test('only the exact workspace origin receives the private credential', () => {
  const origin = 'http://127.0.0.1:54321';
  assert.ok(isWorkspaceURL(`${origin}/api/roadmaps`, origin));
  for (const url of ['http://127.0.0.1:54322/api/', 'https://127.0.0.1:54321/', 'http://127.0.0.1:54321.evil.test/', 'http://127.0.0.1:54321@evil.test/', 'file:///etc/passwd', 'garbage']) assert.equal(isWorkspaceURL(url, origin), false);
});
test('external links cannot open local executables or script protocols', () => {
  for (const url of ['https://example.com', 'http://example.com', 'mailto:hello@example.com']) assert.ok(isExternalURL(url));
  for (const url of ['file:///tmp/app', 'javascript:alert(1)', 'data:text/html,hi', 'garbage']) assert.equal(isExternalURL(url), false);
});
test('invalid persisted window settings fall back to a usable size', () => {
  assert.deepEqual(validWindowState({ width: -100, height: 800 }), {});
  assert.deepEqual(validWindowState({ width: 1280, height: 840, maximized: true, x: -99999 }), { width: 1280, height: 840, maximized: true });
});

test('the name correction keeps an existing workspace and respects explicit profiles', () => {
  const fs = require('node:fs');
  const directory = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'traqu-upgrade-'));
  const { workspaceDirectoryOverride } = require('./policy.cjs');
  try {
    assert.equal(workspaceDirectoryOverride(directory), null);
    const legacy = path.join(directory, 'Traqo');
    fs.mkdirSync(legacy);
    fs.writeFileSync(path.join(legacy, 'roadmap.db'), 'existing workspace');
    assert.equal(workspaceDirectoryOverride(directory), legacy);
    const explicit = path.join(directory, 'separate-profile');
    assert.equal(workspaceDirectoryOverride(directory, explicit), explicit);
    const current = path.join(directory, 'Traqu');
    fs.mkdirSync(current);
    fs.writeFileSync(path.join(current, 'roadmap.db'), 'new workspace');
    assert.equal(workspaceDirectoryOverride(directory), null);
    assert.equal(fs.readFileSync(path.join(legacy, 'roadmap.db'), 'utf8'), 'existing workspace');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
