import type { Block, DropTarget, Project, Props } from '../model/types';
import type { Field } from '../blocks/types';
import { getDef } from '../blocks/registry';
import { createBlock } from '../blocks/presets';
import { canDrop } from '../store/editorStore';
import { getList, insertAt, isDescendant, locate } from '../model/tree';
import { META_BY_KEY } from '../rentry/metadataSchema';
import { validateMetadata, validateOption } from '../rentry/validateMetadata';
import { isAnyColor } from '../rentry/colors';
import { isInlineColor, replaceColor } from '../model/palette';
import { defFields, isPrivateMetaKey, UPLOADED } from './context';

/**
 * The AI never writes into the page directly. It proposes operations; each one is checked against the
 * block registry and the metadata schema here, and only valid ones are applied (as one undo step).
 */
export type AIOp =
  | { op: 'update'; id: string; props?: Props; name?: string; hidden?: boolean }
  | ({ op: 'insert'; type: string; props?: Props; children?: BlockSpec[][]; ref?: string } & Position)
  | { op: 'remove'; id: string }
  | ({ op: 'move'; id: string } & Position)
  | { op: 'meta'; key: string; values: string[] }
  | { op: 'palette'; add: { value: string; name?: string }[] }
  | { op: 'recolor'; from: string; to: string }
  | { op: 'rename'; name: string };

export interface Position { after?: string; before?: string; parent?: string | null; slot?: number; index?: number }
export interface BlockSpec { type: string; props?: Props; children?: BlockSpec[][]; name?: string }

export interface OpsReport {
  changedIds: string[];
  blocks: number;
  metaKeys: string[];
  other: number;
  skipped: string[];
  notes: string[];
}

export interface OpsEnv {
  /** Image URLs the model may use: already on the page, or typed by the user in the request. */
  allowedUrls: Set<string>;
}

// ───────────────────────── values

const SIZE_RE = /^\d+(\.\d+)?(px|%|vh|hw|rem|vw)?$/;
const asString = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null);

type Clean = { ok: true; value: unknown } | { ok: false; why: string };

function cleanValue(f: Field, v: unknown, prev: unknown, env: OpsEnv): Clean {
  switch (f.kind) {
    case 'text': {
      const s = asString(v);
      return s === null ? { ok: false, why: 'expected text' } : { ok: true, value: s.replace(/\s*\n+\s*/g, ' ') };
    }
    case 'textarea':
    case 'emoji': {
      const s = asString(v);
      if (s === null) return { ok: false, why: 'expected text' };
      return { ok: true, value: f.kind === 'emoji' ? s.slice(0, 16) : s };
    }
    case 'number': {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n)) return { ok: false, why: 'expected a number' };
      return { ok: true, value: Math.min(f.max, Math.max(f.min, n)) };
    }
    case 'select':
    case 'segmented': {
      const s = asString(v);
      return s !== null && f.options.some((o) => o.value === s) ? { ok: true, value: s } : { ok: false, why: `must be one of ${f.options.map((o) => o.value).join(', ')}` };
    }
    case 'toggle':
      return typeof v === 'boolean' ? { ok: true, value: v } : { ok: false, why: 'expected true/false' };
    case 'color': {
      const s = asString(v)?.trim() ?? null;
      return s !== null && (s === '' || isInlineColor(s)) ? { ok: true, value: s } : { ok: false, why: `“${String(v)}” isn’t a rentry text color (use a color name or #hex)` };
    }
    case 'image': {
      const s = asString(v)?.trim() ?? null;
      if (s === null) return { ok: false, why: 'expected an image link' };
      if (s === UPLOADED) return typeof prev === 'string' && prev.startsWith('data:') ? { ok: true, value: prev } : { ok: false, why: 'unknown uploaded image' };
      if (s === '' || s === prev || env.allowedUrls.has(s)) return { ok: true, value: s };
      return { ok: false, why: 'new image links aren’t invented. Use one already on the page, or paste a link in your request' };
    }
    case 'size': {
      const s = asString(v)?.trim() ?? null;
      return s !== null && (s === '' || SIZE_RE.test(s)) ? { ok: true, value: s } : { ok: false, why: 'expected a size like 120px or 50%' };
    }
    case 'underline': {
      if (!v || typeof v !== 'object') return { ok: false, why: 'expected underline settings' };
      const u = v as Record<string, unknown>;
      const base = (prev && typeof prev === 'object' ? prev : {}) as Record<string, unknown>;
      const out = { ...base };
      if (typeof u.on === 'boolean') out.on = u.on;
      if (typeof u.color === 'string' && (u.color === '' || isInlineColor(u.color))) out.color = u.color;
      if (typeof u.style === 'string' && ['default', 'solid', 'double', 'dotted', 'dashed', 'wavy'].includes(u.style)) out.style = u.style;
      if (typeof u.type === 'string' && ['default', 'underline', 'line-through', 'overline', 'both'].includes(u.type)) out.type = u.type;
      if (typeof u.thickness === 'number') out.thickness = Math.min(10, Math.max(0, Math.round(u.thickness)));
      return { ok: true, value: out };
    }
    case 'list': {
      if (!Array.isArray(v)) return { ok: false, why: 'expected a list' };
      const prevList = Array.isArray(prev) ? prev : [];
      const items = v.slice(0, f.max ?? 200).map((item, i) => {
        const existing = prevList[i] && typeof prevList[i] === 'object' ? prevList[i] : null;
        const base: Props = { ...f.newItem(), ...(existing ?? {}) };
        if (!existing) for (const sub of f.fields) if (sub.kind === 'image') base[sub.key] = ''; // no stock samples
        if (!item || typeof item !== 'object') return base;
        for (const sub of f.fields) {
          if (!(sub.key in (item as object))) continue;
          const c = cleanValue(sub, (item as Props)[sub.key], base[sub.key], env);
          if (c.ok) base[sub.key] = c.value;
        }
        return base;
      });
      return { ok: true, value: items };
    }
  }
}

