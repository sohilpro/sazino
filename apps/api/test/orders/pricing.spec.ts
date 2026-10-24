import { computeTotals } from '../../src/orders/pricing';

const rule = { fee: 50_000, freeThreshold: null };

describe('computeTotals', () => {
  it('multiplies by quantity and adds shipping', () => {
    const t = computeTotals(
      [
        { unitPrice: 100_000, quantity: 2 },
        { unitPrice: 30_000, quantity: 1 },
      ],
      rule,
    );
    expect(t).toEqual({ subtotal: 230_000, shippingFee: 50_000, total: 280_000, freeShipping: false });
  });

  it('makes shipping free from the threshold (inclusive)', () => {
    const free = { fee: 50_000, freeThreshold: 500_000 };
    expect(computeTotals([{ unitPrice: 499_999, quantity: 1 }], free).shippingFee).toBe(50_000);

    const atThreshold = computeTotals([{ unitPrice: 250_000, quantity: 2 }], free);
    expect(atThreshold).toMatchObject({ shippingFee: 0, total: 500_000, freeShipping: true });
  });

  it('never reports free shipping for a method that was free anyway', () => {
    const t = computeTotals([{ unitPrice: 1000, quantity: 1 }], { fee: 0, freeThreshold: 500 });
    expect(t).toMatchObject({ shippingFee: 0, freeShipping: false });
  });

  it('is all zeros without lines', () => {
    expect(computeTotals([], rule)).toEqual({ subtotal: 0, shippingFee: 0, total: 0, freeShipping: false });
  });
});