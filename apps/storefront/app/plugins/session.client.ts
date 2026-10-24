export default defineNuxtPlugin((nuxtApp) => {
  const store = useStore();
  const customer = useCustomer();
  const cart = useCart();

  // بعد از hydrate؛ روی صفحه‌ی خطا (فروشگاه ناموجود) درخواستی زده نمی‌شود
  nuxtApp.hook('app:mounted', () => {
    if (!store.value) return;
    void customer.load();
    void cart.load();
  });
});