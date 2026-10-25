import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { CustomersModule } from '../customers/customers.module';
import { FakeZarinpalDriver } from './gateway/fake.driver';
import { ZarinpalCheckoutDriver } from './gateway/zarinpal-checkout.driver';
import { ZARINPAL_API } from './gateway/zarinpal.types';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';
import { PaymentsService } from './payments.service';
import { StorefrontPaymentsController } from './storefront-payments.controller';

@Module({
  imports: [CustomersModule],
  controllers: [PaymentGatewayController, StorefrontPaymentsController],
  providers: [
    FakeZarinpalDriver,
    ZarinpalCheckoutDriver,
    {
      provide: ZARINPAL_API,
      inject: [ConfigService, FakeZarinpalDriver, ZarinpalCheckoutDriver],
      useFactory: (
        config: ConfigService<Env, true>,
        fake: FakeZarinpalDriver,
        real: ZarinpalCheckoutDriver,
      ) => (config.get('PAYMENT_DRIVER', { infer: true }) === 'zarinpal' ? real : fake),
    },
    PaymentGatewayService,
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}