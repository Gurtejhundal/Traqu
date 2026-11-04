const { test, expect, _electron: electron } = require('@playwright/test');
const { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, copyFileSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const sample = `# Product design · 4-week sprint

## Week 1: Discover the problem
- Interview five people about their daily planning habits
- Map the current journey and identify friction
- Write a focused problem statement
- Review research with the team

## Week 2: Explore directions
- Sketch three possible approaches
- Build a low-fidelity prototype
- Run a quick usability study
- Capture findings and decide what to refine

## Week 3: Make it tangible
- Design the core screens
- Document reusable components
- Prototype the end-to-end experience
- Review accessibility and keyboard navigation

## Week 4: Ship and learn
- Prepare the handoff
- Test the release with real users
- Measure the first week of usage
- Write a retrospective and next steps`;

test('desktop imports, saves, exports, restarts, and shuts down its private service', async () => {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'traqo-desktop-e2e-'));
  const captures = process.env.TRAQO_CAPTURE_DOCS === '1';
  const docs = path.join(root, 'docs/screenshots');
  const frames = path.join(root, 'test-results/demo-frames');
  mkdirSync(frames, { recursive: true });
  if (captures) mkdirSync(docs, { recursive: true });
  let frame = 0;
  let application;
  const errors = [];

  async function launch() {
    const env = { ...process.env, TRAQO_DATA_DIR: dataDir };
    // Remove this variable entirely: an empty Windows environment entry can
    // still select Electron's Node mode instead of starting a desktop process.
    delete env.ELECTRON_RUN_AS_NODE;
    application = await electron.launch({
      // Setup provisions the executable before either tests or packaging use it.
      executablePath: process.env.TRAQO_TEST_EXECUTABLE || require('electron'),
      args: [
        ...(process.env.TRAQO_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []),
        ...(process.env.TRAQO_TEST_EXECUTABLE ? [] : [root]),
      ],
      env,
    });
    const page = await application.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') console.error('Renderer:', message.text()); });
    await expect(page.getByRole('heading', { name: 'Your roadmaps' })).toBeVisible({ timeout: 60000 });
    return page;
  }

  async function capture(page, name) {
    if (!captures) return;
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: path.join(frames, `${String(frame++).padStart(3, '0')}.png`) });
    if (name) await page.screenshot({ path: path.join(docs, `${name}.png`), fullPage: true });
  }

  async function newRoadmap() {
    await application.evaluate(({ Menu }) => {
      const file = Menu.getApplicationMenu().items.find((item) => item.label === 'File');
      file.submenu.items.find((item) => item.label === 'New Roadmap').click();
    });
  }

  try {
    let page = await launch();
    const origin = new URL(page.url()).origin;
    expect((await fetch(`${origin}/api/roadmaps`)).status).toBe(401);
    const badHostStatus = await new Promise((resolve, reject) => {
      require('node:http').get(`${origin}/`, { headers: { Host: 'evil.test' } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      }).on('error', reject);
    });
    expect(badHostStatus).toBe(400);
    expect(await page.evaluate(() => typeof window.require)).toBe('undefined');
    expect(await page.evaluate(() => typeof window.process)).toBe('undefined');
    await capture(page);

    await expect(page.getByRole('link', { name: 'Traqu home' })).toBeVisible();
    await expect(page).toHaveTitle('Traqu');
    await expect(page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Agent guide', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Downloads', exact: true })).toHaveCount(0);
    // Old deep links must not re-open website-only screens inside the app.
    for (const route of ['/downloads', '/agents']) {
      await page.goto(`${origin}${route}`);
      await expect(page.getByRole('heading', { name: 'Your roadmaps' })).toBeVisible();
      await expect(page).toHaveURL(`${origin}/`);
    }

    // Invoke the native menu directly; synthetic key events depend on OS focus.
    await newRoadmap();
    await expect(page.getByRole('heading', { name: 'Import a plan' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Use the agent guide for cleaner imports →' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Paste text' }).click();
    await page.getByLabel('Roadmap name').fill('Product design · 4-week sprint');
    await page.getByLabel('Plan content').fill(sample);
    await capture(page, 'import');
    await page.getByRole('button', { name: 'Review import', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible();
    await capture(page, 'preview');
    await page.getByRole('button', { name: 'Import roadmap', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Product design · 4-week sprint', exact: true })).toBeVisible();
    const roadmapURL = page.url();
    await capture(page);
    // Detail initially opens in overview; focus a section to reach task controls.
    const focus = page.getByRole('button', { name: 'Focus', exact: true });
    if (await focus.count()) await focus.click();
    const checks = page.getByRole('button', { name: /^Mark (complete|open):/ });
    await expect(checks.first()).toBeVisible();
    await checks.nth(0).click();
    await expect(checks.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(checks.nth(0)).toBeEnabled();
    await capture(page);
    await checks.nth(1).click();
    await expect(checks.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(checks.nth(1)).toBeEnabled();
    await expect(page.getByRole('progressbar', { name: 'Roadmap completion', exact: true })).toHaveAttribute('aria-valuenow', '13');
    await capture(page, 'roadmap');
    await page.reload();
    await expect(page.getByRole('progressbar', { name: 'Roadmap completion', exact: true })).toHaveAttribute('aria-valuenow', '13');

    // Native export dialogs are redirected to the isolated test directory.
    await application.evaluate(({ session, dialog }, dir) => {
      dialog.showSaveDialog = async (_window, options) => ({ canceled: false, filePath: `${dir}/${options.defaultPath.replaceAll('\\', '/').split('/').pop()}` });
      global.__traqoDownloads = [];
      session.defaultSession.on('will-download', (_event, item) => {
        global.__traqoDownloads.push({ filename: item.getFilename(), url: item.getURL() });
        item.setSavePath(`${dir}/${item.getFilename()}`);
      });
    }, dataDir);
    for (const format of ['PDF', 'Word']) {
      await page.getByRole('button', { name: /Save As/ }).click();
      await page.getByRole('menuitem', { name: new RegExp(format, 'i') }).click();
      const extension = format === 'PDF' ? '.pdf' : '.docx';
      try {
        await expect.poll(() => readdirSync(dataDir).some((file) => file.endsWith(extension)), { timeout: 15000 }).toBe(true);
      } catch (error) {
        console.error('Export diagnostics:', format, readdirSync(dataDir), await application.evaluate(() => global.__traqoDownloads), await page.locator('.inline-error').allTextContents());
        throw error;
      }
      const filename = path.join(dataDir, readdirSync(dataDir).find((file) => file.endsWith(extension)));
      await expect.poll(() => { try { return readFileSync(filename).length; } catch { return 0; } }).toBeGreaterThan(100);
      const bytes = readFileSync(filename);
      expect(bytes.subarray(0, format === 'PDF' ? 4 : 2).toString()).toBe(format === 'PDF' ? '%PDF' : 'PK');
      const fixtures = path.join(root, 'test-results', 'export-fixtures');
      mkdirSync(fixtures, { recursive: true });
      copyFileSync(filename, path.join(fixtures, `roundtrip${extension}`));
    }

    // Re-import real exports to exercise frozen DOCX/PDF native dependencies.
    for (const extension of ['.docx', '.pdf']) {
      await newRoadmap();
      await expect(page.getByRole('heading', { name: 'Import a plan' })).toBeVisible();
      const name = `Round-trip ${extension}`;
      await page.getByLabel('Roadmap name').fill(name);
      await page.locator('#roadmap-file').setInputFiles(path.join(dataDir, readdirSync(dataDir).find((file) => file.endsWith(extension))));
      await page.getByRole('button', { name: 'Review import', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible();
    await capture(page, 'preview');
    await page.getByRole('button', { name: 'Import roadmap', exact: true }).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
      await expect(page.getByRole('progressbar', { name: 'Roadmap completion', exact: true })).toHaveAttribute('aria-valuenow', '13');
      const imported = await page.evaluate(async () => {
        const id = location.pathname.split('/').pop();
        return (await fetch(`/api/roadmaps/${id}/export`)).json();
      });
      expect(imported.tasks).toHaveLength(16);
      expect(imported.tasks.filter(task => task.is_done)).toHaveLength(2);
      expect(imported.tasks.map(task => task.title).sort()).toEqual(sample.split('\n').filter(line => line.startsWith('- ')).map(line => line.slice(2)).sort());
      await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Library', exact: true }).click();
      page.once('dialog', (dialog) => dialog.accept());
      await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
      await expect(page.getByRole('link', { name: `Open ${name}`, exact: true })).toHaveCount(0);
    }

    // Additional sample plans are isolated to this disposable profile.
    await page.evaluate(async () => {
      for (const [name, text] of [
        ['Learning Rust · foundations', 'Week 1: First principles\n- Set up the toolchain\n- Understand ownership and borrowing\n- Build a small CLI\n\nWeek 2: Going deeper\n- Explore traits and generics\n- Handle errors thoughtfully\n- Write integration tests'],
        ['A calmer morning routine', 'Week 1: Start small\n- Leave the phone outside the bedroom\n- Take a ten-minute walk\n- Write three priorities\n\nWeek 2: Find your rhythm\n- Read a chapter\n- Prepare a simple breakfast\n- Reflect on what worked'],
      ]) {
        const response = await fetch('/api/roadmaps', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Local-User-Id': 'local_owner' }, body: JSON.stringify({ name, text }) });
        if (!response.ok) throw new Error(`Sample import failed: ${response.status}`);
      }
    });
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Library', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('link', { name: /^Open / })).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Open Product design · 4-week sprint' })).toBeVisible();
    await capture(page, 'library');
    await application.close();
    application = undefined;
    await expect.poll(async () => { try { await fetch(`${origin}/api/`); return false; } catch { return true; } }).toBe(true);

    page = await launch();
    await page.getByRole('link', { name: 'Open Product design · 4-week sprint' }).click();
    await expect(page.getByRole('progressbar', { name: 'Roadmap completion', exact: true })).toHaveAttribute('aria-valuenow', '13');
    expect(new URL(roadmapURL).pathname).toBe(new URL(page.url()).pathname);
    expect(errors).toEqual([]);
  } finally {
    if (application) await application.close();
    try { copyFileSync(path.join(dataDir, 'logs', 'desktop.log'), path.join(root, 'test-results', 'desktop-debug.log')); } catch { /* Best-effort diagnostics. */ }
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('reviewed imports, stable edits, workspace restore, and reduced motion work together', async () => {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'traqu-review-e2e-'));
  let application;
  try {
    const env = { ...process.env, TRAQO_DATA_DIR: profile };
    delete env.ELECTRON_RUN_AS_NODE;
    application = await electron.launch({ executablePath: process.env.TRAQO_TEST_EXECUTABLE || require('electron'),
      args: [...(process.env.TRAQO_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), ...(process.env.TRAQO_TEST_EXECUTABLE ? [] : [root])], env });
    const page = await application.firstWindow();
    await expect(page.getByRole('heading', { name: 'Your roadmaps' })).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.companion img')).toBeVisible();
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'New', exact: true }).click();
    await page.getByRole('tab', { name: 'Paste text' }).click();
    await page.getByLabel('Roadmap name').fill('Reviewed plan');
    await page.getByLabel('Plan content').fill('## Week 1 · 2026-11-03\n- [x] Completed first step\n- [ ] Write a small demo');
    await page.getByRole('button', { name: 'Review import', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible();
    await expect(page.getByLabel('Preview task 1 title')).toHaveValue('Completed first step');
    await page.getByLabel('Preview task 2 title').fill('Build a useful demo');
    await page.getByRole('button', { name: 'Import roadmap', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reviewed plan', exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Roadmap completion', exact: true })).toHaveAttribute('aria-valuenow', '50');
    const before = await page.evaluate(async () => (await fetch(`/api/roadmaps/${location.pathname.split('/').pop()}/export`)).json());
    await page.getByRole('link', { name: 'Edit raw', exact: true }).click();
    const outline = page.getByLabel('Roadmap outline');
    await expect(outline).toBeVisible();
    await outline.fill((await outline.inputValue()).replace('Build a useful demo', 'Ship a useful demo'));
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Reviewed plan', exact: true })).toBeVisible();
    const after = await page.evaluate(async () => (await fetch(`/api/roadmaps/${location.pathname.split('/').pop()}/export`)).json());
    expect(after.tasks.map(task => task.id)).toEqual(before.tasks.map(task => task.id));
    expect(after.tasks[1].title).toBe('Ship a useful demo');
    expect(after.tasks[0].is_done).toBe(true);
    await application.evaluate(({ session }, dir) => {
      session.defaultSession.on('will-download', (_event, item) => item.setSavePath(`${dir}/${item.getFilename()}`));
    }, profile);
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Library', exact: true }).click();
    await page.getByRole('button', { name: 'Back up', exact: true }).click();
    await expect.poll(() => readdirSync(profile).some(file => file.endsWith('.json') && file.startsWith('Traqu-workspace-'))).toBe(true);
    const backupFile = path.join(profile, readdirSync(profile).find(file => file.endsWith('.json') && file.startsWith('Traqu-workspace-')));
    expect(JSON.parse(readFileSync(backupFile, 'utf8')).format).toBe('traqu-workspace');
    await page.getByRole('link', { name: 'Restore', exact: true }).click();
    await page.locator('#roadmap-file').setInputFiles(backupFile);
    await page.getByRole('button', { name: 'Review import', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review your import' })).toBeVisible();
    await page.getByRole('button', { name: 'Restore workspace', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Open Reviewed plan (restored 2)', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Open / })).toHaveCount(2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    expect(await page.locator('.roadmap-row').first().evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  } finally {
    if (application) await application.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
