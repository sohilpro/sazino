const numberFormat = new Intl.NumberFormat('fa-IR');
const yearFormat = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' });

export const formatNumber = (n: number) => numberFormat.format(n);
export const formatPrice = (n: number) => `${numberFormat.format(n)} تومان`;
export const formatYear = (d = new Date()) => yearFormat.format(d);