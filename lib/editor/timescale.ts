/**
 * Optiq Editor Engine — timeline ↔ pixel mapping (pure).
 *
 * Converts between timeline seconds and horizontal pixels for a given zoom
 * (pixels-per-second) and horizontal scroll offset, and generates ruler ticks.
 * No DOM — the UI feeds it viewport width / scroll and renders the result.
 */

export interface TimeScale {
  /** Horizontal zoom. */
  pxPerSecond: number;
  /** Left scroll offset in px (time at x=0 is scrollX / pxPerSecond). */
  scrollX: number;
}

export const MIN_PX_PER_SECOND = 4;
export const MAX_PX_PER_SECOND = 600;

export function clampZoom(pxPerSecond: number): number {
  return Math.max(MIN_PX_PER_SECOND, Math.min(MAX_PX_PER_SECOND, pxPerSecond));
}

export function timeToX(time: number, scale: TimeScale): number {
  return time * scale.pxPerSecond - scale.scrollX;
}

export function xToTime(x: number, scale: TimeScale): number {
  return (x + scale.scrollX) / scale.pxPerSecond;
}

/**
 * Zoom by `factor` while keeping the time under viewport-x `anchorX` fixed
 * (mouse-centered zoom). Returns a new TimeScale with adjusted scroll.
 */
export function zoomAround(scale: TimeScale, factor: number, anchorX: number): TimeScale {
  const pxPerSecond = clampZoom(scale.pxPerSecond * factor);
  const anchorTime = xToTime(anchorX, scale);
  // Keep anchorTime at anchorX: anchorTime*pps - scrollX = anchorX.
  const scrollX = Math.max(0, anchorTime * pxPerSecond - anchorX);
  return { pxPerSecond, scrollX };
}

/** Clamp scroll so the view never runs past the content (with slack). */
export function clampScroll(scrollX: number, scale: TimeScale, duration: number, viewportWidth: number): number {
  const contentWidth = duration * scale.pxPerSecond;
  const max = Math.max(0, contentWidth - viewportWidth * 0.5);
  return Math.max(0, Math.min(scrollX, max));
}

const NICE_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

/** Smallest "nice" seconds-per-tick that keeps ticks ≥ minPxPerTick apart. */
export function niceInterval(pxPerSecond: number, minPxPerTick = 64): number {
  for (const step of NICE_STEPS) {
    if (step * pxPerSecond >= minPxPerTick) return step;
  }
  return NICE_STEPS[NICE_STEPS.length - 1];
}

export interface RulerTick {
  time: number;
  x: number;
  major: boolean;
  label?: string;
}

/**
 * Ruler ticks visible in `[0, viewportWidth]`. Every 5th tick is `major` and
 * labelled. Bounded by `duration` (+ a little slack) so we don't tick forever.
 */
export function rulerTicks(
  scale: TimeScale,
  viewportWidth: number,
  duration: number,
  minPxPerTick = 64
): RulerTick[] {
  const step = niceInterval(scale.pxPerSecond, minPxPerTick);
  const startTime = Math.max(0, Math.floor(xToTime(0, scale) / step) * step);
  const endTime = Math.min(duration + step, xToTime(viewportWidth, scale));
  const ticks: RulerTick[] = [];
  // Guard against pathological loops if pxPerSecond is tiny.
  const maxTicks = 2000;
  let i = 0;
  for (let t = startTime; t <= endTime + 1e-6 && i < maxTicks; t += step, i++) {
    const time = round6(t);
    const major = Math.abs((time / step) % 5) < 1e-6;
    ticks.push({
      time,
      x: timeToX(time, scale),
      major,
      label: major ? formatTimecode(time) : undefined,
    });
  }
  return ticks;
}

/** "M:SS", or "M:SS.d" for sub-second steps. Optional frames with fps. */
export function formatTimecode(seconds: number, fps?: number): string {
  const sign = seconds < 0 ? "-" : "";
  const s = Math.abs(seconds);
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  const base = `${sign}${mins}:${secs.toString().padStart(2, "0")}`;
  if (fps && fps > 0) {
    const frames = Math.round((s - Math.floor(s)) * fps);
    return `${base}:${frames.toString().padStart(2, "0")}`;
  }
  const frac = s - Math.floor(s);
  if (frac > 1e-6) return `${base}.${Math.round(frac * 10)}`;
  return base;
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
