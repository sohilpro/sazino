import 'reflect-metadata';
import { deriveTenantUrl } from './helpers/tenant-url';
import { config } from 'dotenv';

config({ path: ['.env', '../../.env'], quiet: true });
process.env.NODE_ENV = 'test';
// تست‌ها worker و scheduler واقعی نمی‌خواهند و صف جدا (با پاکسازی خودکار) دارند
process.env.JOBS_ENABLED = 'false';
process.env.QUEUE_PREFIX = 'myapp-test';
process.env.INTERNAL_API_TOKEN ||= 'test-internal-token-test-internal-token-0001';

if (process.env.RLS_TESTS !== 'off' && process.env.DATABASE_URL) {
  process.env.TENANT_DATABASE_URL ||= deriveTenantUrl(process.env.DATABASE_URL);
}
