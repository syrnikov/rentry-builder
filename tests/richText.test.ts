import { describe, expect, it } from 'vitest';
import { parseRich, roundTrip, serializeRich, Line } from '../src/rentry/richText';
import { renderRentry } from '../src/preview/rentryMarkdown';

const runs = (md: string) => parseRich(md)[0].runs.map((r) => [r.text, r.marks.map((m) => m.type + (m.attrs ? JSON.stringify(m.attrs) : '')).join('+')]);

describe('rich text: parsing', () => {
  it('bold / italic / strike / mark / code', () => {
    expect(runs('a **b** *c* ~~d~~ ==e== `f`')).toEqual([
      ['a ', ''], ['b', 'bold'], [' ', ''], ['c', 'italic'], [' ', ''], ['d', 'strike'], [' ', ''], ['e', 'mark'], [' ', ''], ['f', 'code'],
    ]);
  });
  it('color and underline strip the syntax spaces', () => {
    expect(runs('%#a6d8f7% sky %%')).toEqual([['sky', 'color{"color":"#a6d8f7"}']]);
    expect(runs('!~red;wavy; hi ~!')).toEqual([['hi', 'underline{"color":"red","style":"wavy","type":"","thickness":""}']]);
  });
  it('nested and adjacent emphasis', () => {
    expect(runs('***x***')).toEqual([['x', 'bold+italic']]);
    expect(runs('**a*b***')).toEqual([['a', 'bold'], ['b', 'bold+italic']]);
    expect(runs('*a**b***')).toEqual([['a', 'italic'], ['b', 'italic+bold']]);
  });
  it('links, spoilers, alignment', () => {
    expect(runs('[site](https://x.co)')).toEqual([['site', 'link{"href":"https://x.co"}']]);
    expect(runs('see !>the end')).toEqual([['see ', ''], ['the end', 'spoiler']]);
    expect(parseRich('-> mid <-')[0].align).toBe('center');
    expect(parseRich('-> r ->')[0].align).toBe('right');
  });
  it('leaves unmatched syntax and list markers as text', () => {
    expect(runs('* item')).toEqual([['* item', '']]);
    expect(runs('2 * 3 = 6')).toEqual([['2 * 3 = 6', '']]);
    expect(runs('\\*not italic\\*')).toEqual([['*not italic*', '']]);
  });
  it('parses inline images as objects (custom emoji / flags)', () => {
    const r = parseRich('hi ![star](https://x.co/s.png){20px:20px} there')[0].runs;
    expect(r.map((x) => x.image ?? x.text)).toEqual(['hi ', { src: 'https://x.co/s.png', alt: 'star', title: '', width: '20px', height: '20px' }, ' there']);
    const linked = parseRich('[![ro](https://flagcdn.com/64x48/ro.png){24px:18px}](https://x.co)')[0].runs[0];
    expect(linked.image?.src).toBe('https://flagcdn.com/64x48/ro.png');
    expect(linked.marks).toEqual([{ type: 'link', attrs: { href: 'https://x.co' } }]);
  });
});

describe('rich text: serializing', () => {
  const line = (runs: Line['runs'], align: Line['align'] = 'left'): Line[] => [{ align, runs }];
  it('emits rentry syntax', () => {
    expect(serializeRich(line([{ text: 'sky', marks: [{ type: 'color', attrs: { color: '#a6d8f7' } }] }]))).toBe('%#a6d8f7% sky %%');
    expect(serializeRich(line([{ text: 'b', marks: [{ type: 'bold' }] }], 'center'))).toBe('-> **b** <-');
  });
  it('moves whitespace outside tight delimiters', () => {
    expect(serializeRich(line([{ text: 'a', marks: [] }, { text: ' bold ', marks: [{ type: 'bold' }] }, { text: 'c', marks: [] }]))).toBe('a **bold** c');
  });
  it('moves whitespace outside color spans and keeps adjacent colors tight', () => {
    expect(serializeRich(line([
      { text: 'lyric, ', marks: [{ type: 'color', attrs: { color: 'gold' } }] },
      { text: 'more', marks: [{ type: 'color', attrs: { color: 'teal' } }] },
    ]))).toBe('%gold% lyric, %% %teal% more %%');
    expect(serializeRich(line([
      { text: 'a', marks: [{ type: 'color', attrs: { color: 'red' } }] },
      { text: 'b', marks: [{ type: 'color', attrs: { color: 'blue' } }] },
    ]))).toBe('%red% a %%%blue% b %%');
  });

  it('escapes literal syntax characters but keeps list markers', () => {
    expect(serializeRich(line([{ text: '2*3 [x]', marks: [] }]))).toBe('2\\*3 \\[x\\]');
    expect(serializeRich(line([{ text: '* item', marks: [] }]))).toBe('* item');
  });
  it('spoiler runs to the end of the line', () => {
    expect(serializeRich(line([{ text: 'see ', marks: [] }, { text: 'end', marks: [{ type: 'spoiler' }, { type: 'bold' }] }]))).toBe('see !>**end**');
  });
});

describe('rich text: round trips', () => {
  const cases = [
    'plain text',
    'a **b** *c* ~~d~~ ==e== `f`',
    '%hotpink% Hello! %% and %teal% **both** %%',
    '!~blue;wavy; under ~! then text',
    '***x*** and **a*b***',
    '[my **site**](https://x.co)',
    '-> centered **bold** <-',
    'line one\nline two\n\nnew paragraph',
    '* list item\n- other item',
    'trailing !>secret stuff',
    'I love ![cat](https://x.co/cat.gif){20px:20px} and **![star](https://x.co/s.png){16px:16px} bold**',
    'flag [![ro](https://flagcdn.com/64x48/ro.png){24px:18px}](https://x.co) linked',
    '-> ![e](https://x.co/e.png){24px:24px}![e](https://x.co/e.png){24px:24px} <-',
  ];
  it('normalises nesting order (color outside bold)', () => {
    expect(roundTrip('**%teal% both %%**')).toBe('%teal% **both** %%');
  });

  for (const md of cases) {
    it(`stable: ${JSON.stringify(md)}`, () => {
      const once = roundTrip(md);
      expect(roundTrip(once)).toBe(once);
      // Same rendered HTML as the original markdown.
      expect(renderRentry(once)).toBe(renderRentry(md));
    });
  }
});
