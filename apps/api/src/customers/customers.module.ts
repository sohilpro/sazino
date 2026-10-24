import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CustomerController, StorefrontAuthController } from './customer-auth.controller';
import { CustomerGuard } from './customer.guard';
import { CustomerSessionService } from './customer-session.service';
import { CustomersService } from './customers.service';
import { OtpService } from './otp.service';

@Module({
  controllers: [StorefrontAuthController, CustomerController, CartController],
  providers: [OtpService, CustomerSessionService, CustomersService, CartService, CustomerGuard],
  exports: [CustomersService, CartService, CustomerSessionService],
})
export class CustomersModule {}