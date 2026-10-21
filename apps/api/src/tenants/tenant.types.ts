import type { TenantPlan, TenantStatus } from '@myapp/shared-types';

export interface TenantInfo {
  id: string;
  name: string;
  subdomain: string;
  plan: TenantPlan;
  status: TenantStatus;
}

export type HostResolution =
  | { type: 'tenant'; tenant: TenantInfo }
  /** میزبان خود پلتفرم (api / app / localhost / IP)؛ بدون tenant */
  | { type: 'platform' }
  /** شبیه آدرس فروشگاه است ولی فروشگاهی با این آدرس نداریم */
  | { type: 'not_found' };

export interface TenantStore {
  tenantId?: string;
  tenant?: TenantInfo;
  source?: 'host' | 'auth' | 'system';
}