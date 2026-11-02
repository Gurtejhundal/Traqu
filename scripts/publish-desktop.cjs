// Runs only after all four native packaging/smoke-test jobs succeed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { version } = require('../package.json');
const directory = path.resolve(process.argv[2] || 'installers');
const tag = `v${version}`;
const expected = [
  'Traqo-Windows-x64.exe', 'Traqo-Linux-x64.AppImage', 'Traqo-Linux-x64.deb',
  'Traqo-macOS-arm64.dmg', 'Traqo-macOS-arm64.zip', 'Traqo-macOS-x64.dmg', 'Traqo-macOS-x64.zip',
];
for (const name of expected) {
  if (!fs.statSync(path.join(directory, name)).size) throw new Error(`Empty installer: ${name}`);
}
const checksums = expected.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')}  ${name}`).join('\n') + '\n';
fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), checksums);
const notes = `Traqo ${version}\n\nDirect installers for Windows x64, Linux x64, and macOS Apple Silicon / Intel. All four native builds passed source and packaged-app import, persistence, export, and shutdown tests before publication.\n\nThis release adds dated daily-planner PDF import, an AI-agent formatting skill, and a desktop download page. Builds are unsigned; see README installation instructions.\n\nSource commit: ${process.env.GITHUB_SHA}\n\nVerify downloads against SHA256SUMS.txt. Your documents and progress are stored locally by the desktop app.`;
const notesFile = path.join(directory, 'release-notes.md');
fs.writeFileSync(notesFile, notes);
const args = ['release', 'create', tag, ...expected.map(name => path.join(directory, name)), path.join(directory, 'SHA256SUMS.txt'),
  '--target', process.env.GITHUB_SHA, '--title', `Traqo ${version}`, '--notes-file', notesFile, '--latest'];
// Immutable version: an existing release is never overwritten by a rerun.
execFileSync('gh', args, { stdio: 'inherit' });
