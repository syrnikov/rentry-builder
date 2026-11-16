import { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import type { Field } from '../../blocks/types';
import type { Props } from '../../model/types';
import { ColorField, EmojiField, ImageField, NumberUnit, Row, Segmented, Select, TextField, Toggle } from '../controls';
import { RichTextArea, UnderlineFields } from '../controls/RichText';

export function visibleFields(fields: Field[], props: Props) {
  return fields.filter((f) => !f.showIf || f.showIf(props));
}

/** Render one declarative field. `onPatch(patch, key)` – key is used to coalesce undo steps while typing. */
export function FieldControl({ field: f, props, onPatch }: { field: Field; props: Props; onPatch: (patch: Props, coalesceKey?: string) => void }) {
  const v = props[f.key];
  const set = (val: unknown) => onPatch({ [f.key]: val }, f.key);
  switch (f.kind) {
    case 'text':
      return <Row label={f.label} hint={f.hint}><TextField value={v ?? ''} onChange={set} placeholder={f.placeholder} /></Row>;
    case 'textarea':
      return (
        <Row label={f.label} hint={f.hint} stack>
          {f.rich ? <RichTextArea value={v ?? ''} onChange={set} rows={f.rows} placeholder={f.placeholder} /> : <TextField multiline mono={f.mono} rows={f.rows} value={v ?? ''} onChange={set} placeholder={f.placeholder} />}
        </Row>
      );
    case 'number':
      return (
        <Row label={f.label} hint={f.hint}>
          <NumberUnit value={v === undefined || v === '' ? '' : String(v)} units={[{ unit: 'no-unit', min: f.min, max: f.max, decimals: 0 }]} scrubLabel="#" onChange={(s) => set(s === '' ? f.min : Math.min(f.max, Math.max(f.min, parseInt(s, 10))))} />
        </Row>
      );
    case 'select':
      return <Row label={f.label} hint={f.hint}><Select value={String(v ?? '')} onChange={set} options={f.options} /></Row>;
    case 'segmented':
      return <Row label={f.label} hint={f.hint}><Segmented value={String(v ?? '')} onChange={(x) => set(x === 'true' ? true : x === 'false' ? false : x)} options={f.options} iconsOnly={f.options.every((o) => o.icon)} /></Row>;
    case 'toggle':
      return <Row label={f.label} hint={f.hint}><Toggle checked={!!v} onChange={set} /></Row>;
    case 'color':
      return <Row label={f.label} hint={f.hint}><ColorField value={v ?? ''} onChange={set} /></Row>;
    case 'image':
      return <Row label={f.label} hint={f.hint}><ImageField value={v ?? ''} onChange={set} /></Row>;
    case 'size':
      return <Row label={f.label} hint={f.hint}><NumberUnit value={v ?? ''} onChange={set} units={f.units} placeholder={f.placeholder} scrubLabel={f.label[0]} /></Row>;
    case 'emoji':
      return <Row label={f.label} hint={f.hint}><EmojiField value={v ?? ''} onChange={set} /></Row>;
    case 'underline':
      return <UnderlineFields value={v} onChange={set} />;
    case 'list':
      return <ListField field={f} items={(v as Props[]) ?? []} onChange={(items, key) => onPatch({ [f.key]: items }, key)} />;
  }
}

type ListFieldDef = Extract<Field, { kind: 'list' }>;

function ListField({ field, items, onChange }: { field: ListFieldDef; items: Props[]; onChange: (items: Props[], key?: string) => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<{ i: number; after: boolean } | null>(null);
  const update = (i: number, patch: Props, key?: string) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)), key ? `${field.key}.${i}.${key}` : undefined);
  const move = (from: number, to: number) => {
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(from < to ? to - 1 : to, 0, x);
    onChange(next);
    setOpen(null);
  };
  return (
    <div className="list-field">
      {items.map((it, i) => (
        <div
          key={i}
          className={clsx('list-item', open === i && 'open', over?.i === i && (over.after ? 'dragover-after' : 'dragover-before'))}
          onDragOver={(e) => {
            if (dragFrom === null) return;
            e.preventDefault();
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            setOver({ i, after: e.clientY > r.top + r.height / 2 });
          }}
          onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragFrom !== null && over) move(dragFrom, over.i + (over.after ? 1 : 0));
            setDragFrom(null);
            setOver(null);
          }}
        >
          <div className="list-item-head" onClick={() => setOpen(open === i ? null : i)}>
            <span className="grip" draggable onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', 'list'); setDragFrom(i); }} onDragEnd={() => { setDragFrom(null); setOver(null); }}>
              <GripVertical size={13} />
            </span>
            <span className="sum">{field.summary(it, i) || `${field.itemLabel} ${i + 1}`}</span>
            <span className="acts">
              <button type="button" className="icon-btn" title="Duplicate" onClick={(e) => { e.stopPropagation(); const n = [...items]; n.splice(i + 1, 0, structuredClone(it)); onChange(n); }}><Copy size={12} /></button>
              <button type="button" className="icon-btn danger" title="Remove" onClick={(e) => { e.stopPropagation(); onChange(items.filter((_, j) => j !== i)); setOpen(null); }}><Trash2 size={12} /></button>
            </span>
            <ChevronDown size={13} style={{ color: 'var(--text-3)', transform: open === i ? 'none' : 'rotate(-90deg)', transition: 'transform .15s', flex: 'none' }} />
          </div>
          {open === i && (
            <div className="list-item-body">
              {visibleFields(field.fields, it).map((f) => (
                <FieldControl key={f.key} field={f} props={it} onPatch={(patch, key) => update(i, patch, key)} />
              ))}
            </div>
          )}
        </div>
      ))}
      {(!field.max || items.length < field.max) && (
        <button type="button" className="btn ghost list-add" onClick={() => { onChange([...items, field.newItem()]); setOpen(items.length); }}>
          <Plus size={13} /> Add {field.itemLabel.toLowerCase()}
        </button>
      )}
    </div>
  );
}
