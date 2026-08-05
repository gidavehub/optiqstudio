// One place that turns a stored aspect ratio into a box of the right shape.
//
// WHY INLINE STYLES AND NOT TAILWIND
// The obvious move is `aspect-[${w}/${h}]`, and it silently does nothing.
// Tailwind generates utilities by scanning source text at build time, so a class
// assembled at runtime is never compiled — the element just falls back to auto
// height. Every ratio here is data (it comes out of Firestore), so it has to be
// an inline style. Don't "tidy" these back into class names.
//
// The studios only ever emit the ids in _shared/aspectOptions.ts, but stored
// docs are years-deep and were written by several older code paths, so the
// parser is deliberately permissive about separators and falls back rather than
// throwing.

import type { CSSProperties } from "react";

/** What to assume when a record predates aspectRatio being stored at all. */
export const DEFAULT_ASPECT = "16:9";

/**
 * Parses "16:9" / "16/9" / "16x9" / 1.7777 into a width-over-height number.
 * Returns null for anything unusable so callers can fall back deliberately.
 */
export function aspectToNumber(aspect?: string | number | null): number | null {
  if (typeof aspect === "number") {
    return Number.isFinite(aspect) && aspect > 0 ? aspect : null;
  }
  if (typeof aspect !== "string") return null;

  const parts = aspect.trim().split(/[:/x]/i);
  if (parts.length === 2) {
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return w / h;
    return null;
  }

  const single = Number(aspect);
  return Number.isFinite(single) && single > 0 ? single : null;
}

/**
 * Inline style sizing a container to its media's shape.
 *
 * Pair it with `w-full` in a fixed-width slot (a grid card): the width is
 * settled and the height follows. For a preview that must fit a viewport, pair
 * it with a bounded height instead — see `aspectFitStyle`.
 */
export function aspectStyle(
  aspect?: string | number | null,
  fallback: string = DEFAULT_ASPECT
): CSSProperties {
  const ratio = aspectToNumber(aspect) ?? aspectToNumber(fallback) ?? 16 / 9;
  return { aspectRatio: String(ratio) };
}

/**
 * Sizing for a card in a fixed-width grid slot.
 *
 * The naive reading of "the box should match the media" is to set the ratio and
 * let a full-width card derive its height. For landscape that is right. For
 * portrait it is not: at the same column width a 9:16 comes out THREE TIMES the
 * height of the 16:9 beside it, which is not "matching", it is one card
 * bullying the row.
 *
 * So the constraint flips with the orientation. Landscape and square fill the
 * column and derive height. Portrait is driven by height instead and derives a
 * narrower width, centred in its slot — the shape is still exactly right, the
 * footprint is comparable, and nothing is cropped.
 */
export function gridBox(aspect?: string | number | null): {
  style: CSSProperties;
  className: string;
} {
  const ratio = aspectToNumber(aspect) ?? 16 / 9;
  const style = { aspectRatio: String(ratio) };
  if (ratio >= 1) return { style, className: "w-full" };
  return { style, className: "mx-auto h-[170px] max-w-full sm:h-[230px] lg:h-[270px]" };
}

/**
 * Same idea for a single hero preview rather than a grid card — the scene
 * render panel, the finished-ad screen. Portrait gets a more generous cap
 * because it is the thing you came to look at, but it is still bounded so it
 * cannot run off the bottom of the page.
 */
export function previewBox(aspect?: string | number | null): {
  style: CSSProperties;
  className: string;
} {
  const ratio = aspectToNumber(aspect) ?? 16 / 9;
  const style = { aspectRatio: String(ratio) };
  if (ratio >= 1) return { style, className: "w-full" };
  return { style, className: "mx-auto h-[320px] max-w-full sm:h-[420px] lg:h-[min(60vh,520px)]" };
}

/**
 * Sizing for a preview that must fit inside a bounded parent — the scene
 * render panel, the finished-ad screen, a detail view.
 *
 * The height is the driver here and the width follows from the ratio, which is
 * what stops a 9:16 from running off the bottom of the page. `maxWidth: 100%`
 * catches the other direction, where a wide 16:9 would overflow a narrow
 * column. The parent needs a definite height (a flex child with `min-h-0`) for
 * `height: 100%` to resolve.
 */
export function aspectFitStyle(
  aspect?: string | number | null,
  fallback: string = DEFAULT_ASPECT
): CSSProperties {
  return { ...aspectStyle(aspect, fallback), height: "100%", maxWidth: "100%" };
}

/** True for anything taller than it is wide. */
export function isPortrait(aspect?: string | number | null): boolean {
  const ratio = aspectToNumber(aspect);
  return ratio !== null && ratio < 1;
}

/**
 * The aspect ratio a generation record was made at.
 *
 * Video has stored `aspectRatio` for a while; image only started with the
 * change that added this file, so older stills have nothing and land on the
 * default. `width`/`height` win when present — they're measured from the file
 * itself and so beat a requested ratio the model may not have honoured exactly.
 */
export function recordAspect(record?: {
  aspectRatio?: string | null;
  width?: number | null;
  height?: number | null;
} | null): string | number {
  if (record?.width && record?.height && record.width > 0 && record.height > 0) {
    return record.width / record.height;
  }
  return record?.aspectRatio || DEFAULT_ASPECT;
}
