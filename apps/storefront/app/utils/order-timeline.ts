import type { OrderDto } from '@myapp/shared-types';

export type TimelineState = 'done' | 'current' | 'todo' | 'canceled';

export interface TimelineStep {
  key: 'created' | 'paid' | 'shipped' | 'canceled';
  label: string;
  at: string | null;
  state: TimelineState;
}

type TimelineInput = Pick<OrderDto, 'status' | 'createdAt' | 'paidAt' | 'shippedAt' | 'canceledAt'>;

/** خط زمانی سفارش: ثبت ← پرداخت ← ارسال، یا ثبت ← (پرداخت) ← لغو */
export function buildOrderTimeline(o: TimelineInput): TimelineStep[] {
  const created: TimelineStep = { key: 'created', label: 'ثبت سفارش', at: o.createdAt, state: 'done' };

  if (o.status === 'CANCELED') {
    const steps = [created];
    if (o.paidAt) steps.push({ key: 'paid', label: 'پرداخت', at: o.paidAt, state: 'done' });
    steps.push({ key: 'canceled', label: 'لغو شد', at: o.canceledAt, state: 'canceled' });
    return steps;
  }

  return [
    created,
    { key: 'paid', label: 'پرداخت', at: o.paidAt, state: o.paidAt ? 'done' : 'current' },
    {
      key: 'shipped',
      label: 'ارسال',
      at: o.shippedAt,
      state: o.shippedAt ? 'done' : o.paidAt ? 'current' : 'todo',
    },
  ];
}
