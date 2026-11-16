import { createContext, CSSProperties, memo, ReactNode, useContext, useEffect, useMemo, useRef } from 'react';
import { kbd } from '../app/platform';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Copy, GripVertical, Lock, Maximize, Minus, Plus, Trash2 } from 'lucide-react';
import { getDef } from '../blocks/registry';
import type { BlockDef } from '../blocks/types';
import type { Block, DropTarget } from '../model/types';
import { findBlock } from '../model/tree';
import { canDrop, DragPayload, useEditor } from '../store/editorStore';
import { getPreset } from '../blocks/presets';
import { compileBlock, compileMarkdown, rootCtx } from '../compiler/compile';
import { collectHeadings, RenderEnv, renderRentry, renderRentryCell } from '../preview/rentryMarkdown';
import { buildTheme, PreviewTheme } from '../preview/rentryTheme';
import { loadGoogleFont } from '../rentry/googleFonts';
import { Align, resolveAlign } from '../rentry/inline';
import { heading } from '../blocks/common';
import { RichTextArea } from './controls/RichText';

const EnvCtx = createContext<RenderEnv>({});
const ART = { desktop: { w: 1100, h: 820, label: 'Desktop' }, mobile: { w: 390, h: 760, label: 'Mobile' } };

// ───────────────────────── drag helpers
export function dropAllowed(d: DragPayload, target: DropTarget): boolean {
  const blocks = useEditor.getState().project.blocks;
  if (d.kind === 'move') {
    const b = findBlock(blocks, d.id);
    return !!b && !b.locked && canDrop(blocks, b, target);
  }
  const p = getPreset(d.presetId);
  return !!p && canDrop(blocks, { id: '__new__', type: p.type, props: {} }, target);
}

export function performDrop() {
  const s = useEditor.getState();
  const { dragging, drop } = s.ui;
  if (dragging && drop) {
    if (dragging.kind === 'new') {
      const p = getPreset(dragging.presetId);
      if (p) s.addBlock(p.make(), drop);
    } else s.moveBlock(dragging.id, drop);
  }
  s.setUI({ dragging: null, drop: null });
}

const sameTarget = (a: DropTarget | null, b: DropTarget | null) => !!a && !!b && a.parentId === b.parentId && a.slot === b.slot && a.index === b.index;

// ───────────────────────── canvas
export function Canvas() {
  const blocks = useEditor((s) => s.project.blocks);
  const meta = useEditor((s) => s.project.meta);
  const { zoom, device, previewDark } = useEditor((s) => s.ui);
  const { select, setUI } = useEditor.getState();
  const art = ART[device];
  const scroller = useRef<HTMLDivElement>(null);

  const theme = useMemo(() => buildTheme(meta, { dark: previewDark, artW: art.w, artH: art.h }), [meta, previewDark, art.w, art.h]);
  useEffect(() => { theme.fonts.forEach(loadGoogleFont); }, [theme.fonts.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const toc = useMemo(() => collectHeadings(compileMarkdown(blocks)), [blocks]);
  const env = useMemo<RenderEnv>(() => ({ toc, viewport: { w: art.w, h: art.h } }), [toc, art.w, art.h]);

  // Fit the artboard to the canvas width on load and when switching device (never above 100%).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    setUI({ zoom: clampZoom(Math.min(1, (el.clientWidth - 140) / art.w)) });
  }, [art.w, setUI]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const z = useEditor.getState().ui.zoom;
      setUI({ zoom: clampZoom(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)) });
    };
    // Safari reports trackpad pinches as gesture events (not ctrl+wheel); without this a pinch zooms the whole app.
    let start = 1;
    const gStart = (e: Event) => { e.preventDefault(); start = useEditor.getState().ui.zoom; };
    const gChange = (e: Event) => { e.preventDefault(); setUI({ zoom: clampZoom(start * (e as Event & { scale: number }).scale) }); };
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('gesturestart', gStart);
    el.addEventListener('gesturechange', gChange);
    return () => {
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('gesturestart', gStart);
      el.removeEventListener('gesturechange', gChange);
    };
  }, [setUI]);

  return (
    <div className="canvas-area">
      <div
        className="canvas-scroll"
        ref={scroller}
        onClick={() => select(null)}
        onDragOver={(e) => {
          // Dragging over empty canvas = append to the page.
          const d = useEditor.getState().ui.dragging;
          if (!d) return;
          e.preventDefault();
          const t = { parentId: null, slot: 0, index: useEditor.getState().project.blocks.length };
          if (!sameTarget(useEditor.getState().ui.drop, t)) setUI({ drop: t });
        }}
        onDrop={(e) => { e.preventDefault(); performDrop(); }}
      >
        {/* The wrapper is never zoomed, so it always spans the canvas and centers the zoomed artboard. */}
        <div className="artboard-wrap">
          <div className="artboard-label" style={{ width: art.w * zoom }}>
            <span>{art.label}</span>
            <span>{art.w} px · {previewDark ? 'Dark' : 'Light'}</span>
          </div>
          <div className="artboard-zoom" style={{ zoom } as CSSProperties}>
            <div
              className="artboard"
              style={{ width: art.w }}
              onClickCapture={(e) => { if ((e.target as HTMLElement).closest('a')) e.preventDefault(); }}
            >
              <EnvCtx.Provider value={env}>
                <RentryPage theme={theme} dark={previewDark} meta={meta}>
                  <BlockList blocks={blocks} parentId={null} slot={0} root />
                </RentryPage>
              </EnvCtx.Provider>
            </div>
          </div>
        </div>
      </div>
      <CanvasHud scroller={scroller} artW={art.w} />
    </div>
  );
}

