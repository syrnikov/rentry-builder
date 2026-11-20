import clsx from 'clsx';

/** The moving color field: a conic sweep that turns, plus mesh blobs drifting on out-of-phase loops. */
function Flow() {
  return (
    <span className="ai-flow">
      <i className="ai-sweep" />
      <i className="ai-blob ai-blob-1" />
      <i className="ai-blob ai-blob-2" />
      <i className="ai-blob ai-blob-3" />
    </span>
  );
}

/**
 * Apple Intelligence–style living glow (#0894FF → #C959DD → #FF2E54 → #FF9004). Always mounted, so
 * turning it on or off is a soft fade, never a pop. Only transform and opacity animate (GPU-composited),
 * so it stays smooth and never forces repaints.
 *
 *   bloom   – blurred, breathing halo behind the surface
 *   surface – repaints the element's background above the halo (keeps text readable)
 *   ring    – crisp 1.5px edge
 *
 * The parent needs `position: relative; isolation: isolate`, and its content `position: relative; z-index: 3`.
 */
export function AIGlow({ active, surface, variant = 'full', className }: {
  active: boolean;
  /** The parent's background color, painted by the glow so the halo can sit underneath it. */
  surface?: string;
  variant?: 'full' | 'ring' | 'soft';
  className?: string;
}) {
  return (
    <span aria-hidden className={clsx('ai-glow', `ai-glow--${variant}`, active && 'on', className)}>
      {variant !== 'ring' && <span className="ai-glow-bloom"><span className="ai-glow-breath"><Flow /></span></span>}
      {surface && <span className="ai-glow-surface" style={{ background: surface }} />}
      {variant !== 'soft' && <span className="ai-glow-ring"><Flow /></span>}
    </span>
  );
}
