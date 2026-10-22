const PUBLIC_ROUTES = ['/login', '/register'];

export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuth();
  const isPublic = PUBLIC_ROUTES.includes(to.path);

  if (!isAuthenticated.value && !isPublic) {
    return navigateTo({
      path: '/login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined,
    });
  }

  if (isAuthenticated.value && isPublic) return navigateTo('/');
});