const clampZoom = (z: number) => Math.min(3, Math.max(0.25, +z.toFixed(3)));

function CanvasHud({ scroller, artW }: { scroller: React.RefObject<HTMLDivElement>; artW: number }) {
  const zoom = useEditor((s) => s.ui.zoom);
  const setUI = useEditor((s) => s.setUI);
  const count = useEditor((s) => s.project.blocks.length);
  return (
    <div className="canvas-hud" onClick={(e) => e.stopPropagation()}>
      <button className="tb-btn" title={`Zoom out (${kbd("mod", "-")})`} onClick={() => setUI({ zoom: clampZoom(zoom / 1.2) })}><Minus size={14} /></button>
      <span className="zoom-label" title={`Reset to 100% (${kbd("mod", "0")})`} onClick={() => setUI({ zoom: 1 })}>{Math.round(zoom * 100)}%</span>
      <button className="tb-btn" title={`Zoom in (${kbd("mod", "+")})`} onClick={() => setUI({ zoom: clampZoom(zoom * 1.2) })}><Plus size={14} /></button>
      <button className="tb-btn" title="Zoom to fit" onClick={() => setUI({ zoom: clampZoom(Math.min(1.25, ((scroller.current?.clientWidth ?? 1200) - 140) / artW)) })}><Maximize size={13} /></button>
      <span className="sep" />
      <span className="stats">{count} block{count === 1 ? '' : 's'}</span>
    </div>
  );
}

// ───────────────────────── rentry page chrome
function RentryPage({ theme, dark, meta, children }: { theme: PreviewTheme; dark: boolean; meta: Record<string, string[]>; children: ReactNode }) {
  const style = { ...theme.outer, ...theme.vars } as CSSProperties;
  return (
    <div className={clsx('rp-page', dark && 'rp-dark')} style={style}>
      {theme.outerFg && <div className="rp-outer-fg" style={{ background: theme.outerFg }} />}
      <div className="rp-nav"><b>rentry</b><span>new · what · how · contacts</span></div>
      <div className="rp-inner" style={theme.inner}>
        {theme.innerFg && <div className="rp-inner-fg" style={{ background: theme.innerFg }} />}
        <div className="rp-content" dir={theme.dir}>{children}</div>
      </div>
      <div className="rp-footer">
        <span><a>Edit</a><a>Raw</a><a>Share</a></span>
        <span>Pub: {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}{meta.OPTION_DISABLE_VIEWS?.[0] === 'true' ? '' : ' · Views: 1,337'}</span>
      </div>
    </div>
  );
}

