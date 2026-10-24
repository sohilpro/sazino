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
