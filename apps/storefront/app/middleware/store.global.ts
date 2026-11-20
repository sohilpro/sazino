import type { StoreInfo } from '@myapp/shared-types';

export default defineNuxtRouteMiddleware(async (to) => {
  const isPlatform = useIsPlatform();

  // اگر کاربر در هاست اصلی پلتفرم (سازینو) است:
  if (isPlatform.value) {
    // مسیر اصلی '/' صفحه لندینگ پلتفرم است و نیازی به واکشی اطلاعات فروشگاه ندارد.
    // اگر کاربر مسیرهای اختصاصی فروشگاه (مانند محصولات، سبد خرید، حساب کاربری و ...) را
    // در هاست اصلی پلتفرم بدون ساب‌دامین باز کند، به صفحه اصلی هدایت می‌شود.
    if (to.path !== '/' && to.path !== '/preview') {
      return navigateTo('/');
    }
    return;
  }

  const store = useStore();
  if (store.value) return; // قبلاً (در SSR یا همین بازدید) بارگذاری شده

  // اگر سرور همین الان خطا داده (فروشگاه ناموجود، تعلیق‌شده، API خراب)، صفحه‌ی خطا
  // از payload می‌آید. مرورگر هنگام hydrate نباید دوباره API را صدا بزند.
  // (بعد از clearError این مقدار خالی می‌شود و ناوبری بعدی دوباره درست بررسی می‌شود.)
  const error = useError();
  if (error.value) return;

  const api = useStorefrontApi();
  try {
    store.value = await api<StoreInfo>('/store');
  } catch (err) {
    const status = statusOf(err);

    // خطاهای قابل انتظار (فروشگاه ناموجود یا تعلیق‌شده) fatal نیستند، پس در لاگ سرور
    // ثبت نمی‌شوند ولی صفحه‌ی error.vue روی سرور همچنان نمایش داده می‌شود.
    if (status === 404 || status === 403) {
      throw createError({
        statusCode: status,
        statusMessage: status === 404 ? 'Store Not Found' : 'Store Suspended',
      });
    }

    console.error('[store] API request failed:', status ?? 'no response', (err as Error).message);
    throw createError({ statusCode: 502, statusMessage: 'Bad Gateway', fatal: true });
  }
});
