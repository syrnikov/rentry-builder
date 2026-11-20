import { createElement, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Keeps something mounted while it animates out. `state` is 'in' while open and 'out' during the exit,
 * so CSS can play a matching leave animation instead of the element vanishing.
 */
export function usePresence(open: boolean, exitMs = 200) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<'in' | 'out'>(open ? 'in' : 'out');
  useEffect(() => {
    if (open) { setMounted(true); setState('in'); return; }
    setState('out');
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return { mounted, state };
}

/**
 * Animates its height to fit the content (ResizeObserver), so rows appearing, errors and streaming text
 * grow smoothly instead of jumping.
 */
export function AutoHeight({ children, className, duration = 260 }: { children: ReactNode; className?: string; duration?: number }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setH(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return createElement(
    'div',
    { className, style: { height: h, overflow: 'hidden', transition: `height ${duration}ms cubic-bezier(.22,.9,.28,1)` } },
    createElement('div', { ref: inner, style: { display: 'flow-root' } }, children),
  );
}
