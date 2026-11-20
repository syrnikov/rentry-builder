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

/** The core of "learn the author's style": shared by every prompt that creates content. */
export const IMITATE = `Imitate the author (most important):
- Before changing anything, study the author's style notes and their own markdown. New content must look like the author made it.
- Build things the way this author builds them: the same block types and patterns (e.g. if section titles are short Text blocks with colored words, make titles that way, not Heading blocks; if Spacer blocks separate sections, keep doing that), the same alignment, casing, decorative symbols, line prefixes, spacing and %color% rhythm.
- Set "like" on every new block that resembles an existing one, pointing at the closest existing block of the same type.
- Never fall back to a generic layout, generic wording or emoji the author doesn't use.`;

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
New or rewritten text must sound and look like this author: the same casing, decorative symbols and %color% habits.
${GROUNDING}
${INLINE_SYNTAX}`;

export function writingMessages(p: Project, opts: { instruction: string; text: string; singleLine?: boolean; fieldLabel?: string; style?: string }) {
  const user = [
    `The author's page, for facts and tone (don't copy it wholesale):\n<page>\n${pageText(p)}\n</page>`,
    opts.style ?? '',
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

const BLOCK_SPEC_DOC = `A block spec is {"type":"...","like"?:"<existing block id>","props":{...},"children"?:[[...]]}.
"like" copies the look (alignment, colors, emphasis, title style…) of an existing block of the SAME type; you then give only the content props (text, items, links). Content is never copied.`;

const OPS_DOC = `Reply with a JSON object: {"summary": "<one short sentence, what you changed>", "ops": [ ... ]}
Operations (applied in order, as one undo step):
{"op":"update","id":"<block id>","props":{<only the props to change>},"name"?:"layer name","hidden"?:bool}
{"op":"insert","type":"<block type>","like":"<id of the most similar existing block>","props":{...},"children"?:[[...block specs]],"ref"?:"new1", "after"|"before":"<block id or ref>"  OR  "parent":"<container id or ref>","slot":0,"index":0}   (no position = end of page)
{"op":"move","id":"<block id>", position as for insert}
{"op":"remove","id":"<block id>"}
{"op":"meta","key":"<style metadata key>","values":["..."]}   (empty values = reset to default)
{"op":"palette","add":[{"value":"#hex","name":"..."}]}
{"op":"recolor","from":"<color>","to":"<color>"}   (swaps a color everywhere: metadata, blocks, inline text)
{"op":"rename","name":"<project name>"}
${BLOCK_SPEC_DOC}`;

export const EDIT_RULES = `Rules:
- Make the smallest set of changes that does what was asked. Keep everything else as it is.
- Only use block types, prop keys and option values from the catalog. Props you leave out keep their current value (new blocks inherit the author's style).
- Text props use rentry inline formatting. Keep existing formatting and colors unless asked to change them.
- Colors in block props must be color names or #hex. Use the page's palette and colors already used, so the page stays consistent.
- Images: only reuse image links already on the page or given in the request. Never invent image links; leave image fields empty instead. "<uploaded image>" stands for an uploaded image; keep it as is.
- Metadata values must follow each option's units and ranges. Some options require partners (see "requires").
- Locked blocks can't be changed.
- If the request is unclear or impossible, return no ops and explain briefly in summary.
- ${GROUNDING}`;

export function editMessages(p: Project, opts: { instruction: string; selectedId: string | null; style?: string }) {
  const system = `You are the AI assistant inside Rentry Builder, a visual editor for rentry.co profile pages. You change the author's page using operations, never free-form output.
${OPS_DOC}
${IMITATE}
${EDIT_RULES}
${INLINE_SYNTAX}

Block catalog:
${JSON.stringify(blockCatalog())}

Style metadata you may set:
${JSON.stringify(styleMetaCatalog())}`;
  const user = [
    opts.style ?? '',
    `Current page:\n${JSON.stringify(pageJSON(p))}`,
    opts.selectedId ? `The author has selected block "${opts.selectedId}". "this", "it" or "here" refer to it; keep changes to it unless the request is clearly about the whole page.` : 'Nothing is selected: the request is about the whole page.',
    `Request: ${opts.instruction}`,
  ].filter(Boolean).join('\n\n');
  return [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
}

// ───────────────────────── New page in this style

export function newPageMessages(p: Project, opts: { instruction: string; style?: string }) {
  const system = `You are the AI assistant inside Rentry Builder, a visual editor for rentry.co profile pages. The author wants a NEW page that reads as a sibling of their current page, as if they made it themselves.
The theme (metadata, fonts, palette) is copied automatically; you design the blocks.
Reply with a JSON object: {"name":"<short project name, in the author's casing>","blocks":[<block specs>]}
${BLOCK_SPEC_DOC}
Use only types, prop keys and option values from the catalog. "like" may point at any block of the current page.
${IMITATE}
Match the current page's section rhythm, title style, spacing, alignment, symbols, casing and color pattern, at a similar length per section.
Content comes from the author's request plus facts already on their current page. Images: only reuse image links already on the page when they fit, otherwise leave image fields empty.
${GROUNDING}
${INLINE_SYNTAX}

Block catalog:
${JSON.stringify(blockCatalog())}`;
  const user = [
    opts.style ?? '',
    `Current page (style and facts reference):\n${JSON.stringify(pageJSON(p))}`,
    `The new page: ${opts.instruction}`,
  ].filter(Boolean).join('\n\n');
  return [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
}

// ───────────────────────── Style brief (cached pre-pass)

export function styleBriefMessages(p: Project, measured: string) {
  const system = `You are a design analyst for rentry.co profile pages. Study the author's page and write precise style notes so another assistant can imitate it exactly.
Cover, with concrete examples copied from the page: voice and tone, casing, decorative symbols / kaomoji and where they go, how section titles are built, how lists are built (prefixes, separators), alignment, spacing between sections, how %color% spans are used (per word or phrase, which colors alternate), inline images, line length.
Be specific and terse: at most 14 bullet points, no preamble.`;
  const user = `${measured}\n\nThe page as rentry markdown:\n<page>\n${pageText(p, 9000)}\n</page>`;
  return [{ role: 'system' as const, content: system }, { role: 'user' as const, content: user }];
}
