# syntax=docker/dockerfile:1.7
# استفاده:
#   --build-arg APP=storefront --build-arg PORT=3000
#   --build-arg APP=dashboard  --build-arg PORT=3001
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG APP
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/shared-types/package.json packages/shared-types/
# postinstall (nuxt prepare) را رد می‌کنیم؛ nuxt build خودش prepare را اجرا می‌کند
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/${APP} --workspace=packages/shared-types --include-workspace-root --ignore-scripts
COPY packages/shared-types packages/shared-types
COPY apps/${APP} apps/${APP}
RUN npm run build -w @myapp/shared-types
# NODE_ENV فقط اینجا production می‌شود (routeRules کش HTML به آن وابسته است)
RUN NODE_ENV=production npm run build -w @myapp/${APP}

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG APP
ARG PORT
ENV NODE_ENV=production HOST=0.0.0.0 PORT=${PORT}
WORKDIR /app
COPY --from=build /app/apps/${APP}/.output ./
USER node
EXPOSE ${PORT}
# فقط زنده‌بودن سرور (هر پاسخ HTTP یعنی سالم)؛ به API وابسته نیست
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/_nuxt/').then(()=>process.exit(0)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]