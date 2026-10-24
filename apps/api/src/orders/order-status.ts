import type { OrderStatus } from '@myapp/shared-types';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELED'],
  PAID: ['SHIPPED', 'CANCELED'],
  SHIPPED: [],
  CANCELED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);

/** لغو سفارش (پرداخت‌نشده یا پرداخت‌شده ولی ارسال‌نشده) موجودی نگه‌داشته‌شده را برمی‌گرداند */
export const restoresStock = (from: OrderStatus, to: OrderStatus) =>
  to === 'CANCELED' && (from === 'PENDING' || from === 'PAID');