import type { CSSProperties } from 'react';
import type { MetaState } from '../rentry/validateMetadata';
import { effectiveValues } from '../rentry/validateMetadata';
import { META_BY_KEY } from '../rentry/metadataSchema';
import { toDisplayFontName } from '../rentry/googleFonts';

export interface ThemeCtx { dark: boolean; artW: number; artH: number }

export interface PreviewTheme {
  outer: CSSProperties;
  outerFg?: string;
  inner: CSSProperties;
  innerFg?: string;
  vars: Record<string, string>;
  dir: 'ltr' | 'rtl';
  fonts: string[];
}

const get = (meta: MetaState, key: string) => effectiveValues(META_BY_KEY[key], meta[key]);

/** Pick the light or dark value from a 1–2 value option. */
const mode = (vals: string[], dark: boolean) => (vals.length === 0 ? undefined : vals.length > 1 && dark ? vals[1] : vals[0]);

/** Convert a rentry css_size into something the preview can use. */
export function len(v: string | undefined, ctx: ThemeCtx): string | undefined {
  if (!v) return undefined;
  const m = /^(-?\d*\.?\d+)(px|%|vh|hw|vw|rem)?$/.exec(v.trim());
  if (!m) return v;
  const n = parseFloat(m[1]);
  switch (m[2]) {
    case 'hw':
    case 'vw':
      return `${+((n / 100) * ctx.artW).toFixed(2)}px`;
    case 'vh':
      return `${+((n / 100) * ctx.artH).toFixed(2)}px`;
    case 'rem':
      return `calc(var(--rp-base, 16px) * ${n})`;
    case '%':
      return `${n}%`;
    case 'px':
      return `${n}px`;
    default:
      return n === 0 ? '0' : `${n}px`;
  }
}

const sides = (vals: string[], ctx: ThemeCtx) => (vals.length ? vals.map((v) => len(v, ctx)).join(' ') : undefined);
const url = (v?: string) => (v ? `url("${v.replace(/"/g, '%22')}")` : undefined);
const color = (v?: string) => v;

