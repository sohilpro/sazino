import { BadRequestException, Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';
import {
  ALLOWED_FORMATS,
  IMAGE_VARIANTS,
  MAX_INPUT_PIXELS,
  VARIANT_NAMES,
  type VariantName,
} from './media.constants';

export interface ProcessedImage {
  /** فرمت فایل ورودی (jpeg | png | webp | gif) */
  format: string;
  /** ابعاد بعد از اعمال چرخش EXIF */
  width: number;
  height: number;
  variants: Array<{ name: VariantName; buffer: Buffer }>;
}

@Injectable()
export class ImageProcessor {
  async process(input: Buffer, opts: { maxPixels?: number } = {}): Promise<ProcessedImage> {
    const limitInputPixels = opts.maxPixels ?? MAX_INPUT_PIXELS;

    let meta: sharp.Metadata;
    try {
      meta = await sharp(input, { limitInputPixels }).metadata();
    } catch {
      throw new BadRequestException('فایل تصویر معتبر نیست');
    }

    // نوع واقعی فایل از روی محتوا تشخیص داده می‌شود، نه نام یا Content-Type ارسالی
    if (!meta.format || !(ALLOWED_FORMATS as readonly string[]).includes(meta.format)) {
      throw new UnsupportedMediaTypeException('فقط تصاویر JPEG، PNG، WebP و GIF مجاز هستند');
    }
    if (!meta.width || !meta.height) {
      throw new BadRequestException('فایل تصویر معتبر نیست');
    }
    if (meta.width * meta.height > limitInputPixels) {
      throw new BadRequestException('ابعاد تصویر بیش از حد بزرگ است');
    }

    // جهت‌های ۵ تا ۸ در EXIF یعنی تصویر ۹۰ درجه چرخیده نمایش داده می‌شود
    const swapped = (meta.orientation ?? 1) >= 5;

    try {
      const variants = await Promise.all(
        VARIANT_NAMES.map(async (name) => ({
          name,
          buffer: await this.render(input, name, limitInputPixels),
        })),
      );
      return {
        format: meta.format,
        width: swapped ? meta.height : meta.width,
        height: swapped ? meta.width : meta.height,
        variants,
      };
    } catch {
      throw new BadRequestException('پردازش تصویر ناموفق بود؛ فایل ممکن است خراب باشد');
    }
  }

  private render(input: Buffer, name: VariantName, limitInputPixels: number): Promise<Buffer> {
    const spec = IMAGE_VARIANTS[name];
    // rotate() جهت EXIF را اعمال می‌کند؛ metadata عمداً حفظ نمی‌شود (GPS و ... پاک می‌شود)
    const pipeline = sharp(input, { limitInputPixels }).rotate();

    const resized =
      'height' in spec
        ? pipeline.resize(spec.width, spec.height, { fit: 'cover' })
        : pipeline.resize({ width: spec.width, withoutEnlargement: true });

    return resized.webp({ quality: 80 }).toBuffer();
  }
}