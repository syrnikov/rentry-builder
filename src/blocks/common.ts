import { AlignCenter, AlignLeft, AlignRight, Wand2 } from 'lucide-react';
import type { Field, Option } from './types';
import type { UnitRange } from '../rentry/metadataSchema';
import { Align, alignLine, cellEscape, color, table, underline, UnderlineOpts, bold, italic, mark } from '../rentry/inline';
import type { Props } from '../model/types';

export const ALIGN_OPTIONS: Option[] = [
  { value: 'auto', label: 'Auto', icon: Wand2 },
  { value: 'left', label: 'Left', icon: AlignLeft },
  { value: 'center', label: 'Center', icon: AlignCenter },
  { value: 'right', label: 'Right', icon: AlignRight },
];

export const alignField = (key = 'align', label = 'Align'): Field => ({ kind: 'segmented', key, label, options: ALIGN_OPTIONS });

export const IMAGE_UNITS: UnitRange[] = [
  { unit: 'px', min: 0, max: 4000, decimals: 0 },
  { unit: '%', min: 0, max: 500, decimals: 2 },
  { unit: 'vw', min: 0, max: 500, decimals: 2 },
  { unit: 'hw', min: 0, max: 500, decimals: 2 },
];

export const LEVEL_OPTIONS: Option[] = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `H${n}` }));

export const TEXT_STYLE_OPTIONS: Option[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'bold', label: 'Bold' },
  { value: 'italic', label: 'Italic' },
  { value: 'mark', label: 'Mark' },
  { value: 'code', label: 'Code' },
];

export function applyTextStyle(t: string, style?: string): string {
  if (!t.trim()) return t;
  switch (style) {
    case 'bold': return bold(t);
    case 'italic': return italic(t);
    case 'mark': return mark(t);
    case 'code': return '`' + t.replace(/`/g, "'") + '`';
    default: return t;
  }
}

/** color + underline in one go. */
export const styled = (t: string, c?: string, u?: UnderlineOpts) => color(underline(t, u), c);

export function heading(text: string, level: number | string, align: Align, c?: string, u?: UnderlineOpts): string {
  if (!text.trim()) return '';
  return `${'#'.repeat(Number(level) || 2)} ${alignLine(styled(text, c, u), align)}`;
}

/** Optional section title used by many profile blocks. */
export const titleFields = (): Field[] => [
  { kind: 'text', key: 'title', label: 'Title', placeholder: 'No title' },
  { kind: 'segmented', key: 'titleLevel', label: 'Level', options: LEVEL_OPTIONS, showIf: (p) => !!p.title },
  { kind: 'color', key: 'titleColor', label: 'Title color', showIf: (p) => !!p.title },
  { kind: 'underline', key: 'titleUnderline', label: 'Underline', showIf: (p) => !!p.title },
];
export const titleDefaults = (title = '', level = '3') => ({ title, titleLevel: level, titleColor: '', titleUnderline: { on: false } });

export const renderTitle = (p: Props, align: Align) => heading(p.title ?? '', p.titleLevel ?? 3, align, p.titleColor, p.titleUnderline);

export const join = (...parts: unknown[]) => parts.filter((x): x is string => typeof x === 'string' && !!x.trim()).join('\n\n');

export const HEADER_MODE_OPTIONS: Option[] = [
  { value: 'first', label: 'First row' },
  { value: 'empty', label: 'Empty' },
];

/** Lay cells out into a grid table. headerMode "first" uses the first row as the header row. */
export function gridTable(cells: string[], columns: number, headerMode: string, align: 'left' | 'center' | 'right' = 'center'): string {
  const cols = Math.max(1, Math.min(8, columns));
  const rows: string[][] = [];
  for (let i = 0; i < cells.length; i += cols) rows.push(cells.slice(i, i + cols));
  if (!rows.length) return '';
  const al = Array.from({ length: cols }, () => align);
  if (headerMode === 'first') return table(rows[0], rows.slice(1), al);
  return table(Array.from({ length: cols }, () => ' '), rows, al);
}

export const lines = (s: string | undefined) => (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

export const cell = cellEscape;

export const tableAlign = (a: Align): 'left' | 'center' | 'right' => (a === 'center' ? 'center' : a === 'right' ? 'right' : 'left');
