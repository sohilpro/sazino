import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload, RequestMeta } from './types';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  signAccessToken(user: { id: string; tenantId: string; role: JwtPayload['role'] }) {
    const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId, role: user.role };
    return this.jwt.signAsync(payload);
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** یک refresh token جدید می‌سازد؛ مقدار خام فقط همین‌جا در دسترس است و در DB هش آن ذخیره می‌شود */
  async createRefreshToken(userId: string, meta: RequestMeta, familyId: string = randomUUID()) {
    const token = randomBytes(48).toString('base64url');
    const days = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: this.hashToken(token),
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return { token, expiresAt };
  }

  /** همه‌ی توکن‌های فعال یک نشست را باطل می‌کند */
  async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}