const { test, expect, _electron: electron } = require('@playwright/test');
const { mkdtempSync, rmSync, mkdirSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const sample = `# Week 1: A steady start
## Day 1 · 2026-11-04
- [ ] Set up a small workspace
Time: 19:00-19:25 | Duration: 25m | Priority: High
Run a small program and keep its output as evidence.
- [ ] Make one useful change
Duration: 30m
Write down what you learned, then check the result.
## Day 2 · 2026-11-05
- [ ] Review yesterday’s work
Duration: 15m
Try the same idea from memory.
## Day 3 · 2026-11-06
- [ ] Build on the first result
Duration: 45m
Keep the scope small enough to finish today.
# Week 2: Keep the rhythm
## Day 4 · 2026-11-09
- [ ] Share what you have learned
Duration: 20m
Explain it with one working example.`;

test('daily sessions, completion cards, profile history, preferences and cursor gaze persist', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'traqu-days-'));
  let app;
  const env = { ...process.env, TRAQU_BACKUP_DIR: path.join(dir, '..', path.basename(dir) + '-backups'), TRAQO_DATA_DIR: dir };
  delete env.ELECTRON_RUN_AS_NODE;
  const launch = async () => {
    app = await electron.launch({ executablePath: process.env.TRAQO_TEST_EXECUTABLE || require('electron'), args: [...(process.env.TRAQO_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), ...(process.env.TRAQO_TEST_EXECUTABLE ? [] : [root])], env });
    const page = await app.firstWindow();
    await page.waitForURL(/127\.0\.0\.1/);
    await page.evaluate(async () => { const profile = await (await fetch('/api/profile')).json(); await fetch('/api/profile', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...profile,onboarding_completed:true})}); });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your roadmaps', exact: true })).toBeVisible({ timeout: 60000 });
    return page;
  };
  const capture = async (page, name) => {
    if (process.env.TRAQO_CAPTURE_DOCS !== '1') return;
    mkdirSync(path.join(root, 'docs/screenshots'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'docs/screenshots', name + '.png') });
  };
  try {
    let page = await launch();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('navigation').getByRole('link', { name: 'New', exact: true }).click();
    await page.getByRole('tab', { name: 'Paste text' }).click();
    await page.getByLabel('Roadmap name').fill('A little progress, every day');
    await page.getByLabel('Plan content').fill(sample);
    await page.getByRole('button', { name: 'Review import', exact: true }).click();
    await expect(page.getByLabel('Preview task 1 title')).toHaveValue('Set up a small workspace');
    await expect(page.getByLabel(/Preview task \d+ title/)).toHaveCount(5);
    await page.getByRole('button', { name: 'Import roadmap', exact: true }).click();
    await expect(page.locator('.day-card')).toHaveCount(4);
    await expect(page.locator('.day-tree-week')).toHaveCount(2);
    const roadmapURL = page.url();
    await capture(page, 'daily-plan');
    await page.getByRole('button', { name: 'Start Day 1', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Day 1 session' })).toBeVisible();
    await expect(page.locator('.task-title')).toHaveCount(2);
    await expect(page.locator('.task-title').filter({ hasText: 'Review yesterday' })).toHaveCount(0);
    await expect(page.getByText('Run a small program and keep its output as evidence.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Start Day 1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Continue Day 1', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mark day complete', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Start Day 2', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'All days', exact: true }).click();
    const first = page.locator('.day-card').first();
    await expect(first).toHaveClass(/complete/);
    expect(await first.locator('.day-card-title').evaluate(el => getComputedStyle(el).textDecorationLine)).toContain('line-through');
    await capture(page, 'daily-completion');
    await page.getByRole('navigation').getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your consistency', exact: true })).toBeVisible();
    await expect(page.locator('.streak-stats strong').nth(3)).toHaveText('2');
    await expect(page.locator('.day-history li')).toHaveCount(2);
    await page.getByRole('button', { name: 'Replay snake', exact: true }).click();
    await expect(page.locator('.snake-head')).toBeVisible();
    await page.getByRole('button', { name: 'Stop snake', exact: true }).click();
    await page.getByRole('navigation', { name: 'Profile sections' }).getByRole('button', { name: 'Personalize', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Alex');
    await page.getByLabel('Your goal', { exact: true }).fill('Build something small, every day.');
    await page.getByLabel('About you', { exact: true }).fill('Learning by making. Keeping a little momentum.');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.locator('.profile-saved')).toContainText('preferences are saved');
    await page.locator('input[type=file][aria-label="Profile photo file"]').setInputFiles(path.join(root, 'desktop/resources/icon.png'));
    await expect(page.getByLabel('Photo crop preview')).toBeVisible();
    await page.getByLabel('Zoom', { exact: true }).fill('1.4');
    await page.getByRole('button', { name: 'Use photo', exact: true }).click();
    await page.getByRole('button', { name: 'Ink', exact: true }).click();
    await page.getByRole('button', { name: 'Soft square', exact: true }).click();
    await page.getByLabel('When I get stuck, remind me…').fill('Ten minutes counts. Come back to one small step.');
    await page.getByLabel('Active days in seven days').selectOption('3');
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.locator('.profile-saved')).toBeVisible();
    await page.reload();
    await expect(page.locator('.profile-cover')).toHaveClass(/cover-ink/);
    await expect(page.locator('.profile-photo img')).toBeVisible();
    await expect(page.locator('.profile-photo')).toHaveClass(/photo-rounded/);
    await expect(page.locator('.rhythm-banner strong')).toHaveText('1 of 3 active days');
    await page.getByRole('navigation', { name: 'Profile sections' }).getByRole('button', { name: 'Overview', exact: true }).click();
    await page.getByRole('button', { name: 'Make my profile card', exact: true }).click();
    const cardDialog = page.getByRole('dialog');
    await expect(cardDialog.getByRole('heading', { name: 'Made of small steps.' })).toBeVisible();
    await expect(cardDialog.getByRole('button', { name: 'Save to computer', exact: true })).toBeEnabled();
    await expect(cardDialog.getByLabel('Show my goal')).not.toBeChecked();
    await cardDialog.getByRole('button', { name: 'Ink', exact: true }).click();
    await app.evaluate(({ session }, dir) => { session.defaultSession.on('will-download', (_event, item) => item.setSavePath(`${dir}/${item.getFilename()}`)); }, dir);
    await cardDialog.getByRole('button', { name: 'Save to computer', exact: true }).click();
    await expect.poll(() => require('node:fs').readdirSync(dir).find(name => /^Traqu-profile-.*\.png$/.test(name)), { timeout: 15000 }).toBeTruthy();
    const cardPath = path.join(dir, require('node:fs').readdirSync(dir).find(name => /^Traqu-profile-.*\.png$/.test(name)));
    await expect.poll(() => { try { return require('node:fs').statSync(cardPath).size; } catch { return 0; } }).toBeGreaterThan(100);
    const png = require('node:fs').readFileSync(cardPath);
    expect(png.readUInt32BE(16)).toBe(2400);
    expect(png.readUInt32BE(20)).toBe(1520);
    if (process.env.TRAQO_CAPTURE_DOCS === '1') {
      mkdirSync(path.join(root, 'docs/screenshots'), { recursive: true });
      require('node:fs').copyFileSync(cardPath, path.join(root, 'docs/screenshots/profile-card.png'));
    }
    await cardDialog.getByRole('button', { name: 'Close profile card' }).click();

    await page.getByRole('heading', { name: 'Your consistency' }).scrollIntoViewIfNeeded();
    await capture(page, 'profile');
    await page.getByRole('navigation', { name: 'Profile sections' }).getByRole('button', { name: 'Preferences', exact: true }).click();
    await page.getByLabel('Reduce motion').check();
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-traqu-motion', 'reduce');
    await page.getByRole('navigation', { name: 'Profile sections' }).getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Replay snake' })).toBeDisabled();
    await page.goto(roadmapURL);
    const qu = page.getByRole('button', { name: 'Play with Qu, your Traqu companion' });
    await expect(qu).toHaveAttribute('data-state', 'steady');
    await expect(page.locator('.qu-pupils')).toBeVisible();
    await page.mouse.move(100, 150);
    expect(await page.locator('.qu-pupils').evaluate(el => el.style.transform)).toBe('translate(0px, 0px)');
    await page.getByRole('navigation').getByRole('link', { name: 'Profile', exact: true }).click();
    await page.getByRole('navigation', { name: 'Profile sections' }).getByRole('button', { name: 'Preferences', exact: true }).click();
    await page.getByLabel('Reduce motion').uncheck();
    await page.getByRole('button', { name: 'Save settings', exact: true }).click();
    await expect(page.locator('.profile-saved')).toHaveText('Your profile and preferences are saved.');
    await expect(page.locator('html')).toHaveAttribute('data-traqu-motion', 'system');
    await page.goto(roadmapURL);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
    await qu.press('Escape');
    await expect(qu).toHaveAttribute('data-gaze', 'tracking');
    await expect(page.locator('.qu-pupils')).toBeVisible();
    await page.mouse.move(50, 300);
    await expect.poll(() => page.locator('.qu-pupils').evaluate(el => el.style.transform)).not.toBe('translate(0px, 0px)');
    // Repeated rest gestures remount the pose; gaze must bind the new pupils.
    await qu.press('Escape');
    await qu.press('Escape');
    await expect(qu).toHaveAttribute('data-gaze', 'tracking');
    await page.mouse.move(1270, 80);
    await expect.poll(() => page.locator('.qu-pupils').evaluate(el => el.style.transform)).toMatch(/^translate\([0-9.]+px,/);
    await page.mouse.move(20, 300);
    await expect.poll(() => page.locator('.qu-pupils').evaluate(el => el.style.transform)).toMatch(/^translate\(-[0-9.]+px,/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Start Day 2', exact: true }).click();
    await capture(page, 'day-mobile');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    await app.close(); app = null;
    page = await launch();
    await page.getByRole('navigation').getByRole('link', { name: 'Profile', exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Alex');
    await expect(page.locator('.streak-stats strong').nth(3)).toHaveText('2');
    await page.getByRole('navigation').getByRole('link', { name: 'Library', exact: true }).click();
    await page.getByRole('link', { name: 'Open A little progress, every day', exact: true }).click();
    await expect(page.locator('.day-card.complete')).toHaveCount(1);
  } finally {
    if (app) await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
