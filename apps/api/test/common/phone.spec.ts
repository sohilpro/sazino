import { maskPhone, normalizeDigits, normalizePhone } from '../../src/common/phone';

describe('normalizePhone', () => {
  it('accepts every common Iranian mobile format', () => {
    for (const input of [
      '09121234567',
      '9121234567',
      '+989121234567',
      '+98 912 123 4567',
      '00989121234567',
      '989121234567',
      '0912-123-4567',
      '(0912) 123 4567',
      '۰۹۱۲۱۲۳۴۵۶۷',
      '٠٩١٢١٢٣٤٥٦٧',
    ]) {
      expect(normalizePhone(input)).toBe('09121234567');
    }
  });

  it('rejects invalid numbers', () => {
    for (const input of ['', '123', '09123', '0812345678', '021123456789', 'abc', '091212345678', null, 42]) {
      expect(normalizePhone(input)).toBeNull();
    }
  });
});

describe('helpers', () => {
  it('converts Persian and Arabic digits', () => {
    expect(normalizeDigits('۱۲۳۴۵۶۷۸۹۰ ٠١٢٣')).toBe('1234567890 0123');
  });

  it('masks the middle of a phone', () => {
    expect(maskPhone('09121234567')).toBe('0912***4567');
  });
});