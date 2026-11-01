import 'reflect-metadata';
import { config } from 'dotenv';

config({ path: ['.env', '../../.env'], quiet: true });
process.env.NODE_ENV = 'test';
// تست‌ها worker و scheduler واقعی نمی‌خواهند و صف جدا (با پاکسازی خودکار) دارند
process.env.JOBS_ENABLED = 'false';
process.env.QUEUE_PREFIX = 'myapp-test';
process.env.INTERNAL_API_TOKEN ||= 'test-internal-token-test-internal-token-0001';