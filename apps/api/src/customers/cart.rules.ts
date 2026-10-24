import type { CartItemIssue } from '@myapp/shared-types';
import { MAX_LINE_QUANTITY } from './customers.constants';

export interface StockInfo {
  quantity: number;
  allowBackorder: boolean;
}

/** حداکثر تعداد قابل سفارش از یک تنوع: ۰ یعنی ناموجود */
export function stockLimit(inventory: StockInfo | null | undefined): number {
  if (!inventory) return 0;
  return inventory.allowBackorder
    ? MAX_LINE_QUANTITY
    : Math.max(0, Math.min(inventory.quantity, MAX_LINE_QUANTITY));
}

export function itemIssue(args: {
  productStatus: string;
  quantity: number;
  limit: number;
}): CartItemIssue | null {
  if (args.productStatus !== 'ACTIVE') return 'UNAVAILABLE';
  if (args.limit <= 0) return 'OUT_OF_STOCK';
  if (args.quantity > args.limit) return 'INSUFFICIENT_STOCK';
  return null;
}