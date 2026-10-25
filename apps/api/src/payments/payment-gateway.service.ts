import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { PaymentGatewayDto } from '@myapp/shared-types';
import { SecretBox } from '../crypto/secret-box';
import { TenantContext } from '../tenants/tenant-context';
import { InjectTenantDb, type TenantDb } from '../tenants/tenant-db';
import type { SaveGatewayDto } from './payment-gateway.dto';
import { PAYMENT_PROVIDER } from './payments.constants';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  constructor(
    @InjectTenantDb() private readonly db: TenantDb,
    private readonly ctx: TenantContext,
    private readonly box: SecretBox,
  ) {}

  /** متن رمزشده به tenant و درگاه «قفل» می‌شود */
  private aad(tenantId: string) {
    return `gateway:${tenantId}:${PAYMENT_PROVIDER}`;
  }

  async get(): Promise<PaymentGatewayDto> {
    const row = await this.db.paymentGatewayConfig.findFirst({ where: { provider: PAYMENT_PROVIDER } });
    return {
      provider: PAYMENT_PROVIDER,
      configured: row !== null,
      isActive: row?.isActive ?? false,
      merchantHint: row?.merchantHint ?? null,
    };
  }

  async save(dto: SaveGatewayDto): Promise<PaymentGatewayDto> {
    const tenantId = this.ctx.require();
    const existing = await this.db.paymentGatewayConfig.findFirst({
      where: { provider: PAYMENT_PROVIDER },
      select: { id: true },
    });

    if (!dto.merchantId) {
      if (!existing) throw new BadRequestException('شناسه‌ی پذیرنده (merchant id) را وارد کنید');
      await this.db.paymentGatewayConfig.update({
        where: { id: existing.id },
        data: { isActive: dto.isActive },
      });
      return this.get();
    }

    const merchantId = dto.merchantId.toLowerCase();
    const merchantIdEnc = this.box.encrypt(merchantId, this.aad(tenantId));
    const merchantHint = merchantId.slice(-4);

    await this.db.paymentGatewayConfig.upsert({
      where: { tenantId_provider: { tenantId, provider: PAYMENT_PROVIDER } },
      create: {
        tenantId,
        provider: PAYMENT_PROVIDER,
        merchantIdEnc,
        merchantHint,
        isActive: dto.isActive ?? true,
      },
      update: { merchantIdEnc, merchantHint, isActive: dto.isActive },
    });
    return this.get();
  }

  async remove(): Promise<void> {
    await this.db.paymentGatewayConfig.deleteMany({ where: { provider: PAYMENT_PROVIDER } });
  }

  /**
   * شناسه‌ی پذیرنده‌ی رمزگشایی‌شده. null اگر تنظیم نشده یا (با requireActive) غیرفعال است.
   * پرداخت‌های در جریان با requireActive=false هم قابل تأیید می‌مانند.
   */
  async merchantId(opts: { requireActive: boolean }): Promise<string | null> {
    const tenantId = this.ctx.require();
    const row = await this.db.paymentGatewayConfig.findFirst({ where: { provider: PAYMENT_PROVIDER } });
    if (!row || (opts.requireActive && !row.isActive)) return null;

    try {
      return this.box.decrypt(row.merchantIdEnc, this.aad(tenantId));
    } catch {
      // کلید رمزنگاری عوض شده یا داده دست‌کاری شده؛ فروشنده باید دوباره ثبت کند
      this.logger.error(`Cannot decrypt the gateway config of tenant ${tenantId}`);
      return null;
    }
  }
}