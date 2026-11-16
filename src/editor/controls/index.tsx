import { ReactNode, RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { HexAlphaColorPicker, HexColorPicker } from 'react-colorful';
import { ChevronDown, ImageOff, Plus, Search, Upload, X } from 'lucide-react';
import { isInlineColor, PaletteColor } from '../../model/palette';
import type { Option } from '../../blocks/types';
import type { UnitRange } from '../../rentry/metadataSchema';
import { RENTRY_COLORS, compactRgba, isAnyColor, isColorName, parseRgba } from '../../rentry/colors';
import { GOOGLE_FONTS, loadGoogleFont, toDisplayFontName, toMetaFontName } from '../../rentry/googleFonts';
import { parseSize } from '../../rentry/validateMetadata';
import { useEditor } from '../../store/editorStore';

// ───────────────────────── Popover
export function Popover({ anchor, open, onClose, children, width = 240, align = 'start' }: {
  anchor: RefObject<HTMLElement>; open: boolean; onClose: () => void; children: ReactNode; width?: number; align?: 'start' | 'end';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      const h = ref.current?.offsetHeight ?? 300;
      let top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
      let left = align === 'end' ? r.right - width : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      setPos({ top, left });
    };
    place();
    const id = requestAnimationFrame(place);
    return () => cancelAnimationFrame(id);
  }, [open, anchor, width, align]);
  useEffect(() => {
    if (!open) return;
    // Popovers are portaled to <body> in open order, so a later one is "on top" of ours.
    const isTopmost = () => {
      const all = document.querySelectorAll('.popover');
      return all[all.length - 1] === ref.current;
    };
    const down = (e: MouseEvent) => {
      const t = e.target as Element;
      if (ref.current?.contains(t) || anchor.current?.contains(t)) return;
      // Clicks inside a popover opened from within ours (nested) must not close us.
      const other = t.closest?.('.popover');
      if (other && ref.current && ref.current.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) { e.stopPropagation(); onClose(); }
    };
    window.addEventListener('mousedown', down, true);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('mousedown', down, true); window.removeEventListener('keydown', key, true); };
  }, [open, onClose, anchor]);
  if (!open) return null;
  return createPortal(
    <div ref={ref} className="popover" style={{ width, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }} onMouseDown={(e) => e.stopPropagation()}>
      {children}
    </div>,
    document.body,
  );
}

export function usePopover() {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return { ref, open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}

// ───────────────────────── Layout helpers
export function Section({ title, defaultOpen = true, children, right, marked }: { title: string; defaultOpen?: boolean; children: ReactNode; right?: ReactNode; marked?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <div className={clsx('section-head', !open && 'closed')} onClick={() => setOpen(!open)}>
        {title}
        {marked && !open && <span className="dot" title="Has settings" />}
        {right && <span className="count" onClick={(e) => e.stopPropagation()}>{right}</span>}
        <ChevronDown size={13} className="chev" />
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

export function Row({ label, children, hint, stack, isSet, title }: { label: ReactNode; children: ReactNode; hint?: ReactNode; stack?: boolean; isSet?: boolean; title?: string }) {
  return (
    <div className={clsx('row', stack && 'stack', isSet && 'is-set')}>
      {label !== '' && <span className="lbl" title={title}>{label}</span>}
      <div className="ctl" style={label === '' ? { gridColumn: '1 / -1' } : undefined}>{children}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

// ───────────────────────── Basic inputs
export function Segmented({ value, onChange, options, full = true, iconsOnly }: { value: string; onChange: (v: string) => void; options: Option[]; full?: boolean; iconsOnly?: boolean }) {
  return (
    <div className={clsx('seg', full && 'full', iconsOnly && 'icons')}>
      {options.map((o) => {
        const Icon = o.icon;
        return (
          <button key={o.value} type="button" className={clsx(String(value) === o.value && 'on')} onClick={() => onChange(o.value)} title={o.label}>
            {Icon && <Icon size={13} />}
            {(!Icon || !iconsOnly) && o.label}
          </button>
        );
      })}
    </div>
  );
}

export const Toggle = ({ checked, onChange, title }: { checked: boolean; onChange: (v: boolean) => void; title?: string }) => (
  <button type="button" title={title} className={clsx('toggle', checked && 'on')} onClick={() => onChange(!checked)} aria-pressed={checked} />
);

export function TextField({ value, onChange, placeholder, maxLength, multiline, rows = 3, mono, invalid, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; multiline?: boolean; rows?: number; mono?: boolean; invalid?: boolean; autoFocus?: boolean;
}) {
  const over = maxLength !== undefined && value.length > maxLength;
  return (
    <div style={{ width: '100%' }}>
      {multiline ? (
        <textarea className={clsx('textarea', mono && 'mono', (invalid || over) && 'invalid')} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} spellCheck={!mono} />
      ) : (
        <input className={clsx('field', mono && 'mono', (invalid || over) && 'invalid')} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} spellCheck={false} />
      )}
      {maxLength !== undefined && value.length > maxLength * 0.7 && <div className={clsx('char-count', over && 'over')}>{value.length}/{maxLength}</div>}
    </div>
  );
}

export function Select({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: Option[]; placeholder?: string }) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Chips({ values, options, onChange }: { values: string[]; options: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = values.includes(o);
        return <button key={o} type="button" className={clsx('chip', on && 'on')} onClick={() => onChange(on ? values.filter((v) => v !== o) : [...values, o])}>{o}</button>;
      })}
    </div>
  );
}

