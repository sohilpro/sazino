/** آدرس ویترین یک فروشگاه از روی قالب (بدون / پایانی) */
export function buildStoreUrl(template: string, subdomain: string): string {
  return template.replace('{subdomain}', subdomain).replace(/\/+$/, '');
}