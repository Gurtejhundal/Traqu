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
const notes = `Traqu ${version}\n\nDirect installers for Windows x64, Linux x64, and macOS Apple Silicon / Intel. All four native builds passed source and packaged-app import, persistence, export, and shutdown tests before publication.\n\nThis release adds dated day cards, expandable Week → Day folders, individual daily checklists and Start/Continue controls. Completed days fade and cross out. An additive recovery preview restores explicit days from older flat imports while keeping the original. The daily parser attaches timing, references and explanations to real actions. The Traqu agent skill now requires day-by-day schedules. Profile includes a name, bio, goal, timezone, week start, compact spacing and motion settings, plus real completion history, streaks, a contribution calendar and a snake replay. Qu’s pupils follow the cursor while resting. Imported checkmarks do not fabricate history; workspace backups preserve profile and recorded activity. Existing desktop workspaces remain accessible. Builds are unsigned; see README installation instructions.\n\nSource commit: ${process.env.GITHUB_SHA}\n\nVerify downloads against SHA256SUMS.txt. Your documents and progress are stored locally by the desktop app.`;
const notesFile = path.join(directory, 'release-notes.md');
fs.writeFileSync(notesFile, notes);
const args = ['release', 'create', tag, ...expected.map(name => path.join(directory, name)), path.join(directory, 'SHA256SUMS.txt'),
  '--target', process.env.GITHUB_SHA, '--title', `Traqu ${version}`, '--notes-file', notesFile, '--latest'];
// Immutable version: an existing release is never overwritten by a rerun.
execFileSync('gh', args, { stdio: 'inherit' });
