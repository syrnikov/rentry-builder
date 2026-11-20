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
import { openProjectFromFile } from '../editor/Toolbar';
import { AISettingsSheet } from '../ai/AISettings';
import { NewPageDialog } from '../ai/NewPageDialog';

function useAppTheme() {
  const pref = useEditor((s) => s.ui.appTheme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && mq.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      // Title bar of the installed app (Safari "Add to Dock") follows the app's own light/dark choice.
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#2a2a2a' : '#f6f6f6'));
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

/** Window title shows the project, like a native document app. */
function useWindowTitle() {
  const name = useEditor((s) => s.project.name);
  useEffect(() => { document.title = name?.trim() ? `${name.trim()} — Rentry Builder` : 'Rentry Builder'; }, [name]);
}

/** Open project files dropped anywhere on the window, or handed over by the OS ("Open with" on installed Chrome/Edge apps). */
function useFileOpening() {
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const over = (e: DragEvent) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; } };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const f = [...(e.dataTransfer?.files ?? [])].find((x) => /\.json$/i.test(x.name));
      if (f) openProjectFromFile(f);
      else useEditor.getState().toast('Drop a .rentrybuilder.json project file to open it');
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    type LaunchParams = { files: { getFile(): Promise<File> }[] };
    const lq = (window as Window & { launchQueue?: { setConsumer(cb: (p: LaunchParams) => void): void } }).launchQueue;
    lq?.setConsumer(async (p) => { if (p.files[0]) openProjectFromFile(await p.files[0].getFile()); });
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('drop', drop); };
  }, []);
}

export function App() {
  useAppTheme();
  useShortcuts();
  useWindowTitle();
  useFileOpening();
  const exportOpen = useEditor((s) => s.ui.exportOpen);
  const importOpen = useEditor((s) => s.ui.importMetaOpen);
  const toast = useEditor((s) => s.ui.toast);
  const aiSettingsOpen = useEditor((s) => s.ui.aiSettingsOpen);
  const aiNewPageOpen = useEditor((s) => s.ui.aiNewPageOpen);
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
      {aiSettingsOpen && <AISettingsSheet />}
      {aiNewPageOpen && <NewPageDialog />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
