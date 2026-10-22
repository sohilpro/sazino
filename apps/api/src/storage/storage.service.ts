import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ImageUrls } from '@myapp/shared-types';
import type { Env } from '../config/env';
import {
  IMAGE_CACHE_CONTROL,
  VARIANT_NAMES,
  type VariantName,
} from '../media/media.constants';

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly publicBase: string;
  private readonly isProduction: boolean;
  readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    this.bucket = config.get('MINIO_BUCKET', { infer: true });
    this.publicBase = config.get('MEDIA_PUBLIC_URL', { infer: true }).replace(/\/+$/, '');
    this.isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

    this.client = new S3Client({
      endpoint: config.get('MINIO_ENDPOINT', { infer: true }),
      region: config.get('S3_REGION', { infer: true }),
      forcePathStyle: true, // لازم برای MinIO
      credentials: {
        accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
        secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
      },
      // چک‌سام اضافه فقط وقتی لازم است؛ با S3-compatibleها سازگارتر است
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucket();
    } catch (err) {
      // نبودن Storage نباید کل API را از کار بیندازد؛ فقط آپلود خطا می‌دهد
      this.logger.error(`Storage init failed: ${(err as Error).message}`);
    }
  }

  onModuleDestroy() {
    this.client.destroy();
  }

  // ───────────── کلیدها و URLها ─────────────
  imageKeys(tenantId: string, mediaId: string): Record<VariantName, string> {
    return Object.fromEntries(
      VARIANT_NAMES.map((name) => [name, `${tenantId}/${mediaId}/${name}.webp`]),
    ) as Record<VariantName, string>;
  }

  imageUrls(tenantId: string, mediaId: string): ImageUrls {
    const keys = this.imageKeys(tenantId, mediaId);
    return Object.fromEntries(
      VARIANT_NAMES.map((name) => [name, `${this.publicBase}/${keys[name]}`]),
    ) as unknown as ImageUrls;
  }

  // ───────────── عملیات ─────────────
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: IMAGE_CACHE_CONTROL,
      }),
    );
  }

  async deleteMany(keys: string[]): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  /** همه‌ی فایل‌های زیر یک پیشوند را حذف می‌کند (مثلاً کل فروشگاه: "<tenantId>/") */
  async deletePrefix(prefix: string): Promise<number> {
    let token: string | undefined;
    let total = 0;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [o.Key] : []));
      if (keys.length) {
        await this.deleteMany(keys);
        total += keys.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return total;
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (this.isNotFound(err)) return false;
      throw err;
    }
  }

  // ───────────── کمکی‌ها ─────────────
  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (err) {
      if (!this.isNotFound(err)) throw err;
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Created bucket "${this.bucket}"`);
    }

    // در توسعه، تصاویر مستقیم از باکت خوانده می‌شوند. در پروداکشن این کار با CDN/زیرساخت انجام می‌شود.
    if (!this.isProduction) {
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        }),
      );
    }
  }

  private isNotFound(err: unknown): boolean {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    return (
      e?.name === 'NotFound' ||
      e?.name === 'NoSuchKey' ||
      e?.name === 'NoSuchBucket' ||
      e?.$metadata?.httpStatusCode === 404
    );
  }
}