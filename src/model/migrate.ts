import type { Block, Project } from './types';
import { newId } from './tree';

/** Validate/upgrade a project loaded from storage or a file. Throws on garbage. */
export function migrateProject(raw: any): Project {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.blocks)) throw new Error('Not a Rentry Builder project');
  const fixBlock = (b: any): Block => ({
    id: typeof b.id === 'string' ? b.id : newId(),
    type: String(b.type),
    name: b.name,
    hidden: !!b.hidden,
    locked: !!b.locked,
    collapsed: !!b.collapsed,
    props: b.props && typeof b.props === 'object' ? b.props : {},
    children: Array.isArray(b.children) ? b.children.map((s: any[]) => (Array.isArray(s) ? s.map(fixBlock) : [])) : undefined,
  });
  const meta: Record<string, string[]> = {};
  if (raw.meta && typeof raw.meta === 'object') {
    for (const [k, v] of Object.entries(raw.meta)) if (Array.isArray(v)) meta[k] = v.map(String);
  }
  const palette = Array.isArray(raw.palette)
    ? raw.palette
        .filter((c: any) => c && typeof c.value === 'string')
        .map((c: any) => ({ value: c.value, name: typeof c.name === 'string' ? c.name : '' }))
    : [];
  return { version: 1, name: typeof raw.name === 'string' ? raw.name : 'untitled', meta, blocks: raw.blocks.map(fixBlock), palette };
}

export const PROJECT_EXT = '.rentrybuilder.json';

export function downloadText(filename: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

export const slugName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rentry';
