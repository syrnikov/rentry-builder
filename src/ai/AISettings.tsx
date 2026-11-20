import { useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { Row, Toggle } from '../editor/controls';
import { DEFAULT_MODEL, useAI } from './settings';
import { AIError, listModels } from './openai';

const SUGGESTED_MODELS = ['gpt-5-mini', 'gpt-5', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4.1'];

/** Pick a sensible model the key actually has, keeping the current choice when possible. */
function pickModel(current: string, models: string[]) {
  if (!models.length || models.includes(current)) return current;
  return models.find((m) => m === DEFAULT_MODEL) ?? models.find((m) => /^gpt-5.*mini$/.test(m)) ?? models.find((m) => /mini/.test(m)) ?? models[0];
}

/** API key entry + test. Used inline (first run) and in the settings sheet. */
export function KeySetup({ compact, onSaved }: { compact?: boolean; onSaved?: () => void }) {
  const ai = useAI();
  const [key, setKey] = useState(ai.key);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' });

  const save = async () => {
    const k = key.trim();
    if (!k) return;
    setStatus({ kind: 'busy' });
    try {
      const models = await listModels(k);
      ai.update({ key: k, models, model: pickModel(ai.model, models) });
      setStatus({ kind: 'ok', msg: `Connected · ${models.length} models available` });
      onSaved?.();
    } catch (e) {
      const err = e as AIError;
      if (err.kind === 'network') {
        // Offline right now: keep the key, it will be checked on first use.
        ai.update({ key: k });
        setStatus({ kind: 'ok', msg: 'Saved. Couldn’t reach OpenAI to check it right now.' });
        onSaved?.();
      } else setStatus({ kind: 'err', msg: err.message });
    }
  };

  return (
    <div className={compact ? 'ai-setup compact' : 'ai-setup'}>
      {compact && (
        <div className="ai-setup-head">
          <KeyRound size={14} />
          <span><strong>Connect your OpenAI account</strong><small>AI tools use your own API key. It stays in this browser.</small></span>
        </div>
      )}
      <div className="ai-key-row">
        <input
          className="field"
          type={show ? 'text' : 'password'}
          placeholder="sk-…"
          value={key}
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          onChange={(e) => { setKey(e.target.value); setStatus({ kind: 'idle' }); }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          autoFocus={compact}
        />
        <button type="button" className="icon-btn" title={show ? 'Hide key' : 'Show key'} onClick={() => setShow(!show)}>{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>
        <button type="button" className="btn primary" disabled={!key.trim() || status.kind === 'busy'} onClick={save}>
          {status.kind === 'busy' ? <Loader2 size={12} className="spin" /> : null} {ai.key && key.trim() === ai.key ? 'Test' : 'Save'}
        </button>
      </div>
      {status.msg && <div className={`ai-status ${status.kind}`}>{status.kind === 'ok' && <Check size={11} />} {status.msg}</div>}
      <div className="hint">
        Create a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a>. Usage is billed to your OpenAI account.
      </div>
    </div>
  );
}

export function AISettingsSheet() {
  const ai = useAI();
  const setUI = useEditor((s) => s.setUI);
  const close = () => setUI({ aiSettingsOpen: false });
  const models = Array.from(new Set([...ai.models, ...SUGGESTED_MODELS]));
  return (
    <div className="sheet-backdrop" onMouseDown={close}>
      <div className="sheet small" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>AI tools</h2>
          <button className="icon-btn" onClick={close}><X size={15} /></button>
        </div>
        <div className="sheet-body single">
          <Row label="Show AI tools"><Toggle checked={ai.enabled} onChange={(enabled) => ai.update({ enabled })} /></Row>
          <div className="mini-label">OpenAI API key</div>
          <KeySetup />
          <Row label="Model">
            <input className="field" list="ai-models" value={ai.model} spellCheck={false} onChange={(e) => ai.update({ model: e.target.value })} onBlur={(e) => { if (!e.target.value.trim()) ai.update({ model: DEFAULT_MODEL }); }} />
            <datalist id="ai-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          </Row>
          <div className="hint">{DEFAULT_MODEL} is fast and inexpensive and works well here. Larger models are slower but better at big layout changes.</div>
          <div className="ai-privacy">
            <strong>Privacy</strong>
            <p>Your key is stored only in this browser and is never included in project files or exports. When you use an AI tool, the page you’re editing (text, settings and image links, not uploaded images or private settings like edit codes) is sent straight to OpenAI. Nothing goes through any other server.</p>
          </div>
          {ai.key && (
            <div style={{ display: 'flex' }}>
              <button className="btn subtle danger-text" onClick={() => ai.update({ key: '', models: [] })}>Remove key from this browser</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
