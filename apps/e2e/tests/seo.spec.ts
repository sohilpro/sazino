import { expect, test, type Page } from '@playwright/test';

const PRODUCT_SLUG = encodeURIComponent('هدفون-بلوتوثی');
const DRAFT_SLUG = encodeURIComponent('پاوربانک-20000');

// *.localhost را فقط مرورگر می‌شناسد (Node در ویندوز نه)؛ پس با page.goto می‌خوانیم
async function get(page: Page, url: string) {
  const response = await page.goto(url);
  if (!response) throw new Error(`no response for ${url}`);
  return { status: response.status(), body: await response.text() };
}

test('robots.txt points to the sitemap and hides private pages', async ({ page }) => {
  const { status, body } = await get(page, '/robots.txt');
  expect(status).toBe(200);
  expect(body).toContain('Sitemap: http://demo.localhost:3000/sitemap.xml');
  expect(body).toContain('Disallow: /checkout');
});

test('sitemap.xml lists active products as absolute URLs and skips drafts', async ({ page }) => {
  const { status, body } = await get(page, '/sitemap.xml');
  expect(status).toBe(200);
  expect(body).toContain('<urlset');
  expect(body).toContain(`http://demo.localhost:3000/products/${PRODUCT_SLUG}`);
  // پیش‌نویس seed نباید در sitemap باشد (اگر دیتابیس تو از seed قدیمی مانده، seed را روی دیتابیس تازه اجرا کن)
  expect(body).not.toContain(`/products/${DRAFT_SLUG}`);
});

test('an unknown store gets "disallow all" and no sitemap', async ({ page }) => {
  const robots = await get(page, 'http://nosuchshop.localhost:3000/robots.txt');
  expect(robots.body).toContain('Disallow: /');
  expect(robots.body).not.toContain('Sitemap:');

  const sitemap = await get(page, 'http://nosuchshop.localhost:3000/sitemap.xml');
  expect(sitemap.status).toBe(404);
});