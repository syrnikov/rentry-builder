import type { Project } from './types';
import { walk } from './tree';
import { META_BY_KEY } from '../rentry/metadataSchema';
import { isAnyColor, isColorName, isHexColor } from '../rentry/colors';

export interface PaletteColor { value: string; name: string }

/** Inline rentry syntax (%color% and !~color;) only accepts names and hex. */
export const isInlineColor = (v: string) => isColorName(v) || isHexColor(v);

const norm = (v: string) => v.trim().toLowerCase();
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const INLINE_RE = /%(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)%|!~(#[0-9a-fA-F]{3,8}|[a-zA-Z]+);/g;

/** Every distinct color used in the project's metadata, block color props and inline text. */
export function collectUsedColors(p: Project): string[] {
  const seen = new Map<string, string>();
  const add = (v: unknown) => {
    if (typeof v !== 'string' || !v.trim() || !isAnyColor(v.trim())) return;
    const k = norm(v);
    if (k === 'transparent' || seen.has(k)) return;
    seen.set(k, v.trim());
  };
  for (const [key, vals] of Object.entries(p.meta)) {
    if (META_BY_KEY[key]?.validate.includes('color')) vals.forEach(add);
  }
  const visit = (val: unknown, key: string) => {
    if (typeof val === 'string') {
      if (/colou?r$/i.test(key)) add(val);
      for (const m of val.matchAll(INLINE_RE)) add(m[1] ?? m[2]);
    } else if (Array.isArray(val)) val.forEach((v) => visit(v, key));
    else if (val && typeof val === 'object') for (const [k, v] of Object.entries(val)) visit(v, k);
  };
  walk(p.blocks, (b) => visit(b.props, ''));
  return [...seen.values()];
}

/**
 * Replace one color with another everywhere in a project draft (mutates it).
 * Exact matches in color fields are swapped; inline %color% / !~color; syntax is
 * rewritten only when the new color is valid inline (name or hex).
 */
export function replaceColor(p: Project, from: string, to: string): number {
  const f = norm(from);
  if (!f || !to.trim() || f === norm(to)) return 0;
  let count = 0;
  for (const [key, vals] of Object.entries(p.meta)) {
    if (!META_BY_KEY[key]?.validate.includes('color')) continue;
    p.meta[key] = vals.map((v) => (norm(v) === f ? (count++, to) : v));
  }
  const inlineOk = isInlineColor(to.trim()) && isInlineColor(from.trim());
  const pct = new RegExp(`%${esc(from.trim())}%`, 'gi');
  const ul = new RegExp(`!~${esc(from.trim())};`, 'gi');
  const fix = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        if (/colou?r$/i.test(k) && norm(v) === f) {
          // Block colors compile to inline syntax, so they also need a name or hex.
          if (isInlineColor(to.trim())) { obj[k] = to; count++; }
        } else if (inlineOk && (pct.test(v) || ul.test(v))) {
          pct.lastIndex = 0;
          ul.lastIndex = 0;
          obj[k] = v.replace(pct, () => (count++, `%${to}%`)).replace(ul, () => (count++, `!~${to};`));
        }
        pct.lastIndex = 0;
        ul.lastIndex = 0;
      } else if (Array.isArray(v)) v.forEach((x) => x && typeof x === 'object' && fix(x as Record<string, unknown>));
      else if (v && typeof v === 'object') fix(v as Record<string, unknown>);
    }
  };
  walk(p.blocks, (b) => fix(b.props));
  return count;
}
