export type RichNode =
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

const MAX_NODES = 200;

/**
 * متن ساده‌ی بلاک rich-text را به گره‌ها تبدیل می‌کند:
 *   «# عنوان»  «## زیرعنوان»  «- مورد»  و پاراگراف‌ها (جداشده با خط خالی)
 * خروجی همیشه با {{ }} نمایش داده می‌شود (escape خودکار)؛ هرگز v-html.
 */
export function parseRichText(content: string): RichNode[] {
  const nodes: RichNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) nodes.push({ type: 'paragraph', text: paragraph.join('\n') });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) nodes.push({ type: 'list', items: list });
    list = [];
  };

  for (const raw of content.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,2})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      nodes.push({ type: 'heading', level: heading[1]!.length === 1 ? 2 : 3, text: heading[2]!.trim() });
      continue;
    }

    const item = /^[-•]\s+(.+)$/.exec(line);
    if (item) {
      flushParagraph();
      list.push(item[1]!.trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return nodes.slice(0, MAX_NODES);
}