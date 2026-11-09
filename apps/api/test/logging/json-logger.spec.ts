import { describe, expect, it } from 'vitest';
import { JsonLogger } from '../../src/common/logging/json-logger';

function capture(level?: string) {
  const lines: string[] = [];
  const logger = new JsonLogger(level, (line) => lines.push(line));
  const parsed = () => lines.map((l) => JSON.parse(l) as Record<string, unknown>);
  return { logger, lines, parsed };
}

describe('JsonLogger', () => {
  it('writes one valid JSON object per line with time, level, context and msg', () => {
    const { logger, lines, parsed } = capture();
    logger.log('server started', 'Bootstrap');
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');
    expect(parsed()[0]).toMatchObject({ level: 'info', context: 'Bootstrap', msg: 'server started' });
    expect(Date.parse(String(parsed()[0]?.time))).not.toBeNaN();
  });

  it('respects the minimum level', () => {
    const { logger, parsed } = capture('warn');
    logger.debug('d');
    logger.log('i');
    logger.warn('w');
    logger.error('e');
    expect(parsed().map((l) => l.level)).toEqual(['warn', 'error']);
  });

  it('falls back to info for an unknown level', () => {
    const { logger, parsed } = capture('nonsense');
    logger.debug('d');
    logger.log('i');
    expect(parsed().map((l) => l.level)).toEqual(['info']);
  });

  it('keeps structured objects, redacts secrets and masks phones', () => {
    const { logger, parsed } = capture();
    logger.log({ msg: 'login', token: 'secret', phone: '09123456789' }, 'Auth');
    expect(parsed()[0]).toMatchObject({
      msg: 'login',
      token: '[REDACTED]',
      phone: '0912***6789',
      context: 'Auth',
    });
  });

  it('records Error messages and stacks', () => {
    const { logger, parsed } = capture();
    logger.error(new Error('boom'), 'Exceptions');
    expect(parsed()[0]).toMatchObject({ level: 'error', msg: 'boom', context: 'Exceptions' });
    expect(String(parsed()[0]?.stack)).toContain('Error: boom');
  });

  it('understands error(message, stack, context)', () => {
    const { logger, parsed } = capture();
    logger.error('failed', 'trace line', 'Svc');
    expect(parsed()[0]).toMatchObject({ msg: 'failed', stack: 'trace line', context: 'Svc' });
  });

  it('cannot be tricked by newlines in messages', () => {
    const { logger, lines } = capture();
    logger.log('a\n{"level":"error","msg":"fake"}');
    expect(lines).toHaveLength(1);
  });

  it('truncates huge messages', () => {
    const { logger, parsed } = capture();
    logger.log('x'.repeat(50_000));
    expect(String(parsed()[0]?.msg).length).toBeLessThanOrEqual(8_000);
  });
});