export function buildTheme(meta: MetaState, ctx: ThemeCtx): PreviewTheme {
  const d = ctx.dark;
  const outer: CSSProperties = {
    backgroundColor: color(mode(get(meta, 'CONTAINER_OUTER_BACKGROUND_COLOR'), d)),
    backgroundImage: url(get(meta, 'CONTAINER_OUTER_BACKGROUND_IMAGE')[0]),
    backgroundRepeat: get(meta, 'CONTAINER_OUTER_BACKGROUND_IMAGE_REPEAT')[0],
    backgroundPosition: get(meta, 'CONTAINER_OUTER_BACKGROUND_IMAGE_POSITION')[0],
    backgroundSize: bgSize(get(meta, 'CONTAINER_OUTER_BACKGROUND_IMAGE_SIZE')[0], ctx),
  };

  const shadowColor = get(meta, 'CONTAINER_SHADOW_COLOR')[0];
  const off = get(meta, 'CONTAINER_SHADOW_OFFSET');
  const shadow = shadowColor
    ? [len(off[0] ?? '0px', ctx), len(off[1] ?? off[0] ?? '0px', ctx), len(get(meta, 'CONTAINER_SHADOW_BLUR')[0] ?? '0px', ctx), len(get(meta, 'CONTAINER_SHADOW_SPREAD')[0] ?? '0px', ctx), shadowColor].join(' ')
    : undefined;

  const borderImage = get(meta, 'CONTAINER_BORDER_IMAGE')[0];
  const borderStyle = get(meta, 'CONTAINER_BORDER_STYLE');
  const borderWidth = get(meta, 'CONTAINER_BORDER_WIDTH');
  const maxW = get(meta, 'CONTAINER_MAX_WIDTH')[0];

  const inner: CSSProperties = {
    padding: sides(get(meta, 'CONTAINER_PADDING'), ctx),
    maxWidth: len(maxW, ctx),
    marginLeft: maxW ? 'auto' : undefined,
    marginRight: maxW ? 'auto' : undefined,
    backgroundColor: color(mode(get(meta, 'CONTAINER_INNER_BACKGROUND_COLOR'), d)),
    backgroundImage: url(get(meta, 'CONTAINER_INNER_BACKGROUND_IMAGE')[0]),
    backgroundRepeat: get(meta, 'CONTAINER_INNER_BACKGROUND_IMAGE_REPEAT')[0],
    backgroundPosition: get(meta, 'CONTAINER_INNER_BACKGROUND_IMAGE_POSITION')[0],
    backgroundSize: bgSize(get(meta, 'CONTAINER_INNER_BACKGROUND_IMAGE_SIZE')[0], ctx),
    borderRadius: sides(get(meta, 'CONTAINER_BORDER_RADIUS'), ctx),
    boxShadow: shadow,
  };
  if (borderStyle.length && borderWidth.length) {
    inner.borderStyle = borderStyle.join(' ');
    inner.borderWidth = sides(borderWidth, ctx);
    const bc = get(meta, 'CONTAINER_BORDER_COLOR');
    if (bc.length) inner.borderColor = bc.join(' ');
  }
  if (borderImage) {
    const bw = get(meta, 'CONTAINER_BORDER_IMAGE_WIDTH');
    inner.borderImageSource = url(borderImage);
    inner.borderImageSlice = get(meta, 'CONTAINER_BORDER_IMAGE_SLICE').join(' ') || undefined;
    inner.borderImageWidth = bw.map((v) => (/^\d+$/.test(v) || v === 'auto' ? v : len(v, ctx))).join(' ') || undefined;
    inner.borderImageOutset = get(meta, 'CONTAINER_BORDER_IMAGE_OUTSET').map((v) => (/^\d+$/.test(v) || v === 'auto' ? v : len(v, ctx))).join(' ') || undefined;
    inner.borderImageRepeat = get(meta, 'CONTAINER_BORDER_IMAGE_REPEAT').join(' ') || undefined;
    if (!inner.borderStyle) {
      inner.borderStyle = 'solid';
      inner.borderColor = 'transparent';
      inner.borderWidth = inner.borderImageWidth && !/^\d+$/.test(String(inner.borderImageWidth)) ? String(inner.borderImageWidth) : '20px';
    }
  }

  const vars: Record<string, string> = {};
  const setVar = (k: string, v: string | undefined) => { if (v) vars[k] = v; };

  const fonts = get(meta, 'CONTENT_FONT');
  if (fonts[0]) setVar('--rp-font', `"${toDisplayFontName(fonts[0])}", var(--rp-default-font)`);
  setVar('--rp-font-head', fonts[1] ? `"${toDisplayFontName(fonts[1])}", var(--rp-default-font)` : vars['--rp-font']);
  const weights = get(meta, 'CONTENT_FONT_WEIGHT');
  setVar('--rp-weight', weights[0]);
  setVar('--rp-weight-head', weights[1]);

  const sizes = get(meta, 'CONTENT_TEXT_SIZE');
  const sizeVars = ['--rp-base', '--rp-p', '--rp-h1', '--rp-h2', '--rp-h3', '--rp-h4', '--rp-h5', '--rp-h6', '--rp-li', '--rp-a', '--rp-quote', '--rp-code'];
  sizes.forEach((v, i) => { if (v && v !== '0') setVar(sizeVars[i], i === 0 ? len(v, ctx)?.replace('calc(var(--rp-base, 16px) *', 'calc(16px *') : len(v, ctx)); });

  setVar('--rp-align', get(meta, 'CONTENT_TEXT_ALIGN')[0]);
  setVar('--rp-text', mode(get(meta, 'CONTENT_TEXT_COLOR'), d));
  setVar('--rp-link', mode(get(meta, 'CONTENT_LINK_COLOR'), d));
  setVar('--rp-bullet', mode(get(meta, 'CONTENT_BULLET_COLOR'), d));
  const tsc = get(meta, 'CONTENT_TEXT_SHADOW_COLOR')[0];
  const tso = get(meta, 'CONTENT_TEXT_SHADOW_OFFSET');
  if (tsc && tso.length) {
    setVar('--rp-text-shadow', [len(tso[0], ctx), len(tso[1] ?? tso[0], ctx), len(get(meta, 'CONTENT_TEXT_SHADOW_BLUR')[0] ?? '0px', ctx), tsc].join(' '));
  }

  return {
    outer,
    outerFg: mode(get(meta, 'CONTAINER_OUTER_FOREGROUND_COLOR'), d),
    inner,
    innerFg: mode(get(meta, 'CONTAINER_INNER_FOREGROUND_COLOR'), d),
    vars,
    dir: get(meta, 'CONTENT_TEXT_DIRECTION')[0] === 'rtl' ? 'rtl' : 'ltr',
    fonts,
  };
}

function bgSize(v: string | undefined, ctx: ThemeCtx) {
  if (!v) return undefined;
  return v === 'cover' || v === 'contain' ? v : len(v, ctx);
}
