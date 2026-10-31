import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import type { PageBlock, PublicPageDto, StoredBlock } from '@myapp/shared-types';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { collectImageIds, defaultHomeBlocks, parseStoredLenient } from './blocks.schema';
import { HOME_SLUG } from './page.dto';
import { PagesService } from './pages.service';
import { PreviewTokenService } from './preview-token.service';

@Injectable()
export class PublicPagesService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly pages: PagesService,
    private readonly tokens: PreviewTokenService,
  ) {}

  /**
   * بدون توکن: فقط نسخه‌ی منتشرشده. با توکن پیش‌نمایش معتبر: پیش‌نویس (یا نسخه‌ی منتشرشده اگر پیش‌نویسی نیست).
   * توکن نامعتبر یا منقضی ← ۴۱۰ (هرگز بی‌صدا نسخه‌ی عمومی نشان داده نمی‌شود).
   */
  async get(slug: string, previewToken?: string): Promise<PublicPageDto> {
    const tenantId = this.ctx.require();
    const preview = previewToken !== undefined;

    if (preview && !this.tokens.verify(previewToken, { tenantId, slug })) {
      throw new GoneException('پیوند پیش‌نمایش منقضی یا نامعتبر است');
    }

    const page = await this.db.page.findFirst({
      where: preview ? { slug } : { slug, publishedAt: { not: null } },
    });

    if (!page) {
      if (slug !== HOME_SLUG) throw new NotFoundException('صفحه پیدا نشد');

      const copy = await this.pages.homeCopy();
      return {
        slug: HOME_SLUG,
        title: copy.title,
        publishedAt: null,
        preview,
        blocks: await this.resolve(defaultHomeBlocks(copy)),
      };
    }

    // بلاک نامعتبر (داده‌ی قدیمی یا دست‌کاری‌شده) حذف می‌شود و صفحه همچنان کار می‌کند
    const source = preview ? (page.draftBlocks ?? page.blocks) : page.blocks;

    return {
      slug: page.slug,
      title: page.title,
      publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
      preview,
      blocks: await this.resolve(parseStoredLenient(source)),
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