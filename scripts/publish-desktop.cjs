// Runs only after all four native packaging/smoke-test jobs succeed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { version } = require('../package.json');
const directory = path.resolve(process.argv[2] || 'installers');
const tag = `v${version}`;
const expected = [
  'Traqu-Windows-x64.exe', 'Traqu-Linux-x64.AppImage', 'Traqu-Linux-x64.deb',
  'Traqu-macOS-arm64.dmg', 'Traqu-macOS-arm64.zip', 'Traqu-macOS-x64.dmg', 'Traqu-macOS-x64.zip',
];
for (const name of expected) {
  if (!fs.statSync(path.join(directory, name)).size) throw new Error(`Empty installer: ${name}`);
}
const checksums = expected.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')}  ${name}`).join('\n') + '\n';
fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), checksums);
const notes = `Traqu ${version}\n\nDirect installers for Windows x64, Linux x64, and macOS Apple Silicon / Intel. All four native builds passed source and packaged-app import, persistence, export, and shutdown tests before publication.\n\nThis release adds an original monochrome Qu companion with run, sway, wave, hop, and rest interactions, an offline AI agent skill panel below the import controls, a restrained motion system, import review and warnings, accurate Markdown/CSV/YAML and day-row assignments, stable editing with stale-save protection, JSON workspace backup/restore, daily local snapshots, signed browser sessions, and native Unicode-capable PDF export with schedules. Windows snapshots close database handles before rename. Existing desktop workspaces remain accessible. Builds are unsigned; see README installation instructions.\n\nSource commit: ${process.env.GITHUB_SHA}\n\nVerify downloads against SHA256SUMS.txt. Your documents and progress are stored locally by the desktop app.`;
const notesFile = path.join(directory, 'release-notes.md');
fs.writeFileSync(notesFile, notes);
const args = ['release', 'create', tag, ...expected.map(name => path.join(directory, name)), path.join(directory, 'SHA256SUMS.txt'),
  '--target', process.env.GITHUB_SHA, '--title', `Traqu ${version}`, '--notes-file', notesFile, '--latest'];
// Immutable version: an existing release is never overwritten by a rerun.
execFileSync('gh', args, { stdio: 'inherit' });
