import type { CategoryDto, ProductDto, ProductStatus, VariantDto } from '@myapp/shared-types';

export interface CategoryRow {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toCategoryDto(row: CategoryRow, productCount?: number): CategoryDto {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    position: row.position,
    ...(productCount === undefined ? {} : { productCount }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface VariantRow {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  position: number;
  inventory: { quantity: number; allowBackorder: boolean } | null;
}

export interface ProductRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  minPrice: number;
  maxPrice: number;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; slug: string } | null;
  variants: VariantRow[];
}

export function toProductDto(row: ProductRow, opts: { exposeStock: boolean }): ProductDto {
  const variants = row.variants.map((v): VariantDto => {
    const quantity = v.inventory?.quantity ?? 0;
    const allowBackorder = v.inventory?.allowBackorder ?? false;
    return {
      id: v.id,
      title: v.title,
      sku: v.sku,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      position: v.position,
      inStock: quantity > 0 || allowBackorder,
      ...(opts.exposeStock ? { quantity, allowBackorder } : {}),
    };
  });

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    status: row.status,
    category: row.category,
    minPrice: row.minPrice,
    maxPrice: row.maxPrice,
    inStock: variants.some((v) => v.inStock),
    variants,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}