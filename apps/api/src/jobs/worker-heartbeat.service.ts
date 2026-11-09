import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export const WORKER_HEARTBEAT_KEY = 'myapp:worker:heartbeat';
export const WORKER_STALE_MS = 90_000;
const INTERVAL_MS = 30_000;

/** فقط در پروسه‌ای ثبت می‌شود که JOBS_ENABLED=true دارد؛ وب با خواندن این کلید می‌فهمد worker زنده است */
@Injectable()
export class WorkerHeartbeatService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  onModuleInit(): void {
    void this.beat();
    this.timer = setInterval(() => void this.beat(), INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async beat(): Promise<void> {
    try {
      await this.redis.set(WORKER_HEARTBEAT_KEY, String(Date.now()), 'EX', 120);
    } catch {
      /* Redis خراب است؛ health خودش آن را گزارش می‌کند */
    }
  }
}