import { create } from 'zustand';

/**
 * AI settings live in their own localStorage entry, never in the project, the export or the UI state.
 * The key is only ever sent to api.openai.com.
 */
export interface AISettings {
  key: string;
  model: string;
  /** Show the ✦ AI tools at all. Off = the app looks exactly like it did before AI existed. */
  enabled: boolean;
  /** Models the key can use, from the last successful "Test". */
  models: string[];
}

const STORAGE = 'rentry-builder:ai:v1';
export const DEFAULT_MODEL = 'gpt-5-mini';

function load(): AISettings {
  const base: AISettings = { key: '', model: DEFAULT_MODEL, enabled: true, models: [] };
  try {
    const r = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
    if (r && typeof r === 'object') {
      return {
        key: typeof r.key === 'string' ? r.key : '',
        model: typeof r.model === 'string' && r.model.trim() ? r.model : DEFAULT_MODEL,
        enabled: r.enabled !== false,
        models: Array.isArray(r.models) ? r.models.filter((m: unknown) => typeof m === 'string') : [],
      };
    }
  } catch { /* storage unavailable */ }
  return base;
}

export const useAI = create<AISettings & { update: (p: Partial<AISettings>) => void }>((set, get) => ({
  ...load(),
  update: (p) => {
    set(p);
    const { key, model, enabled, models } = get();
    try { localStorage.setItem(STORAGE, JSON.stringify({ key, model, enabled, models })); } catch { /* storage unavailable */ }
  },
}));

/** A key is set (the tools may still be hidden). */
export const hasKey = () => !!useAI.getState().key.trim();
