<script setup lang="ts">
import type { PageSummaryDto, StoreSettingsDto } from '@myapp/shared-types';

useHead({ title: 'صفحات' });

const api = useApi();
const toast = useToast();
const { canDelete } = useAuth();

const { data: pages, refresh } = await useAsyncData('pages', () => api<PageSummaryDto[]>('/pages'));
const { data: settings } = await useAsyncData('store-settings-for-pages', () =>
  api<StoreSettingsDto>('/store-settings'),
);

/** صفحه‌ی اصلی همیشه هست (اگر ذخیره نشده، پیش‌فرض) و اول می‌آید */
const rows = computed(() => {
  const list = pages.value ?? [];
  const home: PageSummaryDto = {
    slug: 'home',
    title: 'صفحه‌ی اصلی',
    publishedAt: null,
    hasUnpublishedChanges: false,
    isDefault: true,
    updatedAt: '',
  };
  const all = list.some((p) => p.slug === 'home') ? list : [home, ...list];
  return [...all].sort((a, b) => (a.slug === 'home' ? -1 : b.slug === 'home' ? 1 : a.slug.localeCompare(b.slug)));
});

function pageStatus(p: PageSummaryDto): { label: string; cls: string } {
  if (p.isDefault) return { label: 'پیش‌فرض (ذخیره‌نشده)', cls: 'bg-slate-100 text-slate-600' };
  if (!p.publishedAt) return { label: 'پیش‌نویس', cls: 'bg-amber-100 text-amber-700' };
  if (p.hasUnpublishedChanges) return { label: 'منتشرشده + تغییرات منتشرنشده', cls: 'bg-sky-100 text-sky-700' };
  return { label: 'منتشرشده', cls: 'bg-emerald-100 text-emerald-700' };
}

function liveUrl(p: PageSummaryDto): string | null {
  if (!settings.value) return null;
  if (p.slug === 'home') return `${settings.value.storeUrl}/`;
  return p.publishedAt ? `${settings.value.storeUrl}/p/${p.slug}` : null;
}

// ───────────── صفحه‌ی جدید ─────────────
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const form = reactive({ title: '', slug: '' });
const formError = ref('');

async function create() {
  formError.value = '';
  const title = form.title.trim();
  const slug = form.slug.trim().toLowerCase();

  if (title.length < 2) return void (formError.value = 'عنوان صفحه باید حداقل ۲ کاراکتر باشد');
  if (slug.length > 60 || !SLUG_RE.test(slug)) {
    return void (formError.value = 'نشانی فقط حروف انگلیسی کوچک، عدد و خط تیره دارد (مثل about-us)');
  }
  if (rows.value.some((p) => p.slug === slug && !p.isDefault)) {
    return void (formError.value = 'صفحه‌ای با این نشانی از قبل هست');
  }
  await navigateTo({ path: `/pages/${slug}`, query: { title } });
}

async function remove(p: PageSummaryDto) {
  const message =
    p.slug === 'home'
      ? 'صفحه‌ی اصلی حذف شود و فروشگاه به صفحه‌ی اصلی پیش‌فرض برگردد؟'
      : `صفحه‌ی «${p.title}» برای همیشه حذف شود؟`;
  if (!confirm(message)) return;
  try {
    await api(`/pages/${p.slug}`, { method: 'DELETE' });
    toast.success('صفحه حذف شد');
    await refresh();
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl font-extrabold">صفحات</h1>
      <p class="text-sm text-slate-500">صفحه‌ی اصلی و صفحات عمومی فروشگاه (آدرس: /p/نشانی) را با بلاک‌ها بسازید.</p>
    </header>

    <form class="card flex flex-wrap items-end gap-3" novalidate @submit.prevent="create">
      <label class="min-w-56 flex-1">
        <span class="label">عنوان صفحه‌ی جدید</span>
        <input v-model="form.title" class="input" maxlength="120" placeholder="مثلاً: درباره‌ی ما" />
      </label>
      <label class="min-w-48">
        <span class="label">نشانی (انگلیسی)</span>
        <input v-model="form.slug" class="input" dir="ltr" maxlength="60" placeholder="about-us" />
      </label>
      <button type="submit" class="btn btn-primary">ساخت و ویرایش</button>
      <p v-if="formError" class="w-full text-sm text-red-700" role="alert">{{ formError }}</p>
    </form>

    <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 text-slate-500">
          <tr>
            <th class="px-4 py-3 text-start font-medium">صفحه</th>
            <th class="px-4 py-3 text-start font-medium">وضعیت</th>
            <th class="px-4 py-3 text-start font-medium">آخرین تغییر</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="p in rows" :key="p.slug" class="hover:bg-slate-50">
            <td class="px-4 py-3">
              <NuxtLink :to="`/pages/${p.slug}`" class="font-medium hover:text-brand-600">{{ p.title }}</NuxtLink>
              <div class="text-xs text-slate-400" dir="ltr">{{ p.slug === 'home' ? '/' : `/p/${p.slug}` }}</div>
            </td>
            <td class="px-4 py-3">
              <span class="badge" :class="pageStatus(p).cls">{{ pageStatus(p).label }}</span>
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-slate-600">
              {{ p.updatedAt ? formatDateTime(p.updatedAt) : '—' }}
            </td>
            <td class="whitespace-nowrap px-4 py-3 text-end">
              <NuxtLink :to="`/pages/${p.slug}`" class="btn btn-secondary btn-sm">ویرایش</NuxtLink>
              <a
                v-if="liveUrl(p)"
                :href="liveUrl(p)!"
                target="_blank"
                rel="noopener"
                class="btn btn-secondary btn-sm ms-1"
              >
                مشاهده
              </a>
              <button
                v-if="canDelete && !p.isDefault"
                type="button"
                class="btn btn-secondary btn-sm ms-1 text-red-600"
                @click="remove(p)"
              >
                {{ p.slug === 'home' ? 'بازگشت به پیش‌فرض' : 'حذف' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>