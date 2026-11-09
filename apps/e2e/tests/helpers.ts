import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from '@playwright/test';

const API_LOG = resolve(__dirname, '../.logs/api.log');

export function randomPhone(): string {
  return `09${Math.floor(Math.random() * 1e9).toString().padStart(9, '0')}`;
}

/** درایور پیامک console کد را در لاگ API می‌نویسد؛ آخرین کد این شماره را برمی‌گرداند */
export async function readOtp(phone: string): Promise<string> {
  const pattern = new RegExp(`\\[console\\] \\w+ → ${phone}: (\\d{6})`, 'g');
  let code = '';
  await expect
    .poll(
      () => {
        let text = '';
        try {
          text = readFileSync(API_LOG, 'utf8');
        } catch {
          return '';
        }
        code = [...text.matchAll(pattern)].at(-1)?.[1] ?? '';
        return code;
      },
      { message: `OTP for ${phone} not found in ${API_LOG}`, timeout: 15_000 },
    )
    .not.toBe('');
  return code;
}