const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const screenshots=path.resolve(__dirname,'../tmp/site-review');
test('three pages, local assets and responsive layouts stay usable',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const width of [1440,390]) for(const route of ['index.html','download.html','docs.html']){
  await page.setViewportSize({width,height:1000});await page.goto('/'+route);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('header nav a[aria-current=page]')).toHaveCount(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const links=await page.locator('a[href]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')).filter(href=>!href.startsWith('http')&&!href.startsWith('#')));
  for(const href of [...new Set(links)]) expect((await page.request.get(new URL(href,page.url()).href)).status(),href).toBe(200);
  await expect.poll(()=>page.locator('img').evaluateAll(nodes=>nodes.filter(img=>img.loading!=='lazy').every(img=>img.complete&&img.naturalWidth>0))).toBe(true);
  fs.mkdirSync(screenshots,{recursive:true});await page.screenshot({path:path.join(screenshots,`${route}-${width}.png`),fullPage:true});
 }
 expect(errors).toEqual([]);
});
test('pet, motion control, prompt, manual dialog and donation copy are functional',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);
 await page.goto('/index.html');
 await page.getByRole('button',{name:'Run ↔',exact:true}).click();await expect(page.locator('.pet')).toHaveAttribute('data-action','run');
 await page.locator('.pet').focus();await page.keyboard.press('Escape');await expect(page.locator('.pet')).toHaveAttribute('data-action','rest');
 await page.mouse.move(20,30);await expect.poll(()=>page.locator('.pupils').evaluate(el=>el.style.transform)).toContain('translate(');
 await page.getByRole('button',{name:'Pause animations'}).first().click();await expect(page.locator('html')).toHaveAttribute('data-motion','paused');
 await expect(page.locator('.demo-frame img')).toHaveAttribute('src','media/screenshots/roadmap.png');
 await page.goto('/download.html');await page.getByRole('button',{name:/Copy roadmap prompt/}).click();await expect(page.locator('#copy-status')).toContainText('Copied');
 const prompt=await page.evaluate(()=>navigator.clipboard.readText());expect(prompt).toContain('Week 1');expect(prompt).toContain('Do not claim live access');
 await page.goto('/docs.html');await page.getByRole('button',{name:/AI connections/}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('#manual-body')).toContainText('Claude Code');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 for(const manual of await page.locator('[data-manual]').evaluateAll(nodes=>nodes.map(n=>n.dataset.manual))){expect((await page.request.get('/manual/'+manual)).status()).toBe(200);}
 await page.getByRole('button',{name:'Copy UPI ID',exact:true}).click();await expect(page.locator('#upi-status')).toContainText('copied');
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe('gurtejbir.29107@okhdfcbank');
});
test('reduced motion and unavailable release metadata retain working content',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/index.html');await expect(page.locator('html')).toHaveAttribute('data-motion','paused');
 await page.getByRole('button',{name:'Run ↔',exact:true}).click();await expect(page.locator('.pet')).toHaveAttribute('data-action','rest');
 await page.route('https://api.github.com/**',route=>route.abort());await page.goto('/download.html');await expect(page.locator('#release-status')).toContainText('latest published');
 await expect(page.locator('a[data-asset]')).toHaveCount(6);
});