// ───────────────────────── Number + unit with scrubbing
const STEP: Record<string, number> = { px: 1, rem: 0.1, '%': 1, vh: 0.5, hw: 0.5, vw: 0.5, 'no-unit': 1 };

export function NumberUnit({ value, onChange, units, keywords = [], placeholder, scrubLabel = '↔' }: {
  value: string; onChange: (v: string) => void; units: UnitRange[]; keywords?: string[]; placeholder?: string; scrubLabel?: string;
}) {
  const isKeyword = keywords.includes(value);
  const parsed = !isKeyword ? parseSize(value) : null;
  const defaultUnit = units[0]?.unit ?? 'px';
  const unit = isKeyword ? value : parsed ? (parsed.unit === 'no-unit' && !units.some((u) => u.unit === 'no-unit') ? defaultUnit : parsed.unit) : defaultUnit;
  const [text, setText] = useState(parsed ? String(parsed.num) : '');
  useEffect(() => { setText(parsed ? String(parsed.num) : ''); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const range = units.find((u) => u.unit === unit);
  const fmt = (n: number, u: string) => {
    const r = units.find((x) => x.unit === u);
    const d = r?.decimals ?? 2;
    const v = +n.toFixed(d);
    return u === 'no-unit' ? String(v) : `${v}${u}`;
  };
  const clamp = (n: number) => (range ? Math.min(range.max, Math.max(range.min, n)) : n);
  const invalid = !!(parsed && range && (parsed.num < range.min || parsed.num > range.max));
  const commit = (raw: string) => {
    if (raw.trim() === '') return onChange('');
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) onChange(fmt(n, unit === value ? defaultUnit : unit));
  };
  const step = STEP[unit] ?? 1;
  const scrub = (e: React.PointerEvent) => {
    if (isKeyword) return;
    e.preventDefault();
    const startX = e.clientX;
    const start = parsed?.num ?? range?.min ?? 0;
    const u = unit;
    const move = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / 3) * step * (ev.shiftKey ? 10 : 1);
      onChange(fmt(clamp(start + delta), u));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = 'ew-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className={clsx('num-unit', invalid && 'invalid')} title={range ? `${range.min}–${range.max}${range.unit === 'no-unit' ? '' : range.unit}` : undefined}>
      <span className="scrub" onPointerDown={scrub}>{scrubLabel}</span>
      <input
        value={isKeyword ? '' : text}
        placeholder={isKeyword ? value : placeholder ?? '—'}
        disabled={isKeyword}
        onChange={(e) => { setText(e.target.value); if (e.target.value === '' || !Number.isNaN(parseFloat(e.target.value))) commit(e.target.value); }}
        onBlur={() => { if (parsed && range) onChange(fmt(clamp(parsed.num), unit)); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const d = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            onChange(fmt(clamp((parsed?.num ?? 0) + d), unit));
          }
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <select
        value={unit}
        onChange={(e) => {
          const u = e.target.value;
          if (keywords.includes(u)) return onChange(u);
          const r = units.find((x) => x.unit === u);
          const n = parsed?.num ?? r?.min ?? 0;
          onChange(fmt(r ? Math.min(r.max, Math.max(r.min, n)) : n, u));
        }}
      >
        {units.map((u) => <option key={u.unit} value={u.unit}>{u.unit === 'no-unit' ? '#' : u.unit}</option>)}
        {keywords.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
    </div>
  );
}

// ───────────────────────── Color
let ctx2d: CanvasRenderingContext2D | null = null;
/** Normalise any CSS color into [hex6, alpha]. */
export function colorToHexA(v: string): [string, number] {
  const rgba = parseRgba(v);
  if (rgba) return ['#' + rgba.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join(''), rgba[3]];
  if (/^#[0-9a-f]{8}$/i.test(v)) return [v.slice(0, 7), parseInt(v.slice(7), 16) / 255];
  if (typeof document === 'undefined') return ['#000000', 1];
  ctx2d ??= document.createElement('canvas').getContext('2d');
  if (!ctx2d) return ['#000000', 1];
  ctx2d.fillStyle = '#000';
  ctx2d.fillStyle = v;
  const out = String(ctx2d.fillStyle);
  if (out.startsWith('#')) return [out, v === 'transparent' ? 0 : 1];
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(out);
  if (m) return ['#' + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, '0')).join(''), m[4] !== undefined ? +m[4] : 1];
  return ['#000000', 1];
}

const QUICK_COLORS = ['black', 'gray', 'white', 'crimson', 'tomato', 'orange', 'gold', 'mediumseagreen', 'teal', 'dodgerblue', 'slateblue', 'violet', 'hotpink', 'saddlebrown'];

/** The picker itself (no popover), so it can be embedded anywhere — including inside other popovers. */
export function ColorPanel({ value, onChange, allowAlpha = false, allowRgba = false }: {
  value: string; onChange: (v: string) => void; allowAlpha?: boolean; allowRgba?: boolean;
}) {
  const [tab, setTab] = useState<'custom' | 'named'>(value && isColorName(value) ? 'named' : 'custom');
  const [format, setFormat] = useState<'hex' | 'rgba'>(value.toLowerCase().startsWith('rgba') ? 'rgba' : 'hex');
  const [q, setQ] = useState('');
  const [hoverName, setHoverName] = useState('');
  const [hex, alpha] = value ? colorToHexA(value) : ['#888888', 1];
  const pickerValue = allowAlpha ? hex + Math.round(alpha * 255).toString(16).padStart(2, '0') : hex;
  const emit = (h: string, fmt = format) => {
    if (fmt === 'rgba' && allowRgba) {
      const [hx, a] = colorToHexA(h);
      const n = parseInt(hx.slice(1), 16);
      onChange(compactRgba(`RGBA(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${+a.toFixed(2)})`));
    } else if (allowAlpha && h.length === 9 && h.toLowerCase().endsWith('ff')) onChange(h.slice(0, 7));
    else onChange(h);
  };
  const names = RENTRY_COLORS.filter((c) => c.includes(q.toLowerCase()));
  const swatchBg = (c: string) => (c === 'transparent' ? 'repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 50% / 6px 6px' : c);
  return (
    <div className="color-panel">
      <Segmented value={tab} onChange={(v) => setTab(v as never)} options={[{ value: 'custom', label: 'Custom' }, { value: 'named', label: 'Named' }]} />
      {tab === 'custom' ? (
        <>
          {allowAlpha ? <HexAlphaColorPicker color={pickerValue} onChange={(h) => emit(h)} /> : <HexColorPicker color={hex} onChange={(h) => emit(h)} />}
          <div className="color-panel-row">
            <span className="color-preview"><span style={{ background: value || 'transparent' }} /></span>
            <input className="field mono" value={value} placeholder="#hex or name" spellCheck={false} onChange={(e) => onChange(e.target.value.trim())} />
            {allowRgba && (
              <Segmented full={false} value={format} onChange={(v) => { setFormat(v as never); if (value) emit(pickerValue, v as never); }} options={[{ value: 'hex', label: 'HEX' }, { value: 'rgba', label: 'RGBA' }]} />
            )}
          </div>
          <div className="quick-colors">
            {QUICK_COLORS.map((c) => <button key={c} type="button" title={c} className={clsx(value === c && 'on')} style={{ background: c }} onClick={() => onChange(c)} />)}
          </div>
        </>
      ) : (
        <>
          <div className="search"><Search size={12} /><input className="field" placeholder="Search rentry colors" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
          <div className="named-grid">
            {names.map((c) => <button key={c} type="button" className={clsx(value === c && 'on')} style={{ background: swatchBg(c) }} onMouseEnter={() => setHoverName(c)} onMouseLeave={() => setHoverName('')} onClick={() => onChange(c)} />)}
          </div>
          <div className="color-name-label">{hoverName || (value && isColorName(value) ? value : `${names.length} rentry colors`)}</div>
        </>
      )}
      <PaletteRow value={value} onPick={onChange} allowRgba={allowRgba} />
    </div>
  );
}

const NO_PALETTE: PaletteColor[] = [];

/** Project palette swatches, shared by every color picker. */
function PaletteRow({ value, onPick, allowRgba }: { value: string; onPick: (v: string) => void; allowRgba: boolean }) {
  const palette = useEditor((s) => s.project.palette) ?? NO_PALETTE;
  const { addPaletteColors, setUI } = useEditor.getState();
  const v = value.trim().toLowerCase();
  const saved = palette.some((c) => c.value.toLowerCase() === v);
  const canAdd = !!v && !saved && isAnyColor(value.trim());
  return (
    <div className="palette-row">
      <div className="palette-head">
        <span>Page palette</span>
        <button type="button" className="btn ghost" onClick={() => setUI({ rightTab: 'page', focusMetaKey: '__palette' })}>Manage</button>
      </div>
      <div className="palette-swatches">
        {palette.map((c, i) => {
          const ok = allowRgba || isInlineColor(c.value);
          return (
            <button
              key={i}
              type="button"
              disabled={!ok}
              className={clsx(c.value.toLowerCase() === v && 'on', !ok && 'unsupported')}
              title={`${c.name ? c.name + ' · ' : ''}${c.value}${ok ? '' : ' (RGBA is not supported in text colors)'}`}
              style={{ background: c.value }}
              onClick={() => onPick(c.value)}
            />
          );
        })}
        <button type="button" className="palette-add" disabled={!canAdd} title={saved ? 'Already in the palette' : canAdd ? `Save ${value} to the page palette` : 'Pick a color to save it'} onClick={() => addPaletteColors([value])}>
          <Plus size={12} />
        </button>
      </div>
      {!palette.length && <div className="palette-empty">Save colors here to reuse them across the page.</div>}
    </div>
  );
}

export function ColorField({ value, onChange, allowAlpha = false, allowRgba = false, placeholder = 'Default', clearable = true }: {
  value: string; onChange: (v: string) => void; allowAlpha?: boolean; allowRgba?: boolean; placeholder?: string; clearable?: boolean;
}) {
  const pop = usePopover();
  const invalid = !!value && !isAnyColor(value) && !/^#[0-9a-f]{3,8}$/i.test(value);
  return (
    <div className="color-field">
      <button ref={pop.ref} type="button" className={clsx('swatch', !value && 'empty')} onClick={pop.toggle} title="Pick color">
        <span style={value ? { background: value } : undefined} />
      </button>
      <input className={clsx('field', invalid && 'invalid')} value={value} placeholder={placeholder} spellCheck={false} onChange={(e) => onChange(e.target.value.trim())} />
      {clearable && value && <button type="button" className="icon-btn clear" onClick={() => onChange('')} title="Clear"><X size={12} /></button>}
      <Popover anchor={pop.ref} open={pop.open} onClose={pop.close} width={252}>
        <ColorPanel value={value} onChange={onChange} allowAlpha={allowAlpha} allowRgba={allowRgba} />
      </Popover>
    </div>
  );
}

// ───────────────────────── Image
export function ImageField({ value, onChange, allowDataUri, maxLength = 32768 }: { value: string; onChange: (v: string) => void; allowDataUri?: boolean; maxLength?: number }) {
  const [broken, setBroken] = useState(false);
  const toast = useEditor((s) => s.toast);
  useEffect(() => setBroken(false), [value]);
  const upload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/x-icon';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const s = String(reader.result);
        if (s.length > maxLength) toast(`Image is ${Math.round(s.length / 1024)} KB as text — the limit is ${Math.round(maxLength / 1024)} KB. Use a link instead.`);
        else onChange(s);
      };
      reader.readAsDataURL(f);
    };
    input.click();
  };
  const isData = value.startsWith('data:');
  return (
    <div className="image-field">
      {value && !broken ? <img className="thumb" src={value} alt="" onError={() => setBroken(true)} /> : <span className="thumb broken"><ImageOff size={12} /></span>}
      <input className="field" value={isData ? `embedded image · ${Math.round(value.length / 1024)} KB` : value} readOnly={isData} placeholder="https://…" spellCheck={false} onChange={(e) => onChange(e.target.value.trim())} />
      {allowDataUri && <button type="button" className="icon-btn" title="Embed a small image (base64)" onClick={upload}><Upload size={13} /></button>}
      {value && <button type="button" className="icon-btn" onClick={() => onChange('')} title="Clear"><X size={12} /></button>}
    </div>
  );
}

