export const NOTIFICATIONS_QUEUE = 'notifications';

export const NOTIFICATION_JOB = {
  PAID_CUSTOMER_SMS: 'paid-customer-sms',
  PAID_SELLER_EMAIL: 'paid-seller-email',
  SHIPPED_CUSTOMER_SMS: 'shipped-customer-sms',
} as const;

export interface NotificationJob {
  tenantId: string;
  orderId: string;
}