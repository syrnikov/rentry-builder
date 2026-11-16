import { getDef } from '../blocks/registry';
import type { Ctx } from '../blocks/types';
import type { Block, Project } from '../model/types';
import { walk } from '../model/tree';
import { serializeMetadata } from '../rentry/serializeMetadata';
import { MetaIssue, validateMetadata } from '../rentry/validateMetadata';

export interface BlockIssue { blockId: string; severity: 'error' | 'warning'; message: string }

export function compileBlock(b: Block, ctx: Ctx = rootCtx()): string {
  if (b.hidden) return '';
  const def = getDef(b.type);
  if (!def) return '';
  try {
    return def.toMarkdown(b, ctx).replace(/\s+$/, '');
  } catch (e) {
    console.error('compile failed for', b.type, e);
    return '';
  }
}

export function compileList(blocks: Block[], ctx: Ctx): string {
  return blocks.map((b) => compileBlock(b, ctx)).filter((s) => s.trim()).join('\n\n');
}

export function cellOf(b: Block, ctx: Ctx): string {
  if (b.hidden) return '';
  return getDef(b.type)?.toCell?.(b, ctx) ?? '';
}

export const rootCtx = (): Ctx => ({ align: undefined, compileList, cellOf });

export function compileMarkdown(blocks: Block[]): string {
  return compileList(blocks, rootCtx()) + '\n';
}

export function lintBlocks(blocks: Block[]): BlockIssue[] {
  const out: BlockIssue[] = [];
  walk(blocks, (b) => {
    const def = getDef(b.type);
    if (!def) {
      out.push({ blockId: b.id, severity: 'error', message: `Unknown block type "${b.type}"` });
      return;
    }
    def.lint?.(b).forEach((message) => out.push({ blockId: b.id, severity: 'warning', message }));
    if (def.container && b.children) {
      b.children.forEach((slot) =>
        slot.forEach((c) => {
          const cd = getDef(c.type);
          if (cd && !def.container!.accepts(cd)) out.push({ blockId: c.id, severity: 'error', message: `${cd.label} can't be placed inside ${def.label}` });
        }),
      );
    }
  });
  return out;
}

export interface CompileResult {
  markdown: string;
  metadata: string;
  metaIssues: MetaIssue[];
  blockIssues: BlockIssue[];
}

export function compileProject(p: Project): CompileResult {
  return {
    markdown: compileMarkdown(p.blocks),
    metadata: serializeMetadata(p.meta),
    metaIssues: validateMetadata(p.meta),
    blockIssues: lintBlocks(p.blocks),
  };
}
