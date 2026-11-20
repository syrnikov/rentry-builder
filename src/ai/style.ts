import type { Block, Project, Props } from '../model/types';
import type { Field } from '../blocks/types';
import { getDef } from '../blocks/registry';
import { walk } from '../model/tree';
import { parseRich } from '../rentry/richText';
import { defFields } from './context';
import { isColorName, isHexColor } from '../rentry/colors';

/**
 * Learns how *this* author builds pages (alignment, symbols, casing, color rhythm, structure) so the AI
 * imitates them instead of producing a generic page. Everything here is local: no API calls.
 */

interface TextItem { block: Block; field: string; md: string; plain: string[] }

const TEXT_KINDS = new Set(['text', 'textarea']);
const STYLE_KINDS = new Set(['segmented', 'select', 'toggle', 'color', 'size', 'number', 'underline']);
const COLOR_SPAN = /%(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)%/g;

const plainLines = (md: string) => {
  try { return parseRich(md).map((l) => l.runs.map((r) => (r.image ? '' : r.text)).join('').trim()).filter(Boolean); }
  catch { return md.split('\n').map((l) => l.trim()).filter(Boolean); }
};

function collectTexts(p: Project): TextItem[] {
  const out: TextItem[] = [];
  walk(p.blocks, (b) => {
    if (b.hidden) return;
    for (const f of defFields(b.type)) {
      if (TEXT_KINDS.has(f.kind) && !(f.kind === 'textarea' && f.mono) && typeof b.props[f.key] === 'string' && b.props[f.key].trim()) {
        out.push({ block: b, field: f.key, md: b.props[f.key], plain: plainLines(b.props[f.key]) });
      }
      if (f.kind === 'list' && Array.isArray(b.props[f.key])) {
        for (const it of b.props[f.key] as Props[]) {
          for (const sub of f.fields) if (sub.kind === 'text' && typeof it?.[sub.key] === 'string' && it[sub.key].trim()) {
            out.push({ block: b, field: `${f.key}.${sub.key}`, md: it[sub.key], plain: plainLines(it[sub.key]) });
          }
        }
      }
    }
  });
  return out;
}

/** Whitespace-separated tokens with no Latin letters/digits but some non-ASCII: ⟡ 𖦹 ૮・ﻌ・ა ♡ ✦ … */
const isDecor = (tok: string) => /[^\x00-\x7F]/.test(tok) && !/[A-Za-z0-9]/.test(tok) && !/^[\p{P}]+$/u.test(tok) && tok.length <= 16;

const pct = (n: number, d: number) => (d ? n / d : 0);
/** Plain-data copy that also works on immer drafts (structuredClone can't copy proxies). */
const copy = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export interface StyleProfile {
  align: { value: string; count: number; total: number } | null;
  decor: { token: string; count: number }[];
  linePrefixes: string[];
  lowercase: boolean;
  color: { coloredShare: number; spansPerText: number; colors: string[] };
  spacers: { count: number; share: number };
  usesHeadings: boolean;
  titleExamples: string[];
  inlineImages: number;
  sequence: string;
  examples: string[];
  guide: string;
}

