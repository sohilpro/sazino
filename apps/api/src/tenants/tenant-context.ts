import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type { TenantInfo, TenantStore } from './tenant.types';
import { TenantContextMissingError } from './tenant-scope';

@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  /**
   * fn را داخل یک context اجرا می‌کند.
   * await داخل wrapper عمدی است: کوئری‌های Prisma تنبل‌اند و باید داخل همین context اجرا شوند.
   */
  run<T>(store: TenantStore, fn: () => PromiseLike<T> | T): Promise<T> {
    return this.storage.run(store, async () => await fn());
  }

  /** برای jobهای پس‌زمینه، اسکریپت‌ها و تست‌ها */
  runAs<T>(tenantId: string, fn: () => PromiseLike<T> | T): Promise<T> {
    return this.run({ tenantId, source: 'system' }, fn);
  }

  get tenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }

  get tenant(): TenantInfo | undefined {
    return this.storage.getStore()?.tenant;
  }

  /** اگر tenant مشخص نباشد خطا می‌دهد (fail-closed) */
  require(): string {
    const id = this.tenantId;
    if (!id) throw new TenantContextMissingError();
    return id;
  }

  /** توسط JwtAuthGuard صدا زده می‌شود */
  bindAuthTenant(tenantId: string): void {
    const store = this.storage.getStore();
    if (!store) return;
    if (store.tenantId && store.tenantId !== tenantId) {
      throw new ForbiddenException('این توکن متعلق به فروشگاه دیگری است');
    }
    if (!store.tenantId) {
      store.tenantId = tenantId;
      store.source = 'auth';
    }
  }
}