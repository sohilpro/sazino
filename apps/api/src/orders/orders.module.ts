import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { CheckoutController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { SellerOrdersController } from './seller-orders.controller';
import { SellerOrdersService } from './seller-orders.service';
import { ShippingMethodsController, StorefrontShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';

@Module({
  imports: [CustomersModule, NotificationsModule],
  controllers: [
    AddressesController,
    StorefrontShippingController,
    ShippingMethodsController,
    CheckoutController,
    OrdersController,
    SellerOrdersController,
  ],
  providers: [AddressesService, ShippingService, OrdersService, SellerOrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}