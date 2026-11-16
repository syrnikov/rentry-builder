import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, Download, X } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { compileProject } from '../compiler/compile';
import { META_BY_KEY } from '../rentry/metadataSchema';
import { parseMetadata } from '../rentry/serializeMetadata';
import { downloadText, slugName } from '../model/migrate';
import { findBlock } from '../model/tree';
import { getDef } from '../blocks/registry';
import { Segmented } from './controls';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
  };
  return { copied, copy };
}

export function ExportPanel() {
  const project = useEditor((s) => s.project);
  const { setUI, select } = useEditor.getState();
  const [tab, setTab] = useState<'markdown' | 'metadata'>('markdown');
  const result = useMemo(() => compileProject(project), [project]);
  const { copied, copy } = useCopy();
  const close = () => setUI({ exportOpen: false });
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const text = tab === 'markdown' ? result.markdown : result.metadata;
  const errors = [...result.metaIssues, ...result.blockIssues].filter((i) => i.severity === 'error').length;
  const allIssues = [
    ...result.metaIssues.map((i) => ({ ...i, label: META_BY_KEY[i.key]?.label ?? i.key, code: i.key, go: () => { close(); select(null); setUI({ rightTab: 'page', focusMetaKey: i.key }); } })),
    ...result.blockIssues.map((i) => {
      const b = findBlock(project.blocks, i.blockId);
      return { ...i, label: b ? b.name || getDef(b.type)?.label || b.type : 'Block', code: 'block', go: () => { close(); select(i.blockId); } };
    }),
  ];

  return (
    <div className="sheet-backdrop" onMouseDown={close}>
      <div className="sheet" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Export to rentry</h2>
          <button className="btn subtle" onClick={() => downloadText(`${slugName(project.name)}.md`, result.markdown)}><Download size={13} /> Markdown</button>
          <button className="btn subtle" onClick={() => downloadText(`${slugName(project.name)}-metadata.txt`, result.metadata)}><Download size={13} /> Metadata</button>
          <button className="btn" onClick={close} title="Close (Esc)">Done</button>
        </div>
        <div className="sheet-body">
          <div className="sheet-main">
            <Segmented value={tab} onChange={(v) => setTab(v as never)} options={[{ value: 'markdown', label: 'Markdown' }, { value: 'metadata', label: 'Metadata' }]} />
            <textarea className="code-box" readOnly value={text || (tab === 'metadata' ? '# No metadata set: rentry will use its defaults.' : '')} spellCheck={false} onFocus={(e) => e.currentTarget.select()} />
            <div className="code-meta">
              <span>{text.length.toLocaleString()} characters · {text ? text.split('\n').length : 0} lines</span>
              <span className="spacer" />
              <button className="btn primary big" onClick={() => copy(tab, text)} disabled={!text}>
                {copied === tab ? <Check size={14} /> : <Copy size={14} />}
                {copied === tab ? 'Copied!' : `Copy ${tab}`}
              </button>
            </div>
          </div>
          <div className="sheet-side">
            <div>
              <div className="side-title">How to publish</div>
              <ol className="steps">
                <li>Open <b>rentry.co</b> (or your page's edit view).</li>
                <li>Paste the <b>Markdown</b> into the <b>Text</b> tab.</li>
                <li>Switch to the <b>Metadata</b> tab and paste the <b>Metadata</b>.</li>
                <li>Use <b>Preview</b> to check it, then save. Keep your edit code safe!</li>
              </ol>
            </div>
            <div>
              <div className="side-title">Quick copy</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button className="btn" onClick={() => copy('m', result.markdown)}>{copied === 'm' ? <Check size={13} /> : <Copy size={13} />} Copy markdown</button>
                <button className="btn" disabled={!result.metadata} onClick={() => copy('d', result.metadata)}>{copied === 'd' ? <Check size={13} /> : <Copy size={13} />} Copy metadata</button>
              </div>
            </div>
            <div>
              <div className="side-title">Checks</div>
              {allIssues.length === 0 ? (
                <div className="status-line ok" style={{ margin: 0 }}><CheckCircle2 size={13} /> Everything looks valid</div>
              ) : (
                <div className="issue-list">
                  {errors > 0 && <div className="status-line bad" style={{ margin: '0 0 6px' }}><AlertTriangle size={13} /> Rentry will reject metadata with errors</div>}
                  {allIssues.map((i, n) => (
                    <button key={n} className="issue-item" onClick={i.go}>
                      <AlertTriangle size={13} color={i.severity === 'error' ? 'var(--danger)' : 'var(--warning)'} />
                      <span><b>{i.label}</b> {i.message}{i.code !== 'block' && <code>{i.code}</code>}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImportMetaDialog() {
  const { setUI, replaceMeta, mergeMeta, toast } = useEditor.getState();
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseMetadata(text), [text]);
  const count = Object.keys(parsed.meta).length;
  const close = () => setUI({ importMetaOpen: false });
  return (
    <div className="sheet-backdrop" onMouseDown={close}>
      <div className="sheet small" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Paste existing metadata</h2>
          <button className="icon-btn" onClick={close}><X size={15} /></button>
        </div>
        <div className="sheet-body single">
          <div className="hint">Paste the contents of a rentry page's Metadata tab. Each line looks like <code>OPTION = value</code>.</div>
          <textarea className="code-box" style={{ minHeight: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'CONTENT_FONT = Caveat\nCONTAINER_MAX_WIDTH = 600px'} autoFocus spellCheck={false} />
          {parsed.errors.length > 0 && (
            <div className="issue-list">
              {parsed.errors.map((e, i) => <div key={i} className="issue"><AlertTriangle size={11} /> Line {e.line}: {e.message}</div>)}
            </div>
          )}
          <div className="code-meta">
            <span>{count} option{count === 1 ? '' : 's'} recognised</span>
            <span className="spacer" />
            <button className="btn" disabled={!count} onClick={() => { mergeMeta(parsed.meta); toast(`Merged ${count} options`); close(); }}>Merge</button>
            <button className="btn primary" disabled={!count} onClick={() => { replaceMeta(parsed.meta); toast(`Replaced metadata (${count} options)`); close(); }}>Replace all</button>
          </div>
        </div>
      </div>
    </div>
  );
}
