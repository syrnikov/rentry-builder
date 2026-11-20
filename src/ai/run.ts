import { useEditor } from '../store/editorStore';
import type { Project } from '../model/types';
import { AIError, chat, parseJSONReply } from './openai';
import { useAI } from './settings';
import { projectUrls, urlsIn } from './context';
import { META_BY_KEY } from '../rentry/metadataSchema';
import { buildPage, OpsReport, runOps } from './ops';
import { cleanWritingReply, editMessages, newPageMessages, writingMessages } from './prompts';

function creds() {
  const { key, model } = useAI.getState();
  if (!key.trim()) throw new AIError('Add your OpenAI API key to use AI tools.', 'key');
  return { key, model };
}

let flashTimer: ReturnType<typeof setTimeout> | undefined;
export function flash(ids: string[]) {
  clearTimeout(flashTimer);
  useEditor.getState().setUI({ aiFlash: ids });
  flashTimer = setTimeout(() => useEditor.getState().setUI({ aiFlash: [] }), 2200);
}

export interface EditResult {
  summary: string;
  report: OpsReport;
  /** The project right after applying, so "Undo" only undoes our change. Null when nothing changed. */
  result: Project | null;
}

/** Ask AI: the model proposes operations; valid ones are applied as one undo step. */
export async function runEdit(instruction: string, selectedId: string | null, signal?: AbortSignal): Promise<EditResult> {
  const before = useEditor.getState().project;
  const reply = await chat({ ...creds(), messages: editMessages(before, { instruction, selectedId }), json: true, signal });
  const data = parseJSONReply<{ summary?: unknown; ops?: unknown }>(reply);
  const env = { allowedUrls: new Set([...projectUrls(before), ...urlsIn(instruction)]) };

  let report: OpsReport = { changedIds: [], blocks: 0, metaKeys: [], other: 0, skipped: [], notes: [] };
  const prev = useEditor.getState().project;
  useEditor.getState().commit((draft) => { report = runOps(draft, data.ops, env); });
  const after = useEditor.getState().project;
  if (report.changedIds.length) flash(report.changedIds);
  return { summary: typeof data.summary === 'string' ? data.summary : '', report, result: after !== prev ? after : null };
}

/** Writing Tools: returns the rewritten rentry-markdown text (streamed through onDelta). */
export async function runWriting(
  opts: { instruction: string; text: string; singleLine?: boolean; fieldLabel?: string },
  onDelta: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const p = useEditor.getState().project;
  const out = await chat({
    ...creds(),
    messages: writingMessages(p, opts),
    signal,
    maxTokens: 6000,
    onDelta: (_piece, full) => onDelta(cleanWritingReply(full, opts.singleLine)),
  });
  return cleanWritingReply(out, opts.singleLine);
}

/** New page in this style: theme copied as-is, blocks designed by the model from the request + existing facts. */
export async function runNewPage(instruction: string, signal?: AbortSignal): Promise<{ name: string; blocks: number; skipped: string[] }> {
  const current = useEditor.getState().project;
  const reply = await chat({ ...creds(), messages: newPageMessages(current, { instruction }), json: true, signal, maxTokens: 16000 });
  const data = parseJSONReply<{ name?: unknown; blocks?: unknown }>(reply);
  const env = { allowedUrls: new Set([...projectUrls(current), ...urlsIn(instruction)]) };
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
