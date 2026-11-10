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

// یک رشته‌ی فرمان (نه آرایه) تا هشدار DEP0190 نیاید؛ shell در ویندوز برای فایل npm.cmd لازم است
const child = spawn(`npm run ${script} -w apps/api`, {
  cwd: root,
  shell: true,
  // در یونیکس گروه پروسه‌ی جدا می‌گیرد تا بتوانیم کل درخت (npm + node) را ببندیم
  detached: process.platform !== 'win32',
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
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => process.exit(code ?? 0));