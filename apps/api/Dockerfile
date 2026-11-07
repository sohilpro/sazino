# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24

# ---------- deps: همه‌ی وابستگی‌ها (برای بیلد و ابزار migrate) ----------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/shared-types/package.json packages/shared-types/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=apps/api --workspace=packages/shared-types --include-workspace-root

# ---------- build ----------
FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
# prisma generate اتصال نمی‌گیرد ولی prisma.config.ts وجود این متغیر را لازم دارد
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run build -w @myapp/shared-types && npm run build -w @myapp/api

# ---------- migrate: ابزار یک‌بارمصرف (migrate deploy و ساخت ادمین) ----------
FROM build AS migrate
ENV NODE_ENV=production
WORKDIR /app
CMD ["npm", "run", "db:deploy", "-w", "apps/api"]

# ---------- runtime ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/storefront/package.json apps/storefront/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/shared-types/package.json packages/shared-types/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --workspace=apps/api --workspace=packages/shared-types
COPY --from=build /app/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /app/apps/api/dist apps/api/dist

USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main"]