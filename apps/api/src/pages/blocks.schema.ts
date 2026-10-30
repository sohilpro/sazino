/* eslint-disable no-control-regex */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { StoredBlock } from '@myapp/shared-types';
import { SLUG_MAX_LENGTH, SLUG_REGEX } from '../common/slug';
import { isSafeHref } from './safe-href';

export const MAX_BLOCKS = 30;
export const MAX_BLOCKS_JSON_LENGTH = 60_000;
export const MAX_RICH_TEXT_LENGTH = 5_000;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const optionalHref = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isSafeHref(v), {
    message: 'آدرس لینک نامعتبر است (فقط مسیر داخلی یا https)',
  });

const blockId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,40}$/, 'شناسه‌ی بلاک نامعتبر است')
  .default(() => randomUUID());

const align = z.enum(['start', 'center']);

const heroBlock = z.strictObject({
  id: blockId,
  type: z.literal('hero'),
  props: z
    .strictObject({
      title: z.string().trim().min(1, 'عنوان را وارد کنید').max(120),
      subtitle: optionalText(300),
      align: align.default('center'),
      ctaLabel: optionalText(40),
      ctaHref: optionalHref,
      imageId: z
        .string()
        .uuid()
        .nullish()
        .transform((v) => v ?? null),
    })
    .refine((p) => Boolean(p.ctaLabel) === Boolean(p.ctaHref), {
      message: 'متن دکمه و آدرس آن باید با هم پر شوند',
      path: ['ctaHref'],
    }),
});

const productGridBlock = z.strictObject({
  id: blockId,
  type: z.literal('product-grid'),
  props: z
    .strictObject({
      title: optionalText(80),
      source: z.enum(['latest', 'category']).default('latest'),
      categorySlug: z
        .string()
        .trim()
        .toLowerCase()
        .max(SLUG_MAX_LENGTH)
        .regex(SLUG_REGEX, 'slug دسته‌بندی نامعتبر است')
        .nullish()
        .transform((v) => v ?? null),
      limit: z.number().int().min(2).max(24).default(8),
      columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
    })
    .refine((p) => p.source !== 'category' || p.categorySlug !== null, {
      message: 'برای نمایش یک دسته‌بندی، slug آن را وارد کنید',
      path: ['categorySlug'],
    })
    // با source = latest، slug بی‌اثر است و نگه داشته نمی‌شود
    .transform((p) => (p.source === 'latest' ? { ...p, categorySlug: null } : p)),
});

const richTextBlock = z.strictObject({
  id: blockId,
  type: z.literal('rich-text'),
  props: z.strictObject({
    content: z
      .string()
      .max(MAX_RICH_TEXT_LENGTH)
      // پایان خط یکسان و حذف کاراکترهای کنترلی (جز خط جدید و تب)
      .transform((s) => s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''))
      .refine((s) => s.trim().length > 0, { message: 'متن را وارد کنید' }),
    align: align.default('start'),
  }),
});

export const blockSchema = z.discriminatedUnion('type', [heroBlock, productGridBlock, richTextBlock]);

export class BlocksValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages[0] ?? 'بلاک‌ها نامعتبر هستند');
    this.name = 'BlocksValidationError';
  }
}

function formatIssue(issue: { path: readonly PropertyKey[]; message: string }): string {
  const [index, ...rest] = issue.path;
  const where = typeof index === 'number' ? `بلاک ${index + 1}` : 'blocks';
  const field = rest.length ? ` › ${rest.map(String).join('.')}` : '';
  return `${where}${field}: ${issue.message}`;
}

/** ورودی کاربر: هر خطا ← BlocksValidationError. خروجی نرمال‌شده است (پیش‌فرض‌ها و شناسه‌ها پر شده) */
export function parseBlocks(input: unknown): StoredBlock[] {
  if (!Array.isArray(input)) throw new BlocksValidationError(['blocks باید آرایه باشد']);
  if (input.length > MAX_BLOCKS) {
    throw new BlocksValidationError([`حداکثر ${MAX_BLOCKS} بلاک در هر صفحه مجاز است`]);
  }

  const result = z.array(blockSchema).safeParse(input);
  if (!result.success) {
    throw new BlocksValidationError(result.error.issues.slice(0, 10).map(formatIssue));
  }

  const blocks = result.data as StoredBlock[];

  const seen = new Set<string>();
  for (const block of blocks) {
    if (seen.has(block.id)) throw new BlocksValidationError([`شناسه‌ی بلاک تکراری است: ${block.id}`]);
    seen.add(block.id);
  }

  if (JSON.stringify(blocks).length > MAX_BLOCKS_JSON_LENGTH) {
    throw new BlocksValidationError(['حجم محتوای صفحه بیش از حد مجاز است']);
  }
  return blocks;
}

/** داده‌ی دیتابیس: بلاک نامعتبر بی‌صدا حذف می‌شود (هرگز خطا نمی‌دهد) */
export function parseStoredLenient(json: unknown): StoredBlock[] {
  if (!Array.isArray(json)) return [];
  const blocks: StoredBlock[] = [];
  for (const item of json.slice(0, MAX_BLOCKS)) {
    const parsed = blockSchema.safeParse(item);
    if (parsed.success) blocks.push(parsed.data as StoredBlock);
  }
  return blocks;
}

export function collectImageIds(blocks: StoredBlock[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.type === 'hero' && block.props.imageId) ids.add(block.props.imageId);
  }
  return [...ids];
}

/** صفحه‌ی اصلی پیش‌فرض برای فروشگاهی که هنوز صفحه‌ای نساخته */
export function defaultHomeBlocks(input: { title: string; subtitle: string | null }): StoredBlock[] {
  return [
    {
      id: 'hero',
      type: 'hero',
      props: {
        title: input.title,
        subtitle: input.subtitle,
        align: 'center',
        ctaLabel: 'مشاهده‌ی همه‌ی محصولات',
        ctaHref: '/products',
        imageId: null,
      },
    },
    {
      id: 'latest',
      type: 'product-grid',
      props: { title: 'جدیدترین محصولات', source: 'latest', categorySlug: null, limit: 12, columns: 4 },
    },
  ];
}