// ───────────────────────── block lists (drop zones)
function BlockList({ blocks, parentId, slot, align, root, cell, as = 'div', style, emptyLabel }: {
  blocks: Block[]; parentId: string | null; slot: number; align?: Align; root?: boolean; cell?: boolean; as?: 'div' | 'td'; style?: CSSProperties; emptyLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const drop = useEditor((s) => s.ui.drop);
  const dragging = useEditor((s) => !!s.ui.dragging);
  const setUI = useEditor((s) => s.setUI);
  const active = drop && drop.parentId === parentId && drop.slot === slot ? drop.index : -1;

  const onDragOver = (e: React.DragEvent) => {
    const d = useEditor.getState().ui.dragging;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const kids = Array.from(ref.current?.children ?? []).filter((el) => el.classList.contains('cv-block')) as HTMLElement[];
    let index = blocks.length;
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { index = Number(k.dataset.index); break; }
    }
    const target = { parentId, slot, index };
    const ok = dropAllowed(d, target);
    e.dataTransfer.dropEffect = ok ? (d.kind === 'new' ? 'copy' : 'move') : 'none';
    const cur = useEditor.getState().ui.drop;
    if (ok ? !sameTarget(cur, target) : cur !== null) setUI({ drop: ok ? target : null });
  };
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); performDrop(); };

  const visible = blocks.map((b, i) => [b, i] as const).filter(([b]) => !b.hidden);
  const Tag = as as 'div';
  return (
    <Tag ref={ref as never} className={clsx('cv-list', cell && 'cv-cell')} style={style} onDragOver={onDragOver} onDrop={onDrop}>
      {visible.map(([b, i]) => (
        <BlockSlot key={b.id} showDrop={active === i}>
          <BlockView block={b} index={i} align={align} cell={cell} />
        </BlockSlot>
      ))}
      {active === blocks.length && visible.length > 0 && <div className="cv-drop" />}
      {visible.length === 0 && (
        <div className={clsx('cv-empty', root && 'root', dragging && active >= 0 && 'active')}>
          {root ? (<><b>Your page is empty</b><span>Drag blocks from Insert, or pick a template.</span></>) : (emptyLabel ?? 'Drop blocks here')}
        </div>
      )}
    </Tag>
  );
}

const BlockSlot = ({ showDrop, children }: { showDrop: boolean; children: ReactNode }) => (<>{showDrop && <div className="cv-drop" />}{children}</>);

// ───────────────────────── a single block
const BlockView = memo(function BlockView({ block, index, align, cell }: { block: Block; index: number; align?: Align; cell?: boolean }) {
  const def = getDef(block.type);
  const selected = useEditor((s) => s.selectedId === block.id);
  const hovered = useEditor((s) => s.hoverId === block.id);
  const editing = useEditor((s) => s.ui.editingId === block.id);
  const isDragging = useEditor((s) => s.ui.dragging?.kind === 'move' && s.ui.dragging.id === block.id);
  const { select, hover, setUI, moveBy, duplicateBlock, removeBlock } = useEditor.getState();
  if (!def) return null;
  const Icon = def.icon;

  return (
    <div
      className={clsx('cv-block', selected && 'selected', hovered && 'hovered', isDragging && 'dragging', block.locked && 'locked')}
      data-index={index}
      data-id={block.id}
      draggable={!block.locked && !editing}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', block.id);
        setUI({ dragging: { kind: 'move', id: block.id } });
      }}
      onDragEnd={() => setUI({ dragging: null, drop: null })}
      onClick={(e) => { e.stopPropagation(); select(block.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); if (def.primaryText && !block.locked) { select(block.id); setUI({ editingId: block.id }); } }}
      onMouseOver={(e) => { e.stopPropagation(); hover(block.id); }}
      onMouseLeave={() => hover(null)}
    >
      <div className="cv-tag">{block.locked ? <Lock size={10} /> : <GripVertical size={10} />}<Icon size={11} />{block.name || def.label}</div>
      {selected && !cell && (
        <div className="cv-tools" onClick={(e) => e.stopPropagation()}>
          <button title="Move up" onClick={() => moveBy(block.id, -1)}><ArrowUp size={12} /></button>
          <button title="Move down" onClick={() => moveBy(block.id, 1)}><ArrowDown size={12} /></button>
          <button title="Duplicate" onClick={() => duplicateBlock(block.id)}><Copy size={12} /></button>
          {!block.locked && <button title="Delete" onClick={() => removeBlock(block.id)}><Trash2 size={12} /></button>}
        </div>
      )}
      <BlockContent block={block} def={def} align={align} cell={cell} />
      {editing && def.primaryText && <InlineEditor block={block} field={def.primaryText} />}
    </div>
  );
});

