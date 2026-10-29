const numberFormat = new Intl.NumberFormat('fa-IR');

export function escapeHtml(input: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return input.replace(/[&<>"']/g, (c) => map[c]!);
}

/** هدر ایمیل نباید خط جدید داشته باشد */
const singleLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();

export interface SellerPaidEmailInput {
  storeName: string;
  orderNumber: number;
  total: number;
  recipientName: string;
  recipientPhone: string;
  items: Array<{ title: string; variant: string; quantity: number }>;
  orderUrl: string;
}

export function sellerPaidEmail(i: SellerPaidEmailInput): { subject: string; text: string; html: string } {
  const number = numberFormat.format(i.orderNumber);
  const total = `${numberFormat.format(i.total)} تومان`;
  const label = (item: SellerPaidEmailInput['items'][number]) =>
    `${item.title}${item.variant && item.variant !== 'پیش‌فرض' ? ` (${item.variant})` : ''}`;

  const subject = singleLine(`سفارش جدید پرداخت‌شده ${number} — ${i.storeName}`);

  const text = [
    `یک سفارش جدید در «${i.storeName}» پرداخت شد.`,
    '',
    `شماره‌ی سفارش: ${number}`,
    `مبلغ: ${total}`,
    `گیرنده: ${i.recipientName} (${i.recipientPhone})`,
    '',
    'کالاها:',
    ...i.items.map((item) => `- ${label(item)} × ${numberFormat.format(item.quantity)}`),
    '',
    `مشاهده و ثبت ارسال: ${i.orderUrl}`,
  ].join('\n');

  const rows = i.items
    .map(
      (item) =>
        `<tr><td style="padding:4px 8px">${escapeHtml(label(item))}</td><td style="padding:4px 8px">${escapeHtml(
          numberFormat.format(item.quantity),
        )}</td></tr>`,
    )
    .join('');

  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9">
<h2>سفارش جدید پرداخت‌شده</h2>
<p>یک سفارش جدید در «${escapeHtml(i.storeName)}» پرداخت شد.</p>
<p>شماره‌ی سفارش: <b>${escapeHtml(number)}</b><br>مبلغ: <b>${escapeHtml(total)}</b><br>گیرنده: ${escapeHtml(
    i.recipientName,
  )} (<span dir="ltr">${escapeHtml(i.recipientPhone)}</span>)</p>
<table style="border-collapse:collapse;border:1px solid #ddd"><tbody>${rows}</tbody></table>
<p><a href="${escapeHtml(i.orderUrl)}">مشاهده و ثبت ارسال</a></p>
</div>`;

  return { subject, text, html };
}