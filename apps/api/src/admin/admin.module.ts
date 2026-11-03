import { Module } from '@nestjs/common';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginLimiter } from './admin-login-limiter';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  controllers: [AdminAuthController, AdminController],
  providers: [AdminAuthService, AdminLoginLimiter, AdminGuard, AdminAuditService, AdminTenantsService],
})
export class AdminModule {}