// ───────────────────────── Font
const CATS = [{ value: 'all', label: 'All' }, { value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'display', label: 'Display' }, { value: 'hand', label: 'Hand' }, { value: 'mono', label: 'Mono' }];
export function FontPicker({ value, onChange, placeholder = 'Default' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const pop = usePopover();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  useEffect(() => { if (value) loadGoogleFont(value); }, [value]);
  const list = useMemo(() => GOOGLE_FONTS.filter((f) => (cat === 'all' || f.cat === cat) && f.name.toLowerCase().includes(q.toLowerCase())), [q, cat]);
  useEffect(() => { if (pop.open) list.slice(0, 80).forEach((f) => loadGoogleFont(f.name)); }, [pop.open, list]);
  const display = value ? toDisplayFontName(value) : '';
  return (
    <>
      <button ref={pop.ref} type="button" className="font-btn" onClick={pop.toggle} style={display ? { fontFamily: `"${display}"` } : undefined}>
        <span>{display || <em>{placeholder}</em>}</span>
        <ChevronDown size={12} style={{ flex: 'none', color: 'var(--text-3)' }} />
      </button>
      <Popover anchor={pop.ref} open={pop.open} onClose={pop.close} width={280} align="end">
        <div className="pop-stack">
          <div className="search"><Search size={12} /><input className="field" placeholder="Search Google Fonts" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
          <Segmented value={cat} onChange={setCat} options={CATS} />
          <div className="font-list">
            {value && <button type="button" onClick={() => { onChange(''); pop.close(); }} style={{ fontFamily: 'var(--font)', fontSize: 13 }}>Default font</button>}
            {list.map((f) => (
              <button key={f.name} type="button" className={clsx(toMetaFontName(f.name) === value && 'on')} style={{ fontFamily: `"${f.name}", var(--font)` }} onClick={() => { onChange(toMetaFontName(f.name)); pop.close(); }}>
                {f.name}<small>{f.cat}</small>
              </button>
            ))}
            {q.trim() && !GOOGLE_FONTS.some((f) => f.name.toLowerCase() === q.trim().toLowerCase()) && (
              <button type="button" style={{ fontFamily: 'var(--font)', fontSize: 13 }} onClick={() => { onChange(toMetaFontName(q)); pop.close(); }}>
                Use “{q.trim()}” from Google Fonts
              </button>
            )}
          </div>
        </div>
      </Popover>
    </>
  );
}

// ───────────────────────── Emoji
const EMOJIS = '✨ 🌙 ☀️ ⭐ 🌸 🌷 🍓 🍒 🍰 ☕ 🍵 🧋 🎧 🎵 🎶 🎸 🎹 📖 📚 ✍️ 🎨 🖌️ 📷 🎬 📺 🎮 👾 🕹️ 💿 📼 💌 💬 🔗 🌐 🏠 📌 🐦 🦋 🐱 🐶 🐸 🐰 🦊 🐻 🐝 🍄 🌿 🌵 🌊 🔥 ❄️ 🌈 ⚡ 💫 💖 💜 💙 💚 🖤 🤍 ♡ ✿ ❀ ☆ ✦ ✧ ☾ ⟡ ♪ ✗ ✓ ⚠️ 🛑 🔞 🏳️‍🌈 🏳️‍⚧️'.split(' ');
export function EmojiField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const pop = usePopover();
  return (
    <>
      <button ref={pop.ref} type="button" className="emoji-btn" onClick={pop.toggle}>{value || '·'}</button>
      <Popover anchor={pop.ref} open={pop.open} onClose={pop.close} width={268}>
        <div className="pop-stack">
          <input className="field" placeholder="Type or paste any emoji/symbol" value={value} onChange={(e) => onChange(e.target.value)} autoFocus />
          <div className="emoji-grid">
            {EMOJIS.map((e) => <button key={e} type="button" onClick={() => { onChange(e); pop.close(); }}>{e}</button>)}
          </div>
        </div>
      </Popover>
    </>
  );
}
