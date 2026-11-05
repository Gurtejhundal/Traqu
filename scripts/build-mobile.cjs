const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync('npm', ['run', 'build', '--prefix', 'frontend'], {
  cwd: path.resolve(__dirname, '..'), stdio: 'inherit', shell: process.platform === 'win32',
  env: { ...process.env, VITE_API_URL: '/api', VITE_LOCAL_USER_ID: 'local_owner', VITE_TRAQU_DESKTOP: 'false', VITE_TRAQU_MOBILE: 'true' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
