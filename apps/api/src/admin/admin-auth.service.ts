import { Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { AdminDto } from '@myapp/shared-types';
import type { PlatformAdmin } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginLimiter } from './admin-login-limiter';
import { ADMIN_SESSION_TTL_MS } from './admin.constants';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const toAdminDto = (a: Pick<PlatformAdmin, 'id' | 'email' | 'name'>): AdminDto => ({
  id: a.id,
  email: a.email,
  name: a.name,
});

@Injectable()
export class AdminAuthService {
  /** برای یکسان‌سازی زمان پاسخ وقتی ایمیل وجود ندارد */
  private readonly dummyHash = bcrypt.hashSync('dummy-password-for-timing', 12);

  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: AdminLoginLimiter,
  ) {}

  async login(
    email: string,
    password: string,
    meta: { ip: string; userAgent?: string },
  ): Promise<{ token: string; admin: AdminDto }> {
    await this.limiter.assertAllowed(email, meta.ip);

    const admin = await this.prisma.platformAdmin.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, admin?.passwordHash ?? this.dummyHash);

    if (!admin || !admin.isActive || !valid) {
      await this.limiter.recordFailure(email, meta.ip);
      throw new UnauthorizedException('ایمیل یا رمز عبور اشتباه است');
    }
    await this.limiter.reset(email, meta.ip);

    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.adminSession.create({
        data: {
          adminId: admin.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      }),
      this.prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
    ]);

    return { token, admin: toAdminDto(admin) };
  }

  /** ادمین فعالِ صاحب این نشست؛ نشست منقضی یا ادمین غیرفعال = null */
  async resolve(token: string | undefined): Promise<PlatformAdmin | null> {
    if (!token) return null;
    const session = await this.prisma.adminSession.findFirst({
      where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() }, admin: { is: { isActive: true } } },
      include: { admin: true },
    });
    return session?.admin ?? null;
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
}