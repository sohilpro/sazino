import type { UserRole } from '@myapp/shared-types';

export interface JwtPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
}

/** چیزی که JwtAuthGuard روی req.user می‌گذارد */
export interface RequestUser {
  id: string;
  tenantId: string;
  role: UserRole;
}

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}