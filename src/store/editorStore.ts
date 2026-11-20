import { create } from 'zustand';
import { produce } from 'immer';
import type { Block, DropTarget, Project, Props } from '../model/types';
import { cloneBlock, findBlock, insertAt, isDescendant, locate } from '../model/tree';
import { getDef } from '../blocks/registry';
import { TEMPLATES } from '../templates';
import { migrateProject } from '../model/migrate';
import { PaletteColor, replaceColor } from '../model/palette';

export type DragPayload = { kind: 'new'; presetId: string } | { kind: 'move'; id: string };

export interface UIState {
  zoom: number;
  device: 'desktop' | 'mobile';
  previewDark: boolean;
  appTheme: 'system' | 'light' | 'dark';
  leftTab: 'layers' | 'insert' | 'templates';
  rightTab: 'block' | 'page';
  exportOpen: boolean;
  importMetaOpen: boolean;
  drop: DropTarget | null;
  dragging: DragPayload | null;
  editingId: string | null;
  toast: string | null;
  focusMetaKey: string | null;
  /** Editing a palette color also updates every use of it on the page. */
  paletteLink: boolean;
  /** AI: command bar, settings sheet, new-page dialog, blocks glowing after an AI change. */
  aiOpen: boolean;
  aiSettingsOpen: boolean;
  aiNewPageOpen: boolean;
  aiFlash: string[];
}

interface Store {
  project: Project;
  selectedId: string | null;
  hoverId: string | null;
  past: Project[];
  future: Project[];
  lastKey: string | null;
  lastTime: number;
  clipboard: Block | null;
  ui: UIState;

  commit: (recipe: (p: Project) => void, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setUI: (patch: Partial<UIState>) => void;
  toast: (msg: string) => void;

  addBlock: (block: Block, target?: DropTarget) => void;
  moveBlock: (id: string, target: DropTarget) => void;
  removeBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  updateProps: (id: string, patch: Props, coalesceKey?: string) => void;
  updateBlock: (id: string, recipe: (b: Block) => void, coalesceKey?: string) => void;
  moveBy: (id: string, delta: number) => void;
  setMeta: (key: string, values: string[] | undefined, coalesceKey?: string) => void;
  replaceMeta: (meta: Project['meta']) => void;
  mergeMeta: (meta: Project['meta']) => void;
  loadProject: (p: Project) => void;
  renameProject: (name: string) => void;
  copy: () => void;
  paste: () => void;

  addPaletteColors: (values: string[]) => void;
  updatePaletteColor: (i: number, patch: Partial<PaletteColor>) => void;
  removePaletteColor: (i: number) => void;
  movePaletteColor: (from: number, to: number) => void;
}

const STORAGE_KEY = 'rentry-builder:project:v1';
const UI_KEY = 'rentry-builder:ui:v1';
const HISTORY_LIMIT = 200;

function loadInitial(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrateProject(JSON.parse(raw));
  } catch { /* ignore */ }
  return TEMPLATES[0].make();
}

function loadUI(): Partial<UIState> {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const u = JSON.parse(raw);
      const out: Partial<UIState> = { zoom: u.zoom, device: u.device, previewDark: u.previewDark, appTheme: u.appTheme, leftTab: u.leftTab };
      if (typeof u.paletteLink === 'boolean') out.paletteLink = u.paletteLink;
      return out;
    }
  } catch { /* ignore */ }
  return {};
}

/** Can `block` be dropped into the slot described by `target`? */
export function canDrop(blocks: Block[], block: Block, target: DropTarget): boolean {
  if (target.parentId === null) return true;
  if (target.parentId === block.id || isDescendant(block, target.parentId)) return false;
  const parent = findBlock(blocks, target.parentId);
  const pd = parent && getDef(parent.type);
  const cd = getDef(block.type);
  if (!pd?.container || !cd) return false;
  if (cd.container && pd.type === 'columns') return false;
  return pd.container.accepts(cd);
}

