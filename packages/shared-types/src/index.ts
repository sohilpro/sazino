export type UserRole = 'OWNER' | 'ADMIN' | 'EDITOR';

export type TenantPlan = 'FREE' | 'BASIC' | 'PRO';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED';

export type DomainStatus = 'PENDING' | 'VERIFIED' | 'FAILED';

export type ServiceStatus = 'up' | 'down';

export interface ServiceCheck {
  status: ServiceStatus;
  latencyMs: number;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: ServiceCheck;
    redis: ServiceCheck;
    storage: ServiceCheck;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
}

export interface AuthTenant {
  id: string;
  name: string;
  subdomain: string;
  plan: TenantPlan;
  status: TenantStatus;
}

export interface AuthSession {
  accessToken: string;
  /** عمر access token به ثانیه */
  expiresIn: number;
  user: AuthUser;
  tenant: AuthTenant;
}

export interface MeResponse {
  user: AuthUser;
  tenant: AuthTenant;
}

export interface SubdomainAvailability {
  available: boolean;
  reason?: 'invalid' | 'reserved' | 'taken';
}

export interface StoreTheme {
  /** همیشه با فرمت #rrggbb (حروف کوچک) */
  primaryColor: string;
}

/** اطلاعات عمومی فروشگاه برای ویترین */
export interface StoreInfo {
  id: string;
  name: string;
  subdomain: string;
  description: string | null;
  logoUrl: string | null;
  theme: StoreTheme;
}

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

export interface CategoryRefDto {
  id: string;
  name: string;
  slug: string;
}

export interface CategoryDto {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  /** در پنل همه‌ی محصولات، در ویترین فقط ACTIVE */
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryDetailDto {
  category: CategoryDto;
  parent: CategoryRefDto | null;
  children: CategoryDto[];
}

export interface VariantDto {
  id: string;
  title: string;
  sku: string | null;
  price: number;
  compareAtPrice: number | null;
  position: number;
  inStock: boolean;
  /** فقط در پنل (ویترین نمی‌بیند) */
  quantity?: number;
  allowBackorder?: boolean;
}

export interface ProductDto {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: ProductStatus;
  category: CategoryRefDto | null;
  minPrice: number;
  maxPrice: number;
  inStock: boolean;
  variants: VariantDto[];
  images: ImageDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ImageUrls {
  /** مربع ۲۰۰×۲۰۰ */
  thumb: string;
  /** عرض ۴۸۰ */
  sm: string;
  /** عرض ۹۶۰ */
  md: string;
  /** عرض ۱۶۰۰ */
  lg: string;
}

export interface ImageDto {
  id: string;
  alt: string | null;
  width: number;
  height: number;
  urls: ImageUrls;
}

export interface MediaDto extends ImageDto {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface CustomerDto {
  id: string;
  phone: string;
  name: string | null;
  createdAt: string;
}

export interface CustomerSessionResponse {
  customer: CustomerDto | null;
}

export interface OtpRequestResponse {
  /** عمر کد (ثانیه) */
  expiresIn: number;
  /** زمان انتظار تا درخواست مجدد (ثانیه) */
  resendIn: number;
}

export type CartItemIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export interface CartItemDto {
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  /** حداکثر تعداد قابل سفارش (موجودی و سقف ۲۰) */
  maxQuantity: number;
  issue: CartItemIssue | null;
}

export interface CartDto {
  items: CartItemDto[];
  /** مجموع تعداد همه‌ی آیتم‌ها */
  itemCount: number;
  /** جمع آیتم‌های بدون مشکل */
  subtotal: number;
  hasIssues: boolean;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELED';

export interface AddressDto {
  id: string;
  recipientName: string;
  recipientPhone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  isDefault: boolean;
}

export interface ShippingMethodDto {
  id: string;
  title: string;
  description: string | null;
  fee: number;
  /** جمع سفارش برای ارسال رایگان؛ null = بدون ارسال رایگان */
  freeThreshold: number | null;
}

export interface SellerShippingMethodDto extends ShippingMethodDto {
  isActive: boolean;
  position: number;
}

export interface CheckoutQuoteDto {
  itemCount: number;
  subtotal: number;
  shippingFee: number;
  total: number;
  /** ارسال به‌خاطر رسیدن به آستانه رایگان شده است */
  freeShipping: boolean;
  /** سبد کالای ناموجود یا غیرفعال دارد */
  hasIssues: boolean;
}

export interface OrderItemDto {
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderAddressDto {
  recipientName: string;
  recipientPhone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
}

export interface OrderDto {
  id: string;
  number: number;
  status: OrderStatus;
  items: OrderItemDto[];
  subtotal: number;
  shippingFee: number;
  shippingTitle: string;
  total: number;
  address: OrderAddressDto;
  note: string | null;
  trackingCode: string | null;
  /** رسید پرداخت (فقط وقتی پرداخت تأیید شده) */
  payment: { refId: string | null; cardPan: string | null } | null;
  /** CUSTOMER | EXPIRED | SELLER */
  cancelReason: string | null;
  expiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  canceledAt: string | null;
}

export interface OrderSummaryDto {
  id: string;
  number: number;
  status: OrderStatus;
  total: number;
  itemCount: number;
  /** حداکثر ۳ تصویر کوچک */
  thumbs: string[];
  createdAt: string;
}

export interface PaymentGatewayDto {
  provider: 'ZARINPAL';
  configured: boolean;
  isActive: boolean;
  /** ۴ کاراکتر آخر شناسه‌ی پذیرنده */
  merchantHint: string | null;
}

export interface StartPaymentResponse {
  /** آدرس صفحه‌ی پرداخت درگاه؛ مرورگر باید به آن برود */
  paymentUrl: string;
}

export type PaymentOutcome = 'PAID' | 'FAILED' | 'PENDING_CHECK' | 'NOT_PAYABLE';

export interface PaymentOutcomeDto {
  outcome: PaymentOutcome;
  orderNumber: number;
}
