/** Platform helpers for a native feel (shortcut labels, installed-app detection). */

const nav = typeof navigator !== 'undefined' ? navigator : undefined;
const platform = (nav as (Navigator & { userAgentData?: { platform?: string } }) | undefined)?.userAgentData?.platform ?? nav?.platform ?? '';

export const isMac = /mac|iphone|ipad|ipod/i.test(platform);

/** Running as an installed app (Safari "Add to Dock", Chrome/Edge "Install", iOS Home Screen). */
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const MAC: Record<string, string> = { mod: '⌘', ctrl: '⌃', alt: '⌥', shift: '⇧' };
const PC: Record<string, string> = { mod: 'Ctrl', ctrl: 'Ctrl', alt: 'Alt', shift: 'Shift' };
const MAC_ORDER = ['ctrl', 'alt', 'shift', 'mod'];

/**
 * Shortcut label in the platform's convention.
 * kbd('mod', 'shift', 'Z') → "⇧⌘Z" on macOS, "Ctrl+Shift+Z" elsewhere.
 */
export function kbd(...keys: string[]): string {
  const mods = keys.filter((k) => k in MAC);
  const rest = keys.filter((k) => !(k in MAC));
  if (isMac) return [...MAC_ORDER.filter((m) => mods.includes(m)).map((m) => MAC[m]), ...rest].join('');
  return [...mods.map((m) => PC[m]), ...rest].join('+');
}
