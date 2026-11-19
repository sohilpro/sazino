import { describe, expect, it } from 'vitest';
import { buildOrderTimeline } from '../app/utils/order-timeline';

const base = {
  createdAt: '2026-11-01T10:00:00Z',
  paidAt: null,
  shippedAt: null,
  canceledAt: null,
};

describe('buildOrderTimeline', () => {
  it('pending order: payment is the current step', () => {
    const steps = buildOrderTimeline({ ...base, status: 'PENDING' });
    expect(steps.map((s) => s.state)).toEqual(['done', 'current', 'todo']);
  });

  it('paid order: shipping is the current step', () => {
    const steps = buildOrderTimeline({ ...base, status: 'PAID', paidAt: '2026-11-01T10:05:00Z' });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current']);
  });

  it('shipped order: everything is done', () => {
    const steps = buildOrderTimeline({
      ...base,
      status: 'SHIPPED',
      paidAt: '2026-11-01T10:05:00Z',
      shippedAt: '2026-11-02T09:00:00Z',
    });
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'done']);
  });

  it('canceled before payment skips the payment step', () => {
    const steps = buildOrderTimeline({ ...base, status: 'CANCELED', canceledAt: '2026-11-01T10:40:00Z' });
    expect(steps.map((s) => s.key)).toEqual(['created', 'canceled']);
    expect(steps[1]!.state).toBe('canceled');
  });

  it('canceled after payment keeps the payment step', () => {
    const steps = buildOrderTimeline({
      ...base,
      status: 'CANCELED',
      paidAt: '2026-11-01T10:05:00Z',
      canceledAt: '2026-11-01T12:00:00Z',
    });
    expect(steps.map((s) => s.key)).toEqual(['created', 'paid', 'canceled']);
  });
});
