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
const nameInput = ref<HTMLInputElement | null>(null);

/** افزودن زیردسته: والد را پر می‌کند و نشانگر را در فیلد نام می‌گذارد */
function addChild(parent: CategoryDto) {
  form.parentId = parent.id;
  nameInput.value?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  nameInput.value?.focus({ preventScroll: true });
}
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
    <PageHeader
      title="دسته‌بندی‌ها"
      :subtitle="categories ? `${formatNumber(categories.length)} دسته‌بندی` : undefined"
    />

    <form class="card flex flex-wrap items-end gap-3" novalidate @submit.prevent="create">
      <label class="min-w-56 flex-1">
        <span class="label">نام دسته‌بندی</span>
        <input ref="nameInput" v-model="form.name" class="input" maxlength="80" placeholder="مثلاً: پوشاک" />
      </label>
      <label class="min-w-48">
        <span class="label">والد (اختیاری)</span>
        <select v-model="form.parentId" class="input">
          <option value="">— بدون والد —</option>
          <option v-for="r in roots" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>
      </label>
      <button type="submit" class="btn btn-primary" :disabled="saving">
        <AppIcon name="plus" :size="16" />
        {{ saving ? 'در حال افزودن…' : 'افزودن' }}
      </button>
    </form>

    <div v-if="error" class="card text-center">
      <p class="mb-3 text-red-600">{{ apiErrorMessage(error) }}</p>
      <button type="button" class="btn btn-secondary" @click="() => refresh()">تلاش مجدد</button>
    </div>

    <ul v-else-if="status === 'pending' && !categories" class="space-y-2" aria-busy="true">
      <li v-for="n in 4" :key="n" class="h-14 animate-pulse rounded-xl bg-slate-200/70" />
    </ul>

    <EmptyState
      v-else-if="!rows.length"
      icon="categories"
      title="هنوز دسته‌بندی‌ای ندارید"
      description="دسته‌بندی‌ها به مشتری‌ها کمک می‌کنند محصولات را راحت‌تر پیدا کنند. اولین دسته را از فرم بالا بسازید."
    />

    <ul v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <li
        v-for="row in rows"
        :key="row.category.id"
        class="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
        :class="row.depth ? 'bg-slate-50/60 ps-12' : ''"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="grid size-9 shrink-0 place-items-center rounded-lg"
            :class="row.depth ? 'bg-white text-slate-400 ring-1 ring-slate-200' : 'bg-brand-50 text-brand-600'"
          >
            <AppIcon :name="row.depth ? 'categories' : 'folder'" :size="18" />
          </span>
          <div class="min-w-0">
            <div class="truncate font-medium">{{ row.category.name }}</div>
            <div class="tech truncate text-xs text-slate-400">{{ row.category.slug }}</div>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <span class="badge bg-slate-100 text-slate-600">
            {{ formatNumber(row.category.productCount ?? 0) }} محصول
          </span>
          <button
            v-if="!row.depth"
            type="button"
            class="btn btn-ghost btn-sm"
            @click="addChild(row.category)"
          >
            <AppIcon name="plus" :size="14" />
            زیردسته
          </button>
          <button
            v-if="canDelete"
            type="button"
            class="btn btn-ghost btn-sm !px-2 text-red-600 hover:!bg-red-50"
            title="حذف"
            :aria-label="`حذف ${row.category.name}`"
            @click="remove(row.category)"
          >
            <AppIcon name="trash" :size="16" />
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>
