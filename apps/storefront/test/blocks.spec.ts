import { describe, expect, it } from 'vitest';
import { parseRichText } from '../app/utils/rich-text';
import { safeHref } from '../app/utils/safe-href';

describe('parseRichText', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    expect(parseRichText('اول\nدوم\n\nسوم')).toEqual([
      { type: 'paragraph', text: 'اول\nدوم' },
      { type: 'paragraph', text: 'سوم' },
    ]);
  });

  it('recognizes headings and lists', () => {
    expect(parseRichText('# عنوان\n## زیرعنوان\nمتن\n\n- الف\n- ب\n• ج')).toEqual([
      { type: 'heading', level: 2, text: 'عنوان' },
      { type: 'heading', level: 3, text: 'زیرعنوان' },
      { type: 'paragraph', text: 'متن' },
      { type: 'list', items: ['الف', 'ب', 'ج'] },
    ]);
  });

  it('closes a list when normal text follows', () => {
    expect(parseRichText('- الف\nمتن')).toEqual([
      { type: 'list', items: ['الف'] },
      { type: 'paragraph', text: 'متن' },
    ]);
  });

  it('only treats markers followed by a space as markup', () => {
    expect(parseRichText('#بدون-فاصله\n-5 تخفیف')).toEqual([
      { type: 'paragraph', text: '#بدون-فاصله\n-5 تخفیف' },
    ]);
  });

  it('handles windows line endings and empty input', () => {
    expect(parseRichText('الف\r\n\r\nب')).toHaveLength(2);
    expect(parseRichText('')).toEqual([]);
    expect(parseRichText('  \n \n')).toEqual([]);
  });

  it('never produces markup from html-looking text', () => {
    const nodes = parseRichText('<img src=x onerror=alert(1)>');
    expect(nodes).toEqual([{ type: 'paragraph', text: '<img src=x onerror=alert(1)>' }]);
  });

  it('limits the number of nodes', () => {
    const many = Array.from({ length: 500 }, (_, i) => `خط ${i}`).join('\n\n');
    expect(parseRichText(many)).toHaveLength(200);
  });
});

describe('safeHref', () => {
  it('passes internal paths and https links', () => {
    expect(safeHref('/products')).toBe('/products');
    expect(safeHref(' /p/about ')).toBe('/p/about');
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
  });

  it('blocks everything dangerous or empty', () => {
    for (const href of [
      null,
      undefined,
      '',
      'javascript:alert(1)',
      'data:text/html,x',
      'http://example.com',
      '//evil.com',
      '/\\evil.com',
      'https://user:pass@example.com',
      'products',
    ]) {
      expect(safeHref(href)).toBeNull();
    }
  });
});