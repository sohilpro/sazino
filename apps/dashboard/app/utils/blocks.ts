/* eslint-disable no-control-regex */
import type { GridColumns, StoredBlock } from '@myapp/shared-types';

export type BlockType = StoredBlock['type'];

export const MAX_BLOCKS = 30;
export const MAX_RICH_TEXT = 5000;

export const BLOCK_TYPES: ReadonlyArray<{ type: BlockType; label: string; description: string }> = [
  { type: 'hero', label: 'بنر اصلی', description: 'عنوان بزرگ با زیرعنوان، تصویر پس‌زمینه و دکمه' },
  { type: 'product-grid', label: 'فهرست محصولات', description: 'جدیدترین محصولات یا محصولات یک دسته' },
  { type: 'rich-text', label: 'متن', description: 'عنوان، پاراگراف و فهرست' },
];

export const blockLabel = (type: BlockType): string =>
  BLOCK_TYPES.find((b) => b.type === type)?.label ?? type;

/** شناسه‌ی بلاک: با الگوی [A-Za-z0-9_-]{1,40} سرور سازگار است */
export function newId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  );
}

export function createBlock(type: BlockType): StoredBlock {
  const id = newId();
  switch (type) {
    case 'hero':
      return {
        id,
        type,
        props: { title: 'عنوان بنر', subtitle: null, align: 'center', ctaLabel: null, ctaHref: null, imageId: null },
      };
    case 'product-grid':
      return {
        id,
        type,
        props: { title: 'جدیدترین محصولات', source: 'latest', categorySlug: null, limit: 8, columns: 4 },
      };
    case 'rich-text':
      return { id, type, props: { content: '# عنوان\n\nمتن خود را اینجا بنویسید.', align: 'start' } };
  }
}

/** کپی عمیق با شناسه‌ی جدید */
export function cloneBlock(block: StoredBlock): StoredBlock {
  return { ...(JSON.parse(JSON.stringify(block)) as StoredBlock), id: newId() };
}

/** آرایه‌ی جدید با جابه‌جایی یک عضو؛ اندیس خارج از محدوده = بدون تغییر */
export function moveBlock<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

