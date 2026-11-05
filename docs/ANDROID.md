# Android offline preview

Traqu's Android app bundles the React interface and a local workspace using Android WebView's IndexedDB. It does not connect to the hosted API, need Python on the phone, or require an account. Photos, tasks, notes, preferences and recorded activity remain in this app's storage. There is no automatic desktop sync. Export a workspace backup to move plans between devices.

## Supported in this preview

- JSON, Markdown and pasted daily plans with Week → Day structure, metadata and notes.
- Daily sessions, checkboxes, editing, sections, task notes and real activity/streak history.
- Profile photos with crop controls, customization, rhythm targets and return notes.
- Additive workspace backup/restore and individual JSON/Word exports.
- Android's document destination picker for exported files and its print dialog for PDF export.
- Selectable-text PDF/DOCX import; YAML task plans.

## Limits before installing

- PDF/DOCX text extraction differs from the desktop layout-aware parser. Prefer the matching JSON for tables or complicated layouts. Scanned image-only PDFs need OCR outside this preview.
- CSV import and automatic daily recovery of older flat imports remain desktop features.
- The APK is a **debug-signed preview**, not a production Play Store release. CI preview certificates are not a durable production signing identity. Back up before replacing a preview; changing signing identities requires uninstalling the previous APK. Uninstalling or clearing app data deletes local work. Production distribution needs a privately retained signing key and an update policy.
- Use a current Android System WebView. Minimum Android API: 24. No contacts, location, camera or broad storage permission is requested. Photo selection uses the system picker; exported files go to destinations chosen by the user.
- Android system backups are disabled; make explicit Traqu workspace backups.

## Build

Install Node 24, JDK 21 and Android SDK 36 through their official distributions. Android's Gradle wrapper is committed.

```sh
npm ci
npm ci --prefix frontend
npm run test:mobile
npm run sync:android
cd android
./gradlew assembleDebug
```

The installable preview is `android/app/build/outputs/apk/debug/app-debug.apk`.

`npm run build:mobile` always selects the offline adapter and disables desktop-only behavior. `npm run build:frontend` always selects the Electron interface and its same-origin Python API. Do not mix the output directories when manually packaging: run the appropriate build immediately before packaging/sync.

Native CI builds the APK, starts an Android emulator with Wi-Fi and mobile data disabled, imports a daily plan and verifies profile persistence across activity recreation. An installer is only published after all required jobs pass.
