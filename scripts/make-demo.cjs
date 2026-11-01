const { spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (!existsSync(path.join(root, 'test-results/demo-frames/000.png'))) {
  throw new Error('Capture desktop states first: TRAQO_CAPTURE_DOCS=1 npm run test:desktop');
}
const result = spawnSync('ffmpeg', [
  '-y', '-framerate', '1/2', '-i', 'test-results/demo-frames/%03d.png',
  '-filter_complex', '[0:v]scale=1080:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
  '-loop', '0', 'docs/screenshots/desktop-demo.gif',
], { cwd: root, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