/** همان قاعده‌ی سرور: مسیر داخلی یا https بدون نام‌کاربری */
export function isSafeHref(href: string): boolean {
  if (href.length === 0 || href.length > 500) return false;
  if (/^\/(?!\/)[^\s\\\u0000-\u001f]*$/.test(href)) return true;
  if (!/^https:\/\/[^\s\u0000-\u001f]+$/.test(href)) return false;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

const SLUG = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

/** پیام‌های فارسی خطای یک بلاک (هم‌راستا با schema سرور) */
export function validateBlock(block: StoredBlock): string[] {
  const errors: string[] = [];

  switch (block.type) {
    case 'hero': {
      const p = block.props;
      const title = p.title.trim();
      if (!title) errors.push('عنوان بنر را وارد کنید');
      else if (title.length > 120) errors.push('عنوان بنر حداکثر ۱۲۰ کاراکتر است');
      if ((p.subtitle ?? '').trim().length > 300) errors.push('زیرعنوان حداکثر ۳۰۰ کاراکتر است');

      const label = (p.ctaLabel ?? '').trim();
      const href = (p.ctaHref ?? '').trim();
      if (label.length > 40) errors.push('متن دکمه حداکثر ۴۰ کاراکتر است');
      if (Boolean(label) !== Boolean(href)) {
        errors.push('متن دکمه و آدرس آن باید با هم پر شوند');
      } else if (href && !isSafeHref(href)) {
        errors.push('آدرس دکمه نامعتبر است (مسیر داخلی مثل /products یا لینک https)');
      }
      break;
    }
    case 'product-grid': {
      const p = block.props;
      if ((p.title ?? '').trim().length > 80) errors.push('عنوان بخش حداکثر ۸۰ کاراکتر است');
      if (!Number.isInteger(p.limit) || p.limit < 2 || p.limit > 24) {
        errors.push('تعداد محصولات باید عددی صحیح بین ۲ تا ۲۴ باشد');
      }
      if (p.source === 'category') {
        const slug = (p.categorySlug ?? '').trim().toLowerCase();
        if (!slug) errors.push('یک دسته‌بندی انتخاب کنید');
        else if (slug.length > 80 || !SLUG.test(slug)) errors.push('دسته‌بندی نامعتبر است');
      }
      break;
    }
    case 'rich-text': {
      const content = block.props.content;
      if (!content.trim()) errors.push('متن را وارد کنید');
      else if (content.length > MAX_RICH_TEXT) errors.push(`متن حداکثر ${MAX_RICH_TEXT} کاراکتر است`);
      break;
    }
  }
  return errors;
}

export interface BlocksValidation {
  /** خطاهای کل صفحه (مثلاً تعداد بلاک‌ها) */
  global: string[];
  /** خطاهای هر بلاک به‌ترتیب اندیس */
  byIndex: Record<number, string[]>;
  /** آیا هیچ خطایی نیست */
  valid: boolean;
}

export function validateBlocks(blocks: readonly StoredBlock[]): BlocksValidation {
  const global: string[] = [];
  const byIndex: Record<number, string[]> = {};

  if (blocks.length > MAX_BLOCKS) global.push(`حداکثر ${MAX_BLOCKS} بلاک در هر صفحه مجاز است`);

  blocks.forEach((block, i) => {
    const errors = validateBlock(block);
    if (errors.length) byIndex[i] = errors;
  });

  return { global, byIndex, valid: global.length === 0 && Object.keys(byIndex).length === 0 };
}

const textOrNull = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

/** شکل نهایی بلاک برای ارسال به API (همان چیزی که سرور نرمال می‌کند) */
export function normalizeBlock(block: StoredBlock): StoredBlock {
  switch (block.type) {
    case 'hero': {
      const p = block.props;
      return {
        id: block.id,
        type: 'hero',
        props: {
          title: p.title.trim(),
          subtitle: textOrNull(p.subtitle),
          align: p.align,
          ctaLabel: textOrNull(p.ctaLabel),
          ctaHref: textOrNull(p.ctaHref),
          imageId: p.imageId,
        },
      };
    }
    case 'product-grid': {
      const p = block.props;
      return {
        id: block.id,
        type: 'product-grid',
        props: {
          title: textOrNull(p.title),
          source: p.source,
          categorySlug: p.source === 'category' ? (textOrNull(p.categorySlug)?.toLowerCase() ?? null) : null,
          limit: Number(p.limit),
          columns: Number(p.columns) as GridColumns,
        },
      };
    }
    case 'rich-text':
      return {
        id: block.id,
        type: 'rich-text',
        props: { content: block.props.content.replace(/\r\n?/g, '\n'), align: block.props.align },
      };
  }
}

/** امضای محتوا برای تشخیص «تغییر ذخیره‌نشده»؛ فاصله‌ی اضافه تغییر حساب نمی‌شود */
export function contentSignature(title: string, blocks: readonly StoredBlock[]): string {
  return JSON.stringify([title.trim(), blocks.map(normalizeBlock)]);
}

/** خلاصه‌ی یک خطی بلاک برای سرتیتر کارت */
export function blockSummary(block: StoredBlock): string {
  switch (block.type) {
    case 'hero':
      return block.props.title.trim();
    case 'product-grid':
      return (block.props.title ?? '').trim() || (block.props.source === 'category' ? 'محصولات یک دسته' : 'جدیدترین محصولات');
    case 'rich-text': {
      const line = block.props.content.split('\n').find((l) => l.trim()) ?? '';
      const text = line.replace(/^(#{1,2}\s+|[-•]\s+)/, '').trim();
      return text.length > 40 ? `${text.slice(0, 40)}…` : text;
    }
  }
}