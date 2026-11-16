import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Node } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { Search, Trash2 } from 'lucide-react';
import { useEditor as useStore } from '../../store/editorStore';
import { walk } from '../../model/tree';
import type { Project } from '../../model/types';
import type { InlineImg } from '../../rentry/richText';
import { NumberUnit, Segmented } from './index';

// ───────────────────────── ProseMirror node

/** Preview-only conversion of rentry sizes (hw = % of page width). */
const editorLen = (v: string) => (!v ? '' : /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v.replace(/hw$/, 'vw'));

export const InlineImageNode = Node.create({
  name: 'rentryImage',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ src: { default: '' }, alt: { default: '' }, width: { default: '' }, height: { default: '' }, title: { default: '' } }),
  parseHTML: () => [{
    tag: 'img[data-ri]',
    getAttrs: (el) => {
      const e = el as HTMLElement;
      return { src: e.getAttribute('src') ?? '', alt: e.getAttribute('alt') ?? '', width: e.dataset.w ?? '', height: e.dataset.h ?? '', title: e.getAttribute('title') ?? '' };
    },
  }],
  renderHTML: ({ HTMLAttributes: a }) => {
    const style = [a.width && `width:${editorLen(a.width)}`, a.height && `height:${editorLen(a.height)}`].filter(Boolean).join(';');
    return ['img', { 'data-ri': '', src: a.src, alt: a.alt, title: a.title || a.alt, 'data-w': a.width, 'data-h': a.height, style, class: 'rt-img', draggable: 'true' }];
  },
});

// ───────────────────────── helpers

const FLAG_SRC = (code: string) => `https://flagcdn.com/64x48/${code}.png`;
const FLAG_THUMB = (code: string) => `https://flagcdn.com/20x15/${code}.png`;
const NOT_FLAGS = new Set(['QO', 'ZZ', 'EA', 'IC', 'DG', 'TA', 'CP', 'AC', 'XA', 'XB', 'EZ', 'UN']);

let countryCache: { code: string; name: string }[] | null = null;
/** Every country/region the browser can name (Intl), plus UK nations; flags come from flagcdn.com. */
function countries() {
  if (countryCache) return countryCache;
  const out: { code: string; name: string }[] = [];
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        if (NOT_FLAGS.has(code)) continue;
        try {
          const name = dn.of(code);
          if (name && name !== code && !/unknown/i.test(name)) out.push({ code: code.toLowerCase(), name });
        } catch { /* invalid code */ }
      }
    }
  } catch { /* Intl.DisplayNames unsupported */ }
  out.push({ code: 'gb-eng', name: 'England' }, { code: 'gb-sct', name: 'Scotland' }, { code: 'gb-wls', name: 'Wales' });
  countryCache = out.sort((x, y) => x.name.localeCompare(y.name));
  return countryCache;
}

const INLINE_IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\{\s*([^}:\s]+)\s*:\s*([^}\s]+)\s*\}/g;

/** Inline images (with explicit sizes) already used in the page's text — a reusable custom-emoji set. */
export function collectInlineImages(p: Project): InlineImg[] {
  const seen = new Map<string, InlineImg>();
  const visit = (v: unknown, key: string) => {
    if (typeof v === 'string') {
      if (/^(url|image|avatar|video)$/i.test(key)) return; // image blocks, not inline images
      for (const m of v.matchAll(INLINE_IMG_RE)) if (!seen.has(m[2])) seen.set(m[2], { alt: m[1], src: m[2], width: m[3], height: m[4] });
    } else if (Array.isArray(v)) v.forEach((x) => visit(x, key));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => visit(x, k));
  };
  walk(p.blocks, (b) => visit(b.props, ''));
  return [...seen.values()];
}

const SIZE_PRESETS = ['16', '20', '24', '32'];
const PX_UNITS = [{ unit: 'px' as const, min: 1, max: 400, decimals: 0 }];
const px = (v: string) => parseFloat(v) || 0;

// ───────────────────────── popover content

