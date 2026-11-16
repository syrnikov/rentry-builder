import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Eye, EyeOff, FilePlus2, FolderOpen, Lock, Plus, Save, Search, Unlock } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { getDef, CATEGORIES } from '../blocks/registry';
import { PRESETS } from '../blocks/presets';
import type { Block, DropTarget } from '../model/types';
import { Segmented } from './controls';
import { dropAllowed, performDrop } from './Canvas';
import { TEMPLATES, blankProject } from '../templates';
import { parseRich } from '../rentry/richText';
import { openProjectFile, saveProjectFile } from './Toolbar';

export function LeftSidebar() {
  const tab = useEditor((s) => s.ui.leftTab);
  const setUI = useEditor((s) => s.setUI);
  return (
    <aside className="sidebar">
      <div className="panel-tabs">
        <Segmented value={tab} onChange={(v) => setUI({ leftTab: v as never })} options={[{ value: 'layers', label: 'Layers' }, { value: 'insert', label: 'Insert' }, { value: 'templates', label: 'Templates' }]} />
      </div>
      <div className="panel-scroll">
        {tab === 'layers' && <Layers />}
        {tab === 'insert' && <Insert />}
        {tab === 'templates' && <Templates />}
      </div>
    </aside>
  );
}

// ───────────────────────── Layers
type Row =
  | { kind: 'block'; key: string; block: Block; depth: number; parentId: string | null; slot: number; index: number; listLen: number }
  | { kind: 'slot'; key: string; parentId: string; slot: number; depth: number; label: string; len: number };

function flatten(blocks: Block[], collapsed: Set<string>, depth = 0, parentId: string | null = null, slot = 0, out: Row[] = []): Row[] {
  blocks.forEach((b, index) => {
    out.push({ kind: 'block', key: b.id, block: b, depth, parentId, slot, index, listLen: blocks.length });
    const def = getDef(b.type);
    if (def?.container && !collapsed.has(b.id)) {
      const n = def.container.slotCount(b);
      for (let s = 0; s < n; s++) {
        const kids = b.children?.[s] ?? [];
        if (n > 1 || kids.length === 0) out.push({ kind: 'slot', key: `${b.id}:${s}`, parentId: b.id, slot: s, depth: depth + 1, label: n > 1 ? def.container.slotLabel(b, s) : 'empty — drop here', len: kids.length });
        flatten(kids, collapsed, depth + (n > 1 ? 2 : 1), b.id, s, out);
      }
    }
  });
  return out;
}

