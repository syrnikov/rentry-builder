import { Code2, Heading, Info, ListChecks, ListTree, List as ListIcon, MessageSquareDashed, Minus, MoveVertical, Pilcrow, Quote } from 'lucide-react';
import type { BlockDef } from '../types';
import { alignField, applyTextStyle, cell, heading, LEVEL_OPTIONS, styled, TEXT_STYLE_OPTIONS } from '../common';
import { alignLine, color, italic, noUnderline, resolveAlign } from '../../rentry/inline';

export const headingDef: BlockDef = {
  type: 'heading',
  label: 'Heading',
  icon: Heading,
  category: 'text',
  description: 'Section title, H1–H6',
  primaryText: 'text',
  defaults: () => ({ text: 'Heading', level: '2', align: 'auto', color: '', underline: noUnderline() }),
  groups: [
    {
      title: 'Heading',
      fields: [
        { kind: 'text', key: 'text', label: 'Text' },
        { kind: 'segmented', key: 'level', label: 'Level', options: LEVEL_OPTIONS },
        alignField(),
      ],
    },
    { title: 'Style', fields: [{ kind: 'color', key: 'color', label: 'Color' }, { kind: 'underline', key: 'underline', label: 'Underline' }] },
  ],
  toMarkdown: (b, ctx) => heading(b.props.text, b.props.level, resolveAlign(b.props.align, ctx.align), b.props.color, b.props.underline),
  toCell: (b) => (b.props.text?.trim() ? `**${styled(cell(b.props.text), b.props.color, b.props.underline)}**` : ''),
};

export const paragraphDef: BlockDef = {
  type: 'paragraph',
  label: 'Text',
  icon: Pilcrow,
  category: 'text',
  description: 'Paragraph with inline styles',
  primaryText: 'text',
  defaults: () => ({ text: 'Write something about yourself. **Bold**, *italic*, ==marked== and %hotpink% colored %% text all work.', align: 'auto', color: '', style: 'plain' }),
  groups: [
    { title: 'Text', fields: [{ kind: 'textarea', key: 'text', label: 'Content', rich: true, rows: 6 }, alignField()] },
    { title: 'Style', fields: [{ kind: 'color', key: 'color', label: 'Color' }, { kind: 'segmented', key: 'style', label: 'Emphasis', options: TEXT_STYLE_OPTIONS.slice(0, 4) }] },
  ],
  toMarkdown: (b, ctx) => {
    const a = resolveAlign(b.props.align, ctx.align);
    return (b.props.text ?? '')
      .split('\n')
      .map((l: string) => (l.trim() ? alignLine(color(applyTextStyle(l, b.props.style), b.props.color), a) : ''))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },
  toCell: (b) => (b.props.text ?? '').split('\n').filter((l: string) => l.trim()).map((l: string) => color(applyTextStyle(cell(l), b.props.style), b.props.color)).join(' \\n '),
};

export const quoteDef: BlockDef = {
  type: 'quote',
  label: 'Quote',
  icon: Quote,
  category: 'text',
  description: 'Block quote with attribution',
  primaryText: 'text',
  defaults: () => ({ text: 'Not all those who wander are lost.', attribution: 'J.R.R. Tolkien', depth: 1, align: 'auto', color: '' }),
  groups: [
    {
      title: 'Quote',
      fields: [
        { kind: 'textarea', key: 'text', label: 'Text', rich: true, rows: 3 },
        { kind: 'text', key: 'attribution', label: 'Attribution', placeholder: 'Optional' },
        { kind: 'number', key: 'depth', label: 'Nesting', min: 1, max: 3 },
        alignField(),
        { kind: 'color', key: 'color', label: 'Color' },
      ],
    },
  ],
  toMarkdown: (b, ctx) => {
    const a = resolveAlign(b.props.align, ctx.align);
    const prefix = '>'.repeat(b.props.depth || 1) + ' ';
    const body = (b.props.text ?? '').split('\n').map((l: string) => prefix + alignLine(color(l, b.props.color), a));
    if (b.props.attribution?.trim()) body.push(prefix, prefix + alignLine(italic(`— ${b.props.attribution}`), a));
    return body.join('\n');
  },
  toCell: (b) => italic(`“${cell(b.props.text ?? '')}”`) + (b.props.attribution ? ` \\n — ${cell(b.props.attribution)}` : ''),
};

