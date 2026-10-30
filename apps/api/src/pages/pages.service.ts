import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ImageDto, PageDto, PageSummaryDto, StoredBlock } from '@myapp/shared-types';
import { conflict } from '../common/errors';
import { isUniqueViolation } from '../common/prisma-errors';
import { Prisma, type Page } from '../generated/prisma/client';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { parseStoreSettings } from '../tenants/store-settings';
import {
  BlocksValidationError,
  collectImageIds,
  defaultHomeBlocks,
  parseBlocks,
  parseStoredLenient,
} from './blocks.schema';
import { HOME_SLUG, type SavePageDto } from './page.dto';

const toJson = (blocks: StoredBlock[]) => blocks as unknown as Prisma.InputJsonValue;

@Injectable()
export class PagesService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly storage: StorageService,
  ) {}

  // ───────────── خواندن ─────────────
  async list(): Promise<PageSummaryDto[]> {
    const rows = await this.db.page.findMany({ orderBy: [{ slug: 'asc' }] });
    return rows.map((p) => this.toSummary(p));
  }

  async get(slug: string): Promise<PageDto> {
    const page = await this.db.page.findFirst({ where: { slug } });
    if (page) return this.toDto(page);
    if (slug === HOME_SLUG) return this.virtualHome();
    throw new NotFoundException('صفحه پیدا نشد');
  }

  // ───────────── نوشتن ─────────────
  /** فقط پیش‌نویس را ذخیره می‌کند؛ ویترین تا «انتشار» تغییری نمی‌بیند */
  async saveDraft(slug: string, dto: SavePageDto): Promise<PageDto> {
    const tenantId = this.ctx.require();
    const blocks = this.validate(dto.blocks);
    await this.assertImages(blocks);

    for (let attempt = 0; ; attempt++) {
      const existing = await this.db.page.findFirst({ where: { slug }, select: { id: true } });
      try {
        if (existing) {
          await this.db.page.update({
            where: { id: existing.id },
            data: { title: dto.title, draftBlocks: toJson(blocks) },
          });
        } else {
          if (!dto.title) throw new BadRequestException('عنوان صفحه را وارد کنید');
          await this.db.page.create({
            data: { tenantId, slug, title: dto.title, blocks: [], draftBlocks: toJson(blocks) },
          });
        }
        break;
      } catch (err) {
        // دو ذخیره‌ی هم‌زمان‌ِ صفحه‌ی جدید: دومی به‌روزرسانی می‌شود
        if (!existing && attempt < 2 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
    return this.get(slug);
  }

  async publish(slug: string): Promise<PageDto> {
    const page = await this.db.page.findFirst({ where: { slug } });
    if (!page) throw new NotFoundException('ابتدا پیش‌نویس صفحه را ذخیره کنید');

    if (page.draftBlocks === null && page.publishedAt !== null) {
      throw conflict('NOTHING_TO_PUBLISH', 'تغییر منتشرنشده‌ای وجود ندارد');
    }

    const blocks = parseStoredLenient(page.draftBlocks ?? page.blocks);
    if (blocks.length === 0) {
      throw conflict('EMPTY_PAGE', 'صفحه‌ی بدون بلاک منتشر نمی‌شود');
    }

    await this.db.page.update({
      where: { id: page.id },
      data: { blocks: toJson(blocks), draftBlocks: Prisma.DbNull, publishedAt: new Date() },
    });
    return this.get(slug);
  }

  async discardDraft(slug: string): Promise<PageDto> {
    const page = await this.db.page.findFirst({ where: { slug }, select: { id: true } });
    if (!page) throw new NotFoundException('صفحه پیدا نشد');

    await this.db.page.update({ where: { id: page.id }, data: { draftBlocks: Prisma.DbNull } });
    return this.get(slug);
  }

  /** حذف صفحه‌ی home یعنی بازگشت به صفحه‌ی اصلی پیش‌فرض */
  async remove(slug: string): Promise<void> {
    const { count } = await this.db.page.deleteMany({ where: { slug } });
    if (count === 0) throw new NotFoundException('صفحه پیدا نشد');
  }

  // ───────────── مشترک با ویترین ─────────────
  /** متن پیش‌فرض صفحه‌ی اصلی: نام و توضیح فروشگاه */
  async homeCopy(): Promise<{ title: string; subtitle: string | null }> {
    const tenant = await this.db.tenant.findUnique({
      where: { id: this.ctx.require() },
      select: { name: true, settings: true },
    });
    if (!tenant) throw new NotFoundException('فروشگاه پیدا نشد');
    return { title: tenant.name, subtitle: parseStoreSettings(tenant.settings).description };
  }

  /** تصاویر همین فروشگاه؛ شناسه‌ی نامعتبر یا حذف‌شده در نتیجه نیست */
  async images(ids: string[]): Promise<Map<string, ImageDto>> {
    if (ids.length === 0) return new Map();
    const tenantId = this.ctx.require();

    const rows = await this.db.media.findMany({
      where: { id: { in: ids } },
      select: { id: true, alt: true, width: true, height: true },
    });
    return new Map(
      rows.map((r): [string, ImageDto] => [
        r.id,
        { id: r.id, alt: r.alt, width: r.width, height: r.height, urls: this.storage.imageUrls(tenantId, r.id) },
      ]),
    );
  }

  // ───────────── داخلی ─────────────
  private validate(input: unknown): StoredBlock[] {
    try {
      return parseBlocks(input);
    } catch (err) {
      if (err instanceof BlocksValidationError) {
        throw new BadRequestException({ statusCode: 400, error: 'Bad Request', message: err.messages });
      }
      throw err;
    }
  }

  private async assertImages(blocks: StoredBlock[]): Promise<void> {
    const ids = collectImageIds(blocks);
    if (ids.length === 0) return;
    // کلاینت tenant: تصویر فروشگاه دیگر شمرده نمی‌شود
    const found = await this.db.media.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException('یک یا چند تصویر نامعتبر است');
  }

  private toSummary(page: Page): PageSummaryDto {
    return {
      slug: page.slug,
      title: page.title,
      publishedAt: page.publishedAt ? page.publishedAt.toISOString() : null,
      hasUnpublishedChanges: page.publishedAt === null || page.draftBlocks !== null,
      isDefault: false,
      updatedAt: page.updatedAt.toISOString(),
    };
  }

  private async toDto(page: Page): Promise<PageDto> {
    const blocks = parseStoredLenient(page.blocks);
    const draftBlocks = page.draftBlocks === null ? null : parseStoredLenient(page.draftBlocks);

    const images = await this.images([
      ...new Set([...collectImageIds(blocks), ...collectImageIds(draftBlocks ?? [])]),
    ]);

    return {
      ...this.toSummary(page),
      blocks,
      draftBlocks,
      images: Object.fromEntries(images),
    };
  }

  private async virtualHome(): Promise<PageDto> {
    const copy = await this.homeCopy();
    return {
      slug: HOME_SLUG,
      title: copy.title,
      publishedAt: null,
      hasUnpublishedChanges: false,
      isDefault: true,
      updatedAt: new Date().toISOString(),
      blocks: defaultHomeBlocks(copy),
      draftBlocks: null,
      images: {},
    };
  }
}