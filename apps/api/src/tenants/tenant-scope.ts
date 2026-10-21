/** مدل‌هایی که ستون tenantId دارند. با اضافه‌شدن هر مدل جدید با tenantId باید اینجا هم اضافه شود (تست این را اجبار می‌کند) */
export const SCOPED_MODELS = ['User', 'Domain'] as const;

/** خود Tenant؛ روی کلاینت tenant فقط خواندنِ رکورد خودش مجاز است */
export const ROOT_MODELS = ['Tenant'] as const;

/** فقط با PrismaService (دسترسی سیستمی) قابل استفاده‌اند */
export const SYSTEM_ONLY_MODELS = ['RefreshToken'] as const;

export type ModelKind = 'scoped' | 'root' | 'system';

export function classifyModel(model: string): ModelKind | undefined {
  if ((SCOPED_MODELS as readonly string[]).includes(model)) return 'scoped';
  if ((ROOT_MODELS as readonly string[]).includes(model)) return 'root';
  if ((SYSTEM_ONLY_MODELS as readonly string[]).includes(model)) return 'system';
  return undefined;
}

export class TenantContextMissingError extends Error {
  constructor() {
    super(
      'Tenant context is missing: scoped database access needs a tenant (request host, JWT, or TenantContext.runAs)',
    );
    this.name = 'TenantContextMissingError';
  }
}

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(`Tenant scope violation: ${message}`);
    this.name = 'TenantScopeError';
  }
}