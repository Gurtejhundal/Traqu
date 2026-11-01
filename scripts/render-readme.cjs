// Render vector motion artwork to GitHub-compatible GIFs and still fallbacks.
const { chromium } = require('@playwright/test');
const { spawnSync } = require('node:child_process');
const { mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { pathToFileURL } = require('node:url');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  const output = path.join(root, 'docs/readme');
  const frames = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'traqo-readme-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(output, 'artwork.html')).href);
    for (const [kind, duration] of [['hero',7],['flow',7],['support',5]]) {
      const directory = path.join(frames,kind);
      mkdirSync(directory,{recursive:true});
      const fps=12;
      for(let index=0;index<duration*fps;index++){
        const png=await page.evaluate(({kind,time})=>window.renderReadme(kind,time),{kind,time:index/fps});
        writeFileSync(path.join(directory,`${String(index).padStart(3,'0')}.png`),Buffer.from(png,'base64'));
      }
      const still=await page.evaluate(kind=>window.renderReadme(kind,4.5),kind);
      writeFileSync(path.join(output,`${kind}.png`),Buffer.from(still,'base64'));
      const result=spawnSync('ffmpeg',[
        '-y','-v','error','-framerate',String(fps),'-i',path.join(directory,'%03d.png'),
        '-filter_complex','[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
        '-loop','0',path.join(output,`${kind}.gif`),
      ],{stdio:'inherit'});
      if(result.error)throw result.error;
      if(result.status!==0)throw new Error(`Could not encode ${kind}`);
      console.log(`Rendered ${kind}: ${duration}s at ${fps}fps`);
    }
  } finally {
    await browser.close();
    rmSync(frames,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
