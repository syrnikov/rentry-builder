import type { Block, Project } from '../model/types';
import type { Field } from '../blocks/types';
import { BLOCK_DEFS, getDef } from '../blocks/registry';
import { META_BY_KEY, META_OPTIONS } from '../rentry/metadataSchema';
import { compileMarkdown } from '../compiler/compile';
import { walk } from '../model/tree';

/** What the model sees instead of an uploaded (data URI) image: no huge strings, nothing to copy. */
export const UPLOADED = '<uploaded image>';

const elide = (v: unknown): unknown => {
  if (typeof v === 'string') return v.startsWith('data:') ? UPLOADED : v;
  if (Array.isArray(v)) return v.map(elide);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, elide(x)]));
  return v;
};

export function blockJSON(b: Block): Record<string, unknown> {
  return {
    id: b.id,
    type: b.type,
    ...(b.name ? { name: b.name } : {}),
    ...(b.hidden ? { hidden: true } : {}),
    ...(b.locked ? { locked: true } : {}),
    props: elide(b.props),
    ...(b.children ? { children: b.children.map((slot) => slot.map(blockJSON)) } : {}),
  };
}

/** Metadata that is private or not about looks never goes to the model. */
export const isPrivateMetaKey = (key: string) => {
  const opt = META_BY_KEY[key];
  return !opt || opt.group === 'SECRET' || /CODE|EMAIL|PASSWORD/i.test(key);
};

const STYLE_GROUPS = new Set(['CONTAINER', 'CONTENT']);

export function pageJSON(p: Project) {
  const meta = Object.fromEntries(Object.entries(p.meta).filter(([k]) => !isPrivateMetaKey(k)).map(([k, v]) => [k, elide(v)]));
  return { name: p.name, palette: p.palette ?? [], metadata: meta, blocks: p.blocks.map(blockJSON) };
}

function fieldSpec(f: Field): Record<string, unknown> {
  const s: Record<string, unknown> = { key: f.key, kind: f.kind };
  if (f.kind === 'select' || f.kind === 'segmented') s.options = f.options.map((o) => o.value);
  if (f.kind === 'number') { s.min = f.min; s.max = f.max; }
  if (f.kind === 'textarea' && f.mono) s.plain = true;
  if (f.kind === 'size') s.units = f.units.map((u) => u.unit);
  if (f.kind === 'list') { s.item = f.fields.map(fieldSpec); if (f.max) s.max = f.max; }
  return s;
}

export const defFields = (type: string): Field[] => getDef(type)?.groups.flatMap((g) => g.fields) ?? [];

/** Every block type, generated from the block registry, so the model only uses what exists. */
export function blockCatalog() {
  return BLOCK_DEFS.map((d) => ({
    type: d.type,
    label: d.label,
    description: d.description,
    ...(d.toCell ? { allowedInColumns: true } : {}),
    ...(d.container ? { container: d.type === 'columns' ? 'children = one array per column (count prop); only allowedInColumns blocks' : 'children = [[...blocks]]' } : {}),
    fields: d.groups.flatMap((g) => g.fields).map(fieldSpec),
  }));
}

/** Style metadata the model may change (container & content look), from the metadata schema. */
export function styleMetaCatalog() {
  return META_OPTIONS.filter((o) => STYLE_GROUPS.has(o.group)).map((o) => ({
    key: o.key,
    help: o.help.length > 140 ? `${o.help.slice(0, 137)}…` : o.help,
    maxValues: o.maxValues,
    ...(o.mapping ? { values: o.mapping } : {}),
    ...(o.units ? { units: o.units.map((u) => `${u.unit} ${u.min}–${u.max}`) } : {}),
    ...(o.whitelist ? { allowed: o.whitelist.slice(0, 40) } : {}),
    ...(o.requires ? { requires: o.requires } : {}),
  }));
}

/** The page as readers see it (rentry markdown), trimmed: facts and tone for the writing tools. */
export function pageText(p: Project, max = 6000): string {
  const md = compileMarkdown(p.blocks).replace(/data:[^)\s]+/g, UPLOADED);
  return md.length > max ? `${md.slice(0, max)}\n…` : md;
}

/** Every image URL already on the page (the model may reuse these, never invent new ones). */
export function projectUrls(p: Project): Set<string> {
  const out = new Set<string>();
  const visit = (v: unknown) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/https?:\/\/[^\s)"'<>\]]+/g)) out.add(m[0]);
      if (/^https?:\/\//.test(v.trim())) out.add(v.trim());
    } else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  walk(p.blocks, (b) => visit(b.props));
  Object.values(p.meta).forEach(visit);
  return out;
}

export const urlsIn = (text: string) => new Set([...text.matchAll(/https?:\/\/[^\s)"'<>\]]+/g)].map((m) => m[0]));
