import { nanoid } from 'nanoid';
import type { Block, DropTarget } from './types';

export const newId = () => nanoid(8);

export interface Located {
  block: Block;
  list: Block[];
  index: number;
  parentId: string | null;
  slot: number;
}

export function locate(blocks: Block[], id: string, parentId: string | null = null, slot = 0): Located | null {
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.id === id) return { block: b, list: blocks, index: i, parentId, slot };
    if (b.children) {
      for (let s = 0; s < b.children.length; s++) {
        const r = locate(b.children[s], id, b.id, s);
        if (r) return r;
      }
    }
  }
  return null;
}

export const findBlock = (blocks: Block[], id: string | null | undefined) => (id ? locate(blocks, id)?.block ?? null : null);

export function getList(blocks: Block[], parentId: string | null, slot: number): Block[] | null {
  if (parentId === null) return blocks;
  const p = findBlock(blocks, parentId);
  if (!p?.children) return null;
  while (p.children.length <= slot) p.children.push([]);
  return p.children[slot];
}

export function walk(blocks: Block[], fn: (b: Block, depth: number) => void, depth = 0) {
  for (const b of blocks) {
    fn(b, depth);
    b.children?.forEach((s) => walk(s, fn, depth + 1));
  }
}

export function isDescendant(block: Block, id: string): boolean {
  let found = false;
  block.children?.forEach((s) => walk(s, (b) => { if (b.id === id) found = true; }));
  return found;
}

/** Deep clone a block giving every node a fresh id. */
export function cloneBlock(b: Block): Block {
  return {
    ...structuredClone(b),
    id: newId(),
    children: b.children?.map((s) => s.map(cloneBlock)),
  };
}

export function insertAt(blocks: Block[], target: DropTarget, block: Block): boolean {
  const list = getList(blocks, target.parentId, target.slot);
  if (!list) return false;
  list.splice(Math.max(0, Math.min(target.index, list.length)), 0, block);
  return true;
}

export function flatIds(blocks: Block[]): string[] {
  const out: string[] = [];
  walk(blocks, (b) => out.push(b.id));
  return out;
}
