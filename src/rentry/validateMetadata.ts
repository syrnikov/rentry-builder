import { isAnyColor } from './colors';
import { META_BY_KEY, MetaOption, Unit, UnitRange, Validator } from './metadataSchema';

export type MetaState = Record<string, string[]>;

export interface MetaIssue {
  key: string;
  severity: 'error' | 'warning';
  message: string;
  /** Option keys that would fix a missing "requires" problem. */
  fixAdd?: string[];
}

const SIZE_RE = /^(-?\d*\.?\d+)(px|%|vh|hw|vw|rem)?$/;

export interface ParsedSize { num: number; unit: Unit; decimals: number }

export function parseSize(v: string): ParsedSize | null {
  const m = SIZE_RE.exec(v.trim());
  if (!m) return null;
  const dec = m[1].includes('.') ? m[1].split('.')[1].length : 0;
  return { num: parseFloat(m[1]), unit: (m[2] as Unit) ?? 'no-unit', decimals: dec };
}

/** Returns null when ok, otherwise an error message. */
export function checkSize(v: string, units: UnitRange[]): string | null {
  const p = parseSize(v);
  if (!p) return `"${v}" is not a size`;
  let range = units.find((u) => u.unit === p.unit);
  if (!range && p.unit === 'no-unit') {
    // A bare number is read as the option's default (first) unit.
    range = units[0];
  }
  if (!range) return `unit "${p.unit === 'no-unit' ? 'none' : p.unit}" not allowed (use ${units.map((u) => (u.unit === 'no-unit' ? 'a bare number' : u.unit)).join(', ')})`;
  if (p.num < range.min || p.num > range.max) {
    return `${v} is out of range (${range.min}–${range.max}${range.unit === 'no-unit' ? '' : range.unit})`;
  }
  if (p.decimals > range.decimals) {
    return `${v} has too many decimals (max ${range.decimals} for ${range.unit})`;
  }
  return null;
}

const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(:\d+)?(\/\S*)?$/i;
const DATA_URI_RE = /^data:image\/(png|jpeg|jpg|gif|webp|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/=]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RENTRY_URL_RE = /^((https?:\/\/)?(www\.)?rentry\.(co|org)\/[\w-]+|\/[\w-]+)$/i;
const FONT_RE = /^[A-Za-z0-9_]+$/;

function checkOne(v: string, val: Validator, opt: MetaOption): string | null {
  switch (val) {
    case 'text':
    case 'raw_access_code':
      return null;
    case 'url':
      return v.length <= 1000 && URL_RE.test(v) ? null : `"${short(v)}" is not a valid link`;
    case 'image_data_uri':
      return DATA_URI_RE.test(v) ? null : 'not a valid base64 image data URI';
    case 'bool':
      return v === 'true' || v === 'false' ? null : 'must be true or false';
    case 'whitelist':
      return opt.whitelist?.includes(v) ? null : `"${v}" is not allowed (${opt.whitelist?.join(', ')})`;
    case 'color':
      return isAnyColor(v) ? null : `"${v}" is not a color name, #hex or RGBA(r,g,b,a)`;
    case 'css_size':
      return checkSize(v, opt.units ?? []);
    case 'font_name':
      return FONT_RE.test(v) ? null : `"${v}" is not a font name (use underscores instead of spaces)`;
    case 'email':
      return EMAIL_RE.test(v) ? null : 'not a valid email address';
    case 'rentry_url':
      return RENTRY_URL_RE.test(v) ? null : 'must be a rentry URL or /shorthand';
  }
}

const short = (v: string) => (v.length > 40 ? v.slice(0, 37) + '…' : v);

export function joinValues(opt: MetaOption, values: string[]): string {
  return opt.freeText ? values[0] ?? '' : values.join(' ');
}

/** Values actually emitted for an option (empties removed, text-size gaps → 0). */
export function effectiveValues(opt: MetaOption, values: string[] | undefined): string[] {
  if (!values) return [];
  if (opt.freeText) return values[0]?.trim() ? [values[0].trim()] : [];
  if (opt.mapping === 'textsizes') {
    const out = values.map((v) => v.trim() || '0');
    while (out.length && out[out.length - 1] === '0') out.pop();
    return out;
  }
  return values.map((v) => v.trim()).filter(Boolean);
}

export function validateOption(key: string, values: string[]): MetaIssue[] {
  const opt = META_BY_KEY[key];
  if (!opt) return [{ key, severity: 'error', message: `Unknown option ${key}` }];
  const vals = effectiveValues(opt, values);
  if (!vals.length) return [];
  const issues: MetaIssue[] = [];
  if (vals.length > opt.maxValues) {
    issues.push({ key, severity: 'error', message: `accepts at most ${opt.maxValues} value${opt.maxValues > 1 ? 's' : ''}, got ${vals.length}` });
  }
  const joined = joinValues(opt, vals);
  if (joined.length > opt.maxLength) {
    issues.push({ key, severity: 'error', message: `too long (${joined.length}/${opt.maxLength} characters)` });
  }
  if (opt.mapping === 'multi' && new Set(vals).size !== vals.length) {
    issues.push({ key, severity: 'error', message: 'contains duplicate values' });
  }
  for (const v of vals) {
    if (opt.mapping === 'textsizes' && v === '0') continue;
    const errs = opt.validate.map((val) => checkOne(v, val, opt));
    if (errs.every((e) => e !== null)) {
      issues.push({ key, severity: 'error', message: errs[errs.length - 1]! });
    }
  }
  if (opt.allowDataUri && joined.startsWith('data:') && joined.length > 8000) {
    issues.push({ key, severity: 'warning', message: `embedded image is ${Math.round(joined.length / 1024)} KB of text; every visitor downloads it` });
  }
  return issues;
}

export function validateMetadata(meta: MetaState): MetaIssue[] {
  const issues: MetaIssue[] = [];
  const present = new Set(
    Object.keys(meta).filter((k) => META_BY_KEY[k] && effectiveValues(META_BY_KEY[k], meta[k]).length > 0),
  );
  for (const key of Object.keys(meta)) issues.push(...validateOption(key, meta[key]));
  for (const key of present) {
    const opt = META_BY_KEY[key];
    const missing = (opt.requires ?? []).filter((k) => !present.has(k));
    if (missing.length) {
      issues.push({ key, severity: 'error', message: `requires ${missing.join(' and ')}`, fixAdd: missing });
    }
    if (opt.requiresOne && !opt.requiresOne.some((k) => present.has(k))) {
      issues.push({ key, severity: 'error', message: `requires one of ${opt.requiresOne.join(', ')}`, fixAdd: [opt.requiresOne[0]] });
    }
  }
  return issues;
}

/** Sensible starting value used by the "add required" quick fix. */
export const QUICK_FIX_DEFAULTS: Record<string, string[]> = {
  CONTAINER_BORDER_WIDTH: ['2px'],
  CONTAINER_BORDER_STYLE: ['solid'],
  CONTAINER_BORDER_COLOR: ['gray'],
  CONTAINER_BORDER_IMAGE: ['https://'],
  CONTAINER_BORDER_IMAGE_WIDTH: ['20px'],
  CONTAINER_SHADOW_COLOR: ['RGBA(0,0,0,0.25)'],
  CONTAINER_SHADOW_OFFSET: ['0px', '4px'],
  CONTAINER_SHADOW_BLUR: ['12px'],
  CONTAINER_SHADOW_SPREAD: ['0px'],
  CONTENT_TEXT_SHADOW_COLOR: ['black'],
  CONTENT_TEXT_SHADOW_OFFSET: ['1px', '1px'],
};
