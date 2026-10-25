import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const b64 = (b: Buffer) => b.toString('base64url');

/**
 * رمزنگاری AES-256-GCM. خروجی: v1.<iv>.<tag>.<ciphertext>
 * AAD (داده‌ی همراه) به متن رمزشده «قفل» می‌شود: همان رشته باید هنگام رمزگشایی داده شود.
 */
export class SecretBox {
  private readonly key: Buffer;

  constructor(keyBase64: string) {
    this.key = Buffer.from(keyBase64, 'base64');
    if (this.key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (base64)');
  }

  encrypt(plain: string, aad: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(ciphertext)].join('.');
  }

  /** با کلید یا AAD اشتباه و یا داده‌ی دست‌کاری‌شده خطا می‌دهد */
  decrypt(payload: string, aad: string): string {
    const [version, iv, tag, ciphertext, extra] = payload.split('.');
    if (version !== VERSION || !iv || !tag || !ciphertext || extra !== undefined) {
      throw new Error('Unsupported secret format');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}