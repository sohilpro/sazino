<script setup lang="ts">
import type { DomainDto, DomainsDto, DomainVerifyDto } from '@myapp/shared-types';

useHead({ title: 'دامنه‌ی اختصاصی' });

const api = useApi();
const toast = useToast();
const { user } = useAuth();

const canManage = computed(() => user.value?.role === 'OWNER' || user.value?.role === 'ADMIN');

const { data, error, refresh } = await useAsyncData('domains', () => api<DomainsDto>('/domains'));

const hostname = ref('');
const adding = ref(false);
const busy = ref<string | null>(null);
const results = reactive<Record<string, DomainVerifyDto>>({});

const atLimit = computed(() => data.value?.limit != null && data.value.items.length >= data.value.limit);

const STATUS = {
  PENDING: { label: 'در انتظار تأیید', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  VERIFIED: { label: 'فعال', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  FAILED: { label: 'غیرفعال (رکورد TXT پیدا نشد)', cls: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
} as const;

async function add() {
  if (!hostname.value.trim()) return void toast.error('نام دامنه را وارد کنید');
  adding.value = true;
  try {
    await api<DomainDto>('/domains', { method: 'POST', body: { hostname: hostname.value.trim() } });
    hostname.value = '';
    await refresh();
    toast.success('دامنه اضافه شد؛ رکوردهای DNS را ثبت کنید');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    adding.value = false;
  }
}

async function verify(d: DomainDto) {
  busy.value = d.id;
  try {
    const res = await api<DomainVerifyDto>(`/domains/${d.id}/verify`, { method: 'POST' });
    results[d.id] = res;
    if (res.verified) toast.success('دامنه تأیید شد؛ گواهی SSL در اولین بازدید صادر می‌شود');
    else if (res.unavailable) toast.info('پاسخ DNS دریافت نشد؛ چند لحظه بعد دوباره امتحان کنید');
    await refresh();
  } catch (e) {
    if (statusOf(e) === 429) toast.info(apiErrorMessage(e));
    else toast.error(apiErrorMessage(e));
  } finally {
    busy.value = null;
  }
}

async function makePrimary(d: DomainDto) {
  try {
    await api(`/domains/${d.id}/primary`, { method: 'POST' });
    await refresh();
    toast.success('دامنه‌ی اصلی تغییر کرد');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}

async function remove(d: DomainDto) {
  if (!confirm(`دامنه‌ی ${d.hostname} حذف شود؟ این آدرس دیگر به فروشگاه شما نمی‌رسد.`)) return;
  try {
    await api(`/domains/${d.id}`, { method: 'DELETE' });
    await refresh();
    toast.success('دامنه حذف شد');
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('کپی شد');
  } catch {
    toast.error('کپی نشد؛ متن را دستی انتخاب کنید');
  }
}
</script>

<template>
  <div class="max-w-5xl space-y-6">
    <PageHeader
      title="تنظیمات"
      subtitle="فروشگاهتان را با دامنه‌ی خودتان (مثل shop.example.com) منتشر کنید."
    />
    <SettingsTabs />

    <p v-if="error" class="alert-error">{{ apiErrorMessage(error) }}</p>

    <template v-else-if="data">
      <form v-if="canManage" class="card space-y-3" novalidate @submit.prevent="add">
        <div class="flex flex-wrap items-end gap-3">
          <label class="min-w-64 flex-1">
            <span class="label">دامنه‌ی جدید</span>
            <input
              v-model="hostname"
              class="input tech"
              dir="ltr"
              maxlength="300"
              placeholder="shop.example.com"
            />
          </label>
          <button type="submit" class="btn btn-primary" :disabled="adding || atLimit">
            <AppIcon name="plus" :size="16" />
            {{ adding ? 'در حال افزودن…' : 'افزودن دامنه' }}
          </button>
        </div>
        <p v-if="data.limit === 0" class="alert-warn">
          پلن فعلی شما دامنه‌ی اختصاصی ندارد؛
          <NuxtLink to="/settings/plan" class="underline">پلن و مصرف</NuxtLink>
        </p>
        <p v-else class="hint !mt-0">
          {{ formatNumber(data.items.length) }} از
          {{ data.limit === null ? 'نامحدود' : formatNumber(data.limit) }} دامنه. برای دامنه‌ی اصلی و «www» هر
          کدام را جداگانه اضافه کنید.
        </p>
      </form>

      <EmptyState
        v-if="!data.items.length"
        icon="domain"
        title="هنوز دامنه‌ای اضافه نکرده‌اید"
        description="دامنه‌ی خودتان را اضافه کنید، رکوردهای DNS را ثبت کنید و بعد تأیید را بزنید."
      />

      <article v-for="d in data.items" :key="d.id" class="card space-y-4">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="tech text-lg font-bold">{{ d.hostname }}</h2>
            <span class="badge gap-1.5" :class="STATUS[d.status].cls">
              <span class="size-1.5 rounded-full" :class="STATUS[d.status].dot" />
              {{ STATUS[d.status].label }}
            </span>
            <span v-if="d.isPrimary" class="badge bg-brand-100 text-brand-700">دامنه‌ی اصلی</span>
          </div>
          <div v-if="canManage" class="flex flex-wrap gap-2">
            <a
              v-if="d.status === 'VERIFIED'"
              :href="`https://${d.hostname}`"
              target="_blank"
              rel="noopener"
              class="btn btn-secondary btn-sm"
            >
              مشاهده
              <AppIcon name="external" :size="14" />
            </a>
            <button
              v-if="d.status === 'VERIFIED' && !d.isPrimary"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="makePrimary(d)"
            >
              دامنه‌ی اصلی شود
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-sm !px-2 text-red-600 hover:!bg-red-50"
              title="حذف دامنه"
              :aria-label="`حذف ${d.hostname}`"
              @click="remove(d)"
            >
              <AppIcon name="trash" :size="16" />
            </button>
          </div>
        </header>

        <p
          v-if="d.status === 'VERIFIED'"
          class="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          <AppIcon name="check" :size="18" class="mt-0.5 shrink-0" />
          این دامنه فعال است. گواهی SSL در اولین بازدید به‌صورت خودکار صادر می‌شود (چند ثانیه).
        </p>

        <template v-else>
          <p class="text-sm leading-7 text-slate-600">
            این رکوردها را در پنل DNS ثبت‌کننده‌ی دامنه (مثلاً Cloudflare یا پنل ثبت دامنه) اضافه کنید، سپس
            «بررسی» را بزنید. اعمال رکوردها ممکن است از چند دقیقه تا چند ساعت طول بکشد.
          </p>

          <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th class="px-3 py-2 text-start font-medium">نوع</th>
                  <th class="px-3 py-2 text-start font-medium">نام (Host)</th>
                  <th class="px-3 py-2 text-start font-medium">مقدار (Value)</th>
                  <th class="px-3 py-2"><span class="sr-only">کپی</span></th>
                </tr>
              </thead>
              <tbody class="tech divide-y divide-slate-100">
                <tr>
                  <td class="px-3 py-2 font-bold">TXT</td>
                  <td class="break-all px-3 py-2">{{ d.dns.txtName }}</td>
                  <td class="break-all px-3 py-2">{{ d.dns.txtValue }}</td>
                  <td class="px-3 py-2 text-end">
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm !px-2"
                      title="کپی مقدار"
                      aria-label="کپی مقدار TXT"
                      @click="copy(d.dns.txtValue)"
                    >
                      <AppIcon name="copy" :size="16" />
                    </button>
                  </td>
                </tr>
                <tr>
                  <td class="px-3 py-2 font-bold">CNAME</td>
                  <td class="break-all px-3 py-2">{{ d.hostname }}</td>
                  <td class="break-all px-3 py-2">{{ d.dns.cnameTarget }}</td>
                  <td class="px-3 py-2 text-end">
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm !px-2"
                      title="کپی مقدار"
                      aria-label="کپی مقدار CNAME"
                      @click="copy(d.dns.cnameTarget)"
                    >
                      <AppIcon name="copy" :size="16" />
                    </button>
                  </td>
                </tr>
                <tr v-for="ip in d.dns.addresses" :key="ip">
                  <td class="px-3 py-2 font-bold">A</td>
                  <td class="px-3 py-2">@</td>
                  <td class="px-3 py-2">{{ ip }}</td>
                  <td class="px-3 py-2 text-end">
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm !px-2"
                      title="کپی مقدار"
                      aria-label="کپی آدرس IP"
                      @click="copy(ip)"
                    >
                      <AppIcon name="copy" :size="16" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul class="list-disc space-y-1 rounded-lg bg-slate-50 py-3 pe-3 ps-8 text-xs leading-6 text-slate-500">
            <li>
              برای زیردامنه (مثل shop.example.com یا www.example.com) از رکورد <b>CNAME</b> استفاده کنید.
            </li>
            <li>
              برای دامنه‌ی اصلی (example.com) CNAME مجاز نیست؛ از رکورد <b>A</b> (در صورت نمایش بالا) یا
              <b>ALIAS / ANAME / CNAME flattening</b> به همان مقدار CNAME استفاده کنید.
            </li>
            <li>
              اگر از Cloudflare استفاده می‌کنید، تا پایان تأیید ابر نارنجی (Proxy) را خاموش (خاکستری) کنید.
            </li>
          </ul>

          <div v-if="canManage" class="flex flex-wrap items-center gap-3">
            <button type="button" class="btn btn-primary" :disabled="busy === d.id" @click="verify(d)">
              <AppIcon name="refresh" :size="16" :class="busy === d.id ? 'animate-spin' : ''" />
              {{ busy === d.id ? 'در حال بررسی…' : 'بررسی' }}
            </button>
            <span v-if="d.lastCheckedAt" class="text-xs text-slate-500">
              آخرین بررسی: {{ formatDateTime(d.lastCheckedAt) }}
            </span>
          </div>

          <ul v-if="results[d.id]?.checks" class="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <li
              class="flex items-start gap-2"
              :class="results[d.id]!.checks!.txt.ok ? 'text-emerald-700' : 'text-red-700'"
            >
              <AppIcon :name="results[d.id]!.checks!.txt.ok ? 'check' : 'close'" :size="16" class="mt-1 shrink-0" />
              <span>
                {{
                  results[d.id]!.checks!.txt.ok
                    ? 'رکورد TXT درست است.'
                    : 'رکورد TXT پیدا نشد یا مقدارش فرق دارد.'
                }}
                <span
                  v-if="!results[d.id]!.checks!.txt.ok && results[d.id]!.checks!.txt.found.length"
                  class="tech block text-xs text-slate-500"
                >
                  دیده‌شده: {{ results[d.id]!.checks!.txt.found.join(' | ') }}
                </span>
              </span>
            </li>
            <li
              class="flex items-start gap-2"
              :class="results[d.id]!.checks!.routing.ok ? 'text-emerald-700' : 'text-red-700'"
            >
              <AppIcon
                :name="results[d.id]!.checks!.routing.ok ? 'check' : 'close'"
                :size="16"
                class="mt-1 shrink-0"
              />
              <span>
                {{
                  results[d.id]!.checks!.routing.ok
                    ? 'آدرس دامنه به فروشگاه اشاره می‌کند.'
                    : 'CNAME (یا A) هنوز به آدرس درست اشاره نمی‌کند.'
                }}
                <span
                  v-if="!results[d.id]!.checks!.routing.ok && results[d.id]!.checks!.routing.cname.length"
                  class="tech block text-xs text-slate-500"
                >
                  CNAME دیده‌شده: {{ results[d.id]!.checks!.routing.cname.join(' | ') }}
                </span>
              </span>
            </li>
          </ul>
        </template>
      </article>
    </template>
  </div>
</template>
