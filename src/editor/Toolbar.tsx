import { FilePlus2, FolderOpen, Sparkles, WandSparkles, Monitor, Moon, MoreHorizontal, PanelsTopLeft, Redo2, Save, Share, Smartphone, Sun, SunMoon, Undo2 } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { Popover, Segmented, usePopover } from './controls';
import { downloadText, migrateProject, pickFile, PROJECT_EXT, slugName } from '../model/migrate';
import { blankProject } from '../templates';
import { kbd } from '../app/platform';
import { useAI } from '../ai/settings';

export function saveProjectFile() {
  const p = useEditor.getState().project;
  downloadText(`${slugName(p.name)}${PROJECT_EXT}`, JSON.stringify(p, null, 2), 'application/json');
}

export async function openProjectFile() {
  const f = await pickFile('.json,application/json');
  if (f) await openProjectFromFile(f);
}

/** Load a .rentrybuilder.json file (from the picker, a drop onto the window, or the OS "Open with"). */
export async function openProjectFromFile(f: File) {
  try {
    const p = migrateProject(JSON.parse(await f.text()));
    useEditor.getState().loadProject(p);
    useEditor.getState().toast(`Opened “${p.name}” · ${kbd("mod", "Z")} to go back`);
  } catch (e) {
    useEditor.getState().toast(`Couldn't open file: ${(e as Error).message}`);
  }
}

export function Toolbar() {
  const name = useEditor((s) => s.project.name);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const { device, previewDark, appTheme } = useEditor((s) => s.ui);
  const recommended = useEditor((s) => s.project.meta.ACCESS_RECOMMENDED_THEME?.[0]);
  const { undo, redo, setUI, renameProject, loadProject, toast } = useEditor.getState();
  const menu = usePopover();
  const aiEnabled = useAI((s) => s.enabled);
  const aiOpen = useEditor((s) => s.ui.aiOpen);

  const nextTheme = { system: 'light', light: 'dark', dark: 'system' } as const;

  return (
    <header className="toolbar">
      <div className="tb-left">
        <span className="app-icon"><PanelsTopLeft size={15} /></span>
        <div className="app-title">
          <strong>Rentry Builder</strong>
          <input value={name} onChange={(e) => renameProject(e.target.value)} title="Rename project" spellCheck={false} />
        </div>
        <button className="tb-btn" title={`Undo (${kbd("mod", "Z")})`} disabled={!canUndo} onClick={undo}><Undo2 size={16} /></button>
        <button className="tb-btn" title={`Redo (${kbd("mod", "shift", "Z")})`} disabled={!canRedo} onClick={redo}><Redo2 size={16} /></button>
      </div>
      <div className="tb-center">
        <Segmented
          full={false}
          value={device}
          onChange={(v) => setUI({ device: v as never })}
          options={[{ value: 'desktop', label: 'Desktop', icon: Monitor }, { value: 'mobile', label: 'Mobile', icon: Smartphone }]}
        />
        <Segmented
          full={false}
          value={previewDark ? 'dark' : 'light'}
          onChange={(v) => setUI({ previewDark: v === 'dark' })}
          options={[{ value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }]}
        />
        {recommended && <span className="recommend-badge" title="ACCESS_RECOMMENDED_THEME is set">Viewers get {recommended}</span>}
      </div>
      <div className="tb-right">
        {aiEnabled && (
          <button className={`tb-btn ai-tint ${aiOpen ? 'on' : ''}`} title={`Ask AI (${kbd('mod', 'J')})`} onClick={() => setUI({ aiOpen: !aiOpen })}><Sparkles size={16} /></button>
        )}
        <button className="tb-btn" title={`Appearance: ${appTheme}`} onClick={() => setUI({ appTheme: nextTheme[appTheme] })}>
          {appTheme === 'system' ? <SunMoon size={16} /> : appTheme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
        <button ref={menu.ref} className="tb-btn" title="Project" onClick={menu.toggle}><MoreHorizontal size={17} /></button>
        <Popover anchor={menu.ref} open={menu.open} onClose={menu.close} width={232} align="end">
          <div className="menu" style={{ margin: -10 }}>
            <button onClick={() => { loadProject(blankProject()); toast(`New blank page · ${kbd("mod", "Z")} to go back`); menu.close(); }}><FilePlus2 size={14} /> New blank page</button>
            <hr />
            <button onClick={() => { openProjectFile(); menu.close(); }}><FolderOpen size={14} /> Open project…<span className="kbd">{kbd("mod", "O")}</span></button>
            <button onClick={() => { saveProjectFile(); menu.close(); }}><Save size={14} /> Save project file<span className="kbd">{kbd("mod", "S")}</span></button>
            <hr />
            <button onClick={() => { setUI({ exportOpen: true }); menu.close(); }}><Share size={14} /> Export…<span className="kbd">{kbd("mod", "E")}</span></button>
            <hr />
            {aiEnabled && <button onClick={() => { setUI({ aiNewPageOpen: true }); menu.close(); }}><WandSparkles size={14} /> New page in this style…</button>}
            <button onClick={() => { setUI({ aiSettingsOpen: true }); menu.close(); }}><Sparkles size={14} /> AI settings…</button>
          </div>
        </Popover>
        <div className="divider" />
        <button className="btn primary big" onClick={() => setUI({ exportOpen: true })} title={`Export (${kbd("mod", "E")})`}>Export</button>
      </div>
    </header>
  );
}
