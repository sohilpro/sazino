import { randomBytes } from 'node:crypto';
import { BadRequestException, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessor } from '../../src/media/image-processor';

const processor = new ImageProcessor();

const solid = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#4f46e5' } });

const dims = async (buffer: Buffer) => {
  const m = await sharp(buffer).metadata();
  return { width: m.width, height: m.height, format: m.format };
};

const variant = (result: Awaited<ReturnType<ImageProcessor['process']>>, name: string) =>
  result.variants.find((v) => v.name === name)!.buffer;

describe('ImageProcessor', () => {
  it('creates four WebP variants with the expected dimensions', async () => {
    const result = await processor.process(await solid(2000, 1000).jpeg().toBuffer());

    expect(result).toMatchObject({ format: 'jpeg', width: 2000, height: 1000 });
    expect(result.variants.map((v) => v.name)).toEqual(['thumb', 'sm', 'md', 'lg']);

    expect(await dims(variant(result, 'thumb'))).toEqual({ width: 200, height: 200, format: 'webp' });
    expect(await dims(variant(result, 'sm'))).toEqual({ width: 480, height: 240, format: 'webp' });
    expect(await dims(variant(result, 'md'))).toEqual({ width: 960, height: 480, format: 'webp' });
    expect(await dims(variant(result, 'lg'))).toEqual({ width: 1600, height: 800, format: 'webp' });
  });

  it('never enlarges small images (except the square thumbnail)', async () => {
    const result = await processor.process(await solid(300, 200).jpeg().toBuffer());

    expect(await dims(variant(result, 'thumb'))).toMatchObject({ width: 200, height: 200 });
    for (const name of ['sm', 'md', 'lg']) {
      expect(await dims(variant(result, name))).toMatchObject({ width: 300, height: 200 });
    }
  });

  it('applies EXIF orientation and reports the displayed size', async () => {
    const input = await solid(800, 400).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await processor.process(input);

    expect(result).toMatchObject({ width: 400, height: 800 });
    expect(await dims(variant(result, 'lg'))).toMatchObject({ width: 400, height: 800 });
  });

  it('strips metadata from the output', async () => {
    const input = await solid(400, 300)
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-copyright' } } })
      .toBuffer();
    const result = await processor.process(input);

    for (const v of result.variants) {
      const meta = await sharp(v.buffer).metadata();
      expect(meta.exif).toBeUndefined();
    }
  });

  it('accepts PNG, WebP and GIF', async () => {
    const png = await processor.process(await solid(300, 300).png().toBuffer());
    const webp = await processor.process(await solid(300, 300).webp().toBuffer());
    const gif = await processor.process(await solid(300, 300).gif().toBuffer());

    expect(png.format).toBe('png');
    expect(webp.format).toBe('webp');
    expect(gif.format).toBe('gif');
  });

  it('rejects files that are not images', async () => {
    await expect(processor.process(Buffer.from('just some text, not an image'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects garbage that only starts like a JPEG', async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(2000)]);
    await expect(processor.process(fake)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects SVG (a real image format, but not allowed)', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>',
    );
    await expect(processor.process(svg)).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('rejects images above the pixel limit', async () => {
    const input = await solid(200, 200).png().toBuffer(); // 40,000 پیکسل
    await expect(processor.process(input, { maxPixels: 10_000 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});