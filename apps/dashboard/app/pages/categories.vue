<script setup lang="ts">
import type { CategoryDto } from '@myapp/shared-types';

useHead({ title: 'دسته‌بندی‌ها' });

const api = useApi();
const toast = useToast();
const { canDelete } = useAuth();

const { data: categories, status, error, refresh } = useLazyAsyncData('categories', () =>
  api<CategoryDto[]>('/categories'),
);

const roots = computed(() => (categories.value ?? []).filter((c) => !c.parentId));

const rows = computed(() =>
  roots.value.flatMap((root) => [
    { category: root, depth: 0 },
    ...(categories.value ?? [])
      .filter((c) => c.parentId === root.id)
      .map((category) => ({ category, depth: 1 })),
  ]),
);

const form = reactive({ name: '', parentId: '' });
const saving = ref(false);

async function create() {
  const name = form.name.trim();
  if (name.length < 2) {
    toast.error('نام دسته‌بندی باید حداقل ۲ کاراکتر باشد');
    return;
  }
  saving.value = true;
  try {
    await api<CategoryDto>('/categories', {
      method: 'POST',
      body: { name, parentId: form.parentId || undefined },
    });
    toast.success('دسته‌بندی ساخته شد');
    form.name = '';
    await refresh();
  } catch (e) {
    toast.error(apiErrorMessage(e));
  } finally {
    saving.value = false;
  }
}

async function remove(c: CategoryDto) {
  if (!confirm(`دسته‌بندی «${c.name}» حذف شود؟ محصولات آن بدون دسته‌بندی می‌مانند.`)) return;
  try {
    await api(`/categories/${c.id}`, { method: 'DELETE' });
    toast.success('دسته‌بندی حذف شد');
    await refresh();
  } catch (e) {
    toast.error(apiErrorMessage(e));
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-extrabold">دسته‌بندی‌ها</h1>

    <form class="card flex flex-wrap items-end gap-3" novalidate @submit.prevent="create">
      <label class="min-w-56 flex-1">
        <span class="label">نام دسته‌بندی</span>
        <input v-model="form.name" class="input" maxlength="80" />
      </label>
      <label class="min-w-48">
        <span class="label">والد (اختیاری)</span>
        <select v-model="form.parentId" class="input">
          <option value="">— بدون والد —</option>
          <option v-for="r in roots" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <button type="submit" class="btn btn-primary" :disabled="saving">افزودن</button>
    </form>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <p v-if="error" class="p-6 text-red-600">{{ apiErrorMessage(error) }}</p>
      <p v-else-if="status === 'pending' && !categories" class="p-6 text-slate-500">در حال بارگذاری…</p>
      <p v-else-if="!rows.length" class="p-6 text-slate-500">هنوز دسته‌بندی‌ای ندارید.</p>
      <ul v-else class="divide-y divide-slate-100">
        <li
          v-for="row in rows"
          :key="row.category.id"
          class="flex items-center justify-between gap-3 px-4 py-3"
          :class="row.depth ? 'ps-10' : ''"
        >
          <div>
            <span class="font-medium">{{ row.category.name }}</span>
            <span class="ms-2 text-xs text-slate-400" dir="ltr">{{ row.category.slug }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-slate-500">
              {{ formatNumber(row.category.productCount ?? 0) }} محصول
            </span>
            <button
              v-if="canDelete"
              type="button"
              class="btn btn-secondary btn-sm text-red-600"
              @click="remove(row.category)"
            >
              حذف
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>