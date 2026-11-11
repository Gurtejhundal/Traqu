# Traqu for Android

Traqu's Android app bundles the React interface and a local workspace using Android WebView's IndexedDB. It does not connect to the hosted API, need Python on the phone, or require an account. Photos, tasks, notes, preferences and recorded activity remain in this app's storage. Android is a standalone app: install it, import a plan and track your days on your phone.

## On your phone

- JSON, Markdown and pasted daily plans with Week → Day structure, metadata and notes.
- Daily sessions, checkboxes, editing, sections, task notes and real activity/streak history.
- Profile photos with crop controls, customization, rhythm targets and return notes.
- Additive workspace backup/restore and individual JSON/Word exports.
- Android's document destination picker for exported files and its print dialog for PDF export.
- Selectable-text PDF/DOCX import; YAML task plans.

## Limits before installing

- PDF/DOCX text extraction differs from the desktop layout-aware parser. Prefer the matching JSON for tables or complicated layouts. Scanned image-only PDFs need OCR before importing.
- CSV import and automatic daily recovery of older flat imports remain desktop features.
- The downloadable APK uses a **development signing certificate** and is distributed directly, outside the Play Store. Build certificates are not yet retained across CI runs, so a later build may require uninstalling the previous APK. Export a workspace backup before replacing an installation; uninstalling or clearing app data deletes local work. A privately retained production signing key is required for guaranteed in-place upgrades.
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

The installable APK is `android/app/build/outputs/apk/debug/app-debug.apk`.

`npm run build:mobile` always selects the offline adapter and disables desktop-only behavior. `npm run build:frontend` always selects the Electron interface and its same-origin Python API. Do not mix the output directories when manually packaging: run the appropriate build immediately before packaging/sync.

Native CI builds the APK, starts an Android emulator with Wi-Fi and mobile data disabled, imports a daily plan and verifies profile persistence across activity recreation. An installer is only published after all required jobs pass.

## Android releases

Android has its own version in `android/app/build.gradle`. Bump both `versionName` and `versionCode` for an update. The Android workflow builds and tests the APK offline, then publishes `Traqu-Android.apk` and its checksum under `android-v<version>`. Android releases do not replace the latest desktop release. Update the Android download URL in the README and website when publishing a new version.

## Keep progress when replacing or uninstalling the app (1.7+)

Android internal app storage can be erased by uninstalling or clearing app data. In Library, use **Back up**, then choose Documents or another user-controlled location in Android's system file picker. That portable JSON includes the workspace, completion history and profile. Keep the file outside Traqu's internal storage. Reinstall and use **Restore** to import it as new copies.

Deleting a roadmap now requires successfully saving a workspace backup first. Canceling the Android save picker cancels deletion. The app does not silently write external Android files or promise that an uninstall preserves internal data.

The **Android updates** control opens official Android releases. Save a backup first; install a compatible signed APK over the existing app when Android allows it. A signature mismatch may require backup/reinstallation. This is an update download route, not a silent automatic updater.
