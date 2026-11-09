import { expect, test } from '@playwright/test';

test('robots.txt points to the sitemap and hides private pages', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('Sitemap: http://demo.localhost:3000/sitemap.xml');
  expect(body).toContain('Disallow: /checkout');
});

test('sitemap.xml lists the demo products as absolute URLs', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain('<urlset');
  expect(xml).toContain(`http://demo.localhost:3000/products/${encodeURIComponent('پاوربانک-20000')}`);
});

test('an unknown store gets "disallow all" and no sitemap', async ({ request }) => {
  const robots = await request.get('http://nosuchshop.localhost:3000/robots.txt');
  expect(await robots.text()).toContain('Disallow: /');
  const sitemap = await request.get('http://nosuchshop.localhost:3000/sitemap.xml');
  expect(sitemap.status()).toBe(404);
});