export function dominantAlign(p: Project): { value: string; count: number; total: number } | null {
  const counts = new Map<string, number>();
  let total = 0;
  walk(p.blocks, (b) => {
    if (b.hidden || !defFields(b.type).some((f) => f.key === 'align')) return;
    const v = !b.props.align || b.props.align === 'auto' ? 'left' : String(b.props.align);
    counts.set(v, (counts.get(v) ?? 0) + 1);
    total++;
  });
  if (!total) return null;
  const [value, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { value, count, total };
}

const label = (b: Block) => getDef(b.type)?.label.toLowerCase() ?? b.type;

export function styleProfile(p: Project): StyleProfile {
  const texts = collectTexts(p);
  const allLines = texts.flatMap((t) => t.plain);

  // Decorative symbols / kaomoji and how they start lines.
  const decorCount = new Map<string, number>();
  const prefixCount = new Map<string, number>();
  for (const line of allLines) {
    const toks = line.split(/\s+/).filter(Boolean);
    toks.forEach((tok, i) => {
      if (!isDecor(tok)) return;
      decorCount.set(tok, (decorCount.get(tok) ?? 0) + 1);
      if (i === 0) prefixCount.set(tok, (prefixCount.get(tok) ?? 0) + 1);
    });
  }
  const decor = [...decorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([token, count]) => ({ token, count }));
  const linePrefixes = [...prefixCount.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

  // Casing.
  const latin = allLines.filter((l) => /[A-Za-z]{2}/.test(l));
  const lowerLines = latin.filter((l) => !/[A-Z]/.test(l.replace(/\bI\b/g, 'i')));
  const lowercase = latin.length >= 3 && pct(lowerLines.length, latin.length) >= 0.75;

  // Color rhythm.
  const colorCount = new Map<string, number>();
  let colored = 0;
  let spans = 0;
  for (const t of texts) {
    const m = [...t.md.matchAll(COLOR_SPAN)].filter((x) => isHexColor(x[1]) || isColorName(x[1]));
    if (m.length) colored++;
    spans += m.length;
    for (const x of m) colorCount.set(x[1].toLowerCase(), (colorCount.get(x[1].toLowerCase()) ?? 0) + 1);
  }
  const color = {
    coloredShare: pct(colored, texts.length),
    spansPerText: colored ? Math.round((spans / colored) * 10) / 10 : 0,
    colors: [...colorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c),
  };

  // Structure.
  const top = p.blocks.filter((b) => !b.hidden);
  const spacerCount = top.filter((b) => b.type === 'spacer').length;
  const spacers = { count: spacerCount, share: pct(spacerCount, top.length) };
  let usesHeadings = false;
  walk(p.blocks, (b) => { if (b.type === 'heading' && !b.hidden) usesHeadings = true; });
  const oneLiners = texts.filter((t) => t.block.type === 'paragraph' && t.plain.length === 1 && t.plain[0].length <= 40);
  // Symbol-only lines are decorative dividers; lines with words are section titles.
  const titleExamples = oneLiners.filter((t) => /\p{L}{2}/u.test(t.plain[0].replace(/[^\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/gu, ' '))).map((t) => t.md.trim()).slice(0, 4);
  const dividerExamples = oneLiners.filter((t) => !/[A-Za-z0-9]/.test(t.plain[0])).map((t) => t.md.trim()).slice(0, 2);
  let inlineImages = 0;
  for (const t of texts) inlineImages += (t.md.match(/!\[[^\]]*\]\([^)]+\)\{/g) ?? []).length;

  // Block sequence, run-length compressed: "spacer · text · image · text ×2 · spacer …".
  const seq: string[] = [];
  for (const b of top.slice(0, 40)) {
    const name = label(b);
    const last = seq[seq.length - 1];
    const m = last?.match(/^(.*?)(?: ×(\d+))?$/);
    if (m && m[1] === name) seq[seq.length - 1] = `${name} ×${Number(m[2] ?? 1) + 1}`;
    else seq.push(name);
  }
  const sequence = seq.join(' → ');

  // Real snippets of the author's own markdown.
  const examples: string[] = [];
  const add = (s: string | undefined) => { if (s && !examples.includes(s) && examples.length < 5) examples.push(s.length > 320 ? `${s.slice(0, 317)}…` : s); };
  titleExamples.slice(0, 2).forEach(add);
  add(dividerExamples[0]);
  add(texts.find((t) => t.plain.length >= 3 && linePrefixes.some((pre) => t.plain.filter((l) => l.startsWith(pre)).length >= 2))?.md);
  add([...texts].sort((a, b) => b.md.length - a.md.length)[0]?.md);
  add(texts.find((t) => /%(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)%/.test(t.md) && t.plain.length >= 2)?.md);

  const align = dominantAlign(p);
  const lines: string[] = [];
  if (align && align.total >= 2) lines.push(`Alignment: ${align.value} for ${align.count} of ${align.total} blocks.${pct(align.count, align.total) >= 0.6 ? ` New blocks should be ${align.value}-aligned too.` : ''}`);
  if (decor.length) lines.push(`Decorative symbols / kaomoji the author uses: ${decor.map((d) => `${d.token} (${d.count})`).join(' ')}. Reuse these, in the same places and amounts; don't swap in other emoji.`);
  if (linePrefixes.length) lines.push(`Lines and list items often start with: ${linePrefixes.join(' ')} (used instead of bullets).`);
  if (lowercase) lines.push('Casing: writes almost everything in lowercase. Keep new text lowercase.');
  if (color.coloredShare >= 0.3) lines.push(`Color: ${Math.round(color.coloredShare * 100)}% of texts color individual words/phrases with %color% spans (about ${color.spansPerText} spans per text), mostly ${color.colors.join(', ')}. Color new text the same way, alternating these colors.`);
  if (spacers.count >= 2) lines.push(`Spacing: ${spacers.count} Spacer blocks separate sections (${Math.round(spacers.share * 100)}% of top-level blocks). Keep that rhythm.`);
  if (!usesHeadings && titleExamples.length) lines.push(`Section titles are short Text blocks, not Heading blocks, e.g. ${titleExamples.slice(0, 2).map((t) => `\`${t}\``).join(', ')}.`);
  if (dividerExamples.length) lines.push(`Decorative divider lines made only of symbols, e.g. ${dividerExamples.map((t) => `\`${t}\``).join(', ')}.`);
  if (inlineImages) lines.push(`Uses ${inlineImages} inline images (custom emoji / flags) inside text.`);
  if (sequence) lines.push(`Page structure: ${sequence}.`);
  const guide = lines.length ? `- ${lines.join('\n- ')}` : '- (The page is nearly empty: use clean, simple defaults.)';

  return { align, decor, linePrefixes, lowercase, color, spacers, usesHeadings, titleExamples, inlineImages, sequence, examples, guide };
}

export function styleGuideText(p: Project, brief?: string | null): string {
  const s = styleProfile(p);
  const ex = s.examples.length ? `\nThe author's own rentry markdown (imitate this):\n${s.examples.map((e) => `<<<\n${e}\n>>>`).join('\n')}` : '';
  return `Author's style (measured from their page):\n${s.guide}${brief ? `\n\nStyle notes:\n${brief}` : ''}${ex}`;
}

// ───────────────────────── carry the author's style onto new blocks

const isContent = (f: Field) => !STYLE_KINDS.has(f.kind);

/** Style props most blocks of this type share (≥60% of at least 2), plus page-wide alignment. */
export function dominantProps(p: Project, type: string): Props {
  const fields = defFields(type).filter((f) => STYLE_KINDS.has(f.kind));
  const same: Block[] = [];
  walk(p.blocks, (b) => { if (b.type === type && !b.hidden) same.push(b); });
  const out: Props = {};
  for (const f of fields) {
    if (same.length < 2) break;
    const counts = new Map<string, { v: unknown; n: number }>();
    for (const b of same) {
      if (!(f.key in b.props)) continue;
      const k = JSON.stringify(b.props[f.key]);
      const e = counts.get(k) ?? { v: b.props[f.key], n: 0 };
      e.n++;
      counts.set(k, e);
    }
    const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
    if (best && best.n >= 2 && best.n / same.length >= 0.6) out[f.key] = copy(best.v);
  }
  if (!('align' in out) && fields.some((f) => f.key === 'align')) {
    const a = dominantAlign(p);
    if (a && a.total >= 2 && a.count / a.total >= 0.6) out.align = a.value;
  }
  return out;
}

/**
 * Starting props for a new block: copy the look of `like` (an existing block of the same type) or the
 * author's dominant style for the type. Content (text, lists, images) is never copied.
 */
export function inheritedProps(p: Project | undefined, type: string, likeId?: unknown): Props {
  if (!p) return {};
  if (typeof likeId === 'string') {
    let like: Block | null = null;
    walk(p.blocks, (b) => { if (b.id === likeId) like = b; });
    const l = like as Block | null;
    if (l && l.type === type) {
      const style: Props = {};
      for (const f of defFields(type)) if (!isContent(f) && f.key in l.props) style[f.key] = copy(l.props[f.key]);
      return style;
    }
  }
  return dominantProps(p, type);
}

/** Small stable hash (FNV-1a) for caching the style brief per page version. */
export function hashText(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
