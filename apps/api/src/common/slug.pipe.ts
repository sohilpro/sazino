import { Injectable, NotFoundException, PipeTransform } from '@nestjs/common';
import { SLUG_MAX_LENGTH, SLUG_REGEX } from './slug';

/** slug عمومی ویترین؛ نامعتبر = ۴۰۴ (همان رفتار «پیدا نشد» قبلی، بدون رفتن به دیتابیس) */
@Injectable()
export class SlugParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    const slug = String(value).trim().toLowerCase();
    if (slug.length === 0 || slug.length > SLUG_MAX_LENGTH || !SLUG_REGEX.test(slug)) {
      throw new NotFoundException('پیدا نشد');
    }
    return slug;
  }
}