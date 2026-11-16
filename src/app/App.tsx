import { useEffect } from 'react';
import { useEditor } from '../store/editorStore';
import { Toolbar } from '../editor/Toolbar';
import { LeftSidebar } from '../editor/LeftSidebar';
import { Canvas } from '../editor/Canvas';
import { BlockInspector } from '../editor/inspector/BlockInspector';
import { PageInspector } from '../editor/inspector/PageInspector';
import { ExportPanel, ImportMetaDialog } from '../editor/ExportPanel';
import { Segmented } from '../editor/controls';
import { useShortcuts } from '../editor/shortcuts';

function useAppTheme() {
  const pref = useEditor((s) => s.ui.appTheme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}

function Inspector() {
  const tab = useEditor((s) => s.ui.rightTab);
  const setUI = useEditor((s) => s.setUI);
  return (
    <aside className="inspector">
      <div className="panel-tabs">
        <Segmented value={tab} onChange={(v) => setUI({ rightTab: v as never })} options={[{ value: 'block', label: 'Block' }, { value: 'page', label: 'Page' }]} />
      </div>
      {tab === 'block' ? <BlockInspector /> : <PageInspector />}
    </aside>
  );
}

export function App() {
  useAppTheme();
  useShortcuts();
  const exportOpen = useEditor((s) => s.ui.exportOpen);
  const importOpen = useEditor((s) => s.ui.importMetaOpen);
  const toast = useEditor((s) => s.ui.toast);
  useEffect(() => {
    const clear = () => { const s = useEditor.getState(); if (s.ui.dragging) s.setUI({ dragging: null, drop: null }); };
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => { window.removeEventListener('dragend', clear); window.removeEventListener('drop', clear); };
  }, []);
  return (
    <div className="app">
      <Toolbar />
      <LeftSidebar />
      <Canvas />
      <Inspector />
      {exportOpen && <ExportPanel />}
      {importOpen && <ImportMetaDialog />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
