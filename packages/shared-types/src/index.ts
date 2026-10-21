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

/** اطلاعات عمومی فروشگاه برای ویترین */
export interface StoreInfo {
  id: string;
  name: string;
  subdomain: string;
}