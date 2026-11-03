import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type {
  AdminStatsDto,
  AdminTenantDetailDto,
  AdminTenantSummaryDto,
  Paginated,
  PlanDto,
  TenantPlan,
} from '@myapp/shared-types';
import { Public } from '../auth/decorators/public.decorator';
import { NoStoreInterceptor } from '../common/no-store.interceptor';
import { PlanKeyPipe, UpdatePlanDto } from '../plans/plan.dto';
import { PlansService } from '../plans/plans.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminTenantListQueryDto, SetTenantPlanDto, SuspendTenantDto } from './admin.dto';
import { AdminGuard, CurrentAdmin, type AdminActor } from './admin.guard';

@ApiTags('admin')
@Public() // JwtAuthGuard فروشنده کنار گذاشته می‌شود؛ فقط AdminGuard
@UseGuards(AdminGuard)
@UseInterceptors(NoStoreInterceptor)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly tenants: AdminTenantsService,
    private readonly plans: PlansService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('stats')
  stats(): Promise<AdminStatsDto> {
    return this.tenants.stats();
  }

  @Get('tenants')
  list(@Query() query: AdminTenantListQueryDto): Promise<Paginated<AdminTenantSummaryDto>> {
    return this.tenants.list(query);
  }

  @Get('tenants/:id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminTenantDetailDto> {
    return this.tenants.get(id);
  }

  @Post('tenants/:id/suspend')
  @HttpCode(200)
  suspend(
    @CurrentAdmin() actor: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendTenantDto,
  ): Promise<AdminTenantDetailDto> {
    return this.tenants.suspend(actor, id, dto.reason);
  }

  @Post('tenants/:id/activate')
  @HttpCode(200)
  activate(
    @CurrentAdmin() actor: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminTenantDetailDto> {
    return this.tenants.activate(actor, id);
  }

  @Put('tenants/:id/plan')
  setPlan(
    @CurrentAdmin() actor: AdminActor,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTenantPlanDto,
  ): Promise<AdminTenantDetailDto> {
    return this.tenants.setPlan(actor, id, dto.plan);
  }

  @Get('plans')
  listPlans(): Promise<PlanDto[]> {
    return this.plans.list();
  }

  @Put('plans/:key')
  async updatePlan(
    @CurrentAdmin() actor: AdminActor,
    @Param('key', PlanKeyPipe) key: TenantPlan,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanDto> {
    const updated = await this.plans.update(key, dto);
    await this.audit.record(actor, 'plan.update', null, { key, changes: dto as unknown as Record<string, unknown> });
    return updated;
  }
}