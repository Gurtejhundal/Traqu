# Import, persistence, and export guarantees

Traqu's parser uses deterministic rules and document layout. It is not a trained neural model, and arbitrary PDF accuracy is not guaranteed. Review the preview before saving a new plan.

## Import and preview

All task imports share a validated schema: 5,000 tasks per roadmap, 4,000 characters per title, 500 per section label, valid ordered ISO dates, supported block types, 256 KB properties and 64 KB per block. Uploads remain limited to 8 MB; requests have a separate 16 MB body limit, including requests without Content-Length. PDF extraction runs off the event loop, with two concurrent PDF parsers per event loop. Existing PDF page/line/table/outline limits still apply.

CSV requires a `title` column. Optional columns include `timeframe`, `is_done`, `start_date`, `end_date`, `granularity`, `section_key`, and JSON-encoded `properties`/`blocks`. YAML uses the same `tasks` objects as JSON; unsafe constructors and recursive aliases are rejected. Standard Markdown checkboxes and numbered actions retain their titles and completion. Single ISO dates and explicit `YYYY-MM-DD to YYYY-MM-DD` heading ranges are supported; ambiguous localized dates are not guessed.

A day-row LeetCode assignment format has a dedicated parser. Against the supplied pasted sample it retains all 269 distinct supplied problem IDs, adds 20 explicitly indicated contests, and produces 289 dated tasks in 142 day sections. It warns that the source has 21 of 31 weeks and supplies 269 rather than the promised 400 unique problems. The source is incomplete; no missing weeks or exercises were generated. Personal input files are not committed.

## Editing and identity

Surviving tasks, blocks, and sections retain their IDs. Ordering uses dedicated positions, and SQLite uses AUTOINCREMENT so deleted IDs cannot be reassigned to new work. Startup upgrades older SQLite tables without renumbering records, checks foreign keys, and retains a pre-upgrade snapshot.

Structural writes require the `revision` returned by `/roadmaps/{id}/export`. Missing revisions return 428; stale revisions return 409 and leave the draft unsaved. Normal task/field/block/date changes advance the containing roadmap revision. Old API clients should fetch a current export and pass its revision when making a structural edit.

## Backup and restore

Library → Back up downloads a version 1 `traqu-workspace` JSON file. Restore it through Import, review its roadmap list, then choose Restore workspace. Restore validates the entire file first and creates copies in a single transaction. Existing records are never overwritten; colliding names receive a restored suffix. Workspace restores support 100 roadmaps and 10,000 total tasks within the 8 MB upload budget; larger workspaces can use individual roadmap JSON exports or local database backups.

Save As → JSON backup exports one complete roadmap. Fresh imports map exported section identities to new local identities, preserving adjacent sections with identical labels. Imported database IDs do not grant access to existing records.

SQLite workspaces keep up to seven daily snapshots in `backups/` next to the database, taken before startup migrations. File → Show Data Folder locates desktop storage. To recover from a snapshot, quit Traqu first, retain the current database as another backup, and copy the chosen snapshot to `roadmap.db`. These snapshots are local files, not a cloud backup or encrypted vault.

## Readable document exports

Desktop PDF export uses Chromium's native text layout through a narrow, origin-checked Electron bridge and an OS Save dialog. The print window is sandboxed, has no Node integration, blocks network requests, and receives escaped text rather than active imported HTML. The web app uses the browser print dialog, where the user can select Save as PDF. Word export remains a direct DOCX download.

Both include explicit section dates and use the name Traqu. Local Linux checks confirmed readable Punjabi, Chinese, emoji and symbols, with both tasks and dates recovered on re-import. Font fallback depends on fonts available on the target OS; PDF extraction can return compatibility glyph variants. JSON is the canonical backup for exact text and typed app metadata. A readable PDF/Word file is not a lossless application database replacement. Re-import recognizes Traqu's own attribution/reference appendix so it does not become extra work.

## Hosted browser access

Desktop identity is assigned only after the private session credential validates. Existing desktop records remain under `local_owner`. Browser owner headers, including the legacy Clerk header, are ignored by real authentication.

Hosted browsers receive separate signed, HttpOnly, Secure sessions. A stable, random `TRAQU_SESSION_SECRET` of at least 32 characters and a configured durable `DATABASE_URL` are required. On Vercel, all SQLite driver spellings are rejected for workspace use; there is no `/tmp` user-database fallback. In-memory SQLite is rejected on other hosts too. Informational frontend pages remain usable while workspace configuration is missing; workspace APIs return an informative 503 instead of saving transient data.

Default hosting uses the same-origin `/api` proxy and SameSite=Strict cookies. A separate-site API requires explicit `TRAQU_CROSS_SITE_SESSIONS=1` plus an exact `FRONTEND_URL`/`TRAQU_CORS_ORIGINS` allowlist; cookies then use SameSite=None and Secure. Browser restrictions may still block third-party cookies, so a same-origin proxy is preferred. Writes must present an allowed Origin. Credentials and database URLs must be configured through the deployment platform, never committed.

Browser sessions are account-free, not recoverable accounts or cross-device sign-in. Cookie expiry, clearing site data, changing the signing secret, or changing domains can remove access to that anonymous workspace. Export backups. Existing shared `local_owner`/`public_user` data is not automatically assigned to an arbitrary new visitor.

Local browser development must explicitly set `TRAQU_LOCAL_MODE=1` and bind the backend to loopback. That mode rejects non-loopback clients and Host values, keeps the existing `local_owner` workspace, and persists a private local signing key in the ignored `backend/.traqu-session-key` file. The Windows launcher sets this mode for its own loopback backend process.

## Distribution limits

Installers require new native CI builds for this version. Windows signing and Apple signing/notarization require real publisher credentials; source changes cannot manufacture those credentials. Until configured, installers are unsigned. Automatic installation of updates is not implemented; use published releases and their checksums. Cloud database provisioning and production secret configuration must be verified separately from local tests.