function BlockContent({ block, def, align, cell }: { block: Block; def: BlockDef; align?: Align; cell?: boolean }) {
  const env = useContext(EnvCtx);
  const usesToc = block.type === 'toc';
  const html = useMemo(() => {
    if (def.editorOnly || def.container) return '';
    const ctx = { ...rootCtx(), align };
    if (cell) return renderRentryCell(def.toCell?.(block, ctx) ?? '', env);
    return renderRentry(compileBlock(block, ctx), env);
  }, [block, def, align, cell, usesToc ? env : env.viewport]); // eslint-disable-line react-hooks/exhaustive-deps

  if (def.editorOnly) return <div className="cv-note">Hidden note (not published): {block.props.text}</div>;
  if (block.type === 'section') return <SectionView block={block} align={align} />;
  if (block.type === 'columns') return <ColumnsView block={block} def={def} />;
  if (!html.trim()) return <div className="cv-empty">{def.label} is empty</div>;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function SectionView({ block, align }: { block: Block; align?: Align }) {
  const env = useContext(EnvCtx);
  const p = block.props;
  const a = resolveAlign(p.align, align);
  const inner = p.align === 'auto' ? align : a;
  const top = useMemo(() => renderRentry([p.dividerTop && '***', heading(p.title ?? '', p.titleLevel, a, p.titleColor)].filter(Boolean).join('\n\n'), env), [p, a, env]);
  return (
    <div className="cv-section-body">
      {top.trim() && <div dangerouslySetInnerHTML={{ __html: top }} />}
      <BlockList blocks={block.children?.[0] ?? []} parentId={block.id} slot={0} align={inner} emptyLabel="Drop blocks into this section" />
      {p.dividerBottom && <hr />}
    </div>
  );
}

function ColumnsView({ block, def }: { block: Block; def: BlockDef }) {
  const n = def.container!.slotCount(block);
  const cols = Array.from({ length: n }, (_, i) => i);
  return (
    <table className="cv-cols">
      <thead>
        <tr>
          {cols.map((i) => {
            const t = block.props[`title${i}`];
            return <th key={i} style={{ textAlign: block.props[`align${i}`] ?? 'left' }} dangerouslySetInnerHTML={{ __html: t?.trim() ? renderRentryCell(`**${t}**`) : '' }} />;
          })}
        </tr>
      </thead>
      <tbody>
        <tr>
          {cols.map((i) => (
            <BlockList
              key={i}
              as="td"
              cell
              blocks={block.children?.[i] ?? []}
              parentId={block.id}
              slot={i}
              style={{ textAlign: block.props[`align${i}`] ?? 'left', verticalAlign: 'top' }}
              emptyLabel={`Column ${i + 1}`}
            />
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function InlineEditor({ block, field }: { block: Block; field: string }) {
  const zoom = useEditor((s) => s.ui.zoom);
  const { updateProps, setUI } = useEditor.getState();
  const close = () => setUI({ editingId: null });
  const def = getDef(block.type);
  const f = def?.groups.flatMap((g) => g.fields).find((x) => x.key === field);
  const plain = f?.kind === 'textarea' && (f.mono || !f.rich);
  const value = String(block.props[field] ?? '');
  const set = (v: string) => updateProps(block.id, { [field]: v }, `${block.id}:${field}`);
  return (
    <div
      className="inline-editor"
      style={{ zoom: 1 / zoom } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }}
    >
      <div className="popover">
        {plain
          ? <textarea className={clsx('textarea', f?.kind === 'textarea' && f.mono && 'mono')} rows={6} value={value} onChange={(e) => set(e.target.value)} autoFocus spellCheck={false} />
          : <RichTextArea value={value} onChange={set} rows={4} autoFocus singleLine={f?.kind === 'text'} />}
        <div className="ie-foot"><span>Esc to close</span><button className="btn primary" onClick={close}>Done</button></div>
      </div>
    </div>
  );
}
