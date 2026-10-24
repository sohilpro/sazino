import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { CheckoutController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ShippingMethodsController, StorefrontShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [CustomersModule],
  controllers: [
    AddressesController,
    StorefrontShippingController,
    ShippingMethodsController,
    CheckoutController,
    OrdersController,
  ],
  providers: [AddressesService, ShippingService, OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}