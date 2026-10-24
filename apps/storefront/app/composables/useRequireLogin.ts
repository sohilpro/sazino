/** صفحه‌ی خصوصی: بعد از مشخص‌شدن وضعیت ورود، مهمان به صفحه‌ی ورود می‌رود */
export function useRequireLogin(redirect: string) {
  const { loaded, isLoggedIn } = useCustomer();

  watch(
    () => [loaded.value, isLoggedIn.value] as const,
    ([isLoaded, loggedIn]) => {
      if (isLoaded && !loggedIn) void navigateTo({ path: '/login', query: { redirect } });
    },
    { immediate: true },
  );

  return { ready: computed(() => loaded.value && isLoggedIn.value) };
}