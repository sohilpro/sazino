import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { MediaDto, Paginated } from '@myapp/shared-types';
import { buildMeta, type PaginationQueryDto } from '../common/pagination';
import { StorageService } from '../storage/storage.service';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { ImageProcessor } from './image-processor';
import { IMAGE_CONTENT_TYPE } from './media.constants';
import type { UpdateMediaDto, UploadMediaDto } from './media.dto';
import type { UploadedImageFile } from './uploaded-file';

interface MediaRow {
  id: string;
  tenantId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  alt: string | null;
  createdAt: Date;
}

/** multer نام فایل را گاهی latin1 دیکد می‌کند؛ اگر کاراکتری بالاتر از 255 هست یعنی درست دیکد شده */
function cleanFilename(name: string | undefined): string {
  const raw = name ?? '';
  const alreadyUnicode = [...raw].some((c) => c.charCodeAt(0) > 255);
  let decoded = raw;
  if (!alreadyUnicode) {
    const attempt = Buffer.from(raw, 'latin1').toString('utf8');
    decoded = attempt.includes('\uFFFD') ? raw : attempt;
  }
  return (
    // eslint-disable-next-line no-control-regex
    decoded.replace(/[\\/\u0000-\u001f]/g, '').trim().slice(0, 200) || 'image'
  );
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly processor: ImageProcessor,
    private readonly storage: StorageService,
  ) {}

  async upload(file: UploadedImageFile | undefined, dto: UploadMediaDto): Promise<MediaDto> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایلی ارسال نشده است (فیلد multipart باید file نام داشته باشد)');
    }

    const tenantId = this.ctx.require();
    const processed = await this.processor.process(file.buffer);

    const id = randomUUID();
    const keys = this.storage.imageKeys(tenantId, id);
    const allKeys = Object.values(keys);

    try {
      await Promise.all(
        processed.variants.map((v) => this.storage.put(keys[v.name], v.buffer, IMAGE_CONTENT_TYPE)),
      );
    } catch (err) {
      this.logger.error(`Upload to storage failed: ${(err as Error).message}`);
      await this.storage.deleteMany(allKeys).catch(() => undefined);
      throw new ServiceUnavailableException('ذخیره‌سازی تصویر در دسترس نیست، کمی بعد دوباره تلاش کنید');
    }

    try {
      const row = await this.db.media.create({
        data: {
          id,
          tenantId,
          originalName: cleanFilename(file.originalname),
          mimeType: `image/${processed.format}`,
          sizeBytes: file.size,
          width: processed.width,
          height: processed.height,
          alt: dto.alt || null,
        },
      });
      return this.toDto(row);
    } catch (err) {
      // دیتابیس شکست خورد: فایل‌های یتیم باقی نمی‌مانند
      await this.storage.deleteMany(allKeys).catch(() => undefined);
      throw err;
    }
  }

  async list(q: PaginationQueryDto): Promise<Paginated<MediaDto>> {
    const [rows, total] = await Promise.all([
      this.db.media.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.db.media.count(),
    ]);
    return { items: rows.map((r) => this.toDto(r)), meta: buildMeta(q.page, q.limit, total) };
  }

  async get(id: string): Promise<MediaDto> {
    const row = await this.db.media.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('تصویر پیدا نشد');
    return this.toDto(row);
  }

  async update(id: string, dto: UpdateMediaDto): Promise<MediaDto> {
    const exists = await this.db.media.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('تصویر پیدا نشد');

    const row = await this.db.media.update({
      where: { id },
      data: { alt: dto.alt === undefined ? undefined : dto.alt || null },
    });
    return this.toDto(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.db.media.findUnique({
      where: { id },
      select: { id: true, tenantId: true },
    });
    if (!row) throw new NotFoundException('تصویر پیدا نشد');

    // اتصال‌های محصول توسط دیتابیس حذف می‌شوند (onDelete: Cascade)
    await this.db.media.delete({ where: { id } });

    try {
      await this.storage.deleteMany(Object.values(this.storage.imageKeys(row.tenantId, row.id)));
    } catch (err) {
      // ردیف DB پاک شده؛ فایل یتیم بعداً با job پاکسازی جمع می‌شود
      this.logger.warn(`Could not delete files of media ${row.id}: ${(err as Error).message}`);
    }
  }

  private toDto(row: MediaRow): MediaDto {
    return {
      id: row.id,
      originalName: row.originalName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      width: row.width,
      height: row.height,
      alt: row.alt,
      urls: this.storage.imageUrls(row.tenantId, row.id),
      createdAt: row.createdAt.toISOString(),
    };
  }
}