import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { HealthResponse } from '@myapp/shared-types';
import { HealthService } from './health.service';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** فقط بررسی می‌کند پروسه زنده است */
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  /** بررسی وابستگی‌ها (Postgres, Redis, MinIO)؛ در صورت مشکل 503 */
  @Get()
  async ready(): Promise<HealthResponse> {
    const result = await this.health.check();
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}