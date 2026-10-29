import { config } from 'dotenv';

// این فایل هنگام import ماژول‌ها اجرا می‌شود، یعنی قبل از ConfigModule؛ پس .env را خودش می‌خواند
config({ path: ['.env', '../../.env'], quiet: true });

/** worker و scheduler فقط وقتی ساخته می‌شوند که این مقدار true باشد (در تست false است) */
export const JOBS_ENABLED = process.env.JOBS_ENABLED !== 'false';