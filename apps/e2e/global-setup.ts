import { resolve } from 'node:path';
import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: resolve(__dirname, '../../.env'), quiet: true });

const API = 'http://localhost:4000/api';

export default async function globalSetup() {
  // هر اجرا موجودی کم می‌کند؛ موجودی دمو را برمی‌گردانیم
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(
      `UPDATE inventory SET quantity = 50
       WHERE tenant_id = (SELECT id FROM tenants WHERE subdomain = 'demo')`,
    );
  } finally {
    await db.end();
  }

  // درگاه فروشنده‌ی دمو را (با درایور fake) فعال می‌کنیم
  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'owner@demo.test', password: 'Password123!' }),
  });
  if (!login.ok) {
    throw new Error(`seller login failed (HTTP ${login.status}); run "npm run db:seed" first`);
  }
  const { accessToken } = (await login.json()) as { accessToken: string };

  const save = await fetch(`${API}/payment-gateway`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ merchantId: '00000000-0000-4000-8000-000000000000', isActive: true }),
  });
  if (!save.ok) throw new Error(`gateway setup failed (HTTP ${save.status})`);
}