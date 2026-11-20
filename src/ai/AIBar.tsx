import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ArrowUp, Check, Info, Settings2, Sparkles, Square, X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { findBlock, walk } from '../model/tree';
import { getDef } from '../blocks/registry';
import type { Block, Project } from '../model/types';
import { kbd } from '../app/platform';
import { useAI } from './settings';
import { AIError } from './openai';
import { describeReport } from './ops';
import { EditResult, runEdit } from './run';
import { KeySetup } from './AISettings';

const TEXTY = new Set(['paragraph', 'quote', 'heading', 'admonition', 'banner', 'status']);

/** Context-aware starting points, computed locally (no request until one is clicked). */
export function suggestions(p: Project, block: Block | null): string[] {
  if (block) {
    if (TEXTY.has(block.type)) return ['Rewrite this in a more playful tone', 'Make this shorter', 'Color the key words with my palette'];
    if (block.type === 'interests') return ['Color these tags with my palette', 'Show these as a grid', 'Sort these alphabetically'];
    if (block.type === 'profileCard') return ['Polish my bio', 'Restyle this to match the rest of my page'];
    if (block.type === 'columns') return ['Balance these columns', 'Restyle the headers to match my page'];
    return ['Restyle this to match the rest of my page', 'Tidy this up'];
  }
  const types = new Set<string>();
  walk(p.blocks, (b) => types.add(b.type));
  const out = [p.palette?.length ? 'Make the colors warmer using my palette' : 'Make a color palette from the colors I use'];
  out.push(types.has('profileCard') || types.has('facts') ? 'Write a short intro from my profile' : 'Add an about-me section');
  out.push(types.has('gallery') ? 'Add a currently section that matches my style' : 'Add a favorites section that matches my style');
  return out;
}

export function AIBar() {
  const open = useEditor((s) => s.ui.aiOpen);
  const enabled = useAI((s) => s.enabled);
  return open && enabled ? <AIBarInner /> : null;
}

function AIBarInner() {
  const project = useEditor((s) => s.project);
  const selectedId = useEditor((s) => s.selectedId);
  const { setUI, undo, toast } = useEditor.getState();
  const hasKey = useAI((s) => !!s.key.trim());
  const [text, setText] = useState('');
  const [wholePage, setWholePage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<(EditResult & { instruction: string }) | null>(null);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const block = selectedId ? findBlock(project.blocks, selectedId) : null;
  const scoped = !!block && !wholePage;
  const label = block ? block.name || getDef(block.type)?.label || 'block' : '';
  const ideas = useMemo(() => suggestions(project, scoped ? block : null), [project, scoped, block]);

  useEffect(() => { setWholePage(false); }, [selectedId]);
  useEffect(() => () => abort.current?.abort(), []);

  const close = () => { abort.current?.abort(); setUI({ aiOpen: false }); };

  const run = async (instruction: string) => {
    if (!instruction.trim() || busy) return;
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      const r = await runEdit(instruction.trim(), scoped ? block!.id : null, abort.current.signal);
      setRes({ ...r, instruction: instruction.trim() });
      setText('');
    } catch (e) {
      if ((e as AIError).kind !== 'abort') setError((e as Error).message);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  };

  /** Undo only our own change; if the page was edited since, leave history alone. */
  const undoOurs = () => {
    if (!res?.result) return true;
    if (useEditor.getState().project !== res.result) { toast(`The page changed since. Use ${kbd('mod', 'Z')} to step back`); return false; }
    undo();
    return true;
  };

  const skippedCount = (res?.report.skipped.length ?? 0) + (res?.report.notes.length ?? 0);

  return (
    <div className={clsx('ai-bar', busy && 'thinking')} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); close(); } }}>
      {!hasKey ? (
        <>
          <button className="icon-btn ai-close" onClick={close} title="Close"><X size={13} /></button>
          <KeySetup compact />
        </>
      ) : (
        <>
          {res && (
            <div className="ai-review">
              <span className={clsx('ai-review-icon', !res.result && 'muted')}>{res.result ? <Check size={12} /> : <Info size={12} />}</span>
              <div className="ai-review-text">
                <strong>{res.result ? describeReport(res.report) : 'No changes made'}</strong>
                {res.summary && <span>{res.summary}</span>}
                {skippedCount > 0 && (
                  <details>
                    <summary>{skippedCount} thing{skippedCount === 1 ? '' : 's'} skipped or need attention</summary>
                    <ul>{[...res.report.notes, ...res.report.skipped].map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </details>
                )}
              </div>
              <div className="ai-review-actions">
                <button className="btn subtle" onClick={() => { if (undoOurs()) run(res.instruction); }}>Try again</button>
                {res.result && <button className="btn" onClick={() => { if (undoOurs()) setRes(null); }}>Undo</button>}
                <button className="btn primary" onClick={() => setRes(null)}>{res.result ? 'Keep' : 'OK'}</button>
              </div>
            </div>
          )}
          {error && <div className="ai-error"><Info size={12} /> {error}</div>}
          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); run(text); }}>
            <Sparkles size={15} className="ai-spark" />
            {block && (
              <button type="button" className={clsx('ai-scope', scoped && 'on')} title={scoped ? 'Only this block. Click to ask about the whole page' : 'Whole page. Click to ask about the selected block'} onClick={() => setWholePage(!wholePage)}>
                {scoped ? label : 'Whole page'}
              </button>
            )}
            <input
              ref={input}
              value={text}
              autoFocus
              disabled={busy}
              placeholder={busy ? 'Working on it…' : scoped ? `Ask AI to change ${label}…` : 'Ask AI to change your page…'}
              onChange={(e) => setText(e.target.value)}
            />
            {busy ? (
              <button type="button" className="ai-send stop" title="Stop" onClick={() => abort.current?.abort()}><Square size={10} fill="currentColor" /></button>
            ) : (
              <button type="submit" className="ai-send" disabled={!text.trim()} title="Send (Return)"><ArrowUp size={14} /></button>
            )}
            <button type="button" className="icon-btn" title="AI settings" onClick={() => setUI({ aiSettingsOpen: true })}><Settings2 size={13} /></button>
            <button type="button" className="icon-btn" title="Close (Esc)" onClick={close}><X size={13} /></button>
          </form>
          {!busy && !res && !text && (
            <div className="ai-suggest">
              {ideas.map((s) => <button key={s} type="button" onClick={() => run(s)}>{s}</button>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
