import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { createBlock } from '../src/blocks/presets';
import { collectUsedColors, replaceColor } from '../src/model/palette';
import { migrateProject } from '../src/model/migrate';
import type { Project } from '../src/model/types';

const sample = (): Project => ({
  version: 1,
  name: 't',
  meta: { CONTENT_TEXT_COLOR: ['#ff6ad5', 'white'], CONTAINER_PADDING: ['10px'], CONTAINER_SHADOW_COLOR: ['RGBA(0,0,0,0.2)'] },
  blocks: [
    createBlock('heading', { text: 'Hi', color: '#FF6AD5', underline: { on: true, color: 'teal' } }),
    createBlock('paragraph', { text: 'I like %#ff6ad5% pink %% and !~#ff6ad5; lines ~! and %teal% sea %%' }),
    createBlock('interests', { tags: [{ text: 'a', color: 'gold' }] }),
  ],
  palette: [],
});

describe('palette', () => {
  it('collects colors from metadata, block props and inline syntax (deduped, case-insensitive)', () => {
    const used = collectUsedColors(sample());
    expect(used.map((c) => c.toLowerCase()).sort()).toEqual(['#ff6ad5', 'gold', 'rgba(0,0,0,0.2)', 'teal', 'white'].sort());
  });

  it('replaces a color everywhere, including inline syntax', () => {
    const next = produce(sample(), (d) => { replaceColor(d, '#ff6ad5', '#00aaff'); });
    expect(next.meta.CONTENT_TEXT_COLOR).toEqual(['#00aaff', 'white']);
    expect(next.blocks[0].props.color).toBe('#00aaff');
    expect(next.blocks[1].props.text).toBe('I like %#00aaff% pink %% and !~#00aaff; lines ~! and %teal% sea %%');
    expect(next.blocks[0].props.underline.color).toBe('teal');
  });

  it('only updates metadata when the new color is RGBA (not valid inline)', () => {
    const next = produce(sample(), (d) => { replaceColor(d, '#ff6ad5', 'RGBA(1,2,3,0.5)'); });
    expect(next.meta.CONTENT_TEXT_COLOR[0]).toBe('RGBA(1,2,3,0.5)');
    expect(next.blocks[0].props.color).toBe('#FF6AD5');
    expect(next.blocks[1].props.text).toContain('%#ff6ad5%');
  });

  it('replaces nested list item colors', () => {
    const next = produce(sample(), (d) => { replaceColor(d, 'gold', 'orange'); });
    expect(next.blocks[2].props.tags[0].color).toBe('orange');
  });

  it('survives migration and drops junk entries', () => {
    const p = migrateProject({ ...sample(), palette: [{ value: '#123', name: 'x' }, { nope: 1 }, null] });
    expect(p.palette).toEqual([{ value: '#123', name: 'x' }]);
    expect(migrateProject({ blocks: [] }).palette).toEqual([]);
  });
});
