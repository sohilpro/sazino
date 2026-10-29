const numberFormat = new Intl.NumberFormat('fa-IR');
const dateFormat = new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' });

export const formatNumber = (n: number) => numberFormat.format(n);
export const formatPrice = (n: number) => `${numberFormat.format(n)} تومان`;

export function formatPriceRange(min: number, max: number) {
  return min === max ? formatPrice(min) : `${formatPrice(min)} تا ${formatPrice(max)}`;
}

export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

const dateTimeFormat = new Intl.DateTimeFormat('fa-IR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
