import { Injectable, NotFoundException } from '@nestjs/common';
import type { PageBlock, PublicPageDto, StoredBlock } from '@myapp/shared-types';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { collectImageIds, defaultHomeBlocks, parseStoredLenient } from './blocks.schema';
import { HOME_SLUG } from './page.dto';
import { PagesService } from './pages.service';

@Injectable()
export class PublicPagesService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly pages: PagesService,
  ) {}

  /** فقط نسخه‌ی منتشرشده. home بدون صفحه‌ی منتشرشده ← پیش‌فرض */
  async get(slug: string): Promise<PublicPageDto> {
    this.ctx.require();

    const page = await this.db.page.findFirst({ where: { slug, publishedAt: { not: null } } });
    if (!page) {
      if (slug !== HOME_SLUG) throw new NotFoundException('صفحه پیدا نشد');

      const copy = await this.pages.homeCopy();
      return {
        slug: HOME_SLUG,
        title: copy.title,
        publishedAt: null,
        blocks: await this.resolve(defaultHomeBlocks(copy)),
      };
    }

    return {
      slug: page.slug,
      title: page.title,
      publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
      // بلاک نامعتبر (داده‌ی قدیمی یا دست‌کاری‌شده) حذف می‌شود و صفحه همچنان کار می‌کند
      blocks: await this.resolve(parseStoredLenient(page.blocks)),
    };
  }

  private async resolve(stored: StoredBlock[]): Promise<PageBlock[]> {
    const images = await this.pages.images(collectImageIds(stored));

    return stored.map((block): PageBlock => {
      if (block.type !== 'hero') return block;
      const { imageId, ...rest } = block.props;
      return {
        id: block.id,
        type: 'hero',
        props: { ...rest, image: (imageId && images.get(imageId)) || null },
      };
    });
  }
}