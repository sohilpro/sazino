<script setup lang="ts">
const dashboardUrl = useDashboardUrl();

// منوی موبایل
const mobileMenuOpen = ref(false);

// پرسش‌های متداول تعاملی (آکاردئون)
const activeFaq = ref<number | null>(0);
function toggleFaq(index: number) {
  activeFaq.value = activeFaq.value === index ? null : index;
}

const faqs = [
  {
    q: 'آیا برای ساخت سایت و فروشگاه در سازینو نیاز به دانش برنامه‌نویسی دارم؟',
    a: 'خیر! سازینو ۱۰۰٪ بدون نیاز به حتی یک خط کدنویسی طراحی شده است. شما از طریق پنل فارسی و ساده می‌توانید محصولات، تصاویر، دسته‌بندی‌ها و ظاهر فروشگاه را با چند کلیک بچینید.',
  },
  {
    q: 'چطور درگاه پرداخت بانکی را به فروشگاه متصل کنم و پول به کجا واریز می‌شود؟',
    a: 'سازینو با درگاه‌های پرداخت امن شاپرکی مانند زرین‌پال، سامان، سداد و ... سازگاری کامل دارد. پس از ثبت‌نام، مرچنت کد درگاه خود را در تنظیمات وارد می‌کنید و تمام مبالغ خرید مستقیماً به حساب بانکی خودتان واریز می‌شود.',
  },
  {
    q: 'آیا می‌توانم دامنه‌ی اختصاصی خودم (مثل myshop.ir یا mybrand.com) را وصل کنم؟',
    a: 'بله، در پلن‌های حرفه‌ای می‌توانید دامنه‌ی شخصی‌تان را به سادگی و فقط با تنظیم یک رکورد DNS به فروشگاه متصل کنید. گواهی امنیتی SSL (HTTPS) نیز به صورت کاملاً خودکار و رایگان برای دامنه‌تان صادر می‌شود.',
  },
  {
    q: 'وضعیت سئو (SEO) و رتبه در گوگل چگونه است؟',
    a: 'فروشگاه‌های سازینو بر پایه‌ی جدیدترین تکنولوژی Nuxt با رندر سمت سرور (SSR) ساخته شده‌اند. متاتگ‌های هوشمند، نقشه سایت خودکار (sitemap.xml)، ساختار استاندارد Schema.org و سرعت لود فوق‌العاده بالا، به فروشگاه شما کمک می‌کند سریع‌تر به صفحه اول گوگل برسد.',
  },
  {
    q: 'آیا در ابتدا باید هزینه‌ای پرداخت کنم؟',
    a: 'خیر! شما می‌توانید با پلن رایگان شروع کنید و تمام بخش‌های فروشگاه و پنل مدیریت را بدون پرداخت هیچ هزینه‌ای و بدون نیاز به وارد کردن کارت بانکی تست کنید و فروشگاه خود را بسازید.',
  },
  {
    q: 'آیا امکان ارتقا یا تغییر پلن در آینده وجود دارد؟',
    a: 'بله، هر زمان که کسب‌وکارتان رشد کرد، با یک کلیک از داخل پنل مدیریت می‌توانید پلن خود را ارتقا دهید بدون آنکه هیچ وقفه‌ای در عملکرد فروشگاه شما ایجاد شود.',
  },
];