export const listDef: BlockDef = {
  type: 'list',
  label: 'List',
  icon: ListIcon,
  category: 'text',
  description: 'Bulleted or numbered list',
  defaults: () => ({ ordered: false, color: '', items: [{ text: 'First thing', indent: 0 }, { text: 'Second thing', indent: 0 }, { text: 'A nested detail', indent: 1 }] }),
  groups: [
    {
      title: 'List',
      fields: [
        { kind: 'segmented', key: 'ordered', label: 'Type', options: [{ value: 'false', label: 'Bullets' }, { value: 'true', label: 'Numbers' }] },
        { kind: 'color', key: 'color', label: 'Text color' },
        {
          kind: 'list', key: 'items', label: 'Items', itemLabel: 'Item',
          newItem: () => ({ text: 'New item', indent: 0 }),
          summary: (it) => `${'  '.repeat(it.indent || 0)}${it.text}`,
          fields: [{ kind: 'text', key: 'text', label: 'Text' }, { kind: 'number', key: 'indent', label: 'Indent', min: 0, max: 3 }],
        },
      ],
    },
  ],
  toMarkdown: (b) => {
    const ordered = String(b.props.ordered) === 'true';
    return (b.props.items ?? [])
      .filter((it: any) => it.text?.trim())
      .map((it: any) => `${'    '.repeat(it.indent || 0)}${ordered ? '1.' : '-'} ${color(it.text, b.props.color)}`)
      .join('\n');
  },
  toCell: (b) => {
    const ordered = String(b.props.ordered) === 'true';
    let n = 0;
    return (b.props.items ?? [])
      .filter((it: any) => it.text?.trim())
      .map((it: any) => `${'  '.repeat(it.indent || 0)}${ordered && !it.indent ? `${++n}.` : it.indent ? '◦' : '•'} ${color(cell(it.text), b.props.color)}`)
      .join(' \\n ');
  },
};

export const checklistDef: BlockDef = {
  type: 'checklist',
  label: 'Checklist',
  icon: ListChecks,
  category: 'text',
  description: 'Checkbox list — goals, bucket list',
  defaults: () => ({ items: [{ text: 'Learn to bake bread', done: true }, { text: 'Visit Japan', done: false }, { text: 'Finish my sketchbook', done: false }] }),
  groups: [
    {
      title: 'Checklist',
      fields: [
        {
          kind: 'list', key: 'items', label: 'Items', itemLabel: 'Item',
          newItem: () => ({ text: 'New goal', done: false }),
          summary: (it) => `${it.done ? '☑' : '☐'} ${it.text}`,
          fields: [{ kind: 'text', key: 'text', label: 'Text' }, { kind: 'toggle', key: 'done', label: 'Done' }],
        },
      ],
    },
  ],
  toMarkdown: (b) => (b.props.items ?? []).filter((it: any) => it.text?.trim()).map((it: any) => `- [${it.done ? 'x' : ' '}] ${it.text}`).join('\n'),
  toCell: (b) => (b.props.items ?? []).filter((it: any) => it.text?.trim()).map((it: any) => `${it.done ? '☑' : '☐'} ${cell(it.text)}`).join(' \\n '),
};

export const codeDef: BlockDef = {
  type: 'code',
  label: 'Code',
  icon: Code2,
  category: 'text',
  description: 'Code block with syntax language',
  primaryText: 'code',
  defaults: () => ({ code: 'const me = {\n  vibe: "cozy",\n  coffee: true,\n};', language: 'js' }),
  groups: [
    {
      title: 'Code',
      fields: [
        { kind: 'text', key: 'language', label: 'Language', placeholder: 'python, js, text…' },
        { kind: 'textarea', key: 'code', label: 'Code', rows: 8, mono: true },
      ],
    },
  ],
  toMarkdown: (b) => {
    const code: string = b.props.code ?? '';
    const fence = code.includes('```') ? '~~~' : '```';
    return `${fence} ${b.props.language || 'text'}\n${code}\n${fence}`;
  },
};

const ADMONITION_KINDS = [
  { value: 'info', label: 'Info' },
  { value: 'note', label: 'Note' },
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
  { value: 'greentext', label: 'Greentext' },
];

