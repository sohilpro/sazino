/**
 * حالت پیش‌نمایش پیش‌نویس (با ?preview=توکن). توکن فقط به API فرستاده می‌شود؛
 * این صفحه هرگز کش یا ایندکس نمی‌شود.
 */
export function usePreview() {
  const route = useRoute();
  const token = computed(() => firstQuery(route.query.preview) || undefined);
  const active = computed(() => token.value !== undefined);

  if (import.meta.server && active.value) {
    useResponseHeader('Cache-Control').value = 'no-store';
  }
  useSeoMeta({ robots: () => (active.value ? 'noindex, nofollow' : undefined) });

  return { token, active };
}