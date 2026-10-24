import { normalizePersian } from '../../src/common/persian';

describe('normalizePersian', () => {
  it('converts Arabic yeh and kaf and tidies spaces', () => {
    expect(normalizePersian('  علي   كريمي  ')).toBe('علی کریمی');
    expect(normalizePersian('موسى')).toBe('موسی');
  });

  it('leaves normal Persian untouched', () => {
    expect(normalizePersian('تهران، خیابان ولیعصر')).toBe('تهران، خیابان ولیعصر');
  });
});