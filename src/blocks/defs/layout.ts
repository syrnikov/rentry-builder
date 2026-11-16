import { ArrowDownToLine, Columns3, SquareDashed } from 'lucide-react';
import type { BlockDef } from '../types';
import { ALIGN_OPTIONS, alignField, cell, heading, LEVEL_OPTIONS, tableAlign } from '../common';
import { resolveAlign, table } from '../../rentry/inline';

const COLS = [0, 1, 2, 3];
const ALIGN3 = ALIGN_OPTIONS.slice(1);

export const columnsDef: BlockDef = {
  type: 'columns',
  label: 'Columns',
  icon: Columns3,
  category: 'layout',
  description: 'Side-by-side columns (compiles to a table)',
  defaults: () => ({ count: 2, spacing: 'tight', title0: 'likes ♡', title1: 'dislikes ✗', title2: '', title3: '', align0: 'left', align1: 'left', align2: 'left', align3: 'left' }),
  groups: [
    {
      title: 'Columns',
      fields: [
        { kind: 'number', key: 'count', label: 'Columns', min: 2, max: 4 },
        { kind: 'segmented', key: 'spacing', label: 'Spacing', options: [{ value: 'tight', label: 'Tight' }, { value: 'loose', label: 'Loose' }], hint: 'Loose adds an empty line between blocks inside a column.' },
      ],
    },
    ...COLS.map((i) => ({
      title: `Column ${i + 1}`,
      fields: [
        { kind: 'text' as const, key: `title${i}`, label: 'Header', placeholder: 'No header', showIf: (p: any) => Number(p.count) > i },
        { kind: 'segmented' as const, key: `align${i}`, label: 'Align', options: ALIGN3, showIf: (p: any) => Number(p.count) > i },
      ],
    })),
  ],
  container: {
    slotCount: (b) => Math.max(2, Math.min(4, Number(b.props.count) || 2)),
    slotLabel: (b, i) => b.props[`title${i}`] || `Column ${i + 1}`,
    accepts: (d) => !!d.toCell,
  },
  toMarkdown: (b, ctx) => {
    const n = columnsDef.container!.slotCount(b);
    const glue = b.props.spacing === 'loose' ? ' \\n \\n ' : ' \\n ';
    const header = COLS.slice(0, n).map((i) => cell(b.props[`title${i}`] || ' ') || ' ');
    const row = COLS.slice(0, n).map((i) =>
      (b.children?.[i] ?? [])
        .filter((c) => !c.hidden)
        .map((c) => ctx.cellOf(c, ctx))
        .filter((s) => s.trim())
        .join(glue),
    );
    return table(header.map((h) => (h.trim() ? `**${h}**` : ' ')), [row], COLS.slice(0, n).map((i) => tableAlign(b.props[`align${i}`] ?? 'left')));
  },
};

export const sectionDef: BlockDef = {
  type: 'section',
  label: 'Section',
  icon: SquareDashed,
  category: 'layout',
  description: 'Group blocks; shared title and alignment',
  defaults: () => ({ title: '', titleLevel: '2', titleColor: '', align: 'auto', dividerTop: false, dividerBottom: false }),
  groups: [
    {
      title: 'Section',
      fields: [
        { kind: 'text', key: 'title', label: 'Title', placeholder: 'Optional' },
        { kind: 'segmented', key: 'titleLevel', label: 'Level', options: LEVEL_OPTIONS, showIf: (p) => !!p.title },
        { kind: 'color', key: 'titleColor', label: 'Title color', showIf: (p) => !!p.title },
        { ...alignField('align', 'Align all'), hint: 'Children set to "Auto" alignment follow this.' },
        { kind: 'toggle', key: 'dividerTop', label: 'Line above' },
        { kind: 'toggle', key: 'dividerBottom', label: 'Line below' },
      ],
    },
  ],
  container: {
    slotCount: () => 1,
    slotLabel: () => 'Content',
    accepts: (d) => d.type !== 'section',
  },
  toMarkdown: (b, ctx) => {
    const a = resolveAlign(b.props.align, ctx.align);
    const inner = { ...ctx, align: b.props.align === 'auto' ? ctx.align : a };
    return [
      b.props.dividerTop && '***',
      heading(b.props.title ?? '', b.props.titleLevel, a, b.props.titleColor),
      ctx.compileList(b.children?.[0] ?? [], inner),
      b.props.dividerBottom && '***',
    ].filter((x) => x && String(x).trim()).join('\n\n');
  },
};

export const floatClearDef: BlockDef = {
  type: 'floatClear',
  label: 'Float clear',
  icon: ArrowDownToLine,
  category: 'layout',
  description: 'Stop wrapping around floated images',
  defaults: () => ({}),
  groups: [{ title: 'Float clear', fields: [] }],
  toMarkdown: () => '!;',
};
