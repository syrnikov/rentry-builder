/** Minimal browser client for the OpenAI Chat Completions API (bring-your-own key, no server). */

const BASE = 'https://api.openai.com/v1';

export type AIErrorKind = 'key' | 'quota' | 'rate' | 'model' | 'network' | 'abort' | 'other';

export class AIError extends Error {
  constructor(message: string, public kind: AIErrorKind) { super(message); }
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

export interface ChatOptions {
  key: string;
  model: string;
  messages: ChatMessage[];
  /** Ask for a JSON object (response_format: json_object). */
  json?: boolean;
  signal?: AbortSignal;
  /** Stream the answer; called with each new piece and the text so far. */
  onDelta?: (piece: string, full: string) => void;
  maxTokens?: number;
}

/** Reasoning models (GPT-5, o-series) accept reasoning_effort; low keeps them quick. */
const isReasoningModel = (m: string) => /^(gpt-[5-9]|o\d)/i.test(m.trim());

export function mapError(status: number, message: string): AIError {
  const m = message || '';
  if (status === 401) return new AIError('OpenAI didn’t accept this API key. Check it in AI settings.', 'key');
  if (status === 404 || /model.*(does not exist|not found|access)/i.test(m)) return new AIError(`This key can’t use that model. Pick another one in AI settings.${m ? ` (${m})` : ''}`, 'model');
  if (status === 429 && /quota|billing|credit/i.test(m)) return new AIError('Your OpenAI account is out of credit. Add billing at platform.openai.com.', 'quota');
  if (status === 429) return new AIError('OpenAI is rate-limiting this key. Wait a moment and try again.', 'rate');
  if (status >= 500) return new AIError('OpenAI is having trouble right now. Try again in a bit.', 'other');
  return new AIError(m || `OpenAI returned an error (${status}).`, 'other');
}

async function post(path: string, key: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  try {
    return await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) throw new AIError('Cancelled', 'abort');
    throw new AIError('Couldn’t reach OpenAI. Check your internet connection.', 'network');
  }
}

export async function chat(o: ChatOptions): Promise<string> {
  let effort = isReasoningModel(o.model);
  for (let attempt = 0; attempt < 2; attempt++) {
    const body: Record<string, unknown> = {
      model: o.model.trim(),
      messages: o.messages,
      max_completion_tokens: o.maxTokens ?? 12000,
      // Don't keep this request in OpenAI's stored completions / dashboard logs.
      store: false,
    };
    if (o.json) body.response_format = { type: 'json_object' };
    if (effort) body.reasoning_effort = 'low';
    if (o.onDelta) body.stream = true;

    const res = await post('/chat/completions', o.key, body, o.signal);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      const msg: string = err?.error?.message ?? '';
      // Some models don't take reasoning_effort: retry once without it.
      if (res.status === 400 && effort && /reasoning/i.test(msg)) { effort = false; continue; }
      throw mapError(res.status, msg);
    }
    if (o.onDelta) return readStream(res, o.onDelta, o.signal);

    const data = await res.json();
    const choice = data?.choices?.[0];
    const text: string = choice?.message?.content ?? '';
    if (!text && choice?.finish_reason === 'length') throw new AIError('The answer ran out of room. Try a smaller request.', 'other');
    if (!text && choice?.message?.refusal) throw new AIError(choice.message.refusal, 'other');
    return text;
  }
  throw new AIError('OpenAI request failed.', 'other');
}

/** Parses a Server-Sent Events body of chat-completion chunks. Exported for tests. */
export function createSSEParser(onDelta: (piece: string) => void) {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const piece = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof piece === 'string' && piece) onDelta(piece);
      } catch { /* partial or keep-alive line */ }
    }
  };
}

async function readStream(res: Response, onDelta: (piece: string, full: string) => void, signal?: AbortSignal): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  const feed = createSSEParser((piece) => { full += piece; onDelta(piece, full); });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      feed(decoder.decode(value, { stream: true }));
    }
  } catch {
    if (signal?.aborted) throw new AIError('Cancelled', 'abort');
    throw new AIError('The connection to OpenAI dropped. Try again.', 'network');
  }
  return full;
}

/** Chat models this key can use, for the settings picker. */
export async function listModels(key: string, signal?: AbortSignal): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/models`, { headers: { Authorization: `Bearer ${key.trim()}` }, signal });
  } catch {
    throw new AIError('Couldn’t reach OpenAI. Check your internet connection.', 'network');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw mapError(res.status, err?.error?.message ?? '');
  }
  const data = await res.json();
  const ids: string[] = (data?.data ?? []).map((m: { id: string }) => m.id).filter((id: unknown): id is string => typeof id === 'string');
  return ids
    .filter((id) => /^(gpt-|o\d|chatgpt-)/.test(id) && !/(audio|realtime|tts|transcribe|image|search|embedding|instruct|moderation|codex|computer-use|deep-research)/.test(id))
    .sort();
}

/** Pulls a JSON object out of a reply, tolerating ```json fences or stray text around it. */
export function parseJSONReply<T = unknown>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(t) as T; } catch { /* fall through */ }
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)) as T; } catch { /* fall through */ }
  }
  throw new AIError('The AI reply wasn’t in the expected format. Try again.', 'other');
}
