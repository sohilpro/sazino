export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAdminAuth();
  if (!auth.loaded.value) await auth.load();
  if (!auth.admin.value) {
    return navigateTo({ path: '/admin/login', query: { redirect: to.fullPath } });
  }
});