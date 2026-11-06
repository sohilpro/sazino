import 'reflect-metadata';
import { INestApplication, RequestMethod } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import { getMetadataStorage } from 'class-validator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator';
import { createTestApp } from '../helpers/create-app';

const PATH_METADATA = 'path';
const METHOD_METADATA = 'method';
const ROUTE_ARGS_METADATA = '__routeArguments__';
const BODY = 3;
const QUERY = 4;
const PARAM = 5;

/** استثناهای آگاهانه‌ی DTO: "VERB /path" ← دلیل */
const DTO_ALLOWLIST: Record<string, string> = {};

/** مسیرهای مجاز @Public(): همه‌ی ویترین، ورود فروشنده، سلامت، Caddy ask و ادمین (AdminGuard جدا) */
const PUBLIC_ALLOWED: RegExp[] = [
  /^POST \/api\/auth\/(register|login|refresh|logout)$/,
  /^GET \/api\/auth\/check-subdomain$/,
  /^GET \/api\/store$/,
  /^(GET|POST|PUT|PATCH|DELETE) \/api\/storefront(\/|$)/,
  /^GET \/api\/health(\/live)?$/,
  /^GET \/api\/internal\/domains\/check$/,
  /^(GET|POST|PUT|PATCH|DELETE) \/api\/admin(\/|$)/,
];

type Fn = (...args: unknown[]) => unknown;
interface Route {
  label: string;
  controller: Fn;
  proto: Record<string, Fn>;
  name: string;
  handler: Fn;
}

const asArray = (value: unknown): string[] =>
  Array.isArray(value) ? (value as string[]) : [String(value ?? '')];
const join = (...parts: string[]) =>
  `/${parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')}`;

function isValidatedDto(type: unknown): boolean {
  if (typeof type !== 'function') return false;
  if ([String, Number, Boolean, Array, Object, Date, Promise].includes(type as never)) return false;
  return (
    getMetadataStorage().getTargetValidationMetadatas(
      type as Fn,
      undefined as unknown as string,
      false,
      false,
    ).length > 0
  );
}

describe('Controllers audit', () => {
  let app: INestApplication;
  const routes: Route[] = [];

  const isPublic = (route: Route) =>
    Reflect.getMetadata(IS_PUBLIC_KEY, route.handler) === true ||
    Reflect.getMetadata(IS_PUBLIC_KEY, route.controller) === true;

  beforeAll(async () => {
    app = await createTestApp();
    const container = app.get(ModulesContainer, { strict: false });
    for (const module of container.values()) {
      for (const wrapper of module.controllers.values()) {
        const controller = wrapper.metatype as unknown as Fn | null;
        if (!controller) continue;
        const proto = controller.prototype as Record<string, Fn>;
        for (const basePath of asArray(Reflect.getMetadata(PATH_METADATA, controller))) {
          for (const name of Object.getOwnPropertyNames(proto)) {
            const handler = proto[name];
            if (name === 'constructor' || typeof handler !== 'function') continue;
            const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
            if (method === undefined) continue;
            for (const sub of asArray(Reflect.getMetadata(PATH_METADATA, handler))) {
              const verb = RequestMethod[method] ?? String(method);
              const path = join('api', basePath, sub);
              routes.push({ label: `${verb} ${path}`, controller, proto, name, handler });
            }
          }
        }
      }
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds the controllers', () => {
    expect(routes.length).toBeGreaterThan(60);
  });

  it('gives every @Body() and @Query() a validated DTO class, and every @Param() a pipe', () => {
    const problems: string[] = [];
    for (const route of routes) {
      if (DTO_ALLOWLIST[route.label]) continue;
      const args = (Reflect.getMetadata(ROUTE_ARGS_METADATA, route.controller, route.name) ??
        {}) as Record<string, { index: number; data?: unknown; pipes?: unknown[] }>;
      const types = (Reflect.getMetadata('design:paramtypes', route.proto, route.name) ??
        []) as unknown[];

      for (const [key, arg] of Object.entries(args)) {
        const kind = Number(key.split(':')[0]);
        const type = types[arg.index];
        if ((kind === BODY || kind === QUERY) && !isValidatedDto(type)) {
          problems.push(`${route.label}: ${kind === BODY ? '@Body' : '@Query'} has no validated DTO class`);
        }
        if (kind === PARAM) {
          const hasPipe = (arg.pipes?.length ?? 0) > 0;
          const wholeDto = arg.data === undefined && isValidatedDto(type);
          if (!hasPipe && !wholeDto) problems.push(`${route.label}: @Param('${String(arg.data)}') has no pipe`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('only exposes @Public() routes from the allowlist', () => {
    const unexpected = routes
      .filter((route) => isPublic(route))
      .map((route) => route.label)
      .filter((label) => !PUBLIC_ALLOWED.some((re) => re.test(label)));
    expect(unexpected).toEqual([]);
  });
});