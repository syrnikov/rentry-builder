import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Editor } from '@tiptap/react';
import { ArrowUp, Check, ChevronLeft, Copy, Info, PenLine, RotateCcw, Sparkles } from 'lucide-react';
import { AIGlow } from './AIGlow';
import { parseRich, serializeRich } from '../rentry/richText';
import { renderRentry } from '../preview/rentryMarkdown';
import { fromPM, toPM } from '../editor/controls/pmConvert';
import { useEditor } from '../store/editorStore';
import { useAI } from './settings';
import { AIError } from './openai';
import { WRITING_ACTIONS } from './prompts';
import { runWriting } from './run';
import { KeySetup } from './AISettings';

interface Scope { from: number; to: number; whole: boolean; text: string }

/** What the tools act on: the selection, or the whole field when nothing is selected. */
function captureScope(editor: Editor): Scope {
  const { from, to, empty } = editor.state.selection;
  const size = editor.state.doc.content.size;
  const whole = empty || (from <= 1 && to >= size - 1);
  const json = whole ? editor.getJSON() : editor.state.doc.cut(from, to).toJSON();
  return { from, to, whole, text: serializeRich(fromPM(json)) };
}

/**
 * Apple-style Writing Tools for one rich-text field. The result previews visually and only replaces
 * the text when the author clicks Replace (which is a normal, undoable edit).
 */
export function WritingTools({ editor, singleLine, fieldLabel, onClose }: { editor: Editor; singleLine?: boolean; fieldLabel?: string; onClose: () => void }) {
  const hasKey = useAI((s) => !!s.key.trim());
  const scope = useMemo(() => captureScope(editor), [editor]);
  const empty = !scope.text.trim();
  const [phase, setPhase] = useState<'menu' | 'busy' | 'done'>('menu');
  const [out, setOut] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [last, setLast] = useState('');
  const abort = useRef<AbortController | null>(null);
  const lastInstruction = useRef('');

  useEffect(() => () => abort.current?.abort(), []);

  const run = async (instruction: string, label = instruction) => {
    abort.current?.abort();
    abort.current = new AbortController();
    setLast(label);
    lastInstruction.current = instruction;
    setPhase('busy');
    setError(null);
    setOut('');
    try {
      const text = await runWriting({ instruction, text: scope.text, singleLine, fieldLabel }, setOut, abort.current.signal);
      setOut(text);
      setPhase(text.trim() ? 'done' : 'menu');
      if (!text.trim()) setError('The AI returned nothing. Try again or rephrase.');
    } catch (e) {
      if ((e as AIError).kind === 'abort') return;
      setError((e as Error).message);
      setPhase('menu');
    }
  };

  const replace = () => {
    const lines = parseRich(out);
    if (scope.whole) {
      editor.chain().focus().setContent(toPM(lines), true).run();
    } else {
      const doc = toPM(lines);
      // A single line goes inline into the selection instead of splitting the paragraph.
      const content = doc.content?.length === 1 ? doc.content[0].content ?? [] : doc.content ?? [];
      editor.chain().focus().insertContentAt({ from: scope.from, to: scope.to }, content).run();
    }
    onClose();
  };

  const copy = () => {
    try { navigator.clipboard?.writeText(out); useEditor.getState().toast('Copied'); } catch { /* ignore */ }
  };

  if (!hasKey) return <KeySetup compact />;

  if (phase !== 'menu') {
    return (
      <div className="wt wt-stage" key="result">
        <div className="wt-head">
          <button type="button" className="icon-btn" title="Back" onClick={() => { abort.current?.abort(); setPhase('menu'); }}><ChevronLeft size={13} /></button>
          <span>{last.length > 48 ? `${last.slice(0, 46)}…` : last}</span>
          <Sparkles size={12} className={clsx('ai-spark', phase === 'busy' && 'working')} />
        </div>
        <div className="wt-preview-wrap">
          <AIGlow active={phase === 'busy'} surface="var(--surface-2)" />
          <div className={clsx('wt-preview', phase === 'busy' && out && 'streaming')}>
            {out ? <div className="wt-text" dangerouslySetInnerHTML={{ __html: renderRentry(out) }} /> : <div className="wt-shimmer"><i /><i /><i /></div>}
          </div>
        </div>
        <div className="wt-actions">
          <button type="button" className="btn subtle" disabled={phase === 'busy'} onClick={() => run(lastInstruction.current, last)} title="Try again"><RotateCcw size={12} /></button>
          <button type="button" className="btn subtle" disabled={!out || phase === 'busy'} onClick={copy} title="Copy as rentry markdown"><Copy size={12} /></button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn primary" disabled={phase === 'busy' || !out.trim()} onClick={replace}><Check size={12} /> {empty ? 'Insert' : 'Replace'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wt wt-stage" key="menu">
      <div className="wt-scope">
        <Sparkles size={12} />
        {empty ? 'Write this field from your page' : scope.whole ? 'Whole field' : 'Selected text'}
      </div>
      {error && <div className="ai-error"><Info size={12} /> {error}</div>}
      {empty ? (
        <div className="wt-list">
          <button type="button" onClick={() => run('Write fitting text for this field, using what the page says about the author.', 'Write from my page')}><PenLine size={13} /> Write from my page</button>
        </div>
      ) : (
        <div className="wt-grid">
          {WRITING_ACTIONS.map((a, i) => (
            <button key={a.id} type="button" style={{ '--i': i } as CSSProperties} onClick={() => run(a.instruction, a.label)}>{a.label}</button>
          ))}
        </div>
      )}
      <form className="wt-custom" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) run(custom.trim()); }}>
        <input className="field" value={custom} autoFocus placeholder={empty ? 'Describe what to write…' : 'Describe your change…'} onChange={(e) => setCustom(e.target.value)} />
        <button type="submit" className="ai-send" disabled={!custom.trim()} title="Go"><ArrowUp size={13} /></button>
      </form>
    </div>
  );
}