/** Keeps only known, valid props for this block type. */
export function cleanProps(type: string, props: unknown, prev: Props, env: OpsEnv, skipped: string[], label: string): Props {
  const out: Props = {};
  if (!props || typeof props !== 'object') return out;
  const fields = new Map(defFields(type).map((f) => [f.key, f]));
  for (const [k, v] of Object.entries(props as Props)) {
    const f = fields.get(k);
    if (!f) { skipped.push(`${label}: no “${k}” setting`); continue; }
    const c = cleanValue(f, v, prev[k], env);
    if (c.ok) out[k] = c.value;
    else skipped.push(`${label} · ${f.label}: ${c.why}`);
  }
  return out;
}

const syncSlots = (b: Block) => {
  const def = getDef(b.type);
  if (!def?.container) return;
  b.children ??= [];
  const n = def.container.slotCount(b);
  while (b.children.length < n) b.children.push([]);
};

/** Builds a new block (and its children) from a spec, validating everything. */
export function buildBlock(spec: BlockSpec, env: OpsEnv, skipped: string[]): Block | null {
  const def = spec && typeof spec.type === 'string' ? getDef(spec.type) : undefined;
  if (!def) { skipped.push(`Unknown block type “${String(spec?.type)}”`); return null; }
  const props = cleanProps(def.type, spec.props, def.defaults(), env, skipped, def.label);
  // AI-made blocks never show the registry's stock sample images: no valid image given = empty.
  const defaults = def.defaults();
  for (const f of defFields(def.type)) {
    if (f.kind === 'image' && !(f.key in props)) props[f.key] = '';
    if (f.kind === 'list' && !(f.key in props) && Array.isArray(defaults[f.key]) && f.fields.some((s) => s.kind === 'image')) {
      props[f.key] = (defaults[f.key] as Props[]).map((it) => ({ ...it, ...Object.fromEntries(f.fields.filter((s) => s.kind === 'image').map((s) => [s.key, ''])) }));
    }
  }
  const b = createBlock(def.type, props);
  if (typeof spec.name === 'string' && spec.name.trim()) b.name = spec.name.trim().slice(0, 60);
  if (def.container && Array.isArray(spec.children)) {
    syncSlots(b);
    spec.children.slice(0, b.children!.length).forEach((slot, i) => {
      if (!Array.isArray(slot)) return;
      for (const childSpec of slot) {
        const child = buildBlock(childSpec, env, skipped);
        if (!child) continue;
        const cd = getDef(child.type)!;
        if ((cd.container && def.type === 'columns') || !def.container!.accepts(cd)) { skipped.push(`${cd.label} can’t go inside ${def.label}`); continue; }
        b.children![i].push(child);
      }
    });
  }
  return b;
}

// ───────────────────────── positions

