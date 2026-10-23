import {
  DEFAULT_PRIMARY_COLOR,
  MAX_DESCRIPTION_LENGTH,
  parseStoreSettings,
} from '../../src/tenants/store-settings';

describe('parseStoreSettings', () => {
  it('returns defaults for empty or invalid input', () => {
    const expected = { primaryColor: DEFAULT_PRIMARY_COLOR, description: null, logoMediaId: null };
    expect(parseStoreSettings({})).toEqual(expected);
    expect(parseStoreSettings(null)).toEqual(expected);
    expect(parseStoreSettings('text')).toEqual(expected);
    expect(parseStoreSettings([1, 2])).toEqual(expected);
  });

  it('accepts a valid hex color and lowercases it', () => {
    expect(parseStoreSettings({ primaryColor: '#E11D48' }).primaryColor).toBe('#e11d48');
  });

  it('rejects anything that is not a plain #rrggbb color', () => {
    const unsafe = [
      'red',
      '#fff',
      '#12345g',
      '#1234567',
      'rgb(0,0,0)',
      'red;} body{display:none',
      '#fff"><script>alert(1)</script>',
      "#aabbcc'; background:url(x)",
      '',
      123,
      null,
    ];
    for (const value of unsafe) {
      expect(parseStoreSettings({ primaryColor: value }).primaryColor).toBe(DEFAULT_PRIMARY_COLOR);
    }
  });

  it('trims and limits the description', () => {
    expect(parseStoreSettings({ description: '  سلام  ' }).description).toBe('سلام');
    expect(parseStoreSettings({ description: '   ' }).description).toBeNull();
    const long = parseStoreSettings({ description: 'x'.repeat(2000) }).description;
    expect(long).toHaveLength(MAX_DESCRIPTION_LENGTH);
  });

  it('accepts only a UUID as logo media id', () => {
    const id = '019a0000-0000-7000-8000-000000000000';
    expect(parseStoreSettings({ logoMediaId: id }).logoMediaId).toBe(id);
    expect(parseStoreSettings({ logoMediaId: '../etc/passwd' }).logoMediaId).toBeNull();
    expect(parseStoreSettings({ logoMediaId: 42 }).logoMediaId).toBeNull();
  });
});