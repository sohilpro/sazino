import { Injectable } from '@nestjs/common';
import type { SitemapUrlEntry, SitemapUrlsDto } from '@myapp/shared-types';
import { HOME_SLUG } from '../pages/page.dto';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';

export const SITEMAP_MAX_URLS = 45_000;
const MAX_PAGES = 1_000;
const MAX_CATEGORIES = 2_000;

@Injectable()
export class SeoService {
  constructor(@InjectTenantDb() private readonly db: TenantDb) {}

  async list(limit = SITEMAP_MAX_URLS): Promise<SitemapUrlsDto> {
    const urls: SitemapUrlEntry[] = [{ path: '/', lastModified: null }];

    // صفحات منتشرشده؛ صفحه‌ی home همان «/» است
    const pages = await this.db.page.findMany({
      where: { publishedAt: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { slug: 'asc' },
      take: MAX_PAGES,
    });
    for (const page of pages) {
      const lastModified = page.updatedAt.toISOString();
      if (page.slug === HOME_SLUG) urls[0] = { path: '/', lastModified };
      else urls.push({ path: `/p/${page.slug}`, lastModified });
    }

    // دسته‌های دارای حداقل یک محصول فعال
    const used = await this.db.product.findMany({
      where: { status: 'ACTIVE', categoryId: { not: null } },
      distinct: ['categoryId'],
      select: { categoryId: true },
    });
    const categoryIds = used.map((p) => p.categoryId).filter((id): id is string => id !== null);
    if (categoryIds.length > 0) {
      const categories = await this.db.category.findMany({
        where: { id: { in: categoryIds } },
        select: { slug: true, updatedAt: true },
        orderBy: { slug: 'asc' },
        take: MAX_CATEGORIES,
      });
      for (const c of categories) {
        urls.push({ path: `/categories/${c.slug}`, lastModified: c.updatedAt.toISOString() });
      }
    }

    // محصولات فعال تا سقف؛ یکی بیشتر می‌خوانیم تا truncated را بفهمیم
    const remaining = Math.max(0, limit - urls.length);
    const products = await this.db.product.findMany({
      where: { status: 'ACTIVE' },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: remaining + 1,
    });
    const truncated = products.length > remaining;
    for (const p of products.slice(0, remaining)) {
      urls.push({ path: `/products/${p.slug}`, lastModified: p.updatedAt.toISOString() });
    }

    return { urls: urls.slice(0, limit), truncated };
  }
}