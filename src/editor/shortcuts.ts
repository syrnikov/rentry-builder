import { useEffect } from 'react';
import { useEditor } from '../store/editorStore';
import { locate } from '../model/tree';
import { openProjectFile, saveProjectFile } from './Toolbar';
import { useAI } from '../ai/settings';

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useEditor.getState();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      // Global, even while typing
      if (mod && k === 's') { e.preventDefault(); saveProjectFile(); return; }
      if (mod && k === 'o') { e.preventDefault(); openProjectFile(); return; }
      if (mod && k === 'e') { e.preventDefault(); s.setUI({ exportOpen: !s.ui.exportOpen }); return; }
      if (mod && k === 'j' && useAI.getState().enabled) { e.preventDefault(); s.setUI({ aiOpen: !s.ui.aiOpen }); return; }
      if (isTyping(e.target)) return;

      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); s.redo(); return; }
      if (mod && (k === '=' || k === '+')) { e.preventDefault(); s.setUI({ zoom: Math.min(3, s.ui.zoom * 1.2) }); return; }
      if (mod && k === '-') { e.preventDefault(); s.setUI({ zoom: Math.max(0.25, s.ui.zoom / 1.2) }); return; }
      if (mod && k === '0') { e.preventDefault(); s.setUI({ zoom: 1 }); return; }
      if (mod && k === 'v') { if (s.clipboard) { e.preventDefault(); s.paste(); } return; }
      if (k === 'escape') {
        if (s.ui.editingId) s.setUI({ editingId: null });
        else s.select(null);
        return;
      }
      const id = s.selectedId;
      if (!id) return;
      if (mod && k === 'c') { e.preventDefault(); s.copy(); return; }
      if (mod && k === 'x') { e.preventDefault(); s.copy(); s.removeBlock(id); return; }
      if (mod && k === 'd') { e.preventDefault(); s.duplicateBlock(id); return; }
      if (k === 'delete' || k === 'backspace') { e.preventDefault(); s.removeBlock(id); return; }
      if (k === 'enter') { e.preventDefault(); s.setUI({ editingId: id }); return; }
      if (k === 'arrowup' || k === 'arrowdown') {
        e.preventDefault();
        const d = k === 'arrowup' ? -1 : 1;
        if (e.altKey) { s.moveBy(id, d); return; }
        const loc = locate(s.project.blocks, id);
        const next = loc?.list[loc.index + d];
        if (next) s.select(next.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
