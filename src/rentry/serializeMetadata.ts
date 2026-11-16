import { compactRgba } from './colors';
import { META_BY_KEY, META_GROUP_ORDER, META_OPTIONS } from './metadataSchema';
import { effectiveValues, MetaState } from './validateMetadata';

/** Serialize metadata as rentry expects: one `OPTION = values` line each, grouped. */
export function serializeMetadata(meta: MetaState): string {
  const blocks: string[] = [];
  for (const group of META_GROUP_ORDER) {
    const lines: string[] = [];
    for (const opt of META_OPTIONS) {
      if (opt.group !== group) continue;
      const vals = effectiveValues(opt, meta[opt.key]);
      if (!vals.length) continue;
      const value = opt.freeText
        ? vals[0].replace(/\s*[\r\n]+\s*/g, ' ')
        : vals.map((v) => (opt.validate.includes('color') ? compactRgba(v) : v)).join(' ');
      lines.push(`${opt.key} = ${value}`);
    }
    if (lines.length) blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

/** Split a value list on whitespace, keeping RGBA(...) groups intact. */
export function splitValues(raw: string): string[] {
  const out: string[] = [];
  let cur = '';
  let depth = 0;
  for (const ch of raw.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export interface ParseResult { meta: MetaState; errors: { line: number; message: string }[] }

/** Parse existing rentry metadata text (for importing). */
export function parseMetadata(text: string): ParseResult {
  const meta: MetaState = {};
  const errors: ParseResult['errors'] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const eq = t.indexOf('=');
    if (eq < 0) {
      errors.push({ line: i + 1, message: `Missing "=": ${t}` });
      return;
    }
    const key = t.slice(0, eq).trim().toUpperCase();
    const raw = t.slice(eq + 1).trim();
    const opt = META_BY_KEY[key];
    if (!opt) {
      errors.push({ line: i + 1, message: `Unknown option ${key}` });
      return;
    }
    if (meta[key]) {
      errors.push({ line: i + 1, message: `${key} is listed more than once` });
      return;
    }
    meta[key] = opt.freeText ? [raw] : splitValues(raw).map((v) => (opt.validate.includes('color') ? compactRgba(v) : v));
  });
  return { meta, errors };
}
