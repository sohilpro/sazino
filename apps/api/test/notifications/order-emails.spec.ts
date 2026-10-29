import { escapeHtml, sellerPaidEmail } from '../../src/notifications/order-emails';

const base = {
  storeName: 'فروشگاه دمو',
  orderNumber: 1005,
  total: 250_000,
  recipientName: 'علی رضایی',
  recipientPhone: '09121234567',
  items: [{ title: 'تیشرت', variant: 'M', quantity: 2 }],
  orderUrl: 'http://localhost:3001/orders/1005',
};

describe('escapeHtml', () => {
  it('escapes every dangerous character', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('sellerPaidEmail', () => {
  it('builds a readable subject, text and html', () => {
    const mail = sellerPaidEmail(base);
    expect(mail.subject).toContain('۱٬۰۰۵');
    expect(mail.subject).toContain('فروشگاه دمو');
    expect(mail.text).toContain('تیشرت (M)');
    expect(mail.text).toContain(base.orderUrl);
    expect(mail.html).toContain('dir="rtl"');
  });

  it('hides the default variant title', () => {
    const mail = sellerPaidEmail({ ...base, items: [{ title: 'کتاب', variant: 'پیش‌فرض', quantity: 1 }] });
    expect(mail.text).not.toContain('پیش‌فرض');
  });

  it('never lets user-controlled text become html', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const mail = sellerPaidEmail({
      ...base,
      storeName: evil,
      recipientName: evil,
      items: [{ title: evil, variant: evil, quantity: 1 }],
      orderUrl: 'http://x.test/?a="><script>',
    });
    expect(mail.html).not.toContain('<img');
    expect(mail.html).not.toContain('<script');
    expect(mail.html).toContain('&lt;img');
  });

  it('keeps header injection out of the subject', () => {
    const mail = sellerPaidEmail({ ...base, storeName: 'a\r\nBcc: evil@x.test' });
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });
});