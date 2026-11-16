import { describe, expect, it } from 'vitest';
import { collectHeadings, renderRentry, renderRentryCell } from '../src/preview/rentryMarkdown';

const r = (s: string) => renderRentry(s).trim();

describe('rentry markdown renderer', () => {
  it('colors', () => expect(r('%red% Colored Text %%')).toContain('<span style="color:red"> Colored Text </span>'));
  it('hex colors', () => expect(r('%#ACBDEF% Hex %%')).toContain('color:#ACBDEF'));
  it('ignores unknown color names', () => expect(r('%nope% x %%')).not.toContain('<span'));
  it('mark', () => expect(r('==Mark==')).toContain('<mark>Mark</mark>'));
  it('spoiler', () => expect(r('!>Spoiler')).toContain('<span class="spoiler">Spoiler</span>'));
  it('underline with options', () => {
    const h = r('!~green;double; Underlined Text Plus Style ~!');
    expect(h).toContain('text-decoration-color:green');
    expect(h).toContain('text-decoration-style:double');
  });
  it('underline + color nest', () => expect(r('%violet% !~green; Combine ~! %%')).toMatch(/color:violet.*text-decoration-color:green/s));
  it('center + right align', () => {
    expect(r('-> Centered text <-')).toBe('<p style="text-align:center">Centered text</p>');
    expect(r('-> Right ->')).toBe('<p style="text-align:right">Right</p>');
  });
  it('aligned headers', () => expect(r('### -> Headers <-')).toContain('<h3 style="text-align:center" id="headers">Headers</h3>'));
  it('mixed alignment lines split into paragraphs', () => {
    const h = r('-> a <-\nplain');
    expect(h).toContain('<p style="text-align:center">a</p>');
    expect(h).toContain('<p>plain</p>');
  });
  it('admonitions', () => {
    const h = r('!!! note Admonition title\n    Admonition text');
    expect(h).toContain('class="admonition note"');
    expect(h).toContain('<p class="admonition-title">Admonition title</p>');
    expect(h).toContain('<p>Admonition text</p>');
  });
  it('admonition defaults to warning', () => expect(r('!!! Hello there\n    body')).toContain('admonition warning'));
  it('admonition with list body', () => expect(r('!!! danger DNI\n    - a\n    - b')).toContain('<li>a</li>'));
  it('image size + float', () => {
    const h = r('![Alt](https://i.imgur.com/x.png#left){100px:50px}');
    expect(h).toContain('class="float-left"');
    expect(h).toContain('width:100px;height:50px');
    expect(h).not.toContain('{100px');
  });
  it('linked image keeps size', () => expect(r('[![a](https://x.co/y.png){30px:20px}](https://rentry.co)')).toContain('width:30px'));
  it('float clear', () => expect(r('!;')).toContain('rentry-clear'));
  it('checkboxes', () => expect(r('- [x] done\n- [ ] todo')).toContain('checked'));
  it('comments are stripped', () => expect(r('[//]: (secret)\nvisible')).toBe('<p>visible</p>'));
  it('table cell newlines', () => expect(r('A | B\n--- | ---\nCell \\n line2 | x')).toMatch(/Cell<br>\s*line2/));
  it('TOC', () => {
    const src = '# One\n## Two\n\n[TOC2]';
    const h = renderRentry(src, { toc: collectHeadings(src) });
    expect(h).toContain('href="#two"');
    expect(h).not.toContain('href="#one"');
  });
  it('code fence gets line numbers', () => expect(r('``` python\nprint(1)\nprint(2)\n```')).toContain('<pre>1\n2</pre>'));
  it('cell rendering', () => expect(renderRentryCell('**hi** \\n there')).toBe('<strong>hi</strong><br>there'));
});
