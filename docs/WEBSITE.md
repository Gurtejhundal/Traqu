# Traqu product website

The public website is a three-page product and documentation site. It does not host a roadmap workspace, profile API, database or cloud MCP bridge. The Electron and Android applications still build from `frontend/` and retain their local storage and APIs.

## Source

- `website/index.html`: app overview, real screenshots, recorded demo, features and Qu.
- `website/download.html`: operating system downloads, first-day setup, local MCP and free-browser-chat instructions.
- `website/docs.html`: practical help, full manual reader, creator portfolio and existing donation QR.
- `website/style.css` and `website/site.js`: shared presentation and progressive enhancement.
- `scripts/build-site.cjs`: copies those files plus existing public assets and project manuals into ignored `website/dist/`.

No website dependencies or framework are required. Use Node 24:

```sh
node scripts/build-site.cjs
node website/serve.cjs
```

Open http://127.0.0.1:4174. Navigation and downloads work without JavaScript. Qu, copying, inline manual reading and optional public GitHub release metadata use JavaScript. CSS honors reduced motion; animation controls replace GIFs with static captures.

The optional GitHub API request only checks the latest public desktop release. It does not send user workspace data. Direct download links still work when the request fails. MCP onboarding explicitly requires desktop 1.6.1+ rather than promising that feature in an older published installer.

## Vercel

Root `vercel.json` builds this site with `node scripts/build-site.cjs` and publishes `website/dist`. The production project is Traqu; the public hostname is https://traqu.vercel.app. The creator portfolio links to https://gurtejbirsingh.vercel.app, which is a separate website.

This replaces the previous services configuration for the public hostname. Old `/downloads`, `/agents`, `/import` and `/profile` navigation redirects to relevant product/help content. Existing local desktop and Android plans are not migrated, cleared or accessed.

## GitHub Pages

The same output is compatible with GitHub Pages subpaths because local links and assets are relative. In repository Settings → Pages, select GitHub Actions as the build source. Enable repository variable `DEPLOY_GITHUB_PAGES=true` to turn on the workflow's deployment job. Otherwise the workflow builds and verifies the site without attempting a Pages deployment. This avoids silently requiring repository administration permissions for normal contributors.

GitHub Pages will serve https://gurtejhundal.github.io/Traqu/ when enabled. The default canonical URLs point to the primary Vercel site to avoid duplicated search results. Source is in the same repository; GitHub Pages does not need a backend.

## Verify

After installing the root development dependencies:

```sh
npx playwright install chromium
npm run build:site
npm run test:site
```

The checks exercise three pages at desktop/phone widths, local links and images, clipboard fallback-independent content, Qu, reduced motion, prompt copying, manual reading, QR support and release-lookup failure. They do not perform payments or claim to verify app installers on native operating systems.

Donation artwork and UPI ID are reused unchanged from the repository. No payment is initiated by copying the ID or viewing the QR.