function Layers() {
  const blocks = useEditor((s) => s.project.blocks);
  const selectedId = useEditor((s) => s.selectedId);
  const hoverId = useEditor((s) => s.hoverId);
  const dragging = useEditor((s) => s.ui.dragging);
  const { select, hover, updateBlock, setUI } = useEditor.getState();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<string | null>(null);
  const [over, setOver] = useState<{ key: string; pos: 'before' | 'after' | 'inside' } | null>(null);
  const rows = useMemo(() => flatten(blocks, collapsed), [blocks, collapsed]);

  if (!blocks.length) return <div className="empty-note">No layers yet.<br />Drag blocks in from <b>Insert</b> or pick a <b>Template</b>.</div>;

  const targetFor = (r: Row, pos: 'before' | 'after' | 'inside'): DropTarget => {
    if (r.kind === 'slot') return { parentId: r.parentId, slot: r.slot, index: r.len };
    if (pos === 'inside') return { parentId: r.block.id, slot: 0, index: r.block.children?.[0]?.length ?? 0 };
    return { parentId: r.parentId, slot: r.slot, index: r.index + (pos === 'after' ? 1 : 0) };
  };

  const onDragOver = (e: React.DragEvent, r: Row) => {
    const d = useEditor.getState().ui.dragging;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    const isContainer = r.kind === 'block' && !!getDef(r.block.type)?.container;
    let pos: 'before' | 'after' | 'inside' = r.kind === 'slot' ? 'inside' : y < 0.5 ? 'before' : 'after';
    if (isContainer && y > 0.3 && y < 0.7 && getDef(r.block.type)?.container?.slotCount(r.block) === 1) pos = 'inside';
    const t = targetFor(r, pos);
    const ok = dropAllowed(d, t);
    e.dataTransfer.dropEffect = ok ? 'move' : 'none';
    setOver(ok ? { key: r.key, pos } : null);
    setUI({ drop: ok ? t : null });
  };

  return (
    <div className="layers" onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}>
      {rows.map((r) => {
        const indent = 6 + r.depth * 14;
        if (r.kind === 'slot') {
          return (
            <div key={r.key} className={clsx('layer slot', over?.key === r.key && 'drop-inside')} style={{ paddingLeft: indent + 16 }}
              onDragOver={(e) => onDragOver(e, r)} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(null); performDrop(); }}>
              {r.label}
            </div>
          );
        }
        const b = r.block;
        const def = getDef(b.type);
        const Icon = def?.icon;
        const isContainer = !!def?.container;
        return (
          <div
            key={r.key}
            className={clsx('layer', selectedId === b.id && 'selected', hoverId === b.id && 'hovered', b.hidden && 'hidden-layer', over?.key === r.key && over.pos === 'inside' && 'drop-inside')}
            style={{ paddingLeft: indent, opacity: dragging?.kind === 'move' && dragging.id === b.id ? 0.4 : undefined }}
            draggable={!b.locked && renaming !== b.id}
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', b.id); setUI({ dragging: { kind: 'move', id: b.id } }); }}
            onDragEnd={() => { setOver(null); setUI({ dragging: null, drop: null }); }}
            onDragOver={(e) => onDragOver(e, r)}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(null); performDrop(); }}
            onClick={() => select(b.id)}
            onMouseEnter={() => hover(b.id)}
            onMouseLeave={() => hover(null)}
          >
            {over?.key === r.key && over.pos !== 'inside' && <span className="drop-line" style={{ [over.pos === 'before' ? 'top' : 'bottom']: -1, left: indent }} />}
            {isContainer ? (
              <button className={clsx('chev-btn', collapsed.has(b.id) && 'closed')} onClick={(e) => { e.stopPropagation(); const n = new Set(collapsed); n.has(b.id) ? n.delete(b.id) : n.add(b.id); setCollapsed(n); }}>
                <ChevronDown size={12} />
              </button>
            ) : <span style={{ width: 16, flex: 'none' }} />}
            <span className="ico">{Icon && <Icon size={14} />}</span>
            <span className="name" onDoubleClick={(e) => { e.stopPropagation(); setRenaming(b.id); }}>
              {renaming === b.id ? (
                <input autoFocus defaultValue={b.name ?? def?.label}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => { const v = e.target.value.trim(); updateBlock(b.id, (x) => { x.name = v && v !== def?.label ? v : undefined; }); setRenaming(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(null); e.stopPropagation(); }} />
              ) : (
                <>{b.name || def?.label}{layerHint(b) && <small>{layerHint(b)}</small>}</>
              )}
            </span>
            <span className="acts">
              <button className={clsx('icon-btn', b.locked && 'on')} title={b.locked ? 'Unlock' : 'Lock'} onClick={(e) => { e.stopPropagation(); updateBlock(b.id, (x) => { x.locked = !x.locked; }); }}>
                {b.locked ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
              <button className={clsx('icon-btn', b.hidden && 'on')} title={b.hidden ? 'Show' : 'Hide'} onClick={(e) => { e.stopPropagation(); updateBlock(b.id, (x) => { x.hidden = !x.hidden; }); }}>
                {b.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function layerHint(b: Block): string {
  const p = b.props;
  const s = String(p.text ?? p.title ?? p.name ?? p.label ?? '');
  // Show the visible text, not the rentry syntax around it.
  const clean = parseRich(s).map((l) => l.runs.map((r) => r.text).join('')).join(' ').replace(/\s+/g, ' ').trim();
  return clean.length > 26 ? clean.slice(0, 25) + '…' : clean;
}

// ───────────────────────── Insert library
function Insert() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const { addBlock, setUI } = useEditor.getState();
  const list = PRESETS.filter((p) => (cat === 'all' || p.category === cat) && (p.label + ' ' + p.description).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <div className="lib-top">
        <div className="search">
          <Search size={13} />
          <input className="field" placeholder="Search blocks" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={cat} onChange={setCat} options={[{ value: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]} />
      </div>
      <div className="lib-list">
        {CATEGORIES.map((c) => {
          const items = list.filter((p) => p.category === c.id);
          if (!items.length) return null;
          return (
            <div key={c.id}>
              {cat === 'all' && <div className="lib-cat">{c.label}</div>}
              {items.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    className="lib-row"
                    title="Click to insert after the selection, or drag onto the canvas or into Layers"
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', p.id); setUI({ dragging: { kind: 'new', presetId: p.id } }); }}
                    onDragEnd={() => setUI({ dragging: null, drop: null })}
                    onClick={() => addBlock(p.make())}
                  >
                    <span className="lib-ico"><Icon size={15} strokeWidth={1.75} /></span>
                    <span className="lib-txt"><b>{p.label}</b><small>{p.description}</small></span>
                    <span className="lib-add"><Plus size={14} /></span>
                  </button>
                );
              })}
            </div>
          );
        })}
        {!list.length && <div className="empty-note">No blocks match “{q}”.</div>}
        {list.length > 0 && <div className="lib-foot">Drag a block onto the page or into Layers, or click to insert it below the selected block.</div>}
      </div>
    </>
  );
}

// ───────────────────────── Templates
function Templates() {
  const { loadProject, toast } = useEditor.getState();
  return (
    <div style={{ padding: 10 }}>
      <div className="side-actions">
        <button className="btn" onClick={openProjectFile}><FolderOpen size={13} /> Open…</button>
        <button className="btn" onClick={saveProjectFile}><Save size={13} /> Save file</button>
      </div>
      <div className="lib-cat" style={{ padding: '10px 6px 6px' }}>Templates</div>
      {TEMPLATES.map((t) => (
        <button key={t.id} className="tpl-card" onClick={() => { loadProject(t.make()); toast(`Loaded “${t.name}” · Ctrl+Z to undo`); }}>
          <span className="tpl-thumb" style={{ background: t.swatch[0] }}>
            <i style={{ background: t.swatch[1] }} />
            <b style={{ background: t.swatch[2] }} />
            <u style={{ background: t.swatch[2] }} />
          </span>
          <span><strong>{t.name}</strong><small>{t.description}</small></span>
        </button>
      ))}
      <button className="tpl-card" onClick={() => { loadProject(blankProject()); toast('Blank page · Ctrl+Z to undo'); }}>
        <span className="tpl-thumb" style={{ background: 'var(--track)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}><FilePlus2 size={18} /></span>
        <span><strong>Blank page</strong><small>Start from scratch with rentry defaults</small></span>
      </button>
    </div>
  );
}
