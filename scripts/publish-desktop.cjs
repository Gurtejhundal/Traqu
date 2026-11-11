// Runs only after all native desktop and Android smoke-test jobs succeed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { version } = require('../package.json');
const directory = path.resolve(process.argv[2] || 'installers');
const tag = `v${version}`;
const expected = [
  'Traqu-Windows-x64.exe', 'Traqu-Windows-arm64.exe', 'Traqu-Android-preview.apk', 'Traqu-Linux-x64.AppImage', 'Traqu-Linux-x64.deb',
  'Traqu-macOS-arm64.dmg', 'Traqu-macOS-arm64.zip', 'Traqu-macOS-x64.dmg', 'Traqu-macOS-x64.zip',
];
for (const name of expected) {
  if (!fs.statSync(path.join(directory, name)).size) throw new Error(`Empty installer: ${name}`);
}
const checksums = expected.map(name => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')}  ${name}`).join('\n') + '\n';
fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), checksums);
const notes = `Traqu ${version}

New in 1.6.1: setup for Codex, Claude Desktop, Claude Code, Gemini CLI, Antigravity and Cursor. Copy configuration for other local MCP clients; copy a self-contained roadmap prompt (optionally including a chosen plan) for browser chats, including free plans. Browser copy/import is manual and does not enable live sync or bypass provider limits.\n\nBundled local MCP with Profile → Preferences → AI connections for Codex; no separate Python or Node installation. Read-only by default, optional editing access and a native confirmation. Photos save immediately when applied; other profile save controls appear above the form. Corrected Android launcher artwork and adaptive-icon padding.

Profile studio: photo upload with crop and black-and-white treatment; paper, stone and ink covers; photo shapes and activity shades; a personal seven-day rhythm target and return note. Separate Overview, Personalize and Preferences views, live previews, explicit save/discard, keyboard calendar navigation and a 2400 × 1520 profile card with your photo, Qu and real activity; choose its style and visible details, save it or open a native share sheet. Profile photos and preferences are included in workspace backups.

Desktop installers: Windows x64 and ARM64, Linux x64, macOS Apple Silicon and Intel. The Windows ARM64 build includes a native ARM64 Python backend. All five desktop targets passed source and packaged import/persistence/export checks.

Android PREVIEW APK: bundled offline workspace, local IndexedDB storage, JSON/Markdown imports, daily tasks, profile photos, activity history and backup/restore. Native file saving and Android PDF printing are supported. Android PDF/DOCX import extracts text; use JSON for complex document layouts. CSV import and legacy flat-import daily recovery remain desktop features. The APK is debug-signed for evaluation; this is not a Play Store release, its signing key is not yet a durable production update identity, and an upgraded preview may require backup/reinstallation. Android data does not automatically sync with desktop. Export a workspace backup before uninstalling.

Desktop builds are unsigned. Existing desktop workspaces remain accessible. Source commit: ${process.env.GITHUB_SHA}

Verify downloads against SHA256SUMS.txt.`;
const notesFile = path.join(directory, 'release-notes.md');
fs.writeFileSync(notesFile, notes);
const args = ['release', 'create', tag, ...expected.map(name => path.join(directory, name)), path.join(directory, 'SHA256SUMS.txt'),
  '--target', process.env.GITHUB_SHA, '--title', `Traqu ${version}`, '--notes-file', notesFile, '--latest'];
// Immutable version: an existing release is never overwritten by a rerun.
execFileSync('gh', args, { stdio: 'inherit' });
