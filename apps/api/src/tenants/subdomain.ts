/** ۳ تا ۳۰ کاراکتر، فقط a-z 0-9 و خط تیره؛ بدون شروع/پایان با خط تیره و بدون «--» */
export const SUBDOMAIN_REGEX = /^(?!.*--)[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'app', 'admin', 'dashboard', 'panel', 'console', 'auth', 'login', 'register',
  'signup', 'mail', 'smtp', 'ftp', 'ns1', 'ns2', 'cdn', 'static', 'assets', 'media', 'img',
  'images', 'files', 'store', 'stores', 'shop', 'shops', 'blog', 'docs', 'help', 'support',
  'status', 'billing', 'root', 'test', 'staging', 'dev', 'localhost',
]);