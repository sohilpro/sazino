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

const STATUS = {
  PENDING: { label: 'در انتظار تأیید', cls: 'bg-amber-100 text-amber-700' },
  VERIFIED: { label: 'فعال', cls: 'bg-emerald-100 text-emerald-700' },
  FAILED: { label: 'غیرفعال (رکورد TXT پیدا نشد)', cls: 'bg-red-100 text-red-700' },
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
  <div class="max-w-4xl space-y-6">
    <header>
      <h1 class="text-2xl font-extrabold">دامنه‌ی اختصاصی</h1>
      <p class="text-sm text-slate-500">
        فروشگاهتان را با دامنه‌ی خودتان (مثل shop.example.com) منتشر کنید.
      </p>
    </header>

    <p v-if="error" class="card text-red-700">{{ apiErrorMessage(error) }}</p>

    <template v-else-if="data">
      <form
        v-if="canManage"
        class="card flex flex-wrap items-end gap-3"
        novalidate
        @submit.prevent="add"
      >
        <label class="min-w-64 flex-1">
          <span class="label">دامنه‌ی جدید</span>
          <input
            v-model="hostname"
            class="input"
            dir="ltr"
            maxlength="300"
            placeholder="shop.example.com"
          />
        </label>
        <button
          type="submit"
          class="btn btn-primary"
          :disabled="adding || (data.limit !== null && data.items.length >= data.limit)"
        >
          {{ adding ? 'در حال افزودن…' : 'افزودن' }}
        </button>
        <p v-if="data.limit === 0" class="w-full text-sm text-amber-700">
          پلن فعلی شما دامنه‌ی اختصاصی ندارد؛
          <NuxtLink to="/settings/plan" class="underline">پلن و مصرف</NuxtLink>
        </p>
        <p v-else class="w-full text-xs text-slate-500">
          {{ formatNumber(data.items.length) }} از
          {{ data.limit === null ? 'نامحدود' : formatNumber(data.limit) }} دامنه. برای دامنه‌ی اصلی
          و «www» هر کدام را جداگانه اضافه کنید.
        </p>
      </form>

      <p
        v-if="!data.items.length"
        class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500"
      >
        هنوز دامنه‌ای اضافه نکرده‌اید.
      </p>

      <article v-for="d in data.items" :key="d.id" class="card space-y-4">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-bold" dir="ltr">{{ d.hostname }}</h2>
            <span class="badge" :class="STATUS[d.status].cls">{{ STATUS[d.status].label }}</span>
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
            </a>
            <button
              v-if="d.status === 'VERIFIED' && !d.isPrimary"
              type="button"
              class="btn btn-secondary btn-sm"
              @click="makePrimary(d)"
            >
              دامنه‌ی اصلی شود
            </button>
            <button type="button" class="btn btn-secondary btn-sm text-red-600" @click="remove(d)">
              حذف
            </button>
          </div>
        </header>

        <p v-if="d.status === 'VERIFIED'" class="text-sm text-slate-600">
          این دامنه فعال است. گواهی SSL در اولین بازدید به‌صورت خودکار صادر می‌شود (چند ثانیه).
        </p>

        <template v-else>
          <p class="text-sm leading-7 text-slate-600">
            این دو رکورد را در پنل DNS ثبت‌کننده‌ی دامنه (مثلاً Cloudflare یا پنل ثبت دامنه) اضافه
            کنید، سپس «بررسی» را بزنید. اعمال رکوردها ممکن است از چند دقیقه تا چند ساعت طول بکشد.
          </p>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-slate-500">
                <tr>
                  <th class="px-2 py-2 text-start font-medium">نوع</th>
                  <th class="px-2 py-2 text-start font-medium">نام (Host)</th>
                  <th class="px-2 py-2 text-start font-medium">مقدار (Value)</th>
                  <th class="px-2 py-2" />
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100" dir="ltr">
                <tr>
                  <td class="px-2 py-2 font-medium">TXT</td>
                  <td class="px-2 py-2 break-all">{{ d.dns.txtName }}</td>
                  <td class="px-2 py-2 break-all">{{ d.dns.txtValue }}</td>
                  <td class="px-2 py-2">
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      @click="copy(d.dns.txtValue)"
                    >
                      کپی
                    </button>
                  </td>
                </tr>
                <tr>
                  <td class="px-2 py-2 font-medium">CNAME</td>
                  <td class="px-2 py-2 break-all">{{ d.hostname }}</td>
                  <td class="px-2 py-2 break-all">{{ d.dns.cnameTarget }}</td>
                  <td class="px-2 py-2">
                    <button
                      type="button"
                      class="btn btn-secondary btn-sm"
                      @click="copy(d.dns.cnameTarget)"
                    >
                      کپی
                    </button>
                  </td>
                </tr>
                <tr v-for="ip in d.dns.addresses" :key="ip">
                  <td class="px-2 py-2 font-medium">A</td>
                  <td class="px-2 py-2">@</td>
                  <td class="px-2 py-2">{{ ip }}</td>
                  <td class="px-2 py-2">
                    <button type="button" class="btn btn-secondary btn-sm" @click="copy(ip)">
                      کپی
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ul class="list-disc space-y-1 ps-5 text-xs leading-6 text-slate-500">
            <li>
              برای زیردامنه (مثل shop.example.com یا www.example.com) از رکورد <b>CNAME</b> استفاده
              کنید.
            </li>
            <li>
              برای دامنه‌ی اصلی (example.com) CNAME مجاز نیست؛ از رکورد <b>A</b> (در صورت نمایش
              بالا) یا <b>ALIAS / ANAME / CNAME flattening</b> به همان مقدار CNAME استفاده کنید.
            </li>
            <li>
              اگر از Cloudflare استفاده می‌کنید، تا پایان تأیید ابر نارنجی (Proxy) را خاموش
              (خاکستری) کنید.
            </li>
          </ul>

          <div v-if="canManage" class="flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="busy === d.id"
              @click="verify(d)"
            >
              {{ busy === d.id ? 'در حال بررسی…' : 'بررسی' }}
            </button>
            <span v-if="d.lastCheckedAt" class="text-xs text-slate-500">
              آخرین بررسی: {{ formatDateTime(d.lastCheckedAt) }}
            </span>
          </div>

          <div v-if="results[d.id]?.checks" class="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <p :class="results[d.id]!.checks!.txt.ok ? 'text-emerald-700' : 'text-red-700'">
              {{
                results[d.id]!.checks!.txt.ok
                  ? '✓ رکورد TXT درست است.'
                  : '✗ رکورد TXT پیدا نشد یا مقدارش فرق دارد.'
              }}
              <span
                v-if="!results[d.id]!.checks!.txt.ok && results[d.id]!.checks!.txt.found.length"
                class="block text-xs text-slate-500"
                dir="ltr"
              >
                دیده‌شده: {{ results[d.id]!.checks!.txt.found.join(' | ') }}
              </span>
            </p>
            <p :class="results[d.id]!.checks!.routing.ok ? 'text-emerald-700' : 'text-red-700'">
              {{
                results[d.id]!.checks!.routing.ok
                  ? '✓ آدرس دامنه به فروشگاه اشاره می‌کند.'
                  : '✗ CNAME (یا A) هنوز به آدرس درست اشاره نمی‌کند.'
              }}
              <span
                v-if="
                  !results[d.id]!.checks!.routing.ok && results[d.id]!.checks!.routing.cname.length
                "
                class="block text-xs text-slate-500"
                dir="ltr"
              >
                CNAME دیده‌شده: {{ results[d.id]!.checks!.routing.cname.join(' | ') }}
              </span>
            </p>
          </div>
        </template>
      </article>
    </template>
  </div>
</template>
