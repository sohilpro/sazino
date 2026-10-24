import { Injectable } from '@nestjs/common';
import type { Customer } from '../generated/prisma/client';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { SESSION_TTL_DAYS } from './customers.constants';
import { hashToken, newToken } from './token';

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class CustomerSessionService {
  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
  ) {}

  async create(customerId: string, meta: SessionMeta) {
    const tenantId = this.ctx.require();
    const token = newToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.db.customerSession.create({
      data: {
        tenantId,
        customerId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });
    return { token, expiresAt };
  }

  /** کلاینت tenant: توکن فروشگاه دیگر هرگز مشتری برنمی‌گرداند */
  async resolve(token: string | undefined): Promise<Customer | null> {
    if (!token) return null;
    const session = await this.db.customerSession.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
      select: { customer: true },
    });
    return session?.customer ?? null;
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.db.customerSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
}