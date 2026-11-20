import { useEditor } from '../store/editorStore';
import type { Project } from '../model/types';
import { AIError, chat, parseJSONReply } from './openai';
import { useAI } from './settings';
import { pageText, projectUrls, urlsIn } from './context';
import { META_BY_KEY } from '../rentry/metadataSchema';
import { buildPage, OpsReport, runOps } from './ops';
import { cleanWritingReply, editMessages, newPageMessages, styleBriefMessages, writingMessages } from './prompts';
import { hashText, styleGuideText, styleProfile } from './style';

function creds() {
  const { key, model } = useAI.getState();
  if (!key.trim()) throw new AIError('Add your OpenAI API key to use AI tools.', 'key');
  return { key, model };
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;
export function flash(ids: string[]) {
  clearTimeout(flashTimer);
  useEditor.getState().setUI({ aiFlash: ids });
  flashTimer = setTimeout(() => useEditor.getState().setUI({ aiFlash: [] }), 2600);
}

/** What the UI shows while a request runs. */
export type AIStatus = 'style' | 'thinking';

// ───────────────────────── style brief (learned once per page version)

const BRIEF_KEY = 'rentry-builder:ai-style';
const memo = new Map<string, string>();

/** The cache key changes only when what readers see changes (content, palette), not when you select things. */
export const briefKey = (p: Project) => hashText(`${pageText(p, 20000)}\n${JSON.stringify(p.palette ?? [])}`);

export function cachedBrief(p: Project): string | null {
  const k = briefKey(p);
  if (memo.has(k)) return memo.get(k)!;
  try {
    const saved = JSON.parse(localStorage.getItem(BRIEF_KEY) ?? 'null');
    if (saved?.key === k && typeof saved.brief === 'string') { memo.set(k, saved.brief); return saved.brief; }
  } catch { /* storage unavailable */ }
  return null;
}

/**
 * Studies the author's page before changing it: measured facts (local) + a short AI style brief, cached
 * until the page content changes. If the brief can't be made, the measured profile alone is used.
 */
export async function styleContext(p: Project, signal?: AbortSignal, onStatus?: (s: AIStatus) => void): Promise<string> {
  let brief = cachedBrief(p);
  if (!brief && p.blocks.length >= 3) {
    onStatus?.('style');
    try {
      const measured = `Measured facts:\n${styleProfile(p).guide}`;
      brief = (await chat({ ...creds(), messages: styleBriefMessages(p, measured), signal, maxTokens: 4000 })).trim() || null;
      if (brief) {
        const k = briefKey(p);
        memo.set(k, brief);
        try { localStorage.setItem(BRIEF_KEY, JSON.stringify({ key: k, brief })); } catch { /* storage unavailable */ }
      }
    } catch (e) {
      if ((e as AIError).kind === 'abort' || (e as AIError).kind === 'key' || (e as AIError).kind === 'quota') throw e;
      brief = null; // fall back to the measured profile
    }
  }
  return styleGuideText(p, brief);
}

// ───────────────────────── Ask AI

export interface EditResult {
  summary: string;
  report: OpsReport;
  /** The project right after applying, so "Undo" only undoes our change. Null when nothing changed. */
  result: Project | null;
}

/** Ask AI: study the style, then the model proposes operations; valid ones are applied as one undo step. */
export async function runEdit(instruction: string, selectedId: string | null, signal?: AbortSignal, onStatus?: (s: AIStatus) => void): Promise<EditResult> {
  const before = useEditor.getState().project;
  const style = await styleContext(before, signal, onStatus);
  onStatus?.('thinking');
  const reply = await chat({ ...creds(), messages: editMessages(before, { instruction, selectedId, style }), json: true, signal });
  const data = parseJSONReply<{ summary?: unknown; ops?: unknown }>(reply);
  const env = { allowedUrls: new Set([...projectUrls(before), ...urlsIn(instruction)]) };

  let report: OpsReport = { changedIds: [], blocks: 0, metaKeys: [], other: 0, skipped: [], notes: [] };
  const prev = useEditor.getState().project;
  useEditor.getState().commit((draft) => { report = runOps(draft, data.ops, env); });
  const after = useEditor.getState().project;
  if (report.changedIds.length) flash(report.changedIds);
  return { summary: typeof data.summary === 'string' ? data.summary : '', report, result: after !== prev ? after : null };
}

/** Writing Tools: returns the rewritten rentry-markdown text (streamed through onDelta). Never waits on the brief. */
export async function runWriting(
  opts: { instruction: string; text: string; singleLine?: boolean; fieldLabel?: string },
  onDelta: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const p = useEditor.getState().project;
  const style = styleGuideText(p, cachedBrief(p));
  const out = await chat({
    ...creds(),
    messages: writingMessages(p, { ...opts, style }),
    signal,
    maxTokens: 6000,
    onDelta: (_piece, full) => onDelta(cleanWritingReply(full, opts.singleLine)),
  });
  return cleanWritingReply(out, opts.singleLine);
}

/** New page in this style: theme copied as-is; blocks designed in the author's style from the request + existing facts. */
export async function runNewPage(instruction: string, signal?: AbortSignal, onStatus?: (s: AIStatus) => void): Promise<{ name: string; blocks: number; skipped: string[] }> {
  const current = useEditor.getState().project;
  const style = await styleContext(current, signal, onStatus);
  onStatus?.('thinking');
  const reply = await chat({ ...creds(), messages: newPageMessages(current, { instruction, style }), json: true, signal, maxTokens: 16000 });
  const data = parseJSONReply<{ name?: unknown; blocks?: unknown }>(reply);
  const env = { allowedUrls: new Set([...projectUrls(current), ...urlsIn(instruction)]), source: current };
  const { blocks, skipped } = buildPage(data.blocks, env);
  if (!blocks.length) throw new AIError('The AI didn’t produce any blocks. Try describing the page differently.', 'other');
  const name = (typeof data.name === 'string' && data.name.trim().slice(0, 80)) || 'new page';
  useEditor.getState().loadProject({
    version: 1,
    name,
    // Look and behaviour carry over; the old page's title, share card and secrets don't.
    meta: Object.fromEntries(Object.entries(structuredClone(current.meta)).filter(([k]) => !['PAGE', 'SHARE', 'SECRET'].includes(META_BY_KEY[k]?.group ?? 'SECRET'))),
    palette: structuredClone(current.palette ?? []),
    blocks,
  });
  return { name, blocks: blocks.length, skipped };
}
