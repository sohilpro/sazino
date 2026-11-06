import { describe, expect, it } from 'vitest';
import { buildRobotsTxt, buildSitemapXml, encodePath, MAX_SITEMAP_URLS, xmlEscape } from '../server/utils/sitemap';

describe('xmlEscape', () => {
  it('escapes the five XML characters', () => {
    expect(xmlEscape(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;',
    );
  });

  it('removes characters XML cannot carry', () => {
    expect(xmlEscape('a\u0000b\u0008c')).toBe('abc');
  });
});

describe('encodePath', () => {
  it('percent-encodes each segment but keeps the slashes', () => {
    expect(encodePath('/p/درباره ما')).toBe('/p/%D8%AF%D8%B1%D8%A8%D8%A7%D8%B1%D9%87%20%D9%85%D8%A7');
    expect(encodePath('/')).toBe('/');
  });
});

describe('buildSitemapXml', () => {
  const entries = [
    { path: '/', lastModified: null },
    { path: '/products/a&b', lastModified: '2026-11-05T10:00:00.000Z' },
    { path: '/p/x', lastModified: 'not a date' },
  ];

  it('builds a well-formed urlset with absolute escaped URLs', () => {
    const xml = buildSitemapXml('https://shop.example.com/', entries);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://shop.example.com/</loc>');
    expect(xml).toContain('<loc>https://shop.example.com/products/a%26b</loc>');
    expect(xml).toContain('<lastmod>2026-11-05T10:00:00.000Z</lastmod>');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    // هیچ & خامی نماند
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
    // lastmod نامعتبر حذف می‌شود
    expect(xml).toContain('<loc>https://shop.example.com/p/x</loc></url>');
  });

  it('escapes a hostile origin too', () => {
    const xml = buildSitemapXml('https://a.com/"><script>', [{ path: '/', lastModified: null }]);
    expect(xml).not.toContain('<script>');
  });

  it('never emits more than the protocol limit', () => {
    const many = Array.from({ length: MAX_SITEMAP_URLS + 10 }, (_, i) => ({ path: `/p/${i}`, lastModified: null }));
    expect(buildSitemapXml('https://a.com', many).match(/<url>/g)).toHaveLength(MAX_SITEMAP_URLS);
  });
});

describe('buildRobotsTxt', () => {
  it('blocks private areas and points to the canonical sitemap', () => {
    const txt = buildRobotsTxt({ origin: 'https://shop.example.com/' });
    for (const path of ['/cart', '/checkout', '/account', '/orders', '/login', '/payment', '/api', '/dev', '/preview']) {
      expect(txt).toContain(`Disallow: ${path}\n`);
    }
    expect(txt).toContain('Sitemap: https://shop.example.com/sitemap.xml');
    expect(txt).toContain('Allow: /\n');
  });

  it('blocks everything for an unknown or suspended store', () => {
    expect(buildRobotsTxt({ origin: null })).toBe('User-agent: *\nDisallow: /\n');
  });
});