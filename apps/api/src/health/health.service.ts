import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import type { HealthResponse, ServiceCheck } from '@myapp/shared-types';
import type { Env } from '../config/env';
import { PG_POOL } from '../database/database.module';
import { WORKER_HEARTBEAT_KEY, WORKER_STALE_MS } from '../jobs/worker-heartbeat.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class HealthService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async check(): Promise<HealthResponse> {
    const requireWorker = this.config.get('HEALTH_REQUIRE_WORKER', { infer: true });
    const [database, redis, storage, worker] = await Promise.all([
      this.probe(() => this.pool.query('SELECT 1')),
      this.probe(() => this.redis.ping()),
      this.probe(() => this.pingStorage()),
      requireWorker ? this.probe(() => this.checkWorker()) : Promise.resolve(undefined),
    ]);

    const all = [database, redis, storage, worker].filter((c): c is ServiceCheck => c !== undefined);

    return {
      status: all.every((c) => c.status === 'up') ? 'ok' : 'degraded',
      version: this.config.get('GIT_SHA', { infer: true }) ?? 'dev',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks: { database, redis, storage, ...(worker ? { worker } : {}) },
    };
  }

  private async checkWorker() {
    const raw = await this.redis.get(WORKER_HEARTBEAT_KEY);
    if (!raw || Date.now() - Number(raw) > WORKER_STALE_MS) {
      throw new Error('worker heartbeat is stale');
    }
  }

  private async pingStorage() {
    const endpoint = this.config.get('MINIO_ENDPOINT', { infer: true });
    const res = await fetch(`${endpoint}/minio/health/live`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`MinIO responded with HTTP ${res.status}`);
  }

  private async probe(fn: () => Promise<unknown>): Promise<ServiceCheck> {
    const start = performance.now();
    try {
      await fn();
      return { status: 'up', latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }
}