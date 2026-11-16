/* eslint-disable @typescript-eslint/no-explicit-any */
// markdown-it configured to approximate rentry.co's markdown flavour (see GUIDE/MD GUIDE.txt).
import MarkdownIt from 'markdown-it';
import { isColorName, isHexColor } from '../rentry/colors';

export interface TocEntry { level: number; text: string; id: string }
export interface RenderEnv {
  toc?: TocEntry[];
  /** Artboard size in px, used to resolve vw/hw/vh image sizes. */
  viewport?: { w: number; h: number };
}

const ADMONITION_TYPES = ['info', 'note', 'warning', 'danger', 'greentext'];

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').slice(0, 64) || 'section';

/** Lines starting with [//]: ( … ) are comments and never rendered. */
export const stripComments = (src: string) =>
  src.split('\n').filter((l) => !/^\s*\[\/\/\]:\s*\(.*\)\s*$/.test(l)).join('\n');

// ───────────── inline rules

function wrapInline(state: any, start: number, contentStart: number, contentEnd: number, after: number, open: (t: any) => void, type: string, tag: string) {
  const t = state.push(`${type}_open`, tag, 1);
  open(t);
  const oldMax = state.posMax;
  state.pos = contentStart;
  state.posMax = contentEnd;
  state.md.inline.tokenize(state);
  state.posMax = oldMax;
  state.push(`${type}_close`, tag, -1);
  state.pos = after;
  void start;
}

function colorRule(state: any, silent: boolean): boolean {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x25 /* % */) return false;
  const m = /^%(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)%/.exec(state.src.slice(start, state.posMax));
  if (!m || !(isColorName(m[1]) || isHexColor(m[1]))) return false;
  const cs = start + m[0].length;
  const close = state.src.indexOf('%%', cs);
  if (close < 0 || close + 2 > state.posMax) return false;
  if (silent) {
    state.pos = close + 2;
    return true;
  }
  wrapInline(state, start, cs, close, close + 2, (t) => t.attrSet('style', `color:${m[1]}`), 'rentry_color', 'span');
  return true;
}

function underlineRule(state: any, silent: boolean): boolean {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x21 || state.src.charCodeAt(start + 1) !== 0x7e) return false; // !~
  const m = /^!~((?:[^;\s~]*;){1,4})?/.exec(state.src.slice(start, state.posMax));
  if (!m) return false;
  const cs = start + m[0].length;
  const close = state.src.indexOf('~!', cs);
  if (close < 0 || close + 2 > state.posMax) return false;
  if (silent) {
    state.pos = close + 2;
    return true;
  }
  const [color, style, type, thick] = (m[1] ?? '').split(';').map((s: string) => s.trim());
  const line = type === 'both' ? 'underline overline' : type && type !== 'default' ? type : 'underline';
  const css = [`text-decoration-line:${line}`];
  if (color && color !== 'default') css.push(`text-decoration-color:${color}`);
  if (style && style !== 'default') css.push(`text-decoration-style:${style}`);
  if (thick && thick !== 'default' && /^\d+$/.test(thick)) css.push(`text-decoration-thickness:${Math.min(10, +thick)}px`);
  wrapInline(state, start, cs, close, close + 2, (t) => t.attrSet('style', css.join(';')), 'rentry_underline', 'span');
  return true;
}

function markRule(state: any, silent: boolean): boolean {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x3d || state.src.charCodeAt(start + 1) !== 0x3d) return false; // ==
  const close = state.src.indexOf('==', start + 2);
  if (close < 0 || close === start + 2 || close + 2 > state.posMax) return false;
  if (/^\s/.test(state.src[start + 2])) return false;
  if (silent) {
    state.pos = close + 2;
    return true;
  }
  wrapInline(state, start, start + 2, close, close + 2, () => {}, 'rentry_mark', 'mark');
  return true;
}

function spoilerRule(state: any, silent: boolean): boolean {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x21 || state.src.charCodeAt(start + 1) !== 0x3e) return false; // !>
  let end = state.src.indexOf('\n', start);
  if (end < 0 || end > state.posMax) end = state.posMax;
  if (end <= start + 2) return false;
  if (silent) {
    state.pos = end;
    return true;
  }
  wrapInline(state, start, start + 2, end, end, (t) => t.attrSet('class', 'spoiler'), 'rentry_spoiler', 'span');
  return true;
}

// ───────────── block rule: admonitions

