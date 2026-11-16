import { describe, expect, it } from 'vitest';
import { BLOCK_DEFS } from '../src/blocks/registry';
import { createBlock } from '../src/blocks/presets';
import { compileMarkdown, compileProject } from '../src/compiler/compile';
import { TEMPLATES } from '../src/templates';
import { renderRentry } from '../src/preview/rentryMarkdown';
import { THEME_PRESETS } from '../src/templates/themes';
import { validateMetadata } from '../src/rentry/validateMetadata';

describe('block compiler', () => {
  for (const def of BLOCK_DEFS) {
    it(`${def.type} compiles with defaults`, () => {
      const out = compileMarkdown([createBlock(def.type)]);
      if (!def.container) expect(out.trim().length).toBeGreaterThan(0);
      expect(() => renderRentry(out)).not.toThrow();
    });
  }

  it('heading with align, color and underline', () => {
    const md = compileMarkdown([createBlock('heading', { text: 'Hi', level: '3', align: 'center', color: 'red', underline: { on: true, color: 'blue', style: 'wavy' } })]);
    expect(md.trim()).toBe('### -> %red% !~blue;wavy; Hi ~! %% <-');
  });

  it('columns compile to a table with cell-safe children', () => {
    const cols = createBlock('columns', { count: 2, title0: 'likes', title1: 'dislikes' }, [
      [createBlock('list', { items: [{ text: 'a', indent: 0 }, { text: 'b', indent: 0 }] })],
      [createBlock('paragraph', { text: 'x | y' })],
    ]);
    const md = compileMarkdown([cols]).trim();
    expect(md.split('\n')).toEqual(['| **likes** | **dislikes** |', '| --- | --- |', '| • a \\n • b | x \\| y |']);
    const html = renderRentry(md);
    expect(html).toContain('• a<br>');
    expect(html).toContain('x | y');
  });

  it('profile card floats the avatar and clears', () => {
    const md = compileMarkdown([createBlock('profileCard', { avatar: 'https://x.co/a.png', avatarSize: '100px' })]);
    expect(md).toContain('![avatar](https://x.co/a.png#left){100px:100px}');
    expect(md.trim().endsWith('!;')).toBe(true);
  });

  it('section passes alignment to auto children', () => {
    const sec = createBlock('section', { align: 'center' }, [[createBlock('paragraph', { text: 'hello', align: 'auto' })]]);
    expect(compileMarkdown([sec]).trim()).toBe('-> hello <-');
  });

  it('hidden blocks are skipped', () => {
    const h = createBlock('heading');
    h.hidden = true;
    expect(compileMarkdown([h]).trim()).toBe('');
  });

  for (const t of THEME_PRESETS) {
    it(`theme preset ${t.name} is valid metadata`, () => {
      expect(validateMetadata(t.meta).filter((i) => i.severity === 'error')).toEqual([]);
    });
  }

  for (const t of TEMPLATES) {
    it(`template ${t.id} compiles with valid metadata`, () => {
      const r = compileProject(t.make());
      expect(r.markdown.length).toBeGreaterThan(50);
      expect(r.metaIssues.filter((i) => i.severity === 'error')).toEqual([]);
      expect(r.blockIssues.filter((i) => i.severity === 'error')).toEqual([]);
    });
  }
});
