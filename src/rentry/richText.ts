// Converts rentry inline markdown <-> a simple visual model (lines of styled runs).
// Used by the visual text editor; the stored value is always rentry markdown.
import { isColorName, isHexColor } from './colors';

export type MarkType = 'link' | 'color' | 'underline' | 'strike' | 'mark' | 'bold' | 'italic' | 'code' | 'spoiler';
export interface RMark { type: MarkType; attrs?: Record<string, string> }
/** Inline image, e.g. a custom emoji or flag: ![alt](src){width:height}. */
export interface InlineImg { src: string; alt: string; width: string; height: string; title?: string }
export interface Run { text: string; marks: RMark[]; image?: InlineImg }
export type LineAlign = 'left' | 'center' | 'right';
export interface Line { align: LineAlign; runs: Run[] }

/** Nesting order when serializing: earlier = outermost. */
const ORDER: MarkType[] = ['link', 'color', 'underline', 'strike', 'mark', 'bold', 'italic', 'code'];

const sameMark = (a: RMark, b: RMark) => a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {});
const sameMarks = (a: RMark[], b: RMark[]) => a.length === b.length && a.every((m) => b.some((n) => sameMark(m, n)));
const isWs = (c: string | undefined) => c === undefined || /\s/.test(c);
const trim1 = (s: string) => s.replace(/^ /, '').replace(/ $/, '');

function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (r.image) { out.push(r); continue; }
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && !last.image && sameMarks(last.marks, r.marks)) last.text += r.text;
    else out.push({ text: r.text, marks: r.marks });
  }
  return out;
}

const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)(?:\{\s*([^}:\s]+)\s*(?::\s*([^}\s]+)\s*)?\})?/;

/** Markdown for an inline image (rentry needs both width and height for a size). */
export function imageMarkdown(img: InlineImg): string {
  const alt = (img.alt ?? '').replace(/[[\]]/g, '');
  const title = img.title?.trim() ? ` "${img.title.replace(/"/g, "'")}"` : '';
  const size = img.width && img.height ? `{${img.width}:${img.height}}` : '';
  return `![${alt}](${img.src}${title})${size}`;
}

// ───────────────────────── parsing

/** Length of the run of `ch` starting at i. */
const runLen = (s: string, i: number, ch: string) => { let n = 0; while (s[i + n] === ch) n++; return n; };

/** Find a closing `*` run for an opener of length `open` (1 = italic, 2 = bold, 3 = both). Returns [innerEnd, after]. */
function findStarCloser(s: string, from: number, open: number): [number, number] | null {
  for (let j = from; j < s.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s[j] === '`') { const k = s.indexOf('`', j + 1); if (k > 0) { j = k; continue; } }
    if (s[j] !== '*') continue;
    const n = runLen(s, j, '*');
    const end = j + n;
    const closes = !isWs(s[j - 1]);
    if (closes) {
      if (open === 1 && n % 2 === 1) return [end - 1, end];
      if (open === 2 && n >= 2) return [end - 2, end];
      if (open >= 3 && n >= 3) return [end - 3, end];
    }
    j = end - 1;
  }
  return null;
}

function findSimpleCloser(s: string, from: number, d: string): number {
  for (let j = from; j <= s.length - d.length; j++) {
    if (s[j] === '\\') { j++; continue; }
    if (s.startsWith(d, j) && !isWs(s[j - 1]) && j > from) return j;
  }
  return -1;
}