function admonitionRule(state: any, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const pos = state.bMarks[startLine] + state.tShift[startLine];
  const lineText = state.src.slice(pos, state.eMarks[startLine]);
  const m = /^!!!(?:\s+(\S+))?(?:\s+(.*))?\s*$/.exec(lineText);
  if (!m) return false;
  if (silent) return true;
  let kind = (m[1] ?? '').toLowerCase();
  let title = (m[2] ?? '').trim();
  if (!ADMONITION_TYPES.includes(kind)) {
    title = [m[1], m[2]].filter(Boolean).join(' ').trim();
    kind = 'warning';
  }
  let next = startLine + 1;
  let lastContent = startLine;
  while (next < endLine) {
    const empty = state.isEmpty(next);
    if (!empty && state.sCount[next] - state.blkIndent < 4) break;
    if (!empty) lastContent = next;
    next++;
  }
  const bodyLines: string[] = [];
  for (let l = startLine + 1; l <= lastContent; l++) {
    const raw = state.src.slice(state.bMarks[l], state.eMarks[l]);
    bodyLines.push(raw.replace(/^( {1,4}|\t)/, ''));
  }
  const open = state.push('admonition_open', 'div', 1);
  open.attrSet('class', `admonition ${kind}`);
  open.map = [startLine, lastContent + 1];
  if (title) {
    const to = state.push('admonition_title_open', 'p', 1);
    to.attrSet('class', 'admonition-title');
    const inline = state.push('inline', '', 0);
    inline.content = title;
    inline.map = [startLine, startLine + 1];
    inline.children = [];
    state.push('admonition_title_close', 'p', -1);
  }
  if (bodyLines.length) state.md.block.parse(bodyLines.join('\n'), state.md, state.env, state.tokens);
  state.push('admonition_close', 'div', -1);
  state.line = lastContent + 1;
  return true;
}

// ───────────── core rules

const ALIGN_RE = /^->\s?(.*?)\s?(<-|->)$/;

function alignRule(state: any) {
  const tokens = state.tokens as any[];
  const out: any[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const inline = tokens[i + 1];
    const close = tokens[i + 2];
    if ((t.type === 'paragraph_open' || t.type === 'heading_open') && inline?.type === 'inline') {
      const lines: string[] = inline.content.split('\n');
      const parsed = lines.map((l) => {
        const m = ALIGN_RE.exec(l.trim());
        return m ? { text: m[1], align: m[2] === '<-' ? 'center' : 'right' } : { text: l, align: '' };
      });
      if (parsed.some((p) => p.align)) {
        // Group consecutive lines with the same alignment into separate blocks.
        const groups: { align: string; lines: string[] }[] = [];
        for (const p of parsed) {
          const g = groups[groups.length - 1];
          if (g && g.align === p.align) g.lines.push(p.text);
          else groups.push({ align: p.align, lines: [p.text] });
        }
        if (groups.length === 1 || t.type === 'heading_open') {
          if (groups[0].align || t.type === 'heading_open') t.attrJoin('style', `text-align:${groups.find((g) => g.align)?.align}`);
          inline.content = parsed.map((p) => p.text).join('\n');
          out.push(t, inline, close);
        } else {
          for (const g of groups) {
            const o = new state.Token('paragraph_open', 'p', 1);
            if (g.align) o.attrSet('style', `text-align:${g.align}`);
            const inl = new state.Token('inline', '', 0);
            inl.content = g.lines.join('\n');
            inl.children = [];
            inl.map = inline.map;
            out.push(o, inl, new state.Token('paragraph_close', 'p', -1));
          }
        }
        i += 2;
        continue;
      }
    }
    out.push(t);
  }
  state.tokens = out;
}

function specialParagraphs(state: any) {
  const tokens = state.tokens as any[];
  const env = (state.env ?? {}) as RenderEnv;
  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i].type !== 'paragraph_open' || tokens[i + 1].type !== 'inline') continue;
    const c = tokens[i + 1].content.trim();
    let html: string | null = null;
    if (c === '!;') html = '<div class="rentry-clear"></div>\n';
    const toc = /^\[TOC([1-6])?\]$/.exec(c);
    if (toc) html = renderToc(env.toc ?? [], toc[1] ? +toc[1] : 1);
    if (html !== null) {
      const t = new state.Token('html_block', '', 0);
      t.content = html;
      tokens.splice(i, 3, t);
    }
  }
}

function renderToc(entries: TocEntry[], from: number): string {
  const list = entries.filter((e) => e.level >= from);
  if (!list.length) return '<div class="toc"><em>No headings yet</em></div>\n';
  const min = Math.min(...list.map((e) => e.level));
  return `<div class="toc"><ul>${list
    .map((e) => `<li style="margin-left:${(e.level - min) * 1.2}em"><a href="#${e.id}">${escapeHtml(e.text)}</a></li>`)
    .join('')}</ul></div>\n`;
}

const SIZE_RE = /^\{\s*([\d.]+(?:px|%|vw|hw|vh)?)\s*(?::\s*([\d.]+(?:px|%|vw|hw|vh)?))?\s*\}/;

function cssLen(v: string, env: RenderEnv): string {
  const m = /^([\d.]+)(px|%|vw|hw|vh)?$/.exec(v);
  if (!m) return v;
  const n = parseFloat(m[1]);
  const vp = env.viewport ?? { w: 1000, h: 800 };
  switch (m[2]) {
    case '%': return `${n}%`;
    case 'vw': case 'hw': return `${Math.round((n / 100) * vp.w)}px`;
    case 'vh': return `${Math.round((n / 100) * vp.h)}px`;
    default: return `${n}px`;
  }
}

