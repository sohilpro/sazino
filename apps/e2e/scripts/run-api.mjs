import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const logDir = resolve(here, '../.logs');
mkdirSync(logDir, { recursive: true });
const file = createWriteStream(resolve(logDir, 'api.log'), { flags: 'w' });

// در CI قبلاً build شده؛ محلی با watch
const script = process.env.CI ? 'start' : 'dev';
const child = spawn('npm', ['run', script, '-w', 'apps/api'], {
  cwd: root,
  shell: process.platform === 'win32',
  env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', NODE_ENV: 'development' },
});

for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    process.stdout.write(chunk);
    file.write(chunk);
  });
}

function stop() {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } else {
    child.kill('SIGTERM');
  }
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => process.exit(code ?? 0));