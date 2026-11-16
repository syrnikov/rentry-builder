// Helpers that emit rentry-flavoured inline markdown.

export type Align = 'auto' | 'left' | 'center' | 'right';

export interface UnderlineOpts {
  on: boolean;
  color?: string;
  style?: 'default' | 'solid' | 'double' | 'dotted' | 'dashed' | 'wavy';
  type?: 'default' | 'underline' | 'line-through' | 'overline' | 'both';
  thickness?: number;
}

export const noUnderline = (): UnderlineOpts => ({ on: false, color: '', style: 'default', type: 'default', thickness: 0 });

export function color(text: string, c?: string): string {
  if (!c || !text.trim()) return text;
  return `%${c}% ${text} %%`;
}

export function underline(text: string, u?: UnderlineOpts): string {
  if (!u?.on || !text.trim()) return text;
  const parts = [u.color || 'default', u.style || 'default', u.type || 'default', u.thickness ? String(u.thickness) : 'default'];
  while (parts.length && parts[parts.length - 1] === 'default') parts.pop();
  const opts = parts.length ? parts.join(';') + ';' : '';
  return `!~${opts} ${text} ~!`;
}

export const bold = (t: string) => (t.trim() ? `**${t}**` : t);
export const italic = (t: string) => (t.trim() ? `*${t}*` : t);
export const mark = (t: string) => (t.trim() ? `==${t}==` : t);
export const strike = (t: string) => (t.trim() ? `~~${t}~~` : t);

export function link(text: string, url?: string): string {
  if (!url?.trim()) return text;
  return `[${text || url}](${normalizeUrl(url)})`;
}

export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/^(https?:|mailto:|\/|#)/i.test(u)) return u;
  return `https://${u}`;
}

/** Wrap one line in rentry alignment arrows. */
export function alignLine(line: string, a: Align | undefined): string {
  if (!line.trim()) return line;
  if (a === 'center') return `-> ${line} <-`;
  if (a === 'right') return `-> ${line} ->`;
  return line;
}

export function alignLines(text: string, a: Align | undefined): string {
  if (a !== 'center' && a !== 'right') return text;
  return text
    .split('\n')
    .map((l) => alignLine(l, a))
    .join('\n');
}

export function resolveAlign(a: Align | undefined, inherited?: Align): Align {
  if (!a || a === 'auto') return inherited && inherited !== 'auto' ? inherited : 'left';
  return a;
}

export interface ImageOpts {
  url: string;
  alt?: string;
  title?: string;
  width?: string;
  height?: string;
  float?: 'none' | 'left' | 'right';
  link?: string;
}

/** ![alt](url#left "title"){w:h}, optionally wrapped in a link. */
export function image(o: ImageOpts): string {
  if (!o.url?.trim()) return '';
  const floatHash = o.float === 'left' ? '#left' : o.float === 'right' ? '#right' : '';
  const title = o.title?.trim() ? ` "${o.title.replace(/"/g, "'")}"` : '';
  const w = o.width?.trim();
  const h = o.height?.trim();
  // Rentry's documented size syntax is {width:height}; both are needed.
  const size = w && h ? `{${w}:${h}}` : '';
  const img = `![${(o.alt ?? '').replace(/[[\]]/g, '')}](${normalizeUrl(o.url)}${floatHash}${title})${size}`;
  return o.link?.trim() ? `[${img}](${normalizeUrl(o.link)})` : img;
}

/** Escape characters that would break a table cell. */
export const cellEscape = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' \\n ');

/** Build a markdown table. `align` per column: left/center/right. */
export function table(header: string[], rows: string[][], align?: ('left' | 'center' | 'right')[]): string {
  const cols = Math.max(header.length, ...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? '');
  const sep = Array.from({ length: cols }, (_, i) => {
    const a = align?.[i] ?? 'left';
    return a === 'center' ? ':---:' : a === 'right' ? '---:' : '---';
  });
  const line = (r: string[]) => '| ' + pad(r).map((c) => c || ' ').join(' | ') + ' |';
  return [line(header), '| ' + sep.join(' | ') + ' |', ...rows.map(line)].join('\n');
}

/** Wrap a selection in a textarea-like value. Used by the format toolbar. */
export function wrapSelection(value: string, start: number, end: number, before: string, after: string, placeholder = 'text') {
  const sel = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + before + sel + after + value.slice(end);
  return { value: next, selStart: start + before.length, selEnd: start + before.length + sel.length };
}
