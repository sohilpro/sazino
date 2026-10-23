import { describe, expect, it } from 'vitest';
import type { CategoryDto, ProductDto } from '@myapp/shared-types';
import { contrastColor, safeColor } from '../app/utils/theme';
import { discountInfo, variantDiscount, visibleRootCategories } from '../app/utils/product';
import { firstQuery, mergeQuery } from '../app/utils/query';

describe('theme', () => {
  it('accepts only #rrggbb colors', () => {
    expect(safeColor('#E11D48')).toBe('#e11d48');
    expect(safeColor('red;} body{display:none')).toBe('#4f46e5');
    expect(safeColor('#fff')).toBe('#4f46e5');
    expect(safeColor(undefined)).toBe('#4f46e5');
  });

  it('picks a readable text color', () => {
    expect(contrastColor('#ffffff')).toBe('#111827');
    expect(contrastColor('#facc15')).toBe('#111827');
    expect(contrastColor('#000000')).toBe('#ffffff');
    expect(contrastColor('#4f46e5')).toBe('#ffffff');
  });
});

describe('discounts', () => {
  it('computes the percentage from the compare-at price', () => {
    expect(variantDiscount({ price: 1_200_000, compareAtPrice: 1_500_000 })).toEqual({
      percent: 20,
      compareAt: 1_500_000,
    });
  });

  it('ignores missing, equal or tiny discounts', () => {
    expect(variantDiscount({ price: 100, compareAtPrice: null })).toBeNull();
    expect(variantDiscount({ price: 100, compareAtPrice: 100 })).toBeNull();
    expect(variantDiscount({ price: 100_000, compareAtPrice: 100_001 })).toBeNull();
  });

  it('uses the cheapest variant for a product', () => {
    const p = {
      variants: [
        { price: 500, compareAtPrice: null },
        { price: 400, compareAtPrice: 500 },
      ],
    } as unknown as ProductDto;
    expect(discountInfo(p)).toEqual({ percent: 20, compareAt: 500 });
  });
});

describe('visibleRootCategories', () => {
  const cat = (id: string, parentId: string | null, productCount: number) =>
    ({ id, parentId, name: id, slug: id, productCount }) as CategoryDto;

  it('shows roots that have products directly or through a child', () => {
    const all = [
      cat('a', null, 2),
      cat('b', null, 0),
      cat('b1', 'b', 3),
      cat('c', null, 0),
      cat('c1', 'c', 0),
    ];
    expect(visibleRootCategories(all).map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('query helpers', () => {
  it('reads the first string value', () => {
    expect(firstQuery('a')).toBe('a');
    expect(firstQuery(['x', 'y'])).toBe('x');
    expect(firstQuery(undefined)).toBe('');
    expect(firstQuery(null)).toBe('');
  });

  it('merges and removes keys', () => {
    expect(mergeQuery({ q: 'x', page: '3' }, { page: undefined, sort: 'title' })).toEqual({
      q: 'x',
      sort: 'title',
    });
    expect(mergeQuery({ q: 'x' }, { q: '' })).toEqual({});
    expect(mergeQuery({}, { page: 2 })).toEqual({ page: '2' });
  });
});