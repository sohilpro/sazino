import type { StoreInfo } from '@myapp/shared-types';

/** فروشگاه فعلی؛ middleware سراسری آن را پر می‌کند و همراه payload به مرورگر می‌رسد */
export const useStore = () => useState<StoreInfo | null>('store', () => null);