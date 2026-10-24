import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type {
  AuthSession,
  AuthTenant,
  AuthUser,
  MeResponse,
  SubdomainAvailability,
} from '@myapp/shared-types';
import type { Tenant, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RESERVED_SUBDOMAINS, SUBDOMAIN_REGEX } from '../tenants/subdomain';
import { BCRYPT_ROUNDS, MAX_PASSWORD_BYTES } from './auth.constants';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';
import type { RequestMeta } from './types';
import { TenantResolver } from '../tenants/tenant-resolver';

export interface AuthResult {
  session: AuthSession;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  /** برای یکسان‌سازی زمان پاسخ وقتی ایمیل وجود ندارد (جلوگیری از user enumeration) */
  private readonly dummyHash = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly tenantResolver: TenantResolver,
  ) {}

  // ───────────── ثبت‌نام ─────────────
  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResult> {
    if (Buffer.byteLength(dto.password, 'utf8') > MAX_PASSWORD_BYTES) {
      throw new BadRequestException('رمز عبور بیش از حد طولانی است');
    }

    const availability = await this.checkSubdomain(dto.subdomain);
    if (!availability.available) {
      if (availability.reason === 'taken') {
        throw new ConflictException('این ساب‌دامین قبلاً گرفته شده است');
      }
      throw new BadRequestException('این ساب‌دامین مجاز نیست');
    }

    const emailTaken = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (emailTaken) throw new ConflictException('این ایمیل قبلاً ثبت‌نام کرده است');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const { tenant, user } = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: dto.storeName, subdomain: dto.subdomain },
        });
        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: dto.email,
            name: dto.name,
            passwordHash,
            role: 'OWNER',
          },
        });
        // فروشگاه تازه‌ساخته با یک روش ارسال پیش‌فرض شروع می‌کند؛ فروشنده بعداً ویرایشش می‌کند
        await tx.shippingMethod.create({
          data: { tenantId: tenant.id, title: 'ارسال پیش‌فرض', fee: 50_000, position: 0 },
        });
        return { tenant, user };
      });

      // اگر قبلاً این ساب‌دامین در کش منفی ثبت شده، فوراً پاکش کن
      await this.tenantResolver.invalidateSubdomain(dto.subdomain);

      return this.issue(user, tenant, meta);
    } catch (err) {
      // رقابت هم‌زمان: بین بررسی و ساخت، کس دیگری همین مقدار را گرفته
      if ((err as { code?: string }).code === 'P2002') {
        throw new ConflictException('ساب‌دامین یا ایمیل قبلاً استفاده شده است');
      }
      throw err;
    }
  }

  // ───────────── ورود ─────────────
  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !valid) throw new UnauthorizedException('ایمیل یا رمز عبور اشتباه است');

    this.assertAccountUsable(user, user.tenant);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issue(user, user.tenant, meta);
  }

  // ───────────── تمدید نشست ─────────────
  async refresh(rawToken: string | undefined, meta: RequestMeta): Promise<AuthResult> {
    const invalid = () => new UnauthorizedException('نشست نامعتبر است، دوباره وارد شوید');
    if (!rawToken) throw invalid();

    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(rawToken) },
      include: { user: { include: { tenant: true } } },
    });
    if (!record) throw invalid();

    // استفاده‌ی دوباره از توکن باطل‌شده = احتمال سرقت؛ کل نشست باطل می‌شود
    if (record.revokedAt) {
      await this.tokens.revokeFamily(record.familyId);
      throw invalid();
    }
    if (record.expiresAt <= new Date()) throw invalid();

    const { user } = record;
    if (!user.isActive || user.tenant.status !== 'ACTIVE') {
      await this.tokens.revokeFamily(record.familyId);
      throw invalid();
    }

    // claim اتمیک: اگر دو درخواست هم‌زمان بیایند فقط یکی موفق می‌شود
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) {
      await this.tokens.revokeFamily(record.familyId);
      throw invalid();
    }

    const next = await this.tokens.createRefreshToken(user.id, meta, record.familyId);
    return {
      session: await this.buildSession(user, user.tenant),
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
    };
  }

  // ───────────── خروج ─────────────
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashToken(rawToken) },
      select: { familyId: true },
    });
    if (record) await this.tokens.revokeFamily(record.familyId);
  }

  // ───────────── کاربر فعلی ─────────────
  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user) throw new UnauthorizedException();
    return { user: this.toAuthUser(user), tenant: this.toAuthTenant(user.tenant) };
  }

  // ───────────── ساب‌دامین ─────────────
  async checkSubdomain(subdomain: string): Promise<SubdomainAvailability> {
    if (!SUBDOMAIN_REGEX.test(subdomain)) return { available: false, reason: 'invalid' };
    if (RESERVED_SUBDOMAINS.has(subdomain)) return { available: false, reason: 'reserved' };

    const exists = await this.prisma.tenant.findUnique({
      where: { subdomain },
      select: { id: true },
    });
    return exists ? { available: false, reason: 'taken' } : { available: true };
  }

  // ───────────── کمکی‌ها ─────────────
  private assertAccountUsable(user: User, tenant: Tenant) {
    if (!user.isActive) throw new ForbiddenException('حساب کاربری شما غیرفعال است');
    if (tenant.status !== 'ACTIVE') throw new ForbiddenException('فروشگاه شما تعلیق شده است');
  }

  /** نشست جدید (family جدید) می‌سازد */
  private async issue(user: User, tenant: Tenant, meta: RequestMeta): Promise<AuthResult> {
    const refresh = await this.tokens.createRefreshToken(user.id, meta);
    return {
      session: await this.buildSession(user, tenant),
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  private async buildSession(user: User, tenant: Tenant): Promise<AuthSession> {
    return {
      accessToken: await this.tokens.signAccessToken(user),
      expiresIn: this.tokens.accessTtlSeconds,
      user: this.toAuthUser(user),
      tenant: this.toAuthTenant(tenant),
    };
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    };
  }

  private toAuthTenant(tenant: Tenant): AuthTenant {
    return {
      id: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      plan: tenant.plan,
      status: tenant.status,
    };
  }
}
