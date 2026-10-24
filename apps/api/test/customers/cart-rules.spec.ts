import { itemIssue, stockLimit } from '../../src/customers/cart.rules';

describe('stockLimit', () => {
  it('is zero without inventory or stock', () => {
    expect(stockLimit(null)).toBe(0);
    expect(stockLimit({ quantity: 0, allowBackorder: false })).toBe(0);
    expect(stockLimit({ quantity: -3, allowBackorder: false })).toBe(0);
  });

  it('is the stock, capped at 20', () => {
    expect(stockLimit({ quantity: 5, allowBackorder: false })).toBe(5);
    expect(stockLimit({ quantity: 500, allowBackorder: false })).toBe(20);
  });

  it('allows the cap when backorder is on', () => {
    expect(stockLimit({ quantity: 0, allowBackorder: true })).toBe(20);
  });
});

describe('itemIssue', () => {
  it('flags inactive products first', () => {
    expect(itemIssue({ productStatus: 'ARCHIVED', quantity: 1, limit: 5 })).toBe('UNAVAILABLE');
    expect(itemIssue({ productStatus: 'DRAFT', quantity: 1, limit: 0 })).toBe('UNAVAILABLE');
  });

  it('flags out-of-stock and insufficient stock', () => {
    expect(itemIssue({ productStatus: 'ACTIVE', quantity: 1, limit: 0 })).toBe('OUT_OF_STOCK');
    expect(itemIssue({ productStatus: 'ACTIVE', quantity: 4, limit: 3 })).toBe('INSUFFICIENT_STOCK');
  });

  it('has no issue when everything is fine', () => {
    expect(itemIssue({ productStatus: 'ACTIVE', quantity: 3, limit: 3 })).toBeNull();
  });
});