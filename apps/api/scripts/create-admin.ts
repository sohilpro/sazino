/* eslint-disable no-console */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: ['.env', '../../.env'], quiet: true });

const MIN_PASSWORD = 12;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

/** رمز بدون نمایش روی صفحه و بدون ماندن در تاریخچه‌ی shell */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('ورودی ترمینال نیست؛ رمز را در متغیر محیطی ADMIN_PASSWORD بگذارید'));
      return;
    }

    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';

    const done = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
    };
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (c === '\u0003') {
          done();
          reject(new Error('لغو شد'));
          return;
        }
        if (c === '\r' || c === '\n') {
          done();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const name = (arg('name') ?? process.env.ADMIN_NAME ?? 'مدیر پلتفرم').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('ایمیل را بدهید: npm run admin:create -w apps/api -- --email=you@example.com --name="نام شما"');
  }

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await promptHidden(`رمز عبور (حداقل ${MIN_PASSWORD} کاراکتر): `);
    const again = await promptHidden('تکرار رمز: ');
    if (password !== again) throw new Error('دو رمز یکی نیست');
  }
  if (password.length < MIN_PASSWORD) throw new Error(`رمز باید حداقل ${MIN_PASSWORD} کاراکتر باشد`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const existing = await prisma.platformAdmin.findUnique({ where: { email } });

    if (existing) {
      await prisma.$transaction([
        prisma.platformAdmin.update({ where: { id: existing.id }, data: { passwordHash, name, isActive: true } }),
        prisma.adminSession.deleteMany({ where: { adminId: existing.id } }), // نشست‌های قبلی باطل می‌شوند
      ]);
      console.log(`✔ رمز ادمین ${email} عوض شد و نشست‌های قبلی بسته شدند`);
    } else {
      await prisma.platformAdmin.create({ data: { email, name, passwordHash } });
      console.log(`✔ ادمین ${email} ساخته شد`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: Error) => {
  console.error(`✘ ${err.message}`);
  process.exitCode = 1;
});