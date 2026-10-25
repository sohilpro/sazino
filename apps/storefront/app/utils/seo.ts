import type { ProductDto } from '@myapp/shared-types';

export interface Crumb {
  label: string;
  /** مسیر داخلی؛ آیتم آخر (صفحه‌ی فعلی) لینک ندارد */
  to?: string;
}

/** قیمت‌ها به تومان‌اند؛ schema.org کد ارز ISO 4217 می‌خواهد و ریال (IRR) معتبر است */
export const TOMAN_TO_RIAL = 10;
export const SCHEMA_CURRENCY = 'IRR';

const rial = (toman: number) => String(toman * TOMAN_TO_RIAL);
const availability = (inStock: boolean) =>
  `https://schema.org/${inStock ? 'InStock' : 'OutOfStock'}`;

/** متن ساده‌شده و کوتاه‌شده (برای meta description) */
export function plainText(input: string | null | undefined, max = 160): string {
  const text = (input ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * JSON را برای قرارگرفتن داخل <script> امن می‌کند: بدون این، عنوانی مثل
 * "</script><script>..." تگ را می‌بندد و کد تزریق می‌شود.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function jsonLdScript(data: unknown) {
  return {
    type: 'application/ld+json' as const,
    innerHTML: serializeJsonLd(data),
    key: 'json-ld',
  };
}

export function jsonLdGraph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export function productJsonLd(p: ProductDto, ctx: { url: string; storeName: string }) {
  const many = p.variants.length > 1;

  const offerOf = (v: ProductDto['variants'][number]) => ({
    '@type': 'Offer',
    url: ctx.url,
    ...(many ? { name: v.title } : {}),
    ...(v.sku ? { sku: v.sku } : {}),
    priceCurrency: SCHEMA_CURRENCY,
    price: rial(v.price),
    availability: availability(v.inStock),
    itemCondition: 'https://schema.org/NewCondition',
  });

  let offers: object | undefined;
  if (p.variants.length === 1) {
    offers = offerOf(p.variants[0]!);
  } else if (many) {
    offers = {
      '@type': 'AggregateOffer',
      priceCurrency: SCHEMA_CURRENCY,
      lowPrice: rial(p.minPrice),
      highPrice: rial(p.maxPrice),
      offerCount: p.variants.length,
      availability: availability(p.inStock),
      offers: p.variants.map(offerOf),
    };
  }

  const description = plainText(p.description, 1000);
  const onlySku = p.variants.length === 1 ? p.variants[0]!.sku : null;

  return {
    '@type': 'Product',
    name: p.title,
    url: ctx.url,
    ...(description ? { description } : {}),
    ...(p.images.length ? { image: p.images.map((i) => i.urls.lg) } : {}),
    ...(onlySku ? { sku: onlySku } : {}),
    ...(p.category ? { category: p.category.name } : {}),
    brand: { '@type': 'Brand', name: ctx.storeName },
    ...(offers ? { offers } : {}),
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}