function resolveTarget(p: Project, pos: Position, resolve: (id: string) => string): DropTarget | string {
  if (pos.after || pos.before) {
    const id = resolve(String(pos.after ?? pos.before));
    const loc = locate(p.blocks, id);
    if (!loc) return `no block “${pos.after ?? pos.before}”`;
    return { parentId: loc.parentId, slot: loc.slot, index: loc.index + (pos.after ? 1 : 0) };
  }
  if (pos.parent) {
    const pid = resolve(String(pos.parent));
    const slot = Math.max(0, Math.floor(Number(pos.slot) || 0));
    const list = getList(p.blocks, pid, slot);
    if (!list) return `no slot ${slot} in “${pos.parent}”`;
    const index = pos.index === undefined ? list.length : Math.max(0, Math.floor(Number(pos.index) || 0));
    return { parentId: pid, slot, index };
  }
  const index = pos.index === undefined ? p.blocks.length : Math.max(0, Math.floor(Number(pos.index) || 0));
  return { parentId: null, slot: 0, index };
}

// ───────────────────────── apply

/**
 * Applies operations to a draft project (inside one store commit), validating each against the current
 * draft so later operations can refer to blocks inserted earlier (via `ref`).
 */
export function runOps(p: Project, rawOps: unknown, env: OpsEnv): OpsReport {
  const r: OpsReport = { changedIds: [], blocks: 0, metaKeys: [], other: 0, skipped: [], notes: [] };
  const refs = new Map<string, string>();
  const resolve = (id: string) => refs.get(id) ?? id;
  const touched = new Set<string>();
  const ops: unknown[] = Array.isArray(rawOps) ? rawOps.slice(0, 120) : [];

  for (const raw of ops) {
    if (!raw || typeof raw !== 'object') continue;
    const op = raw as AIOp & Record<string, unknown>;
    switch (op.op) {
      case 'update': {
        const loc = locate(p.blocks, resolve(String(op.id)));
        if (!loc) { r.skipped.push(`No block “${op.id}” to change`); break; }
        const b = loc.block;
        const def = getDef(b.type)!;
        if (b.locked) { r.skipped.push(`${b.name || def.label} is locked`); break; }
        const props = cleanProps(b.type, op.props, b.props, env, r.skipped, b.name || def.label);
        const changed = Object.entries(props).some(([k, v]) => JSON.stringify(b.props[k]) !== JSON.stringify(v));
        Object.assign(b.props, props);
        syncSlots(b);
        if (typeof op.name === 'string') b.name = op.name.trim().slice(0, 60) || undefined;
        if (typeof op.hidden === 'boolean') b.hidden = op.hidden || undefined;
        if (changed || typeof op.name === 'string' || typeof op.hidden === 'boolean') { r.changedIds.push(b.id); touched.add(b.id); }
        break;
      }
      case 'insert': {
        const b = buildBlock(op as BlockSpec, env, r.skipped);
        if (!b) break;
        const t = resolveTarget(p, op, resolve);
        if (typeof t === 'string') { r.skipped.push(`Couldn’t place ${getDef(b.type)!.label}: ${t}`); break; }
        if (!canDrop(p.blocks, b, t)) { r.skipped.push(`${getDef(b.type)!.label} can’t go there`); break; }
        insertAt(p.blocks, t, b);
        if (typeof op.ref === 'string') refs.set(op.ref, b.id);
        r.changedIds.push(b.id);
        touched.add(b.id);
        break;
      }
      case 'remove': {
        const loc = locate(p.blocks, resolve(String(op.id)));
        if (!loc) { r.skipped.push(`No block “${op.id}” to remove`); break; }
        if (loc.block.locked) { r.skipped.push(`${loc.block.name || getDef(loc.block.type)?.label} is locked`); break; }
        loc.list.splice(loc.index, 1);
        touched.add(loc.block.id);
        break;
      }
      case 'move': {
        const id = resolve(String(op.id));
        const loc = locate(p.blocks, id);
        if (!loc) { r.skipped.push(`No block “${op.id}” to move`); break; }
        if (loc.block.locked) { r.skipped.push(`${loc.block.name || getDef(loc.block.type)?.label} is locked`); break; }
        const anchor = op.after ?? op.before;
        if (anchor && resolve(String(anchor)) === id) break;
        if (op.parent && (resolve(String(op.parent)) === id || isDescendant(loc.block, resolve(String(op.parent))))) { r.skipped.push('A block can’t move inside itself'); break; }
        const [b] = loc.list.splice(loc.index, 1);
        const t = resolveTarget(p, op, resolve);
        if (typeof t === 'string' || !canDrop(p.blocks, b, t)) {
          loc.list.splice(loc.index, 0, b); // put it back
          r.skipped.push(`Couldn’t move ${b.name || getDef(b.type)?.label}${typeof t === 'string' ? `: ${t}` : ' there'}`);
          break;
        }
        insertAt(p.blocks, t, b);
        r.changedIds.push(b.id);
        touched.add(b.id);
        break;
      }
      case 'meta': {
        const key = String(op.key ?? '');
        if (!META_BY_KEY[key] || isPrivateMetaKey(key)) { r.skipped.push(`Page setting “${key}” isn’t available`); break; }
        const values = (Array.isArray(op.values) ? op.values : [op.values]).map(asString).filter((v): v is string => v !== null && v.trim() !== '').map((v) => v.trim());
        if (!values.length) { if (p.meta[key]) { delete p.meta[key]; r.metaKeys.push(key); } break; }
        const errors = validateOption(key, values).filter((i) => i.severity === 'error');
        if (errors.length) { r.skipped.push(`${META_BY_KEY[key].label}: ${errors[0].message}`); break; }
        if (JSON.stringify(p.meta[key]) !== JSON.stringify(values)) { p.meta[key] = values; r.metaKeys.push(key); }
        break;
      }
      case 'palette': {
        const add = Array.isArray(op.add) ? op.add : [];
        p.palette ??= [];
        for (const c of add) {
          const value = asString(c?.value)?.trim();
          if (!value || !isAnyColor(value)) { r.skipped.push(`“${String(c?.value)}” isn’t a color`); continue; }
          if (p.palette.some((x) => x.value.toLowerCase() === value.toLowerCase())) continue;
          p.palette.push({ value, name: asString(c?.name)?.slice(0, 40) ?? '' });
          r.other++;
        }
        break;
      }
      case 'recolor': {
        const from = asString(op.from)?.trim() ?? '';
        const to = asString(op.to)?.trim() ?? '';
        if (!isAnyColor(from) || !isAnyColor(to)) { r.skipped.push(`Can’t recolor “${from}” to “${to}”`); break; }
        let n = replaceColor(p, from, to);
        p.palette?.forEach((c) => { if (c.value.toLowerCase() === from.toLowerCase()) { c.value = to; n++; } });
        if (n) r.other++;
        else r.skipped.push(`${from} isn’t used on the page`);
        break;
      }
      case 'rename': {
        const name = asString(op.name)?.trim().slice(0, 80);
        if (name && name !== p.name) { p.name = name; r.other++; }
        break;
      }
      default:
        r.skipped.push(`Unknown action “${String((raw as Record<string, unknown>).op)}”`);
    }
  }

  r.blocks = touched.size;
  r.changedIds = [...new Set(r.changedIds)].filter((id) => locate(p.blocks, id));
  r.metaKeys = [...new Set(r.metaKeys)];
  // Settings that need a partner (e.g. border color → width + style) are reported, not silently broken.
  if (r.metaKeys.length) {
    for (const issue of validateMetadata(p.meta)) {
      if (r.metaKeys.includes(issue.key) && issue.severity === 'error') r.notes.push(`${META_BY_KEY[issue.key]?.label ?? issue.key}: ${issue.message}`);
    }
  }
  return r;
}

/** Builds the blocks for a brand-new page (New page in this style). */
export function buildPage(specs: unknown, env: OpsEnv): { blocks: Block[]; skipped: string[] } {
  const skipped: string[] = [];
  const blocks = (Array.isArray(specs) ? specs.slice(0, 60) : [])
    .map((s) => buildBlock(s as BlockSpec, env, skipped))
    .filter((b): b is Block => !!b);
  return { blocks, skipped };
}

export function describeReport(r: OpsReport): string {
  const parts: string[] = [];
  if (r.blocks) parts.push(`${r.blocks} block${r.blocks === 1 ? '' : 's'}`);
  if (r.metaKeys.length) parts.push(`${r.metaKeys.length} page style${r.metaKeys.length === 1 ? '' : 's'}`);
  if (r.other) parts.push(`${r.other} other change${r.other === 1 ? '' : 's'}`);
  return parts.length ? `Changed ${parts.join(' · ')}` : 'No changes';
}
