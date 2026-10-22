import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { VARIANT_NAMES } from '../../src/media/media.constants';
import { PrismaService } from '../../src/prisma/prisma.service';
import { StorageService } from '../../src/storage/storage.service';
import {
  cleanupFixtures,
  createFixture,
  subdomainHost,
  type TenantFixture,
} from '../helpers/fixtures';

const jpeg = (w = 1200, h = 800) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#4f46e5' } }).jpeg().toBuffer();

describe('Media API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let storage: StorageService;

  let A: TenantFixture;
  let B: TenantFixture;
  let tokenA = '';
  let tokenAEditor = '';
  let tokenB = '';

  const http = () => request(app.getHttpServer());
  const sign = (u: { id: string; tenantId: string; role: string }) =>
    jwt.signAsync({ sub: u.id, tenantId: u.tenantId, role: u.role });
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const upload = (token: string, file: Buffer, filename = 'photo.jpg', contentType = 'image/jpeg') =>
    http().post('/api/media').set(auth(token)).attach('file', file, { filename, contentType });

  const uploadOk = async (token: string, alt?: string) => {
    const req = upload(token, await jpeg());
    if (alt) req.field('alt', alt);
    return (await req.expect(201)).body as {
      id: string;
      urls: Record<string, string>;
      [k: string]: unknown;
    };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService, { strict: false });
    storage = app.get(StorageService);

    A = await createFixture(prisma, 'a');
    B = await createFixture(prisma, 'b');
    tokenA = await sign(A.owner);
    tokenAEditor = await sign(A.editor);
    tokenB = await sign(B.owner);
  });

  afterAll(async () => {
    await storage.deletePrefix(`${A.tenant.id}/`);
    await storage.deletePrefix(`${B.tenant.id}/`);
    await cleanupFixtures(prisma, [A, B]);
    await app.close();
  });

  // ─────────────────────────── آپلود ───────────────────────────
  describe('upload', () => {
    it('stores four WebP variants under the tenant prefix and serves them', async () => {
      const buf = await jpeg(1200, 800);
      const res = await upload(tokenA, buf, 'عکس محصول.jpg').field('alt', '  متن جایگزین ').expect(201);

      expect(res.body).toMatchObject({
        originalName: 'عکس محصول.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: buf.length,
        width: 1200,
        height: 800,
        alt: 'متن جایگزین',
      });
      expect(Object.keys(res.body.urls).sort()).toEqual([...VARIANT_NAMES].sort());

      const id = res.body.id as string;
      for (const name of VARIANT_NAMES) {
        expect(await storage.objectExists(`${A.tenant.id}/${id}/${name}.webp`)).toBe(true);
        expect(res.body.urls[name]).toContain(`/${A.tenant.id}/${id}/${name}.webp`);
      }

      // خواندن مستقیم از آدرس عمومی
      const file = await fetch(res.body.urls.md);
      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('image/webp');
      expect(file.headers.get('cache-control')).toContain('immutable');
      const meta = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
      expect(meta).toMatchObject({ width: 960, height: 640, format: 'webp' });
    });

    it('rejects a text file even when it claims to be a JPEG', async () => {
      await upload(tokenA, Buffer.from('not an image at all'), 'evil.jpg', 'image/jpeg').expect(400);
    });

    it('rejects SVG with 415', async () => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
      );
      await upload(tokenA, svg, 'logo.svg', 'image/svg+xml').expect(415);
    });

    it('rejects files above 5 MB with 413', async () => {
      const big = Buffer.alloc(5 * 1024 * 1024 + 2048);
      await upload(tokenA, big, 'big.jpg', 'image/jpeg').expect(413);
    });

    it('rejects a request without a file, and a wrong field name', async () => {
      await http().post('/api/media').set(auth(tokenA)).field('alt', 'x').expect(400);
      await http()
        .post('/api/media')
        .set(auth(tokenA))
        .attach('photo', await jpeg(100, 100), { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(400);
    });

    it('requires authentication', async () => {
      await http()
        .post('/api/media')
        .attach('file', await jpeg(100, 100), { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(401);
    });

    it('does not leave files behind after a rejected upload', async () => {
      const before = await prisma.media.count({ where: { tenantId: A.tenant.id } });
      await upload(tokenA, Buffer.from('nope'), 'x.jpg').expect(400);
      expect(await prisma.media.count({ where: { tenantId: A.tenant.id } })).toBe(before);
    });
  });

  // ─────────────────────────── مدیریت و ایزوله‌سازی ───────────────────────────
  describe('management and isolation', () => {
    let mediaA!: { id: string; urls: Record<string, string> };

    beforeAll(async () => {
      mediaA = await uploadOk(tokenA, 'اصلی');
    });

    it('gets, lists and updates its own media', async () => {
      const one = await http().get(`/api/media/${mediaA.id}`).set(auth(tokenA)).expect(200);
      expect(one.body.id).toBe(mediaA.id);

      const list = await http().get('/api/media?limit=100').set(auth(tokenA)).expect(200);
      expect((list.body.items as Array<{ id: string }>).map((m) => m.id)).toContain(mediaA.id);

      const patched = await http()
        .patch(`/api/media/${mediaA.id}`)
        .set(auth(tokenA))
        .send({ alt: 'متن جدید' })
        .expect(200);
      expect(patched.body.alt).toBe('متن جدید');

      const cleared = await http()
        .patch(`/api/media/${mediaA.id}`)
        .set(auth(tokenA))
        .send({ alt: '' })
        .expect(200);
      expect(cleared.body.alt).toBeNull();
    });

    it('hides media of another tenant', async () => {
      await http().get(`/api/media/${mediaA.id}`).set(auth(tokenB)).expect(404);
      await http().patch(`/api/media/${mediaA.id}`).set(auth(tokenB)).send({ alt: 'x' }).expect(404);
      await http().delete(`/api/media/${mediaA.id}`).set(auth(tokenB)).expect(404);

      const listB = await http().get('/api/media?limit=100').set(auth(tokenB)).expect(200);
      expect((listB.body.items as Array<{ id: string }>).map((m) => m.id)).not.toContain(mediaA.id);

      expect(await storage.objectExists(`${A.tenant.id}/${mediaA.id}/md.webp`)).toBe(true);
    });

    it('forbids an EDITOR from deleting', async () => {
      await http().delete(`/api/media/${mediaA.id}`).set(auth(tokenAEditor)).expect(403);
    });

    it('deleting removes the database row and the stored files', async () => {
      const temp = await uploadOk(tokenA);
      await http().delete(`/api/media/${temp.id}`).set(auth(tokenA)).expect(204);
      await http().get(`/api/media/${temp.id}`).set(auth(tokenA)).expect(404);
      for (const name of VARIANT_NAMES) {
        expect(await storage.objectExists(`${A.tenant.id}/${temp.id}/${name}.webp`)).toBe(false);
      }
    });
  });

  // ─────────────────────────── تصاویر محصول ───────────────────────────
  describe('product images', () => {
    let m1!: { id: string; urls: Record<string, string> };
    let m2!: { id: string; urls: Record<string, string> };
    let product!: { id: string; slug: string };

    const setImages = (token: string, productId: string, mediaIds: string[]) =>
      http().put(`/api/products/${productId}/images`).set(auth(token)).send({ mediaIds });

    beforeAll(async () => {
      m1 = await uploadOk(tokenA);
      m2 = await uploadOk(tokenA);
      product = (
        await http()
          .post('/api/products')
          .set(auth(tokenA))
          .send({ title: 'محصول تصویری', variants: [{ price: 1000 }] })
          .expect(201)
      ).body;
    });

    it('has no images by default', async () => {
      const res = await http().get(`/api/products/${product.id}`).set(auth(tokenA)).expect(200);
      expect(res.body.images).toEqual([]);
    });

    it('sets images in the given order', async () => {
      const res = await setImages(tokenA, product.id, [m2.id, m1.id]).expect(200);
      expect(res.body.images.map((i: { id: string }) => i.id)).toEqual([m2.id, m1.id]);
      expect(res.body.images[0].urls.thumb).toContain(`/${A.tenant.id}/${m2.id}/thumb.webp`);
      expect(res.body.images[0]).toMatchObject({ width: 1200, height: 800 });
    });

    it('reorders images', async () => {
      const res = await setImages(tokenA, product.id, [m1.id, m2.id]).expect(200);
      expect(res.body.images.map((i: { id: string }) => i.id)).toEqual([m1.id, m2.id]);
    });

    it('rejects duplicates, unknown ids and more than 10 images', async () => {
      await setImages(tokenA, product.id, [m1.id, m1.id]).expect(400);
      await setImages(tokenA, product.id, [randomUUID()]).expect(400);
      await setImages(
        tokenA,
        product.id,
        Array.from({ length: 11 }, () => randomUUID()),
      ).expect(400);
    });

    it('rejects media of another tenant and products of another tenant', async () => {
      const productB = (
        await http()
          .post('/api/products')
          .set(auth(tokenB))
          .send({ title: 'محصول B', variants: [{ price: 1000 }] })
          .expect(201)
      ).body;

      await setImages(tokenB, productB.id, [m1.id]).expect(400); // تصویر A در B
      await setImages(tokenB, product.id, [m1.id]).expect(404); // محصول A از B

      const still = await http().get(`/api/products/${product.id}`).set(auth(tokenA)).expect(200);
      expect(still.body.images).toHaveLength(2);
    });

    it('shows images (without stock quantities) in the storefront', async () => {
      await http().patch(`/api/products/${product.id}`).set(auth(tokenA)).send({ status: 'ACTIVE' }).expect(200);

      const res = await http()
        .get(`/api/storefront/products/${encodeURIComponent(product.slug)}`)
        .set('Host', subdomainHost(A))
        .expect(200);
      expect(res.body.images.map((i: { id: string }) => i.id)).toEqual([m1.id, m2.id]);
      expect(res.body.images[0].urls).toHaveProperty('md');
    });

    it('deleting a media item removes it from the product', async () => {
      await http().delete(`/api/media/${m1.id}`).set(auth(tokenA)).expect(204);
      const res = await http().get(`/api/products/${product.id}`).set(auth(tokenA)).expect(200);
      expect(res.body.images.map((i: { id: string }) => i.id)).toEqual([m2.id]);
    });

    it('clears images with an empty list', async () => {
      const res = await setImages(tokenA, product.id, []).expect(200);
      expect(res.body.images).toEqual([]);
    });

    it('deleting a product keeps the media (reusable)', async () => {
      await setImages(tokenA, product.id, [m2.id]).expect(200);
      await http().delete(`/api/products/${product.id}`).set(auth(tokenA)).expect(204);
      await http().get(`/api/media/${m2.id}`).set(auth(tokenA)).expect(200);
    });
  });
});