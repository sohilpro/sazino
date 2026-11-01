import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { DomainDto, DomainsDto, DomainVerifyDto } from '@myapp/shared-types';
import { conflict } from '../common/errors';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Env } from '../config/env';
import type { Domain } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import { TenantResolver } from '../tenants/tenant-resolver';
import { DnsUnavailableError } from './dns-lookup';
import { DomainVerifier } from './domain-verifier';
import { MAX_DOMAINS_PER_TENANT, REVALIDATE_MAX_FAILURES, VERIFY_COOLDOWN_MS } from './domains.constants';
import { HOSTNAME_ERROR_MESSAGE, normalizeCustomHostname } from './hostname';

export type RevalidateResult = 'ok' | 'failing' | 'disabled' | 'unavailable' | 'skipped';

@Injectable()
export class DomainsService {
  private readonly platformDomain: string;

  constructor(
    private readonly prisma: PrismaService,
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly verifier: DomainVerifier,
    private readonly resolver: TenantResolver,
    config: ConfigService<Env, true>,
  ) {
    this.platformDomain = config.get('PLATFORM_DOMAIN', { infer: true });
  }

  // ───────────── خواندن ─────────────
  async list(): Promise<DomainsDto> {
    const rows = await this.db.domain.findMany({
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    return { items: rows.map((d) => this.toDto(d)), limit: MAX_DOMAINS_PER_TENANT };
  }

  // ───────────── افزودن ─────────────
  async add(raw: string): Promise<DomainDto> {
    const tenantId = this.ctx.require();

    const parsed = normalizeCustomHostname(raw, this.platformDomain);
    if (!parsed.ok) throw new BadRequestException(HOSTNAME_ERROR_MESSAGE[parsed.reason]);
    const { hostname } = parsed;

    if ((await this.db.domain.count()) >= MAX_DOMAINS_PER_TENANT) {
      throw conflict('DOMAIN_LIMIT', `حداکثر ${MAX_DOMAINS_PER_TENANT} دامنه می‌توانید ثبت کنید`);
    }
    if (await this.db.domain.findFirst({ where: { hostname }, select: { id: true } })) {
      throw conflict('DOMAIN_EXISTS', 'این دامنه قبلاً در فروشگاه شما ثبت شده است');
    }

    // بررسی سراسری (بین فروشگاه‌ها): دامنه‌ی تأییدشده‌ی فروشگاه دیگر قابل ثبت نیست.
    // دامنه‌ی «در انتظار» فروشگاه دیگر مانع نیست؛ هر که TXT خودش را نشان دهد برنده است.
    const holder = await this.prisma.domain.findFirst({
      where: { verifiedHostname: hostname },
      select: { tenantId: true },
    });
    if (holder && holder.tenantId !== tenantId) throw this.taken();

    try {
      const row = await this.db.domain.create({
        data: {
          tenantId,
          hostname,
          verificationToken: randomBytes(24).toString('hex'),
        },
      });
      return this.toDto(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw conflict('DOMAIN_EXISTS', 'این دامنه قبلاً در فروشگاه شما ثبت شده است');
      }
      throw err;
    }
  }

  // ───────────── تأیید ─────────────
  async verify(id: string): Promise<DomainVerifyDto> {
    const domain = await this.find(id);

    if (domain.status === 'VERIFIED') {
      return { domain: this.toDto(domain), verified: true, checks: null, unavailable: false };
    }

    if (domain.lastCheckedAt) {
      const elapsed = Date.now() - domain.lastCheckedAt.getTime();
      if (elapsed < VERIFY_COOLDOWN_MS) {
        const retryAfter = Math.ceil((VERIFY_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          {
            statusCode: 429,
            error: 'Too Many Requests',
            message: `${retryAfter} ثانیه‌ی دیگر دوباره تلاش کنید`,
            retryAfter,
          },
          429,
        );
      }
    }

    let checks;
    try {
      checks = await this.verifier.check(domain.hostname, domain.verificationToken);
    } catch (err) {
      if (!(err instanceof DnsUnavailableError)) throw err;
      const touched = await this.touch(domain.id);
      return { domain: this.toDto(touched), verified: false, checks: null, unavailable: true };
    }

    if (!(checks.txt.ok && checks.routing.ok)) {
      const touched = await this.touch(domain.id);
      return { domain: this.toDto(touched), verified: false, checks, unavailable: false };
    }

    let updated: Domain;
    try {
      updated = await this.db.$transaction(async (tx) => {
        const hasPrimary =
          (await tx.domain.count({ where: { isPrimary: true, status: 'VERIFIED' } })) > 0;
        return tx.domain.update({
          where: { id: domain.id },
          data: {
            status: 'VERIFIED',
            verifiedAt: new Date(),
            verifiedHostname: domain.hostname,
            isPrimary: !hasPrimary,
            lastCheckedAt: new Date(),
            checkFailures: 0,
          },
        });
      });
    } catch (err) {
      // فروشگاه دیگری هم‌زمان (یا زودتر) همین دامنه را تأیید کرد
      if (isUniqueViolation(err)) throw this.taken();
      throw err;
    }

    await this.resolver.invalidateHosts([domain.hostname]);
    return { domain: this.toDto(updated), verified: true, checks, unavailable: false };
  }

  // ───────────── دامنه‌ی اصلی و حذف ─────────────
  async setPrimary(id: string): Promise<DomainDto> {
    const domain = await this.find(id);
    if (domain.status !== 'VERIFIED') {
      throw conflict('NOT_VERIFIED', 'فقط دامنه‌ی تأییدشده می‌تواند دامنه‌ی اصلی باشد');
    }

    const updated = await this.db.$transaction(async (tx) => {
      await tx.domain.updateMany({ where: { isPrimary: true, NOT: { id } }, data: { isPrimary: false } });
      return tx.domain.update({ where: { id }, data: { isPrimary: true } });
    });
    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    const domain = await this.find(id);
    await this.db.domain.deleteMany({ where: { id } });
    if (domain.isPrimary) await this.promoteNextPrimary();
    await this.resolver.invalidateHosts([domain.hostname]);
  }

  // ───────────── بررسی دوره‌ای (job روزانه) ─────────────
  /**
   * فقط مالکیت (TXT). مسیر عمداً بررسی نمی‌شود: فروشنده ممکن است بعداً پشت CDN برود.
   * خطای DNS به‌حساب شکست نمی‌آید.
   */
  async revalidate(id: string): Promise<RevalidateResult> {
    const domain = await this.db.domain.findUnique({ where: { id } });
    if (!domain || domain.status !== 'VERIFIED') return 'skipped';

    let ownership;
    try {
      ownership = await this.verifier.checkOwnership(domain.hostname, domain.verificationToken);
    } catch (err) {
      if (err instanceof DnsUnavailableError) return 'unavailable';
      throw err;
    }

    if (ownership.ok) {
      await this.db.domain.update({
        where: { id },
        data: { lastCheckedAt: new Date(), checkFailures: 0 },
      });
      return 'ok';
    }

    const failures = domain.checkFailures + 1;
    if (failures < REVALIDATE_MAX_FAILURES) {
      await this.db.domain.update({
        where: { id },
        data: { lastCheckedAt: new Date(), checkFailures: failures },
      });
      return 'failing';
    }

    await this.db.domain.update({
      where: { id },
      data: {
        status: 'FAILED',
        verifiedHostname: null,
        isPrimary: false,
        checkFailures: failures,
        lastCheckedAt: new Date(),
      },
    });
    if (domain.isPrimary) await this.promoteNextPrimary();
    await this.resolver.invalidateHosts([domain.hostname]);
    return 'disabled';
  }

  // ───────────── داخلی ─────────────
  private async find(id: string): Promise<Domain> {
    const domain = await this.db.domain.findUnique({ where: { id } });
    if (!domain) throw new NotFoundException('دامنه پیدا نشد');
    return domain;
  }

  private touch(id: string): Promise<Domain> {
    return this.db.domain.update({ where: { id }, data: { lastCheckedAt: new Date() } });
  }

  private async promoteNextPrimary(): Promise<void> {
    const next = await this.db.domain.findFirst({
      where: { status: 'VERIFIED' },
      orderBy: { verifiedAt: 'asc' },
      select: { id: true },
    });
    if (next) await this.db.domain.update({ where: { id: next.id }, data: { isPrimary: true } });
  }

  private taken() {
    return conflict('DOMAIN_TAKEN', 'این دامنه قبلاً توسط فروشگاه دیگری تأیید شده است');
  }

  private toDto(d: Domain): DomainDto {
    return {
      id: d.id,
      hostname: d.hostname,
      status: d.status,
      isPrimary: d.isPrimary,
      verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
      lastCheckedAt: d.lastCheckedAt ? d.lastCheckedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      dns: this.verifier.records(d.hostname, d.verificationToken),
    };
  }
}