const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
test('photo saves immediately without saving unrelated edits and save controls stay above fields', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(),'traqu-photo-'));
  const env = {...process.env, TRAQO_DATA_DIR:folder}; delete env.ELECTRON_RUN_AS_NODE;
  const app = await electron.launch({executablePath:process.env.TRAQO_TEST_EXECUTABLE || require('electron'),args:[...(process.env.TRAQO_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), ...(process.env.TRAQO_TEST_EXECUTABLE ? [] : [path.resolve(__dirname,'../..')])],env});
  try {
    const page=await app.firstWindow();
    await page.waitForURL(/127\.0\.0\.1/);
    await page.goto(new URL('/profile',page.url()).href);
    await page.getByRole('button',{name:'Personalize',exact:true}).first().click();
    const name=page.getByRole('textbox',{name:'Name',exact:true});
    await expect(name).toBeEnabled(); const original=await name.inputValue();
    await name.fill('Unsaved identity');
    await page.getByLabel('Profile photo file').setInputFiles(path.resolve(__dirname,'../resources/icon.png'));
    await page.getByRole('button',{name:'Use photo',exact:true}).click();
    await expect(page.getByLabel('Crop your profile photo')).toHaveCount(0);
    await expect(name).toHaveValue('Unsaved identity');
    const data=await page.evaluate(async()=> (await fetch('/api/profile')).json());
    expect(data.avatar).toMatch(/^data:image\/jpeg/); expect(data.name).toBe(original);
    await page.getByRole('button',{name:'Save settings',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Your profile and preferences are saved.'})).toBeVisible();
    expect(await page.locator('.profile-savebar').evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector('.profile-section-heading')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await page.getByRole('button',{name:'Preferences',exact:true}).click();
    await expect(page.getByRole('button',{name:'Connect to Codex',exact:true})).toBeVisible();
  } finally { await app.close(); fs.rmSync(folder,{recursive:true,force:true}); }
});