const features = [
  {
    title: 'سایت‌ساز بصری و بلوکی',
    desc: 'چیدمان صفحات فروشگاه با بلوک‌های بنر، محصولات، گالری و متن‌های غنی بدون کدنویسی.',
    icon: 'layout',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    title: 'اتصال سریع درگاه‌های پرداخت',
    desc: 'سازگار با درگاه‌های رسمی شاپرک (زرین‌پال، سامان، سداد) با تسویه مستقیم به حساب شما.',
    icon: 'creditCard',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    title: 'دامنه‌ی اختصاصی + SSL رایگان',
    desc: 'دامنه‌ی دلخواه خودتان (.ir یا .com) را وصل کنید و بدون هزینه از پروتکل امن HTTPS بهره ببرید.',
    icon: 'globe',
    color: 'from-violet-500 to-purple-600',
  },
  {
    title: 'سئوی خودکار و سرعت رعدآسا',
    desc: 'رندر سروری Nuxt SSR با تولید خودکار متاتگ‌ها و سایت‌مپ برای فتح رتبه‌های نخست گوگل.',
    icon: 'sparkles',
    color: 'from-amber-500 to-orange-600',
  },
  {
    title: 'ورود سریع با پیامک (OTP)',
    desc: 'بدون فراموشی رمز عبور؛ مشتریان شما فقط با شماره موبایل و کد یکبارمصرف خرید می‌کنند.',
    icon: 'phone',
    color: 'from-rose-500 to-pink-600',
  },
  {
    title: 'کاملاً واکنش‌گرا برای موبایل',
    desc: 'تجربه خریدی فوق‌العاده سریع و روان روی گوشی‌های هوشمند که ۸۰٪ خریداران از آن استفاده می‌کنند.',
    icon: 'device',
    color: 'from-sky-500 to-cyan-600',
  },
  {
    title: 'مدیریت حرفه‌ای محصولات و انبار',
    desc: 'پشتیبانی از تنوع سایز، رنگ، SKU، کنترل موجودی و گزارش‌گیری پیشرفته از سفارش‌ها.',
    icon: 'box',
    color: 'from-indigo-500 to-blue-600',
  },
  {
    title: 'شخصی‌سازی تم، فونت و استایل',
    desc: 'پالت رنگی اختصاصی برندتان، فونت زیبای فارسی وزیرمتن و بارگذاری سریع لوگو و بنرها.',
    icon: 'palette',
    color: 'from-fuchsia-500 to-purple-600',
  },
];
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900 selection:bg-indigo-500 selection:text-white" dir="rtl">
    <!-- نوار اطلاعیه بالایی -->
    <aside aria-label="اطلاعیه" class="relative overflow-hidden bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm">
      <div class="flex items-center justify-center gap-2">
        <span class="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">جدید</span>
        <span>پلتفرم سایت‌ساز و فروشگاه‌ساز سازینو راه‌اندازی شد — بدون نیاز به کدنویسی</span>
        <a :href="`${dashboardUrl}/register`" class="hidden underline decoration-white/60 underline-offset-4 hover:decoration-white sm:inline font-bold">
          ساخت رایگان در ۲ دقیقه ←
        </a>
      </div>
    </aside>

    <!-- هدر و ناوبری اصلی -->
    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <!-- لوگو و برند -->
        <div class="flex items-center gap-3">
          <NuxtLink to="/" class="flex items-center gap-2.5">
            <div class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20">
              <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.614A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.651h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
              </svg>
            </div>
            <div class="flex flex-col">
              <span class="text-xl font-black tracking-tight text-slate-900">سازینو</span>
              <span class="text-[10px] font-bold text-indigo-600">سایت‌ساز و فروشگاه‌ساز ابری</span>
            </div>
          </NuxtLink>
        </div>

        <!-- پیوندهای ناوبری دسکتاپ -->
        <nav class="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
          <a href="#features" class="transition hover:text-indigo-600">امکانات و قابلیت‌ها</a>
          <a href="#how-it-works" class="transition hover:text-indigo-600">چطور کار می‌کند؟</a>
          <a href="#showcase" class="transition hover:text-indigo-600">فروشگاه‌های نمونه</a>
          <a href="#comparison" class="transition hover:text-indigo-600">چرا سازینو؟</a>
          <a href="#pricing" class="transition hover:text-indigo-600">تعرفه‌ها</a>
          <a href="#faq" class="transition hover:text-indigo-600">سوالات متداول</a>
        </nav>

        <!-- دکمه‌های اکشن ورود و ثبت نام -->
        <div class="flex items-center gap-2.5">
          <a
            :href="`${dashboardUrl}/login`"
            class="hidden rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
          >
            ورود به پنل
          </a>
          <a
            :href="`${dashboardUrl}/register`"
            class="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>ساخت رایگان فروشگاه</span>
          </a>

          <!-- دکمه منوی موبایل -->
          <button
            type="button"
            class="flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
            aria-label="منو"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <svg v-if="!mobileMenuOpen" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            <svg v-else class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- دراور منوی موبایل -->
      <div v-if="mobileMenuOpen" class="border-t border-slate-200 bg-white px-4 py-5 shadow-xl lg:hidden">
        <div class="flex flex-col gap-3 text-sm font-semibold text-slate-700">
          <a href="#features" class="py-2 transition hover:text-indigo-600" @click="mobileMenuOpen = false">امکانات و قابلیت‌ها</a>
          <a href="#how-it-works" class="py-2 transition hover:text-indigo-600" @click="mobileMenuOpen = false">چطور کار می‌کند؟</a>
          <a href="#showcase" class="py-2 transition hover:text-indigo-600" @click="mobileMenuOpen = false">فروشگاه‌های نمونه</a>
          <a href="#comparison" class="py-2 transition hover:text-indigo-600" @click="mobileMenuOpen = false">چرا سازینو؟</a>
          <a href="#pricing" class="py-2 transition hover:text-indigo-600" @click="mobileMenuOpen = false">تعرفه‌ها</a>
          <a href="#faq" class="py-2 transition hover:text-indigo-600" @click="mobileMenuOpen = false">سوالات متداول</a>
          <hr class="my-2 border-slate-200" />
          <a :href="`${dashboardUrl}/login`" class="py-2 text-center font-bold text-slate-800">ورود به پنل مدیریت</a>
        </div>
      </div>
    </header>

    <!-- بخش اصلی HERO -->
    <section class="relative overflow-hidden bg-gradient-to-b from-indigo-50/70 via-white to-white py-16 sm:py-24 lg:py-28">
      <!-- هاله‌های رنگی مدرن پشت زمینه -->
      <div class="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-full max-w-7xl -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-200/50 via-purple-100/30 to-transparent blur-3xl"></div>

      <div class="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <!-- بج معرفی -->
        <div class="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3.5 py-1.5 shadow-xs transition hover:border-indigo-300">
          <span class="flex size-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs font-bold text-slate-700 sm:text-sm">ساده‌ترین و قدرتمندترین سایت‌ساز بدون کد ایران</span>
        </div>

        <!-- تیتر اصلی جذاب -->
        <h1 class="mx-auto mt-6 max-w-4xl text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          سایت و فروشگاه آنلاین خودت رو
          <span class="mt-2 block bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            در کمتر از ۲ دقیقه بساز!
          </span>
        </h1>

        <!-- زیرتیتر توضیحی -->
        <p class="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
          سازینو یک پلتفرم ابری کامل برای ساخت سایت و فروشگاه اینترنتی است. بدون نیاز به یک کلمه کدنویسی، فروشگاه حرفه‌ای با درگاه پرداخت بانکی، سئوی خودکار و دامنه‌ی اختصاصی راه بندازید و همین امروز فروش رو شروع کنید.
        </p>

        <!-- دکمه‌های فراخوان (CTAs) -->
        <div class="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row sm:gap-4">
          <a
            :href="`${dashboardUrl}/register`"
            class="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-7 py-4 text-base font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-xl hover:shadow-indigo-500/40 sm:w-auto"
          >
            <span>شروع رایگان — ساخت فوری فروشگاه</span>
            <svg class="size-5 transition-transform group-hover:-translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </a>

          <a
            href="http://demo.localhost:3000"
            target="_blank"
            class="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-base font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-400 sm:w-auto"
          >
            <svg class="size-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <span>مشاهده فروشگاه دمو (زنده)</span>
          </a>
        </div>

        <!-- ویژگی‌های اطمینان‌بخش -->
        <div class="mt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-semibold text-slate-500 sm:text-sm">
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
            </svg>
            بدون نیاز به کارت بانکی
          </span>
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
            </svg>
            راه‌اندازی فوری در چند ثانیه
          </span>
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
            </svg>
            دامنه‌ی اختصاصی + SSL رایگان
          </span>
          <span class="flex items-center gap-1.5">
            <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
            </svg>
            پشتیبانی ۲۴ ساعته
          </span>
        </div>

        <!-- پیش‌نمایش موکاپ ویترین و داشبورد -->
        <div class="relative mx-auto mt-12 max-w-5xl">
          <div class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-slate-900/5">
            <!-- نوار آدرس مرورگر -->
            <div class="flex items-center gap-2 border-b border-slate-200 bg-slate-100/80 px-4 py-2.5">
              <div class="flex items-center gap-1.5">
                <span class="size-3 rounded-full bg-red-400"></span>
                <span class="size-3 rounded-full bg-amber-400"></span>
                <span class="size-3 rounded-full bg-emerald-400"></span>
              </div>
              <div class="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-lg bg-white px-3 py-1 text-xs text-slate-500 shadow-xs" dir="ltr">
                <svg class="size-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clip-rule="evenodd" />
                </svg>
                <span class="font-medium text-slate-700">https://yourshop.sazino.ir</span>
              </div>
            </div>

            <!-- نمای داخل فروشگاه موکاپ -->
            <div class="bg-slate-50 p-4 sm:p-6 text-start">
              <!-- هدر نمونه فروشگاه -->
              <div class="flex items-center justify-between rounded-xl bg-white p-3 shadow-xs">
                <div class="flex items-center gap-2.5">
                  <div class="flex size-9 items-center justify-center rounded-lg bg-indigo-600 font-black text-white">ش</div>
                  <div>
                    <div class="text-sm font-bold text-slate-900">فروشگاه شیک‌پوشان</div>
                    <div class="text-[11px] text-slate-400">لباس و مد روز</div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">سبد خرید (۳)</span>
                  <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">ورود خریدار</span>
                </div>
              </div>

              <!-- بنر فروشگاه -->
              <div class="mt-4 rounded-xl bg-gradient-to-l from-indigo-700 via-indigo-600 to-purple-700 p-5 text-white">
                <span class="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">حراج میان فصل</span>
                <h3 class="mt-2 text-lg font-black sm:text-xl">تخفیف تا ۵۰٪ روی تمام محصولات زمستانه</h3>
                <p class="mt-1 text-xs text-indigo-100">ارسال رایگان به سراسر کشور برای خریدهای بالای ۵۰۰ هزار تومان</p>
              </div>

              <!-- محصولات نمونه موکاپ -->
              <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                  <div class="aspect-square rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                    <svg class="size-8 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                    </svg>
                  </div>
                  <div class="mt-2 text-xs font-bold text-slate-800">تیشرت نخی ممتاز</div>
                  <div class="mt-1 flex items-center justify-between text-xs">
                    <span class="font-extrabold text-indigo-600">۴۵۰,۰۰۰ تومان</span>
                    <span class="rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-bold text-emerald-600">موجود</span>
                  </div>
                </div>

                <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                  <div class="aspect-square rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                    <svg class="size-8 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </div>
                  <div class="mt-2 text-xs font-bold text-slate-800">شلوار جین راسته</div>
                  <div class="mt-1 flex items-center justify-between text-xs">
                    <span class="font-extrabold text-indigo-600">۱,۲۰۰,۰۰۰ تومان</span>
                    <span class="rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-bold text-emerald-600">موجود</span>
                  </div>
                </div>

                <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                  <div class="aspect-square rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                    <svg class="size-8 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                    </svg>
                  </div>
                  <div class="mt-2 text-xs font-bold text-slate-800">هدفون بلوتوثی Pro</div>
                  <div class="mt-1 flex items-center justify-between text-xs">
                    <span class="font-extrabold text-indigo-600">۲,۳۰۰,۰۰۰ تومان</span>
                    <span class="rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-bold text-emerald-600">موجود</span>
                  </div>
                </div>

                <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                  <div class="aspect-square rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                    <svg class="size-8 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <div class="mt-2 text-xs font-bold text-slate-800">کوله پشتی چرم</div>
                  <div class="mt-1 flex items-center justify-between text-xs">
                    <span class="font-extrabold text-indigo-600">۸۹۰,۰۰۰ تومان</span>
                    <span class="rounded bg-amber-50 px-1 py-0.5 text-[10px] font-bold text-amber-700">تنها ۲ عدد</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- کارت شناور آمار فروش زنده -->
          <div class="absolute -bottom-6 -right-4 hidden rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md sm:flex sm:items-center sm:gap-3 text-start">
            <div class="flex size-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
              <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6H2.25m0 0H3m0 0h1.5a.75.75 0 0 1 .75.75V9m0 0H4.5m0 0H3m0 0h1.5a.75.75 0 0 1 .75.75V12m0 0H4.5m0 0H3m0 0h1.5a.75.75 0 0 1 .75.75v3.75m16.5-12.75v.75a.75.75 0 0 1-.75.75h-.75m0 0H18m0 0h-1.5a.75.75 0 0 1-.75-.75V3m0 0h-3.75M9 3v18" />
              </svg>
            </div>
            <div>
              <div class="text-[11px] font-medium text-slate-500">سفارش جدید پرداخت شد!</div>
              <div class="text-sm font-extrabold text-slate-900">+ ۱,۴۵۰,۰۰۰ تومان (زرین‌پال)</div>
            </div>
          </div>

          <!-- کارت شناور سئو و سرعت -->
          <div class="absolute -top-5 -left-4 hidden rounded-2xl border border-slate-200 bg-white/95 p-3.5 shadow-xl backdrop-blur-md sm:flex sm:items-center sm:gap-3 text-start">
            <div class="flex size-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20">
              <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
              </svg>
            </div>
            <div>
              <div class="text-[11px] font-medium text-slate-500">امتیاز سرعت گوگل PageSpeed</div>
              <div class="text-sm font-extrabold text-emerald-600">۹۹ از ۱۰۰ • لود در ۰.۳ ثانیه</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- نوار آمار زنده و اعتبار پلتفرم -->
    <section class="border-y border-slate-200 bg-slate-50/60 py-10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
          <div class="p-3">
            <div class="text-3xl font-black text-indigo-600 sm:text-4xl">+۵,۲۰۰</div>
            <div class="mt-1 text-xs font-semibold text-slate-600 sm:text-sm">فروشگاه فعال در سراسر ایران</div>
          </div>
          <div class="p-3">
            <div class="text-3xl font-black text-indigo-600 sm:text-4xl">۹۹.۹۸٪</div>
            <div class="mt-1 text-xs font-semibold text-slate-600 sm:text-sm">پایداری و در دسترس بودن سرورها</div>
          </div>
          <div class="p-3">
            <div class="text-3xl font-black text-indigo-600 sm:text-4xl">۲ دقیقه</div>
            <div class="mt-1 text-xs font-semibold text-slate-600 sm:text-sm">میانگین زمان راه‌اندازی فروشگاه</div>
          </div>
          <div class="p-3">
            <div class="text-3xl font-black text-indigo-600 sm:text-4xl">+۶۵ میلیارد</div>
            <div class="mt-1 text-xs font-semibold text-slate-600 sm:text-sm">تومان تراکنش مالی موفق</div>
          </div>
        </div>
      </div>
    </section>

    <!-- بخش ویژگی‌ها و قابلیت‌ها -->
    <section id="features" class="py-20 sm:py-28">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">امکانات فوق‌العاده</span>
          <h2 class="mt-3 text-2xl font-black text-slate-900 sm:text-4xl">همه چیز برای فروش اینترنتی در یک جا</h2>
          <p class="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            سازینو تمام پیچیدگی‌های فنی، درگاه بانکی، هاست و سئو را برای شما حل کرده تا فقط روی افزایش فروش تمرکز کنید.
          </p>
        </div>

        <div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="(feat, idx) in features"
            :key="idx"
            class="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/5 text-start"
          >
            <div class="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md shadow-indigo-500/15" :class="feat.color">
              <!-- آیکون‌های متناسب با قابلیت -->
              <svg v-if="feat.icon === 'layout'" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
              <svg v-else-if="feat.icon === 'creditCard'" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-6 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
              </svg>
              <svg v-else-if="feat.icon === 'globe'" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <svg v-else-if="feat.icon === 'sparkles'" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
              <svg v-else-if="feat.icon === 'phone'" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
              <svg v-else-if="feat.icon === 'device'" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
              </svg>
              <svg v-else-if="feat.icon === 'box'" class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
              </svg>
              <svg v-else class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
              </svg>
            </div>
            <h3 class="mt-4 text-base font-extrabold text-slate-900">{{ feat.title }}</h3>
            <p class="mt-2 text-xs leading-6 text-slate-500">{{ feat.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- بخش چطور کار می‌کند؟ (۳ مرحله تا راه‌اندازی) -->
    <section id="how-it-works" class="border-t border-slate-200 bg-slate-50/70 py-20 sm:py-28">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">ساده و سریع</span>
          <h2 class="mt-3 text-2xl font-black text-slate-900 sm:text-4xl">تنها در ۳ مرحله فروشگاهت را بساز</h2>
          <p class="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            از لحظه ثبت‌نام تا دریافت اولین سفارش مشتری، فقط چند دقیقه زمان می‌برد.
          </p>
        </div>

        <div class="mt-16 grid gap-8 md:grid-cols-3">
          <!-- مرحله اول -->
          <div class="relative rounded-2xl border border-slate-200 bg-white p-7 shadow-xs text-start">
            <div class="flex size-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-black text-white shadow-md shadow-indigo-600/20">
              ۱
            </div>
            <h3 class="mt-5 text-lg font-extrabold text-slate-900">ثبت‌نام و انتخاب نام فروشگاه</h3>
            <p class="mt-2 text-xs leading-6 text-slate-600">
              فقط در ۳۰ ثانیه با ایمیل ثبت‌نام کنید. نام برندتان را انتخاب کنید و ساب‌دامین اختصاصی و رایگانتان را بلافاصله دریافت نمایید.
            </p>
            <div class="mt-4 rounded-lg bg-indigo-50/70 p-2.5 text-xs text-indigo-700 font-medium">
              مثال: myshop.localhost یا myshop.sazino.ir
            </div>
          </div>

          <!-- مرحله دوم -->
          <div class="relative rounded-2xl border border-slate-200 bg-white p-7 shadow-xs text-start">
            <div class="flex size-12 items-center justify-center rounded-xl bg-purple-600 text-lg font-black text-white shadow-md shadow-purple-600/20">
              ۲
            </div>
            <h3 class="mt-5 text-lg font-extrabold text-slate-900">محصولاتت را بگذار و تم را تنظیم کن</h3>
            <p class="mt-2 text-xs leading-6 text-slate-600">
              عکس‌های محصولاتتان را آپلود کنید، قیمت‌ها و موجودی را وارد کنید، رنگ سازمانی و لوگوی خود را تنظیم کنید.
            </p>
            <div class="mt-4 rounded-lg bg-purple-50/70 p-2.5 text-xs text-purple-700 font-medium">
              ویرایشگر بصری صفحات با پیش‌نمایش آنی
            </div>
          </div>

          <!-- مرحله سوم -->
          <div class="relative rounded-2xl border border-slate-200 bg-white p-7 shadow-xs text-start">
            <div class="flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white shadow-md shadow-emerald-600/20">
              ۳
            </div>
            <h3 class="mt-5 text-lg font-extrabold text-slate-900">شروع فروش و دریافت سفارش‌ها</h3>
            <p class="mt-2 text-xs leading-6 text-slate-600">
              لینک اختصاصی فروشگاهت را در بیو اینستاگرام، تلگرام و مشتریان بفرست؛ مشتریان آنلاین پرداخت می‌کنند و پول به حسابت می‌آید.
            </p>
            <div class="mt-4 rounded-lg bg-emerald-50/70 p-2.5 text-xs text-emerald-700 font-medium">
              تسویه مستقیم شاپرک بدون معطلی
            </div>
          </div>
        </div>

        <div class="mt-12 text-center">
          <a
            :href="`${dashboardUrl}/register`"
            class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-700"
          >
            <span>همین حالا فروشگاه خودت رو بساز ←</span>
          </a>
        </div>
      </div>
    </section>

    <!-- بخش فروشگاه‌های نمونه و دمو (Showcase) -->
    <section id="showcase" class="py-20 sm:py-28">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">نمونه‌های واقعی</span>
          <h2 class="mt-3 text-2xl font-black text-slate-900 sm:text-4xl">فروشگاه‌های ساخته‌شده با سازینو</h2>
          <p class="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            می‌توانید همین الان فروشگاه‌های نمونه فعال روی سیستم را به صورت زنده بررسی کنید و تجربه خرید واقعی را تست نمایید!
          </p>
        </div>

        <div class="mt-14 grid gap-8 md:grid-cols-2">
          <!-- کارت دموی ۱: فروشگاه دمو (demo.localhost) -->
          <div class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-indigo-400 hover:shadow-xl text-start">
            <div class="relative bg-gradient-to-br from-indigo-600 to-indigo-800 p-6 text-white">
              <div class="flex items-center justify-between">
                <span class="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">دموی آماده و فعال</span>
                <span class="text-xs text-indigo-200" dir="ltr">demo.localhost:3000</span>
              </div>
              <h3 class="mt-4 text-xl font-black">فروشگاه پوشاک و استایل دمو</h3>
              <p class="mt-1 text-xs text-indigo-100">فروشگاه نمونه با پالت رنگی نیلی، دسته‌بندی پوشاک، گالری محصولات و فرآیند کامل تسویه‌حساب.</p>
            </div>
            <div class="p-6">
              <div class="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span class="rounded-md bg-slate-100 px-2.5 py-1">قالب مدرن پوشاک</span>
                <span class="rounded-md bg-slate-100 px-2.5 py-1">تنوع سایز S, M, L</span>
                <span class="rounded-md bg-slate-100 px-2.5 py-1">درگاه تستی شاپرک</span>
              </div>
              <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <a
                  href="http://demo.localhost:3000"
                  target="_blank"
                  class="inline-flex items-center gap-1.5 font-bold text-indigo-600 transition hover:text-indigo-800"
                >
                  <span>مشاهده آنلاین فروشگاه دمو</span>
                  <svg class="size-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z" clip-rule="evenodd" />
                  </svg>
                </a>
                <span class="text-xs text-slate-400">کلیک برای مشاهده زنده</span>
              </div>
            </div>
          </div>

          <!-- کارت دموی ۲: فروشگاه دیجیتال اکمی (acme.localhost) -->
          <div class="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-rose-400 hover:shadow-xl text-start">
            <div class="relative bg-gradient-to-br from-rose-600 to-rose-800 p-6 text-white">
              <div class="flex items-center justify-between">
                <span class="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">دموی تکنولوژی</span>
                <span class="text-xs text-rose-200" dir="ltr">acme.localhost:3000</span>
              </div>
              <h3 class="mt-4 text-xl font-black">فروشگاه دیجیتال و اکسسوری اکمی</h3>
              <p class="mt-1 text-xs text-rose-100">فروشگاه نمونه با پالت رنگی قرمز، لوازم جانبی دیجیتال، هدفون و ساعت هوشمند با تم اختصاصی.</p>
            </div>
            <div class="p-6">
              <div class="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                <span class="rounded-md bg-slate-100 px-2.5 py-1">تم تیره و قرمز</span>
                <span class="rounded-md bg-slate-100 px-2.5 py-1">لوازم دیجیتال</span>
                <span class="rounded-md bg-slate-100 px-2.5 py-1">سئوی اختصاصی</span>
              </div>
              <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <a
                  href="http://acme.localhost:3000"
                  target="_blank"
                  class="inline-flex items-center gap-1.5 font-bold text-rose-600 transition hover:text-rose-800"
                >
                  <span>مشاهده آنلاین فروشگاه اکمی</span>
                  <svg class="size-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.22 14.78a.75.75 0 0 0 1.06 0l7.22-7.22v5.69a.75.75 0 0 0 1.5 0v-7.5a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0 0 1.5h5.69l-7.22 7.22a.75.75 0 0 0 0 1.06Z" clip-rule="evenodd" />
                  </svg>
                </a>
                <span class="text-xs text-slate-400">کلیک برای مشاهده زنده</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- جدول مقایسه: سازینو در برابر روش‌های سنتی -->
    <section id="comparison" class="border-t border-slate-200 bg-slate-50/70 py-20 sm:py-28">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">مقایسه هوشمند</span>
          <h2 class="mt-3 text-2xl font-black text-slate-900 sm:text-4xl">چرا سازینو بهترین انتخاب است؟</h2>
          <p class="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            تفاوت سازینو با روش‌های پیچیده و پرهزینه مانند وردپرس و برنامه‌نویسی اختصاصی
          </p>
        </div>

        <div class="mt-12 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table class="w-full min-w-[600px] text-right text-sm">
            <thead class="border-b border-slate-200 bg-slate-50 text-xs font-extrabold text-slate-700">
              <tr>
                <th class="p-4">ویژگی / معیار</th>
                <th class="p-4 text-indigo-600 bg-indigo-50/50">سازینو (ابری و هوشمند)</th>
                <th class="p-4 text-slate-500">وردپرس و ووکامرس</th>
                <th class="p-4 text-slate-500">کدنویسی اختصاصی</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs sm:text-sm">
              <tr>
                <td class="p-4 font-bold text-slate-900">زمان راه‌اندازی</td>
                <td class="p-4 font-bold text-indigo-600 bg-indigo-50/30">کمتر از ۲ دقیقه</td>
                <td class="p-4 text-slate-600">۲ تا ۴ هفته</td>
                <td class="p-4 text-slate-600">۳ تا ۶ ماه</td>
              </tr>
              <tr>
                <td class="p-4 font-bold text-slate-900">هزینه اولیه راه‌اندازی</td>
                <td class="p-4 font-bold text-indigo-600 bg-indigo-50/30">رایگان</td>
                <td class="p-4 text-slate-600">۵ تا ۲۰ میلیون تومان</td>
                <td class="p-4 text-slate-600">۵۰ تا ۲۰۰ میلیون تومان</td>
              </tr>
              <tr>
                <td class="p-4 font-bold text-slate-900">نیاز به خرید هاست و سرور</td>
                <td class="p-4 font-bold text-emerald-600 bg-indigo-50/30">بی‌نیاز (هاست ابری رایگان)</td>
                <td class="p-4 text-slate-600">سالانه ۲ تا ۱۰ میلیون تومان</td>
                <td class="p-4 text-slate-600">هزینه‌های سنگین سرور اختصاصی</td>
              </tr>
              <tr>
                <td class="p-4 font-bold text-slate-900">گواهی امنیتی SSL و آپدیت‌ها</td>
                <td class="p-4 font-bold text-emerald-600 bg-indigo-50/30">خودکار و رایگان</td>
                <td class="p-4 text-slate-600">دستی و خطر باگ امنیتی</td>
                <td class="p-4 text-slate-600">نیازمند قرارداد پشتیبانی</td>
              </tr>
              <tr>
                <td class="p-4 font-bold text-slate-900">سرعت بارگذاری و سئو</td>
                <td class="p-4 font-bold text-indigo-600 bg-indigo-50/30">معماری Nuxt SSR فوق‌سریع</td>
                <td class="p-4 text-slate-600">کند به دلیل افزونه‌های متعدد</td>
                <td class="p-4 text-slate-600">بسته به کیفیت برنامه‌نویس</td>
              </tr>
              <tr>
                <td class="p-4 font-bold text-slate-900">درگاه پرداخت و تسویه</td>
                <td class="p-4 font-bold text-emerald-600 bg-indigo-50/30">آماده و با اتصال مستقیم</td>
                <td class="p-4 text-slate-600">نیازمند نصب و کانفیگ پلاگین</td>
                <td class="p-4 text-slate-600">برنامه‌نویسی و تأییدیه فنی</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- بخش پلن‌ها و تعرفه‌ها -->
    <section id="pricing" class="py-20 sm:py-28">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">تعرفه‌های منصفانه</span>
          <h2 class="mt-3 text-2xl font-black text-slate-900 sm:text-4xl">پلن مناسب کسب‌وکار خود را انتخاب کنید</h2>
          <p class="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            شفاف، بدون هزینه‌های پنهان، با قابلیت ارتقای لحظه‌ای در پنل مدیریت
          </p>
        </div>

        <div class="mt-14 grid gap-8 lg:grid-cols-3 text-start">
          <!-- پلن پایه (رایگان) -->
          <div class="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
            <div>
              <span class="text-sm font-bold text-slate-500">پلن شروع</span>
              <h3 class="mt-2 text-2xl font-black text-slate-900">رایگان همیشگی</h3>
              <p class="mt-2 text-xs leading-6 text-slate-500">مناسب راه‌اندازی و تست فروشگاه برای کسب‌وکارهای نوپا</p>
              <div class="mt-6 flex items-baseline gap-1">
                <span class="text-4xl font-black text-slate-900">۰</span>
                <span class="text-sm font-bold text-slate-500">تومان / ماهانه</span>
              </div>
              <ul class="mt-8 space-y-3.5 text-xs text-slate-600">
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>تا ۱۰ محصول فعال</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>ساب‌دامین اختصاصی سازینو</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>اتصال به درگاه پرداخت آنلاین</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>میزبانی و پهنای باند نامحدود</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>پنل مدیریت فروشنده</span>
                </li>
              </ul>
            </div>
            <a
              :href="`${dashboardUrl}/register`"
              class="mt-8 block rounded-xl border border-slate-300 bg-white py-3 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              شروع رایگان
            </a>
          </div>

          <!-- پلن حرفه‌ای (Pro) با هایلایت ویژه -->
          <div class="relative flex flex-col justify-between rounded-3xl border-2 border-indigo-600 bg-white p-8 shadow-2xl shadow-indigo-500/10">
            <span class="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-1 text-xs font-black text-white shadow-md">
              محبوب‌ترین انتخاب فروشندگان
            </span>
            <div>
              <span class="text-sm font-bold text-indigo-600">پلن حرفه‌ای (Pro)</span>
              <h3 class="mt-2 text-2xl font-black text-slate-900">کسب‌وکارهای فعال</h3>
              <p class="mt-2 text-xs leading-6 text-slate-500">برای فروشگاه‌های اینستاگرامی و برندهایی که دامنه‌ی شخصی می‌خواهند</p>
              <div class="mt-6 flex items-baseline gap-1">
                <span class="text-4xl font-black text-indigo-600">۲۹۰,۰۰۰</span>
                <span class="text-sm font-bold text-slate-500">تومان / ماهانه</span>
              </div>
              <ul class="mt-8 space-y-3.5 text-xs text-slate-700">
                <li class="flex items-center gap-2.5 font-bold">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>تا ۵۰۰ محصول فعال</span>
                </li>
                <li class="flex items-center gap-2.5 font-bold">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>امکان اتصال دامنه‌ی اختصاصی (.ir / .com)</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>گواهی امنیتی SSL نامحدود و رایگان</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>ادیتور پیشرفته صفحات و بلوک‌ها</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>شخصی‌سازی کامل تم، رنگ و فونت‌ها</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>بدون هیچ‌گونه کارمزد اضافی روی فروش</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>پشتیبانی اولویت‌دار تیکت و چت</span>
                </li>
              </ul>
            </div>
            <a
              :href="`${dashboardUrl}/register`"
              class="mt-8 block rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3.5 text-center text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition hover:from-indigo-700 hover:to-purple-700 hover:shadow-lg"
            >
              انتخاب پلن حرفه‌ای
            </a>
          </div>

          <!-- پلن سازمانی (Enterprise) -->
          <div class="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-8 shadow-xs">
            <div>
              <span class="text-sm font-bold text-slate-500">پلن سازمانی</span>
              <h3 class="mt-2 text-2xl font-black text-slate-900">فروشگاه‌های بزرگ</h3>
              <p class="mt-2 text-xs leading-6 text-slate-500">برای برندهای پرفروش با نیاز به پهنای باند و خدمات ویژه</p>
              <div class="mt-6 flex items-baseline gap-1">
                <span class="text-4xl font-black text-slate-900">۷۹۰,۰۰۰</span>
                <span class="text-sm font-bold text-slate-500">تومان / ماهانه</span>
              </div>
              <ul class="mt-8 space-y-3.5 text-xs text-slate-600">
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>تعداد محصولات نامحدود</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>اتصال چند دامنه‌ی همزمان</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>بالاترین منابع سرور و اولویت پردازش</span>
                </li>
                <li class="flex items-center gap-2.5">
                  <svg class="size-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
                  </svg>
                  <span>مدیر اختصاصی حساب و پشتیبانی تلفنی VIP</span>
                </li>
              </ul>
            </div>
            <a
              :href="`${dashboardUrl}/register`"
              class="mt-8 block rounded-xl border border-slate-300 bg-white py-3 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              مشاوره سازمانی
            </a>
          </div>
        </div>
      </div>
    </section>

    <!-- نظرات مشتریان و فروشندگان موفق -->
    <section id="testimonials" class="border-t border-slate-200 bg-slate-50/70 py-20 sm:py-28">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">صدای مشتریان</span>
          <h2 class="mt-3 text-2xl font-black text-slate-900 sm:text-4xl">فروشندگانی که با سازینو اوج گرفتند</h2>
          <p class="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            ببینید صاحبان کسب‌وکارها درباره سادگی و سرعت سازینو چه می‌گویند
          </p>
        </div>

        <div class="mt-14 grid gap-8 md:grid-cols-3 text-start">
          <div class="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
            <div class="flex items-center gap-1 text-amber-400">
              <span v-for="i in 5" :key="i">★</span>
            </div>
            <p class="mt-4 text-xs leading-7 text-slate-600">
              «قبلاً در دایرکت اینستاگرام شماره کارت می‌دادم و مدام سر فیش‌های فیک ضرر می‌کردم. با سازینو در کمتر از نیم ساعت فروشگاهم را ساختم، درگاه زرین‌پال وصل شد و الان مشتریانم مستقیم خرید می‌کنند.»
            </p>
            <div class="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div class="flex size-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">م</div>
              <div>
                <div class="text-xs font-bold text-slate-900">مریم احمدی</div>
                <div class="text-[11px] text-slate-400">مدیر مزون لباس باران</div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
            <div class="flex items-center gap-1 text-amber-400">
              <span v-for="i in 5" :key="i">★</span>
            </div>
            <p class="mt-4 text-xs leading-7 text-slate-600">
              «سرعت لود سایت فوق‌العاده‌ست. ما قبلاً روی وردپرس بودیم و سرور مدام قطع می‌شد، اما سازینو چون کاملاً مدرن و با Nuxt ساخته شده، حتی در حراج‌های چند هزار نفری هم بدون ثانیه‌ای قطعی کار می‌کنه.»
            </p>
            <div class="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div class="flex size-10 items-center justify-center rounded-full bg-purple-100 font-bold text-purple-700">ک</div>
              <div>
                <div class="text-xs font-bold text-slate-900">کامران صادقی</div>
                <div class="text-[11px] text-slate-400">فروشگاه آنلاین دیجیتال‌لند</div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
            <div class="flex items-center gap-1 text-amber-400">
              <span v-for="i in 5" :key="i">★</span>
            </div>
            <p class="mt-4 text-xs leading-7 text-slate-600">
              «بهترین قسمتش این بود که نیازی به استخدام برنامه‌نویس نداشتم. خودم رنگ، عکس‌ها و دسته‌بندی‌ها رو چیدم و دامنه‌ی .ir خودم رو وصل کردم. پشتیبانی‌شون هم عالی و پاسخگو بود.»
            </p>
            <div class="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div class="flex size-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">س</div>
              <div>
                <div class="text-xs font-bold text-slate-900">سارا رضوانی</div>
                <div class="text-[11px] text-slate-400">صنایع دستی و سرامیک ترنج</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- بخش پرسش‌های متداول (FAQ Accordion) -->
    <section id="faq" class="py-20 sm:py-28">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div class="text-center">
          <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">پاسخ به ابهامات</span>
          <h2 class="mt-3 text-2xl font-black text-slate-900 sm:text-4xl">پرسش‌های متداول</h2>
          <p class="mx-auto mt-3 max-w-xl text-sm text-slate-600">
            پاسخ سوالاتی که اغلب کاربران پیش از شروع راه‌اندازی فروشگاه دارند
          </p>
        </div>

        <div class="mt-12 space-y-3.5">
          <div
            v-for="(item, idx) in faqs"
            :key="idx"
            class="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 text-start"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between p-5 text-start font-bold text-slate-800 transition hover:text-indigo-600"
              @click="toggleFaq(idx)"
            >
              <span class="text-sm sm:text-base">{{ item.q }}</span>
              <svg
                class="size-5 shrink-0 text-slate-400 transition-transform duration-200"
                :class="{ 'rotate-180 text-indigo-600': activeFaq === idx }"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fill-rule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
              </svg>
            </button>
            <div
              v-show="activeFaq === idx"
              class="border-t border-slate-100 bg-slate-50/50 px-5 py-4 text-xs leading-7 text-slate-600 sm:text-sm"
            >
              {{ item.a }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- بخش نهایی فراخوان به عمل (Bottom CTA) -->
    <section class="relative overflow-hidden bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 py-16 text-white sm:py-20">
      <div class="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <h2 class="text-2xl font-black sm:text-4xl">همین امروز کسب‌وکار آنلاین خود را راه‌اندازی کنید</h2>
        <p class="mx-auto mt-4 max-w-2xl text-sm leading-7 text-indigo-100 sm:text-base">
          بیش از ۵,۰۰۰ فروشنده موفق به سازینو اعتماد کرده‌اند. کمتر از ۲ دقیقه تا ساخت وبسایت و فروشگاه اینترنتی شما فاصله است.
        </p>
        <div class="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row sm:gap-4">
          <a
            :href="`${dashboardUrl}/register`"
            class="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-black text-indigo-700 shadow-xl transition hover:bg-indigo-50 sm:w-auto active:scale-95"
          >
            <span>ساخت رایگان فروشگاه اینترنتی 🚀</span>
          </a>
          <a
            :href="`${dashboardUrl}/login`"
            class="inline-flex w-full items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-6 py-4 text-base font-bold text-white backdrop-blur transition hover:bg-white/20 sm:w-auto"
          >
            ورود به پنل مدیریت
          </a>
        </div>
      </div>
    </section>

    <!-- فوتر کامل و معتبر -->
    <footer class="border-t border-slate-200 bg-slate-900 py-12 text-slate-400">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-start">
        <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <!-- ستون ۱: درباره سازینو -->
          <div class="space-y-4">
            <div class="flex items-center gap-2 text-white">
              <div class="flex size-9 items-center justify-center rounded-xl bg-indigo-600 font-black text-white">س</div>
              <span class="text-xl font-black">سازینو</span>
            </div>
            <p class="text-xs leading-6 text-slate-400">
              پلتفرم مدرن و ابری سایت‌ساز و فروشگاه‌ساز بدون نیاز به کدنویسی. سریع‌ترین راه برای تبدیل ایده‌ها به فروشگاه‌های آنلاین پرسود.
            </p>
          </div>

          <!-- ستون ۲: دسترسی سریع -->
          <div>
            <h4 class="text-sm font-bold text-white">دسترسی سریع</h4>
            <ul class="mt-4 space-y-2.5 text-xs">
              <li><a href="#features" class="transition hover:text-white">امکانات پلتفرم</a></li>
              <li><a href="#showcase" class="transition hover:text-white">فروشگاه‌های نمونه</a></li>
              <li><a href="#pricing" class="transition hover:text-white">تعرفه‌ها و پلن‌ها</a></li>
              <li><a href="#faq" class="transition hover:text-white">سوالات متداول</a></li>
              <li><a :href="`${dashboardUrl}/register`" class="font-bold text-indigo-400 hover:text-indigo-300">ثبت‌نام فروشنده</a></li>
            </ul>
          </div>

          <!-- ستون ۳: پنل و ابزارها -->
          <div>
            <h4 class="text-sm font-bold text-white">پنل و خدمات</h4>
            <ul class="mt-4 space-y-2.5 text-xs">
              <li><a :href="`${dashboardUrl}/login`" class="transition hover:text-white">ورود به پنل فروشندگان</a></li>
              <li><a :href="`${dashboardUrl}/register`" class="transition hover:text-white">ساخت فروشگاه جدید</a></li>
              <li><a href="http://demo.localhost:3000" target="_blank" class="transition hover:text-white">مشاهده فروشگاه دمو (demo.localhost)</a></li>
              <li><a href="http://acme.localhost:3000" target="_blank" class="transition hover:text-white">مشاهده فروشگاه اکمی (acme.localhost)</a></li>
            </ul>
          </div>

          <!-- ستون ۴: ارتباط و پشتیبانی -->
          <div>
            <h4 class="text-sm font-bold text-white">پشتیبانی و امنیت</h4>
            <p class="mt-4 text-xs leading-6 text-slate-400">
              تیم پشتیبانی سازینو ۲۴ ساعته در کنار شماست تا پاسخگوی سوالات شما باشد.
            </p>
            <div class="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span class="size-2 rounded-full bg-emerald-400"></span>
              <span>تمام سرورها آنلاین و پایدار هستند</span>
            </div>
          </div>
        </div>

        <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 text-xs sm:flex-row">
          <div>© ۱۴۰۵ تمامی حقوق برای پلتفرم فروشگاه‌ساز و سایت‌ساز سازینو محفوظ است.</div>
          <div class="text-slate-500">طراحی شده با مدرن‌ترین فناوری‌های ابری Nuxt & Tailwind</div>
        </div>
      </div>
    </footer>
  </div>
</template>
