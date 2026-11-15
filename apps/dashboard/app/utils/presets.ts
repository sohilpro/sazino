import type { StoreFont } from '@myapp/shared-types';

export interface LookPreset {
  key: string;
  label: string;
  hint: string;
  primaryColor: string;
  font: StoreFont;
}

/** حالت‌های ظاهری آماده؛ فقط از تنظیمات موجود (رنگ و فونت) استفاده می‌کنند. */
export const LOOK_PRESETS: LookPreset[] = [
  { key: 'indigo', label: 'کلاسیک', hint: 'رسمی و قابل‌اعتماد', primaryColor: '#4f46e5', font: 'vazirmatn' },
  { key: 'emerald', label: 'طبیعی', hint: 'مناسب خوراکی و ارگانیک', primaryColor: '#059669', font: 'vazirmatn' },
  { key: 'rose', label: 'شاد', hint: 'مناسب مد و هدیه', primaryColor: '#e11d48', font: 'vazirmatn' },
  { key: 'amber', label: 'گرم', hint: 'مناسب لوازم خانه و دکور', primaryColor: '#d97706', font: 'vazirmatn' },
  { key: 'slate', label: 'مینیمال', hint: 'ساده و شیک', primaryColor: '#334155', font: 'vazirmatn' },
];