/** Default insertion point: after the selection, or inside a selected container. */
export function defaultTarget(blocks: Block[], selectedId: string | null, block?: Block): DropTarget {
  if (selectedId) {
    const loc = locate(blocks, selectedId);
    if (loc) {
      const def = getDef(loc.block.type);
      if (def?.container && block) {
        const t = { parentId: loc.block.id, slot: 0, index: loc.block.children?.[0]?.length ?? 0 };
        if (canDrop(blocks, block, t)) return t;
      }
      const t = { parentId: loc.parentId, slot: loc.slot, index: loc.index + 1 };
      if (!block || canDrop(blocks, block, t)) return t;
    }
  }
  return { parentId: null, slot: 0, index: blocks.length };
}

const initialUI: UIState = {
  zoom: 1,
  device: 'desktop',
  previewDark: false,
  appTheme: 'system',
  leftTab: 'layers',
  rightTab: 'page',
  exportOpen: false,
  importMetaOpen: false,
  drop: null,
  dragging: null,
  editingId: null,
  toast: null,
  focusMetaKey: null,
  paletteLink: true,
  aiOpen: false,
  aiSettingsOpen: false,
  aiNewPageOpen: false,
  aiFlash: [],
  ...loadUI(),
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useEditor = create<Store>((set, get) => ({
  project: loadInitial(),
  selectedId: null,
  hoverId: null,
  past: [],
  future: [],
  lastKey: null,
  lastTime: 0,
  clipboard: null,
  ui: initialUI,

  commit: (recipe, coalesceKey) => {
    const { project, past, lastKey, lastTime } = get();
    const next = produce(project, recipe);
    if (next === project) return;
    const now = Date.now();
    const coalesce = !!coalesceKey && coalesceKey === lastKey && now - lastTime < 1200;
    set({
      project: next,
      past: coalesce ? past : [...past, project].slice(-HISTORY_LIMIT),
      future: [],
      lastKey: coalesceKey ?? null,
      lastTime: now,
    });
  },

  undo: () => {
    const { past, project, future, selectedId } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({
      project: prev,
      past: past.slice(0, -1),
      future: [project, ...future],
      lastKey: null,
      selectedId: selectedId && findBlock(prev.blocks, selectedId) ? selectedId : null,
    });
  },

  redo: () => {
    const { past, project, future, selectedId } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      project: next,
      past: [...past, project],
      future: future.slice(1),
      lastKey: null,
      selectedId: selectedId && findBlock(next.blocks, selectedId) ? selectedId : null,
    });
  },

  select: (id) => set((s) => ({ selectedId: id, ui: { ...s.ui, rightTab: id ? 'block' : 'page', editingId: s.ui.editingId === id ? id : null } })),
  hover: (id) => { if (get().hoverId !== id) set({ hoverId: id }); },
  setUI: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
  toast: (msg) => {
    clearTimeout(toastTimer);
    set((s) => ({ ui: { ...s.ui, toast: msg } }));
    toastTimer = setTimeout(() => set((s) => ({ ui: { ...s.ui, toast: null } })), 1800);
  },

  addBlock: (block, target) => {
    const { project, selectedId } = get();
    const t = target ?? defaultTarget(project.blocks, selectedId, block);
    if (!canDrop(project.blocks, block, t)) {
      get().toast(`${getDef(block.type)?.label ?? 'Block'} can't go there`);
      return;
    }
    get().commit((p) => { insertAt(p.blocks, t, block); });
    get().select(block.id);
  },

  moveBlock: (id, target) => {
    const { project } = get();
    const loc = locate(project.blocks, id);
    if (!loc || loc.block.locked) return;
    if (!canDrop(project.blocks, loc.block, target)) {
      get().toast(`${getDef(loc.block.type)?.label ?? 'Block'} can't go there`);
      return;
    }
    get().commit((p) => {
      const l = locate(p.blocks, id)!;
      const [b] = l.list.splice(l.index, 1);
      let index = target.index;
      // Removing from the same list before the target shifts the index.
      if (l.parentId === target.parentId && l.slot === target.slot && l.index < index) index--;
      insertAt(p.blocks, { ...target, index }, b);
    });
  },

  removeBlock: (id) => {
    const { project } = get();
    const loc = locate(project.blocks, id);
    if (!loc || loc.block.locked) return;
    get().commit((p) => {
      const l = locate(p.blocks, id)!;
      l.list.splice(l.index, 1);
    });
    // Select a neighbour so keyboard deleting keeps flowing.
    const after = get().project.blocks;
    const neighbour = loc.list[loc.index + 1]?.id ?? loc.list[loc.index - 1]?.id ?? loc.parentId;
    set({ selectedId: neighbour && findBlock(after, neighbour) ? neighbour : null });
  },

  duplicateBlock: (id) => {
    const loc = locate(get().project.blocks, id);
    if (!loc) return;
    const copy = cloneBlock(loc.block);
    copy.locked = false;
    get().commit((p) => { insertAt(p.blocks, { parentId: loc.parentId, slot: loc.slot, index: loc.index + 1 }, copy); });
    get().select(copy.id);
  },

  updateProps: (id, patch, coalesceKey) => {
    get().commit((p) => {
      const b = findBlock(p.blocks, id);
      if (!b) return;
      Object.assign(b.props, patch);
      const def = getDef(b.type);
      if (def?.container && b.children) {
        const n = def.container.slotCount(b);
        while (b.children.length < n) b.children.push([]);
      }
    }, coalesceKey);
  },

  updateBlock: (id, recipe, coalesceKey) => {
    get().commit((p) => {
      const b = findBlock(p.blocks, id);
      if (b) recipe(b);
    }, coalesceKey);
  },

  moveBy: (id, delta) => {
    const loc = locate(get().project.blocks, id);
    if (!loc) return;
    const index = loc.index + delta;
    if (index < 0 || index >= loc.list.length) return;
    get().moveBlock(id, { parentId: loc.parentId, slot: loc.slot, index: delta > 0 ? index + 1 : index });
  },

  setMeta: (key, values, coalesceKey) => {
    get().commit((p) => {
      const clean = values?.some((v) => v.trim()) ? values : undefined;
      if (clean) p.meta[key] = clean;
      else delete p.meta[key];
    }, coalesceKey);
  },

  replaceMeta: (meta) => get().commit((p) => { p.meta = meta; }),
  mergeMeta: (meta) => get().commit((p) => { Object.assign(p.meta, meta); }),

  loadProject: (proj) => {
    set({ project: migrateProject(proj), past: [...get().past, get().project].slice(-HISTORY_LIMIT), future: [], selectedId: null, lastKey: null });
  },

  renameProject: (name) => get().commit((p) => { p.name = name; }, 'project-name'),

  copy: () => {
    const { selectedId, project } = get();
    const b = findBlock(project.blocks, selectedId);
    if (!b) return;
    set({ clipboard: structuredClone(b) });
    try { navigator.clipboard?.writeText(JSON.stringify({ rentryBuilderBlock: b })); } catch { /* ignore */ }
    get().toast('Copied block');
  },

  paste: () => {
    const { clipboard } = get();
    if (!clipboard) return;
    get().addBlock(cloneBlock(clipboard));
  },

  addPaletteColors: (values) => {
    get().commit((p) => {
      p.palette ??= [];
      for (const v of values) {
        const value = v.trim();
        if (value && !p.palette.some((c) => c.value.toLowerCase() === value.toLowerCase())) p.palette.push({ value, name: '' });
      }
    });
  },

  updatePaletteColor: (i, patch) => {
    const link = get().ui.paletteLink;
    get().commit((p) => {
      const c = p.palette?.[i];
      if (!c) return;
      if (patch.value !== undefined && link && c.value) replaceColor(p, c.value, patch.value);
      Object.assign(c, patch);
    }, `palette:${i}:${patch.value !== undefined ? 'value' : 'name'}`);
  },

  removePaletteColor: (i) => get().commit((p) => { p.palette?.splice(i, 1); }),

  movePaletteColor: (from, to) => get().commit((p) => {
    if (!p.palette) return;
    const [c] = p.palette.splice(from, 1);
    p.palette.splice(from < to ? to - 1 : to, 0, c);
  }),
}));

// ───────── autosave
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useEditor.subscribe((s, prev) => {
  if (s.project !== prev.project) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s.project)); } catch { /* quota */ }
    }, 400);
  }
  if (s.ui !== prev.ui) {
    try {
      const { zoom, device, previewDark, appTheme, leftTab, paletteLink } = s.ui;
      localStorage.setItem(UI_KEY, JSON.stringify({ zoom, device, previewDark, appTheme, leftTab, paletteLink }));
    } catch { /* ignore */ }
  }
});