function parseInline(s: string, marks: RMark[]): Run[] {
  const out: Run[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ text: buf, marks }); buf = ''; } };
  const push = (inner: string, mark: RMark) => { flush(); out.push(...parseInline(inner, [...marks, mark])); };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const rest = s.slice(i);
    // escapes
    if (c === '\\' && i + 1 < s.length && /[\\`*_{}[\]()#+\-.!~=%>|]/.test(s[i + 1])) { buf += s[i + 1]; i += 2; continue; }
    // inline images (custom emoji, flags, …)
    if (rest.startsWith('![')) {
      const m = IMG_RE.exec(rest);
      if (m) {
        flush();
        out.push({ text: '', marks, image: { src: m[2], alt: m[1], title: m[3] ?? '', width: m[4] ?? '', height: m[5] ?? '' } });
        i += m[0].length;
        continue;
      }
    }
    // a linked image: [![alt](src){w:h}](href)
    if (rest.startsWith('[![')) {
      const m = /^\[(!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)(?:\{[^}]*\})?)\]\(([^)\s]+)\)/.exec(rest);
      if (m) { push(m[1], { type: 'link', attrs: { href: m[2] } }); i += m[0].length; continue; }
    }
    // spoiler: to the end of the line
    if (rest.startsWith('!>') && rest.length > 2) { push(s.slice(i + 2), { type: 'spoiler' }); return mergeRuns(out); }
    // underline !~opts; text ~!
    if (rest.startsWith('!~')) {
      const m = /^!~((?:[^;\s~]*;){1,4})?/.exec(rest)!;
      const start = i + m[0].length;
      const j = s.indexOf('~!', start);
      if (j >= 0) {
        const [color = '', style = '', type = '', thickness = ''] = (m[1] ?? '').split(';').map((x) => (x === 'default' ? '' : x.trim()));
        push(trim1(s.slice(start, j)), { type: 'underline', attrs: { color, style, type, thickness } });
        i = j + 2;
        continue;
      }
    }
    // color %name% text %%
    if (c === '%') {
      const m = /^%(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)%/.exec(rest);
      if (m && (isColorName(m[1]) || isHexColor(m[1]))) {
        const j = s.indexOf('%%', i + m[0].length);
        if (j >= 0) { push(trim1(s.slice(i + m[0].length, j)), { type: 'color', attrs: { color: m[1] } }); i = j + 2; continue; }
      }
    }
    // inline code
    if (c === '`') {
      const j = s.indexOf('`', i + 1);
      if (j > i + 1) { flush(); out.push({ text: s.slice(i + 1, j), marks: [...marks, { type: 'code' }] }); i = j + 1; continue; }
    }
    // links [text](url)
    if (c === '[') {
      const m = /^\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/.exec(rest);
      if (m) { push(m[1], { type: 'link', attrs: { href: m[2] } }); i += m[0].length; continue; }
    }
    // ~~strike~~ and ==mark==
    let matched = false;
    for (const [d, type] of [['~~', 'strike'], ['==', 'mark']] as const) {
      if (rest.startsWith(d) && !isWs(s[i + 2])) {
        const j = findSimpleCloser(s, i + 2, d);
        if (j > 0) { push(s.slice(i + 2, j), { type }); i = j + 2; matched = true; break; }
      }
    }
    if (matched) continue;
    // *italic*, **bold**, ***both***
    if (c === '*') {
      const n = runLen(s, i, '*');
      const open = Math.min(n, 3);
      if (!isWs(s[i + n])) {
        const close = findStarCloser(s, i + n, open);
        if (close) {
          const lead = s.slice(i, i + n - open); // extra stars beyond 3 stay literal
          buf += lead;
          const inner = s.slice(i + n, close[0]);
          if (open >= 3) {
            flush();
            out.push(...parseInline(inner, [...marks, { type: 'bold' }, { type: 'italic' }]));
          } else push(inner, { type: open === 2 ? 'bold' : 'italic' });
          i = close[1];
          continue;
        }
      }
      buf += s.slice(i, i + n);
      i += n;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return mergeRuns(out);
}

const ALIGN_RE = /^->\s?(.*?)\s?(<-|->)$/;

export function parseRich(md: string): Line[] {
  return (md ?? '').split('\n').map((raw) => {
    const m = ALIGN_RE.exec(raw.trim());
    if (m) return { align: m[2] === '<-' ? 'center' : 'right', runs: parseInline(m[1], []) };
    return { align: 'left', runs: parseInline(raw, []) };
  });
}

// ───────────────────────── serializing

function openTok(m: RMark): string {
  switch (m.type) {
    case 'bold': return '**';
    case 'italic': return '*';
    case 'strike': return '~~';
    case 'mark': return '==';
    case 'code': return '`';
    case 'link': return '[';
    case 'color': return `%${m.attrs?.color}% `;
    case 'underline': {
      const a = m.attrs ?? {};
      const parts = [a.color || 'default', a.style || 'default', a.type || 'default', a.thickness || 'default'];
      while (parts.length && parts[parts.length - 1] === 'default') parts.pop();
      return `!~${parts.length ? parts.join(';') + ';' : ''} `;
    }
    default: return '';
  }
}
function closeTok(m: RMark): string {
  switch (m.type) {
    case 'bold': return '**';
    case 'italic': return '*';
    case 'strike': return '~~';
    case 'mark': return '==';
    case 'code': return '`';
    case 'link': return `](${m.attrs?.href ?? ''})`;
    case 'color': return ' %%';
    case 'underline': return ' ~!';
    default: return '';
  }
}

/** Delimiters that break when they touch whitespace on the inside. */
const TIGHT = new Set(['**', '*', '~~', '==', '`']);
/** Openers/closers whose surrounding whitespace should sit outside them. */
const shuffleOpen = (s: string) => TIGHT.has(s) || /^%\S+% $/.test(s) || s.startsWith('!~');
const shuffleClose = (s: string) => TIGHT.has(s) || s === ' %%' || s === ' ~!';

function escapeText(t: string, atLineStart: boolean): string {
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const listMarker = atLineStart && i === t.search(/\S/) && /^[*+-]\s/.test(t.slice(i));
    if (c === '\\' || c === '`' || c === '[' || c === ']') out += '\\' + c;
    else if (c === '*' && !listMarker) out += '\\*';
    else if (c === '!' && /[>~[]/.test(t[i + 1] ?? '')) out += '\\!';
    else out += c;
  }
  return out;
}

type Tok = { k: 'open' | 'close' | 'text' | 'img'; s: string };

function serializeLine(line: Line): string {
  const runs = mergeRuns(line.runs);
  const toks: Tok[] = [];
  const stack: RMark[] = [];
  let spoiler = false;
  let first = true;
  for (const r of runs) {
    if (!spoiler && r.marks.some((m) => m.type === 'spoiler')) {
      // Spoiler runs to the end of the line: close everything, emit !>, then reopen.
      while (stack.length) toks.push({ k: 'close', s: closeTok(stack.pop()!) });
      toks.push({ k: 'open', s: '!>' });
      spoiler = true;
    }
    // Whitespace-only runs keep whatever is open (avoids empty "** **" pairs).
    if (!r.image && !r.text.trim() && !r.marks.some((m) => m.type === 'code')) {
      toks.push({ k: 'text', s: r.text });
      first = false;
      continue;
    }
    // Images can't live inside inline code.
    const want = r.marks.filter((m) => m.type !== 'spoiler' && !(r.image && m.type === 'code')).sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
    let k = 0;
    while (k < stack.length && k < want.length && sameMark(stack[k], want[k])) k++;
    while (stack.length > k) toks.push({ k: 'close', s: closeTok(stack.pop()!) });
    for (const m of want.slice(k)) { toks.push({ k: 'open', s: openTok(m) }); stack.push(m); }
    const inCode = stack.some((m) => m.type === 'code');
    if (r.image) toks.push({ k: 'img', s: imageMarkdown(r.image) });
    else toks.push({ k: 'text', s: inCode ? r.text.replace(/`/g, "'") : escapeText(r.text, first) });
    first = false;
  }
  while (stack.length) toks.push({ k: 'close', s: closeTok(stack.pop()!) });

  // Move whitespace outside tight delimiters: "** hi **" -> " **hi** ".
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.k === 'open' && shuffleOpen(t.s)) {
      let j = i + 1;
      while (toks[j]?.k === 'open') j++;
      const tx = toks[j];
      if (tx?.k === 'text') {
        const m = /^\s+/.exec(tx.s);
        if (m) { tx.s = tx.s.slice(m[0].length); toks.splice(i, 0, { k: 'text', s: m[0] }); i++; }
      }
    }
    if (t.k === 'close' && shuffleClose(t.s)) {
      let j = i - 1;
      while (toks[j]?.k === 'close') j--;
      const tx = toks[j];
      if (tx?.k === 'text') {
        const m = /\s+$/.exec(tx.s);
        if (m) { tx.s = tx.s.slice(0, -m[0].length); toks.splice(i + 1, 0, { k: 'text', s: m[0] }); }
      }
    }
  }
  const s = toks.map((t) => t.s).join('');
  if (line.align !== 'left' && s.trim()) return `-> ${s} ${line.align === 'center' ? '<-' : '->'}`;
  return s;
}

export function serializeRich(lines: Line[]): string {
  return lines.map(serializeLine).join('\n');
}

/** Normalise markdown by round-tripping it through the visual model. */
export const roundTrip = (md: string) => serializeRich(parseRich(md));
