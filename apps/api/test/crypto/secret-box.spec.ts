import { randomBytes } from 'node:crypto';
import { SecretBox } from '../../src/crypto/secret-box';

const key = () => randomBytes(32).toString('base64');

describe('SecretBox', () => {
  const box = new SecretBox(key());
  const aad = 'gateway:tenant-1:ZARINPAL';
  const secret = '11111111-1111-4111-8111-111111111111';

  it('round-trips a value', () => {
    expect(box.decrypt(box.encrypt(secret, aad), aad)).toBe(secret);
  });

  it('never leaks the plain text and uses a fresh IV every time', () => {
    const a = box.encrypt(secret, aad);
    const b = box.encrypt(secret, aad);
    expect(a).not.toContain(secret);
    expect(a.startsWith('v1.')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('is bound to its AAD (a ciphertext cannot move to another tenant)', () => {
    const enc = box.encrypt(secret, aad);
    expect(() => box.decrypt(enc, 'gateway:tenant-2:ZARINPAL')).toThrow();
  });

  it('rejects another key', () => {
    const enc = box.encrypt(secret, aad);
    expect(() => new SecretBox(key()).decrypt(enc, aad)).toThrow();
  });

  it('detects tampering and malformed input', () => {
    const [v, iv, tag, ct] = box.encrypt(secret, aad).split('.');
    const flipped = `${ct!.slice(0, -2)}${ct!.endsWith('A') ? 'B' : 'A'}A`;
    expect(() => box.decrypt([v, iv, tag, flipped].join('.'), aad)).toThrow();
    expect(() => box.decrypt('garbage', aad)).toThrow();
    expect(() => box.decrypt([v, iv, tag].join('.'), aad)).toThrow();
    expect(() => box.decrypt(['v2', iv, tag, ct].join('.'), aad)).toThrow();
  });

  it('refuses keys of the wrong size', () => {
    expect(() => new SecretBox(Buffer.alloc(16).toString('base64'))).toThrow('32 bytes');
    expect(() => new SecretBox('')).toThrow();
  });
});