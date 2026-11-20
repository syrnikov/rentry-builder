import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Info, Save, Sparkles, X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { saveProjectFile } from '../editor/Toolbar';
import { kbd } from '../app/platform';
import { useAI } from './settings';
import { AIError } from './openai';
import { AIStatus, runNewPage } from './run';
import { AIGlow } from './AIGlow';
import { KeySetup } from './AISettings';

const IDEAS = ['My art commissions: prices, process and terms', 'A fandom page for my favorite series', 'A carrd-style links and socials hub', 'My OC / character profile'];

/** New page in this style: the theme is copied exactly; the AI lays out blocks for the new topic. */
export function NewPageDialog() {
  const setUI = useEditor((s) => s.setUI);
  const name = useEditor((s) => s.project.name);
  const hasKey = useAI((s) => !!s.key.trim());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<AIStatus>('thinking');
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const close = () => { abort.current?.abort(); setUI({ aiNewPageOpen: false }); };

  const create = async () => {
    if (!text.trim() || busy) return;
    abort.current = new AbortController();
    setBusy(true);
    setError(null);
    try {
      setStatus('thinking');
      const r = await runNewPage(text.trim(), abort.current.signal, setStatus);
      setUI({ aiNewPageOpen: false, leftTab: 'layers' });
      const extra = r.skipped.length ? ` · ${r.skipped.length} invalid part${r.skipped.length === 1 ? '' : 's'} left out` : '';
      useEditor.getState().toast(`Created “${r.name}”${extra} · ${kbd('mod', 'Z')} brings back “${name}”`);
    } catch (e) {
      if ((e as AIError).kind !== 'abort') setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onMouseDown={() => { if (!busy) close(); }}>
      <div className={clsx('sheet small', busy && 'ai-glow-sheet')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <Sparkles size={14} className="ai-spark" />
          <h2>New page in this style</h2>
          <button className="icon-btn" onClick={close}><X size={15} /></button>
        </div>
        <div className="sheet-body single">
          {!hasKey ? <KeySetup compact /> : (
            <>
              <div className="hint">Keeps the theme, fonts, colors and palette of <strong>{name}</strong>. AI lays out the blocks for the new topic, reusing facts from your page. Anything it doesn’t know becomes a [placeholder].</div>
              <textarea
                className="field"
                rows={3}
                style={{ minHeight: 72, resize: 'vertical' }}
                autoFocus
                disabled={busy}
                value={text}
                placeholder="What is the new page about?"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create(); }}
              />
              {!text && (
                <div className="ai-suggest left">
                  {IDEAS.map((i) => <button key={i} type="button" onClick={() => setText(i)}>{i}</button>)}
                </div>
              )}
              {error && <div className="ai-error"><Info size={12} /> {error}</div>}
              <div className="code-meta">
                <button className="btn subtle" onClick={saveProjectFile} title="Download the current page as a project file first"><Save size={12} /> Save current page</button>
                <span className="spacer" />
                {busy
                  ? <span className="ai-status-row"><Sparkles size={12} className="ai-spark working" /><span key={status} className="ai-shine">{status === 'style' ? 'Studying your style…' : 'Designing your page…'}</span></span>
                  : <span className="hint">Replaces the current page ({kbd('mod', 'Z')} undoes)</span>}
                <span className="ai-btn-wrap">
                  <AIGlow active={busy} variant="soft" />
                  <button className="btn primary" disabled={!text.trim() || busy} onClick={create}>Create page</button>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