export function InlineImagePanel({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const editing = editor.isActive('rentryImage');
  const current = editing ? (editor.getAttributes('rentryImage') as InlineImg) : null;
  const project = useStore((s) => s.project);
  const used = useMemo(() => collectInlineImages(project), [project]);

  const [tab, setTab] = useState<'link' | 'flag' | 'page'>('link');
  const [src, setSrc] = useState(current?.src ?? '');
  const [alt, setAlt] = useState(current?.alt ?? '');
  const [width, setWidth] = useState(current?.width ?? '');
  const [height, setHeight] = useState(current?.height ?? '20px');
  const [ratio, setRatio] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);
  const [q, setQ] = useState('');

  // Learn the image's natural proportions so width can follow the chosen height.
  useEffect(() => {
    setBroken(false);
    if (!src) { setRatio(null); return; }
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth / img.naturalHeight || 1;
      setRatio(r);
      if (!current || current.src !== src) setWidth(`${Math.round(px(height || '20') * r)}px`);
    };
    img.onerror = () => setBroken(true);
    img.src = src;
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  const preset = SIZE_PRESETS.find((h) => `${h}px` === height && (!ratio || width === `${Math.round(+h * ratio)}px`)) ?? 'custom';
  const choosePreset = (h: string) => {
    if (h === 'custom') return;
    setHeight(`${h}px`);
    setWidth(`${Math.round(+h * (ratio ?? 1))}px`);
  };

  const attrs = { src: src.trim(), alt: alt.trim() || (tab === 'flag' ? 'flag' : 'emoji'), width: width || height, height, title: '' };
  const commit = (a = attrs) => {
    if (!a.src) return;
    if (editing) editor.chain().focus().updateAttributes('rentryImage', a).run();
    else editor.chain().focus().insertContent({ type: 'rentryImage', attrs: a }).run();
    onDone();
  };

  const list = useMemo(() => {
    if (tab !== 'flag') return [];
    const all = countries();
    const t = q.trim().toLowerCase();
    return t ? all.filter((c) => c.name.toLowerCase().includes(t) || c.code === t) : all;
  }, [tab, q]);

  return (
    <div className="pop-stack ii-panel">
      <Segmented
        value={tab}
        onChange={(v) => setTab(v as never)}
        options={[{ value: 'link', label: 'Link' }, { value: 'flag', label: 'Flag' }, ...(used.length ? [{ value: 'page', label: `On page (${used.length})` }] : [])]}
      />

      {tab === 'link' && (
        <input className="field" placeholder="Direct image link (https://…png/gif)" value={src} autoFocus spellCheck={false} onChange={(e) => setSrc(e.target.value.trim())} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      )}

      {tab === 'flag' && (
        <>
          <div className="search"><Search size={12} /><input className="field" placeholder="Search countries" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
          <div className="ii-flags">
            {list.map((c) => (
              <button key={c.code} type="button" className={clsx(src === FLAG_SRC(c.code) && 'on')} onClick={() => { setSrc(FLAG_SRC(c.code)); setAlt(c.name); }} onDoubleClick={() => commit({ ...attrs, src: FLAG_SRC(c.code), alt: c.name, width: `${Math.round(px(height) * 4 / 3)}px` })}>
                <img src={FLAG_THUMB(c.code)} alt="" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                <span>{c.name}</span>
              </button>
            ))}
            {!list.length && <div className="hint" style={{ padding: 8 }}>No country matches “{q}”.</div>}
          </div>
        </>
      )}

      {tab === 'page' && (
        <div className="ii-used">
          {used.map((u) => (
            <button key={u.src} type="button" title={`${u.alt || 'image'} · ${u.width}×${u.height}`} onClick={() => commit({ src: u.src, alt: u.alt || 'emoji', width: u.width, height: u.height, title: '' })}>
              <img src={u.src} alt={u.alt} />
            </button>
          ))}
        </div>
      )}

      {tab !== 'page' && (
        <>
          <div className="ii-preview">
            {src && !broken ? (
              <span>Aa <img src={src} alt="" style={{ width: editorLen(width || height), height: editorLen(height) }} /> text</span>
            ) : (
              <em>{broken ? "Couldn't load that image" : 'Preview'}</em>
            )}
          </div>
          <div className="row">
            <span className="lbl">Size</span>
            <Segmented value={preset} onChange={choosePreset} options={[...SIZE_PRESETS.map((h) => ({ value: h, label: h })), { value: 'custom', label: '…' }]} />
          </div>
          <div className="grid2">
            <div><div className="mini-label">Width</div><NumberUnit value={width} onChange={setWidth} units={PX_UNITS} scrubLabel="W" /></div>
            <div><div className="mini-label">Height</div><NumberUnit value={height} onChange={(h) => { setHeight(h); if (ratio && h) setWidth(`${Math.round(px(h) * ratio)}px`); }} units={PX_UNITS} scrubLabel="H" /></div>
          </div>
          <div className="row"><span className="lbl">Alt text</span><input className="field" value={alt} placeholder={tab === 'flag' ? 'flag' : 'emoji'} onChange={(e) => setAlt(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 6 }}>
            {editing && <button type="button" className="btn subtle" onClick={() => { editor.chain().focus().deleteSelection().run(); onDone(); }}><Trash2 size={12} /> Remove</button>}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn primary" disabled={!src || broken} onClick={() => commit()}>{editing ? 'Update' : 'Insert'}</button>
          </div>
          {tab === 'link' && <div className="hint">Use a direct link to a .png, .gif or .webp (e.g. a Discord emoji or imgur link). Rentry can't host images itself.</div>}
          {tab === 'flag' && <div className="hint">Flags are loaded from flagcdn.com. Double-click a country to insert it right away.</div>}
        </>
      )}
    </div>
  );
}
