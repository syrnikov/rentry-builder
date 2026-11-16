import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardPaste, GripVertical, Pipette, Plus, RotateCcw, Split, SunMoon, X } from 'lucide-react';
import { collectUsedColors } from '../../model/palette';
import clsx from 'clsx';
import { MAPPING_LABELS, META_BY_KEY, MetaOption, PAGE_SECTIONS, TEXT_SIZE_LABELS, UnitRange } from '../../rentry/metadataSchema';
import { effectiveValues, MetaIssue, QUICK_FIX_DEFAULTS, validateMetadata } from '../../rentry/validateMetadata';
import { splitValues } from '../../rentry/serializeMetadata';
import { useEditor } from '../../store/editorStore';
import { THEME_PRESETS, isStyleKey } from '../../templates/themes';
import { Chips, ColorField, FontPicker, ImageField, NumberUnit, Row, Section, Segmented, Select, TextField, Toggle } from '../controls';

export function PageInspector() {
  const meta = useEditor((s) => s.project.meta);
  const focusKey = useEditor((s) => s.ui.focusMetaKey);
  const { setMeta, commit, setUI } = useEditor.getState();
  const issues = useMemo(() => validateMetadata(meta), [meta]);
  const byKey = useMemo(() => {
    const m: Record<string, MetaIssue[]> = {};
    issues.forEach((i) => (m[i.key] ??= []).push(i));
    return m;
  }, [issues]);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusKey) return;
    const el = scroller.current?.querySelector(`[data-meta="${focusKey}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (el as HTMLElement | null)?.animate?.([{ background: 'var(--accent-soft)' }, { background: 'transparent' }], { duration: 1200 });
    setUI({ focusMetaKey: null });
  }, [focusKey, setUI]);

  const applyTheme = (preset: (typeof THEME_PRESETS)[number]) =>
    commit((p) => {
      for (const k of Object.keys(p.meta)) if (isStyleKey(k)) delete p.meta[k];
      Object.assign(p.meta, structuredClone(preset.meta));
    });

  const setCount = Object.keys(meta).length;

  return (
    <div className="panel-scroll" ref={scroller}>
      <div className={clsx('status-line', errors ? 'bad' : 'ok')}>
        {errors ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
        {errors ? `${errors} metadata problem${errors > 1 ? 's' : ''}: rentry rejects the page until fixed` : `Metadata valid · ${setCount} option${setCount === 1 ? '' : 's'} set`}
      </div>
      <Section title="Presets" right={<button className="btn ghost" style={{ height: 20, fontSize: 11 }} onClick={() => setUI({ importMetaOpen: true })}><ClipboardPaste size={12} /> Paste metadata</button>}>
        <div className="theme-row">
          {THEME_PRESETS.map((t) => (
            <button key={t.name} className="theme-item" title={`Apply ${t.name} (replaces page styling)`} onClick={() => applyTheme(t)}>
              <span className="theme-chip" style={{ background: t.outer }}>
                <i style={{ background: t.inner }} />
                <b style={{ background: t.accent }} />
              </span>
              {t.name}
            </button>
          ))}
        </div>
      </Section>
      <PaletteSection />
      {PAGE_SECTIONS.map((s) => {
        const marked = s.keys.some((k) => meta[k]?.length);
        const hasIssue = s.keys.some((k) => byKey[k]?.length);
        return (
          <Section key={s.id} title={s.title} defaultOpen={!s.collapsed || hasIssue} marked={marked}>
            {s.keys.map((k) => (
              <MetaControl key={k} opt={META_BY_KEY[k]} values={meta[k] ?? []} issues={byKey[k] ?? []} onChange={(v, coalesce) => setMeta(k, v, coalesce ? `meta:${k}` : undefined)} />
            ))}
          </Section>
        );
      })}
      <div style={{ padding: 12 }}>
        <button className="btn subtle" style={{ width: '100%' }} onClick={() => commit((p) => { for (const k of Object.keys(p.meta)) if (isStyleKey(k)) delete p.meta[k]; })}>
          <RotateCcw size={12} /> Reset page styling to rentry defaults
        </button>
      </div>
    </div>
  );
}

function PaletteSection() {
  const project = useEditor((s) => s.project);
  const link = useEditor((s) => s.ui.paletteLink);
  const { addPaletteColors, updatePaletteColor, removePaletteColor, movePaletteColor, setUI, toast } = useEditor.getState();
  const palette = project.palette ?? [];
  const used = useMemo(
    () => collectUsedColors(project).filter((c) => !palette.some((p) => p.value.toLowerCase() === c.toLowerCase())),
    [project], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<{ i: number; after: boolean } | null>(null);

  const addNew = () => {
    const hue = Math.round(Math.random() * 360);
    const hex = '#' + [0, 8, 4].map((n) => {
      const k = (n + hue / 30) % 12;
      const c = 0.55 - 0.35 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    }).join('');
    addPaletteColors([hex]);
  };

  return (
    <div data-meta="__palette">
      <Section title="Palette" right={palette.length ? String(palette.length) : undefined}>
        {palette.length > 0 ? (
          <div className="palette-list">
            {palette.map((c, i) => (
              <div
                key={i}
                className={clsx('palette-item', over?.i === i && (over.after ? 'drop-after' : 'drop-before'))}
                onDragOver={(e) => {
                  if (drag === null) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  setOver({ i, after: e.clientY > r.top + r.height / 2 });
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag !== null && over) movePaletteColor(drag, over.i + (over.after ? 1 : 0));
                  setDrag(null);
                  setOver(null);
                }}
              >
                <span className="grip" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', 'palette'); setDrag(i); }} onDragEnd={() => { setDrag(null); setOver(null); }}>
                  <GripVertical size={12} />
                </span>
                <ColorField value={c.value} onChange={(v) => v && updatePaletteColor(i, { value: v })} allowAlpha allowRgba clearable={false} />
                <input className="pname" value={c.name} placeholder="Name" spellCheck={false} onChange={(e) => updatePaletteColor(i, { name: e.target.value })} />
                <button className="icon-btn danger del" title="Remove from palette (the page keeps the color)" onClick={() => removePaletteColor(i)}><X size={12} /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="hint">Save the colors your page uses so every color picker offers them. Keeps custom colors consistent.</div>
        )}
        <div className="palette-actions">
          <button className="btn" onClick={addNew}><Plus size={12} /> Add color</button>
          {used.length > 0 && (
            <button className="btn subtle" title={used.join(', ')} onClick={() => { addPaletteColors(used); toast(`Added ${used.length} color${used.length > 1 ? 's' : ''} from the page`); }}>
              <Pipette size={12} /> Collect {used.length} from page
            </button>
          )}
        </div>
        <label className="palette-link">
          <Toggle checked={link} onChange={(b) => setUI({ paletteLink: b })} />
          Editing a swatch updates every use on the page
        </label>
      </Section>
    </div>
  );
}

function MetaControl({ opt, values, issues, onChange }: { opt: MetaOption; values: string[]; issues: MetaIssue[]; onChange: (v: string[] | undefined, coalesce?: boolean) => void }) {
  const mergeMeta = useEditor((s) => s.mergeMeta);
  const isSet = effectiveValues(opt, values).length > 0;
  const stack = opt.control === 'textarea' || opt.control === 'textSizes' || opt.control === 'sides' || opt.control === 'chips' || (opt.control === 'pair' && values.length > 1);
  const label = (
    <>
      {opt.label}
      {isSet && <button className="icon-btn reset" title="Reset to default" onClick={() => onChange(undefined)}><RotateCcw size={10} /></button>}
    </>
  );
  return (
    <div data-meta={opt.key} className="meta-item">
      <Row label={label} stack={stack} isSet={isSet} title={`${opt.key}\n${opt.help}`}>
        <MetaEditor opt={opt} values={values} onChange={onChange} />
      </Row>
      {issues.map((i, n) => (
        <div key={n} className={clsx('issue', i.severity === 'warning' && 'warning')}>
          <AlertTriangle size={11} style={{ flex: 'none', marginTop: 1 }} />
          <span>{i.message}</span>
          {i.fixAdd && (
            <button className="btn" style={{ height: 18, fontSize: 10.5, padding: '0 6px' }} onClick={() => mergeMeta(Object.fromEntries(i.fixAdd!.map((k) => [k, QUICK_FIX_DEFAULTS[k] ?? ['']])))}>
              Add {i.fixAdd.map((k) => META_BY_KEY[k]?.label.toLowerCase()).join(' + ')}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** One editor per value type (used by single, pair and sides controls). */
function ValueEditor({ opt, kind, value, onChange, scrub }: { opt: MetaOption; kind: MetaOption['valueControl']; value: string; onChange: (v: string) => void; scrub?: string }) {
  switch (kind) {
    case 'color':
      return <ColorField value={value} onChange={onChange} allowAlpha allowRgba />;
    case 'size':
      return <NumberUnit value={value} onChange={onChange} units={opt.units ?? []} scrubLabel={scrub} placeholder={opt.defaultHint?.split(' ')[0]} />;
    case 'sizeOrKeyword':
      return <NumberUnit value={value} onChange={onChange} units={opt.units ?? []} keywords={opt.whitelist} scrubLabel={scrub} />;
    case 'select':
      return <Select value={value} onChange={onChange} options={(opt.whitelist ?? []).map((w) => ({ value: w, label: w }))} placeholder="Default" />;
    case 'font':
      return <FontPicker value={value} onChange={onChange} />;
    default:
      return <TextField value={value} onChange={onChange} />;
  }
}

const SIDE_MODES = [{ value: '1', label: 'All' }, { value: '2', label: 'V / H' }, { value: '4', label: 'Each' }];
const SIDE_LABELS: Record<string, string[]> = { '1': ['All'], '2': ['Top/Bottom', 'Left/Right'], '4': ['Top', 'Right', 'Bottom', 'Left'] };
const SIDE_SCRUB: Record<string, string[]> = { '1': ['↔'], '2': ['V', 'H'], '4': ['T', 'R', 'B', 'L'] };

function MetaEditor({ opt, values, onChange }: { opt: MetaOption; values: string[]; onChange: (v: string[] | undefined, coalesce?: boolean) => void }) {
  const v0 = values[0] ?? '';
  switch (opt.control) {
    case 'text':
      return <TextField value={v0} onChange={(s) => onChange([s], true)} maxLength={opt.maxLength} />;
    case 'textarea':
      return <TextField value={v0} onChange={(s) => onChange([s], true)} maxLength={opt.maxLength} multiline rows={2} />;
    case 'image':
      return <ImageField value={v0} onChange={(s) => onChange([s], true)} allowDataUri={opt.allowDataUri} maxLength={opt.maxLength} />;
    case 'toggle':
      return <Toggle checked={v0 === 'true'} onChange={(b) => onChange(b ? ['true'] : undefined)} />;
    case 'select':
      return opt.whitelist!.length <= 3
        ? <Segmented value={v0} onChange={(s) => onChange(s ? [s] : undefined)} options={[{ value: '', label: 'Default' }, ...opt.whitelist!.map((w) => ({ value: w, label: w }))]} />
        : <Select value={v0} onChange={(s) => onChange(s ? [s] : undefined)} options={opt.whitelist!.map((w) => ({ value: w, label: w }))} placeholder="Default" />;
    case 'chips':
      return <Chips values={values} options={opt.whitelist!} onChange={(v) => onChange(v.length ? v : undefined)} />;
    case 'color':
      return <ColorField value={v0} onChange={(s) => onChange([s], true)} allowAlpha allowRgba />;
    case 'size':
      return <NumberUnit value={v0} onChange={(s) => onChange([s], true)} units={opt.units!} placeholder={opt.defaultHint} />;
    case 'sizeOrKeyword':
      return <NumberUnit value={v0} onChange={(s) => onChange([s], true)} units={opt.units!} keywords={opt.whitelist} />;
    case 'raw':
      return <TextField value={values.join(' ')} onChange={(s) => onChange(splitValues(s), true)} placeholder={opt.whitelist?.length ? `e.g. 30 ${opt.whitelist[0]}` : ''} mono />;
    case 'pair':
      return <PairEditor opt={opt} values={values} onChange={onChange} />;
    case 'sides':
      return <SidesEditor opt={opt} values={values} onChange={onChange} />;
    case 'textSizes':
      return <TextSizesEditor opt={opt} values={values} onChange={onChange} />;
    default:
      return null;
  }
}

function PairEditor({ opt, values, onChange }: { opt: MetaOption; values: string[]; onChange: (v: string[] | undefined, coalesce?: boolean) => void }) {
  const labels = MAPPING_LABELS[opt.mapping ?? 'lightdark'];
  const split = values.length > 1;
  const setAt = (i: number, s: string) => {
    const next = split ? [values[0] ?? '', values[1] ?? ''] : [values[0] ?? ''];
    next[i] = s;
    onChange(next, true);
  };
  const SplitIcon = opt.mapping === 'lightdark' ? SunMoon : Split;
  const toggle = (
    <button
      type="button"
      className={clsx('icon-btn', split && 'on')}
      style={{ marginTop: split ? 15 : 1 }}
      title={split ? `Use one value for ${labels.single.toLowerCase()}` : `Separate ${labels.pair![0].toLowerCase()} / ${labels.pair![1].toLowerCase()}`}
      onClick={() => onChange(split ? (values[0] ? [values[0]] : undefined) : [values[0] ?? '', values[0] ?? ''])}
    >
      <SplitIcon size={13} />
    </button>
  );
  return (
    <div className="pair-wrap">
      <div className="pair-fields">
        {split ? (
          <div className="grid2">
            {[0, 1].map((i) => (
              <div key={i}>
                <div className="mini-label">{labels.pair![i]}</div>
                <ValueEditor opt={opt} kind={opt.valueControl} value={values[i] ?? ''} onChange={(s) => setAt(i, s)} scrub={opt.mapping === 'xy' ? (i ? 'Y' : 'X') : undefined} />
              </div>
            ))}
          </div>
        ) : (
          <ValueEditor opt={opt} kind={opt.valueControl} value={values[0] ?? ''} onChange={(s) => setAt(0, s)} />
        )}
      </div>
      {toggle}
    </div>
  );
}

function SidesEditor({ opt, values, onChange }: { opt: MetaOption; values: string[]; onChange: (v: string[] | undefined, coalesce?: boolean) => void }) {
  const n = values.length >= 3 ? '4' : values.length === 2 ? '2' : '1';
  const norm = values.length === 3 ? [values[0], values[1], values[2], values[1]] : values;
  const setMode = (m: string) => {
    const first = values[0] ?? '';
    const second = values[1] ?? first;
    if (m === '1') onChange(first ? [first] : undefined);
    else if (m === '2') onChange([first, second]);
    else onChange(norm.length === 4 ? norm : [first, second, first, second]);
  };
  const count = Number(n);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      <Segmented value={n} onChange={setMode} options={SIDE_MODES} />
      <div className={count > 1 ? 'grid2' : undefined}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i}>
            {count > 1 && <div className="mini-label">{SIDE_LABELS[n][i]}</div>}
            <ValueEditor
              opt={opt}
              kind={opt.valueControl}
              value={norm[i] ?? ''}
              scrub={SIDE_SCRUB[n][i]}
              onChange={(s) => {
                const next = Array.from({ length: count }, (_, j) => norm[j] ?? '');
                next[i] = s;
                onChange(next, true);
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TextSizesEditor({ opt, values, onChange }: { opt: MetaOption; values: string[]; onChange: (v: string[] | undefined, coalesce?: boolean) => void }) {
  const defaults = (opt.defaultHint ?? '').split(' ');
  const units: UnitRange[] = (opt.units ?? []).filter((u) => u.unit !== 'no-unit');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
      {TEXT_SIZE_LABELS.map((label, i) => (
        <div key={label} className="row">
          <span className="lbl">{label}</span>
          <NumberUnit
            value={values[i] && values[i] !== '0' ? values[i] : ''}
            units={i === 0 ? units.filter((u) => u.unit !== 'rem') : units.slice().sort((a) => (a.unit === 'rem' ? -1 : 1))}
            placeholder={defaults[i]}
            scrubLabel={i === 0 ? 'B' : i >= 2 && i <= 7 ? `${i - 1}` : label[0]}
            onChange={(s) => {
              const next = Array.from({ length: 12 }, (_, j) => (values[j] && values[j] !== '0' ? values[j] : ''));
              next[i] = s;
              onChange(next, true);
            }}
          />
        </div>
      ))}
      <div className="hint">Leave a size empty to keep rentry's default. Use rem so everything scales with Base.</div>
    </div>
  );
}
