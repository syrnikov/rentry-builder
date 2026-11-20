import type { Project } from '../model/types';
import { blockCatalog, pageJSON, pageText, styleMetaCatalog } from './context';

const INLINE_SYNTAX = `Rentry inline formatting (keep it where the words survive):
**bold**, *italic*, ~~strike~~, ==highlight==, \`code\`,
%color% text %% — colored text, e.g. %#a6d8f7% sky %% or %hotpink% hi %% (names or #hex only),
!~color;style; text ~! — styled underline,
!>text — spoiler, runs to the end of the line,
[label](https://link), inline images ![alt](https://url){20px:20px},
-> centered line <-   and   -> right-aligned line ->`;

const GROUNDING = `Ground everything in the author's own page. Never invent personal facts (names, ages, places, pronouns, dates, links, usernames, images). If something needed is missing, write a short [bracketed placeholder] such as [your favorite band] for the author to fill in. Write in the same language as the page.`;

// ───────────────────────── Writing Tools

export type WritingAction = 'proofread' | 'rewrite' | 'friendly' | 'professional' | 'concise' | 'expand' | 'playful' | 'write' | 'custom';

export const WRITING_ACTIONS: { id: WritingAction; label: string; instruction: string }[] = [
  { id: 'proofread', label: 'Proofread', instruction: 'Fix spelling, grammar and punctuation only. Change nothing else.' },
  { id: 'rewrite', label: 'Rewrite', instruction: 'Rewrite it so it reads better. Keep the meaning, facts and roughly the same length.' },
  { id: 'friendly', label: 'Friendlier', instruction: 'Make the tone warmer and friendlier.' },
  { id: 'professional', label: 'Professional', instruction: 'Make the tone more polished and professional.' },
  { id: 'concise', label: 'Concise', instruction: 'Make it shorter and tighter while keeping the key points.' },
  { id: 'expand', label: 'Expand', instruction: 'Expand it a little with more detail, using only facts from the text or the page. Use [placeholders] for anything unknown.' },
  { id: 'playful', label: 'More playful', instruction: 'Make it more playful and fun, like a cozy tumblr bio — charming, not cringey.' },
];

export const WRITING_SYSTEM = `You are the Writing Tools inside Rentry Builder, an editor for rentry.co profile pages. You edit the text of one field.
Reply with ONLY the resulting text: no quotes, no explanations, no code fences, no preamble.
Keep the author's voice and every fact. Don't add emoji unless the text already uses them or you're asked to.
${GROUNDING}
${INLINE_SYNTAX}`;

export function writingMessages(p: Project, opts: { instruction: string; text: string; singleLine?: boolean; fieldLabel?: string }) {
  const user = [
    `The author's page, for facts and tone (don't copy it wholesale):\n<page>\n${pageText(p)}\n</page>`,
    opts.fieldLabel ? `Field: ${opts.fieldLabel}` : '',
    opts.singleLine ? 'This field is a single line: reply with one line only.' : '',
    `Instruction: ${opts.instruction}`,
    opts.text.trim() ? `Text to edit:\n<<<\n${opts.text}\n>>>` : 'The field is empty: write new text for it.',
  ].filter(Boolean).join('\n\n');
  return [{ role: 'system' as const, content: WRITING_SYSTEM }, { role: 'user' as const, content: user }];
}

/** Removes wrappers models sometimes add despite instructions. */
export function cleanWritingReply(text: string, singleLine?: boolean): string {
  let t = text.trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').replace(/^<<<\s*/, '').replace(/\s*>>>$/, '');
  if (/^"[\s\S]*"$/.test(t) && !t.slice(1, -1).includes('"')) t = t.slice(1, -1);
  return singleLine ? t.replace(/\s*\n+\s*/g, ' ').trim() : t;
}

// ───────────────────────── Ask AI (page edits)

const OPS_DOC = `Reply with a JSON object: {"summary": "<one short sentence, what you changed>", "ops": [ ... ]}
Operations (applied in order, as one undo step):
{"op":"update","id":"<block id>","props":{<only the props to change>},"name"?:"layer name","hidden"?:bool}
{"op":"insert","type":"<block type>","props":{...},"children"?:[[...block specs]],"ref"?:"new1", "after"|"before":"<block id or ref>"  OR  "parent":"<container id or ref>","slot":0,"index":0}   (no position = end of page)
{"op":"move","id":"<block id>", position as for insert}
{"op":"remove","id":"<block id>"}
{"op":"meta","key":"<style metadata key>","values":["..."]}   (empty values = reset to default)
{"op":"palette","add":[{"value":"#hex","name":"..."}]}
{"op":"recolor","from":"<color>","to":"<color>"}   (swaps a color everywhere: metadata, blocks, inline text)
{"op":"rename","name":"<project name>"}
A block spec is {"type":"...","props":{...},"children"?:[[...]]}.`;

export const EDIT_RULES = `Rules:
- Make the smallest set of changes that does what was asked. Keep everything else as it is.
- Only use block types, prop keys and option values from the catalog. Props you leave out keep their current value (new blocks get sensible defaults).
- Text props use rentry inline formatting. Keep existing formatting and colors unless asked to change them.
- Colors in block props must be color names or #hex. Prefer the page's palette and colors already used, so the page stays consistent.
- Images: only reuse image links already on the page or given in the request. Never invent image links; leave image fields empty instead. "${'<uploaded image>'}" stands for an uploaded image; keep it as is.
- Metadata values must follow each option's units and ranges. Some options require partners (see "requires").
- Locked blocks can't be changed.
- If the request is unclear or impossible, return no ops and explain briefly in summary.
- ${GROUNDING}`;

export function editMessages(p: Project, opts: { instruction: string; selectedId: string | null }) {
  const system = `You are the AI assistant inside Rentry Builder, a visual editor for rentry.co profile pages. You change the author's page using operations, never free-form output.
${OPS_DOC}
${EDIT_RULES}
${INLINE_SYNTAX}

Block catalog:
${JSON.stringify(blockCatalog())}

Style metadata you may set:
${JSON.stringify(styleMetaCatalog())}`;
  const user = [
    `Current page:\n${JSON.stringify(pageJSON(p))}`,
    opts.selectedId ? `The author has selected block "${opts.selectedId}". "this", "it" or "here" refer to it; keep changes to it unless the request is clearly about the whole page.` : 'Nothing is selected: the request is about the whole page.',
    `Request: ${opts.instruction}`,
  ].join('\n\n');
  return [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
}

// ───────────────────────── New page in this style

export function newPageMessages(p: Project, opts: { instruction: string }) {
  const system = `You are the AI assistant inside Rentry Builder, a visual editor for rentry.co profile pages. The author wants a NEW page that looks like part of the same site as their current page.
The theme (metadata, fonts, palette) is copied automatically; you design the blocks.
Reply with a JSON object: {"name":"<short project name>","blocks":[<block specs>]}
A block spec is {"type":"...","props":{...},"children"?:[[...]]} using only types, prop keys and option values from the catalog.
Match the current page's style: the same kinds of blocks, title styles, alignment, separators, tag styles and colors (palette and colors already used). Usually 6–14 blocks.
Content comes from the author's request plus facts already on their current page. Images: only reuse image links already on the page when they fit, otherwise leave image fields empty.
${GROUNDING}
${INLINE_SYNTAX}

Block catalog:
${JSON.stringify(blockCatalog())}`;
  const user = `Current page (style and facts reference):\n${JSON.stringify(pageJSON(p))}\n\nThe new page: ${opts.instruction}`;
  return [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
}