function inlinePostRule(state: any) {
  const env = (state.env ?? {}) as RenderEnv;
  const tokens = state.tokens as any[];
  let inCell = false;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === 'th_open' || tok.type === 'td_open') inCell = true;
    if (tok.type === 'th_close' || tok.type === 'td_close') inCell = false;

    if (tok.type === 'heading_open' && tokens[i + 1]?.type === 'inline') {
      const text = (tokens[i + 1].children ?? []).filter((c: any) => c.type === 'text' || c.type === 'code_inline').map((c: any) => c.content).join('');
      tok.attrSet('id', slugify(text));
    }

    if (tok.type === 'list_item_open') {
      const inl = tokens.slice(i + 1, i + 4).find((t: any) => t.type === 'inline');
      const first = inl?.children?.[0];
      const m = first?.type === 'text' ? /^\[( |x|X)\]\s+/.exec(first.content) : null;
      if (m) {
        first.content = first.content.slice(m[0].length);
        const cb = new state.Token('html_inline', '', 0);
        cb.content = `<input type="checkbox" disabled${m[1] !== ' ' ? ' checked' : ''}> `;
        inl.children.unshift(cb);
        tok.attrJoin('class', 'task-list-item');
      }
    }

    if (tok.type !== 'inline' || !tok.children) continue;
    const kids: any[] = tok.children;
    for (let k = 0; k < kids.length; k++) {
      const c = kids[k];
      if (c.type === 'image') {
        const src: string = c.attrGet('src') ?? '';
        const fm = /#(left|right)$/.exec(src);
        if (fm) {
          c.attrSet('src', src.slice(0, -fm[0].length));
          c.attrJoin('class', `float-${fm[1]}`);
        }
        const nxt = kids[k + 1];
        if (nxt?.type === 'text') {
          const sm = SIZE_RE.exec(nxt.content);
          if (sm) {
            nxt.content = nxt.content.slice(sm[0].length);
            const css = [`width:${cssLen(sm[1], env)}`];
            if (sm[2]) css.push(`height:${cssLen(sm[2], env)}`);
            c.attrJoin('style', css.join(';'));
          }
        }
      }
      if (inCell && c.type === 'text' && c.content.includes('\\n')) {
        const parts = c.content.split(/\s*\\n\s*/);
        const repl: any[] = [];
        parts.forEach((p: string, idx: number) => {
          if (idx > 0) repl.push(new state.Token('hardbreak', 'br', 0));
          if (p) {
            const t = new state.Token('text', '', 0);
            t.content = p;
            repl.push(t);
          }
        });
        kids.splice(k, 1, ...repl);
        k += repl.length - 1;
      }
    }
  }
}

// ───────────── instance

function createMd(): MarkdownIt {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: true, typographer: false });
  md.inline.ruler.before('emphasis', 'rentry_color', colorRule as any);
  md.inline.ruler.before('emphasis', 'rentry_underline', underlineRule as any);
  md.inline.ruler.before('emphasis', 'rentry_mark', markRule as any);
  md.inline.ruler.before('emphasis', 'rentry_spoiler', spoilerRule as any);
  md.block.ruler.before('paragraph', 'rentry_admonition', admonitionRule as any, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.core.ruler.after('block', 'rentry_align', alignRule as any);
  md.core.ruler.after('rentry_align', 'rentry_special', specialParagraphs as any);
  md.core.ruler.push('rentry_inline_post', inlinePostRule as any);

  md.renderer.rules.fence = (tokens, idx) => {
    const t = tokens[idx];
    const code = t.content.replace(/\n$/, '');
    const nums = code.split('\n').map((_, i) => i + 1).join('\n');
    const lang = escapeHtml(t.info.trim().split(/\s+/)[0] ?? '');
    return `<div class="codehilite" data-lang="${lang}"><table><tr><td class="linenos"><pre>${nums}</pre></td><td class="code"><pre><code>${escapeHtml(code)}</code></pre></td></tr></table></div>\n`;
  };
  const defaultLink = md.renderer.rules.link_open ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    tokens[idx].attrSet('rel', 'noopener');
    return defaultLink(tokens, idx, opts, env, self);
  };
  return md;
}

const md = createMd();

export function renderRentry(src: string, env: RenderEnv = {}): string {
  return md.render(stripComments(src), { ...env });
}

export function collectHeadings(src: string): TocEntry[] {
  const tokens = md.parse(stripComments(src), {});
  const out: TocEntry[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'heading_open') {
      const inline = tokens[i + 1];
      const text = (inline.children ?? []).filter((c) => c.type === 'text' || c.type === 'code_inline').map((c) => c.content).join('').trim();
      out.push({ level: +tokens[i].tag.slice(1), text, id: slugify(text) });
    }
  }
  return out;
}

/** Render inline-only markdown (used for table cells built by the Columns block). */
export function renderRentryCell(src: string, env: RenderEnv = {}): string {
  // Render as a one-cell table so cell-specific rules (\n breaks) apply, then unwrap.
  // `src` is already cell-escaped by the block's toCell().
  const html = md.render(`| x |\n| --- |\n| ${src || ' '} |`, { ...env });
  const m = /<td[^>]*>([\s\S]*?)<\/td>/.exec(html);
  return m ? m[1].replace(/<br>\n/g, '<br>') : '';
}