export const admonitionDef: BlockDef = {
  type: 'admonition',
  label: 'Callout',
  icon: Info,
  category: 'text',
  description: 'Info / note / warning / danger box',
  primaryText: 'text',
  defaults: () => ({ kind: 'info', title: 'Heads up', text: 'I reply slowly but I always reply!' }),
  groups: [
    {
      title: 'Callout',
      fields: [
        { kind: 'select', key: 'kind', label: 'Type', options: ADMONITION_KINDS },
        { kind: 'text', key: 'title', label: 'Title', placeholder: 'Optional' },
        { kind: 'textarea', key: 'text', label: 'Text', rich: true, rows: 4 },
      ],
    },
  ],
  toMarkdown: (b) => admonition(b.props.kind, b.props.title, b.props.text),
};

export function admonition(kind: string, title: string | undefined, body: string | undefined): string {
  const head = `!!! ${kind || 'info'}${title?.trim() ? ' ' + title.trim() : ''}`;
  const text = (body ?? '').split('\n').map((l) => (l.trim() ? '    ' + l : '')).join('\n').replace(/\n+$/, '');
  return text.trim() ? `${head}\n${text}` : head;
}

export const dividerDef: BlockDef = {
  type: 'divider',
  label: 'Divider',
  icon: Minus,
  category: 'text',
  description: 'Horizontal rule or decorative symbols',
  defaults: () => ({ style: 'rule', symbols: '✦ ✦ ✦', color: '', align: 'center' }),
  groups: [
    {
      title: 'Divider',
      fields: [
        { kind: 'segmented', key: 'style', label: 'Style', options: [{ value: 'rule', label: 'Line' }, { value: 'symbols', label: 'Symbols' }] },
        { kind: 'text', key: 'symbols', label: 'Symbols', showIf: (p) => p.style === 'symbols' },
        { kind: 'color', key: 'color', label: 'Color', showIf: (p) => p.style === 'symbols' },
        { ...alignField(), showIf: (p) => p.style === 'symbols' },
      ],
    },
  ],
  toMarkdown: (b, ctx) => (b.props.style === 'symbols' ? alignLine(color(b.props.symbols || '* * *', b.props.color), resolveAlign(b.props.align, ctx.align)) : '***'),
  toCell: (b) => (b.props.style === 'symbols' ? color(cell(b.props.symbols || '—'), b.props.color) : '———'),
};

export const spacerDef: BlockDef = {
  type: 'spacer',
  label: 'Spacer',
  icon: MoveVertical,
  category: 'text',
  description: 'Empty vertical space',
  defaults: () => ({ lines: 1 }),
  groups: [{ title: 'Spacer', fields: [{ kind: 'number', key: 'lines', label: 'Lines', min: 1, max: 6 }] }],
  toMarkdown: (b) => Array.from({ length: b.props.lines || 1 }, () => '&nbsp;').join('\n\n'),
  toCell: (b) => Array.from({ length: b.props.lines || 1 }, () => '&nbsp;').join(' \\n '),
};

export const tocDef: BlockDef = {
  type: 'toc',
  label: 'Contents',
  icon: ListTree,
  category: 'text',
  description: 'Table of contents from headings',
  defaults: () => ({ from: '1', title: '' }),
  groups: [
    {
      title: 'Table of contents',
      fields: [
        { kind: 'text', key: 'title', label: 'Title', placeholder: 'Optional' },
        { kind: 'segmented', key: 'from', label: 'From', options: LEVEL_OPTIONS.slice(0, 4), hint: 'Lowest heading level to include' },
      ],
    },
  ],
  toMarkdown: (b) => {
    const toc = b.props.from && b.props.from !== '1' ? `[TOC${b.props.from}]` : '[TOC]';
    return b.props.title?.trim() ? `**${b.props.title}**\n\n${toc}` : toc;
  },
};

export const commentDef: BlockDef = {
  type: 'comment',
  label: 'Hidden note',
  icon: MessageSquareDashed,
  category: 'text',
  description: 'Comment that is not shown on the page',
  primaryText: 'text',
  editorOnly: true,
  defaults: () => ({ text: 'Note to self: update this every month' }),
  groups: [{ title: 'Hidden note', fields: [{ kind: 'textarea', key: 'text', label: 'Note', rows: 3, hint: 'Saved in the markdown as [//]: (…) and hidden from visitors.' }] }],
  toMarkdown: (b) => (b.props.text ?? '').split('\n').filter((l: string) => l.trim()).map((l: string) => `[//]: (${l.replace(/[()]/g, '')})`).join('\n'),
};

