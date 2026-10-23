/** رنگ، favicon و قالب عنوان صفحه را از روی فروشگاه فعلی روی <html> و <head> می‌گذارد */
export function useStoreTheme() {
  const store = useStore();

  useHead(() => {
    const primary = safeColor(store.value?.theme.primaryColor);
    const name = store.value?.name;
    const logo = store.value?.logoUrl;

    return {
      htmlAttrs: {
        style: `--store-primary:${primary};--store-on-primary:${contrastColor(primary)}`,
      },
      link: logo ? [{ rel: 'icon', href: logo }] : [],
      titleTemplate: (title?: string) =>
        !name ? (title ?? '') : !title || title === name ? name : `${title} | ${name}`,
    };
  });
}