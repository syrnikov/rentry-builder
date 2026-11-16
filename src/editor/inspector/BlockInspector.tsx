import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Lock, MousePointerClick, Trash2, Unlock } from 'lucide-react';
import { getDef } from '../../blocks/registry';
import { findBlock, locate } from '../../model/tree';
import { useEditor } from '../../store/editorStore';
import { compileBlock, rootCtx } from '../../compiler/compile';
import { Section } from '../controls';
import { FieldControl, visibleFields } from './FieldControl';

export function BlockInspector() {
  const selectedId = useEditor((s) => s.selectedId);
  const block = useEditor((s) => findBlock(s.project.blocks, s.selectedId));
  const { updateProps, updateBlock, duplicateBlock, removeBlock, moveBy } = useEditor.getState();
  const def = block ? getDef(block.type) : undefined;
  const md = useMemo(() => (block ? compileBlock({ ...block, hidden: false }, rootCtx()) : ''), [block]);

  if (!block || !def) {
    return (
      <div className="insp-empty">
        <MousePointerClick size={26} strokeWidth={1.5} />
        <span>Select a block on the canvas or in Layers to edit it.</span>
      </div>
    );
  }
  const Icon = def.icon;
  const loc = locate(useEditor.getState().project.blocks, block.id);
  const lint = def.lint?.(block) ?? [];

  return (
    <>
      <div className="insp-head">
        <span className="big-ico"><Icon size={16} strokeWidth={1.75} /></span>
        <div className="title">
          <input value={block.name ?? ''} placeholder={def.label} onChange={(e) => updateBlock(block.id, (b) => { b.name = e.target.value || undefined; }, `name:${block.id}`)} />
          <small>{def.description}</small>
        </div>
      </div>
      <div className="insp-actions">
        <button className="icon-btn" title="Move up (Alt+↑)" disabled={!loc || loc.index === 0} onClick={() => moveBy(block.id, -1)}><ArrowUp size={14} /></button>
        <button className="icon-btn" title="Move down (Alt+↓)" disabled={!loc || loc.index >= loc.list.length - 1} onClick={() => moveBy(block.id, 1)}><ArrowDown size={14} /></button>
        <button className="icon-btn" title="Duplicate (Ctrl+D)" onClick={() => duplicateBlock(block.id)}><Copy size={14} /></button>
        <span style={{ flex: 1 }} />
        <button className={`icon-btn ${block.hidden ? 'on' : ''}`} title={block.hidden ? 'Show' : 'Hide'} onClick={() => updateBlock(block.id, (b) => { b.hidden = !b.hidden; })}>{block.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        <button className={`icon-btn ${block.locked ? 'on' : ''}`} title={block.locked ? 'Unlock' : 'Lock'} onClick={() => updateBlock(block.id, (b) => { b.locked = !b.locked; })}>{block.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
        <button className="icon-btn danger" title="Delete (Del)" disabled={block.locked} onClick={() => removeBlock(block.id)}><Trash2 size={14} /></button>
      </div>
      <div className="panel-scroll" key={selectedId}>
        {lint.length > 0 && <div className="lint-banner">{lint[0]}</div>}
        {def.groups.map((g) => {
          const fields = visibleFields(g.fields, block.props);
          if (!fields.length) return null;
          return (
            <Section key={g.title} title={g.title} defaultOpen={!g.collapsed}>
              {fields.map((f, i) => (
                <FieldControl key={f.key + i} field={f} props={block.props} onPatch={(patch, key) => updateProps(block.id, patch, key ? `${block.id}:${key}` : undefined)} />
              ))}
            </Section>
          );
        })}
        {def.container && (
          <Section title="Contents">
            <div className="hint">
              {def.type === 'columns'
                ? 'Drag blocks into a column on the canvas or in Layers. Only text, images, lists, links, tags and other single-line blocks fit inside table cells.'
                : 'Drag blocks into this section on the canvas or in Layers.'}
            </div>
          </Section>
        )}
        <Section title="Markdown output" defaultOpen={false}>
          <pre className="code-box" style={{ minHeight: 0, maxHeight: 240, margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', userSelect: 'text' }}>{md || '(empty)'}</pre>
        </Section>
      </div>
    </>
  );
}
