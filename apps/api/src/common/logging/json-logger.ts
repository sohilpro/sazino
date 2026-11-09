import type { LoggerService } from '@nestjs/common';
import { redactValue } from './redact';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;

const MAX_MESSAGE = 8_000;

function toLevel(value: string | undefined): LogLevel {
  return value && value in LEVELS ? (value as LogLevel) : 'info';
}

/** هر لاگ یک خط JSON روی stdout (برای docker logs و هر جمع‌کننده‌ی لاگ) */
export class JsonLogger implements LoggerService {
  private readonly min: number;

  constructor(
    level?: string,
    private readonly sink: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  ) {
    this.min = LEVELS[toLevel(level)];
  }

  log(message: unknown, ...rest: unknown[]): void {
    this.emit('info', message, rest);
  }
  error(message: unknown, ...rest: unknown[]): void {
    this.emit('error', message, rest);
  }
  warn(message: unknown, ...rest: unknown[]): void {
    this.emit('warn', message, rest);
  }
  debug(message: unknown, ...rest: unknown[]): void {
    this.emit('debug', message, rest);
  }
  verbose(message: unknown, ...rest: unknown[]): void {
    this.emit('debug', message, rest);
  }
  fatal(message: unknown, ...rest: unknown[]): void {
    this.emit('error', message, rest);
  }

  /** لاگ ساختاریافته‌ی مستقیم (مثل لاگ درخواست) */
  write(level: LogLevel, fields: Record<string, unknown>): void {
    if (LEVELS[level] < this.min) return;
    const safe = redactValue(fields) as Record<string, unknown>;
    this.sink(JSON.stringify({ ...safe, time: new Date().toISOString(), level }));
  }

  private emit(level: LogLevel, message: unknown, rest: unknown[]): void {
    if (LEVELS[level] < this.min) return;

    const params = [...rest];
    // قرارداد Nest: آخرین پارامتر رشته، نام context است
    const context = typeof params.at(-1) === 'string' ? (params.pop() as string) : undefined;

    const fields: Record<string, unknown> = {};
    if (context) fields.context = context;

    if (message instanceof Error) {
      fields.msg = message.message;
      fields.stack = message.stack;
    } else if (message !== null && typeof message === 'object') {
      Object.assign(fields, message);
    } else {
      fields.msg = String(message);
    }

    // error(message, stack, context)
    if (level === 'error' && typeof params[0] === 'string') fields.stack = params[0];
    if (typeof fields.msg === 'string') fields.msg = fields.msg.slice(0, MAX_MESSAGE);

    this.write(level, fields);
  }
}