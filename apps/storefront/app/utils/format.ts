const numberFormat = new Intl.NumberFormat('fa-IR');
const yearFormat = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' });

export const formatNumber = (n: number) => numberFormat.format(n);
export const formatPrice = (n: number) => `${numberFormat.format(n)} تومان`;
export const formatYear = (d = new Date()) => yearFormat.format(d);

const dateTimeFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));