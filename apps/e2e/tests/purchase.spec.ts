import { expect, test } from '@playwright/test';
import { randomPhone, readOtp } from './helpers';

// محصول فعال و تک‌تنوعه‌ی seed (پاوربانک seed پیش‌نویس است و در ویترین دیده نمی‌شود)
const PRODUCT_TITLE = 'هدفون بلوتوثی';
const PRODUCT_PATH = `/products/${encodeURIComponent('هدفون-بلوتوثی')}`;

test('a new customer buys a product and pays through the gateway', async ({ page }) => {
  const phone = randomPhone();

  await test.step('add the product to the cart', async () => {
    await page.goto(PRODUCT_PATH);

    // کلیک قبل از hydration اثری ندارد؛ همان صفحه را بدون reload تا ارسال درخواست سبد تکرار می‌کنیم
    await expect(async () => {
      const [response] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes('/api/storefront/cart/items') && r.request().method() === 'POST',
          { timeout: 4_000 },
        ),
        page.getByRole('button', { name: 'افزودن به سبد خرید' }).click(),
      ]);
      expect(response.ok(), `cart POST failed: ${response.status()} ${await response.text()}`).toBe(true);
    }).toPass({ timeout: 90_000, intervals: [500, 1_000, 2_000] });

    // سبد سمت مرورگر بعد از hydration بارگذاری می‌شود
    await page.goto('/cart');
    await expect(page.getByText(PRODUCT_TITLE).first()).toBeVisible({ timeout: 30_000 });
  });

  await test.step('sign in with an SMS code', async () => {
    await page.getByRole('link', { name: 'ورود و ادامه‌ی خرید' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByPlaceholder('09123456789').fill(phone);
    await page.getByRole('button', { name: 'دریافت کد تأیید' }).click();

    const code = await readOtp(phone);
    await page.getByPlaceholder('------').fill(code);
    await page.getByRole('button', { name: 'ورود', exact: true }).click();
    await expect(page).toHaveURL(/\/checkout/);
  });

  await test.step('add a delivery address', async () => {
    await page.getByLabel('نام گیرنده').fill('خریدار آزمایشی');
    await page.getByLabel('موبایل گیرنده').fill(phone);
    await page.getByLabel('استان').selectOption('تهران');
    await page.getByLabel('شهر').fill('تهران');
    await page.getByLabel('نشانی کامل').fill('خیابان آزمایش، پلاک ۱۲');
    await page.getByLabel('کد پستی (۱۰ رقم)').fill('1234567890');
    await page.getByRole('button', { name: 'ذخیره‌ی نشانی' }).click();
  });

  await test.step('place the order', async () => {
    await page.getByRole('button', { name: 'ثبت سفارش' }).click();
    await expect(page).toHaveURL(/\/orders\/\d+\?placed=1/);
  });

  await test.step('pay at the fake gateway', async () => {
    await page.getByRole('button', { name: 'پرداخت آنلاین' }).click();
    await expect(page).toHaveURL(/\/dev\/fake-gateway/);
    await page.getByRole('button', { name: 'پرداخت موفق' }).click();
    await expect(page).toHaveURL(/\/orders\/\d+\?paid=1/);
    await expect(page.getByText('پرداخت شما با موفقیت انجام شد')).toBeVisible();
  });
});

test('checkout asks anonymous visitors to sign in', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/login|\/cart/);
});

test('another store cannot see the demo store products', async ({ page }) => {
  const response = await page.goto(`http://acme.localhost:3000${PRODUCT_PATH}`);
  expect(response?.status()).toBe(404);
});