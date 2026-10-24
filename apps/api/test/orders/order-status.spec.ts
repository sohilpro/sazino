import { canTransition, restoresStock } from '../../src/orders/order-status';

describe('order status machine', () => {
  it('allows the normal flow', () => {
    expect(canTransition('PENDING', 'PAID')).toBe(true);
    expect(canTransition('PENDING', 'CANCELED')).toBe(true);
    expect(canTransition('PAID', 'SHIPPED')).toBe(true);
    expect(canTransition('PAID', 'CANCELED')).toBe(true);
  });

  it('rejects everything else', () => {
    for (const [from, to] of [
      ['PENDING', 'SHIPPED'],
      ['PAID', 'PENDING'],
      ['SHIPPED', 'CANCELED'],
      ['SHIPPED', 'PAID'],
      ['CANCELED', 'PAID'],
      ['CANCELED', 'PENDING'],
      ['PENDING', 'PENDING'],
    ] as const) {
      expect(canTransition(from, to)).toBe(false);
    }
  });

  it('gives stock back only when an unshipped order is canceled', () => {
    expect(restoresStock('PENDING', 'CANCELED')).toBe(true);
    expect(restoresStock('PAID', 'CANCELED')).toBe(true);
    expect(restoresStock('PENDING', 'PAID')).toBe(false);
    expect(restoresStock('PAID', 'SHIPPED')).toBe(false);
  });
});