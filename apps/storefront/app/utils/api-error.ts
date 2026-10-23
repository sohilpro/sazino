export function statusOf(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status?: number } | null;
  return e?.statusCode ?? e?.status;
}