// The Optiq Studio mark: an aperture in four colours with the "O" knocked out.
//
// It used to be a solid ink disc. That read as a utility, not as a generation
// platform — the whole product was black and white and the mark was the reason
// it never had a chance to be anything else. Now the disc is quartered into the
// four brand colours (blue, red, yellow, green, declared on :root in
// app/globals.css) and the ring is still cut out of it, so the silhouette is
// unchanged and everything that already places the mark keeps working.
//
// The ring is the CANVAS colour, not currentColor and not a tint of the disc —
// that is load-bearing. A tint fills in at 18px and the mark turns into a dot.
//
// Canonical source for the shape is app/icon.svg (the favicon), which has to
// hardcode its colours because a favicon cannot read CSS variables.

import React from "react";

interface OptiqMarkProps {
  /** Rendered width and height in px. The mark is square. */
  size?: number;
  className?: string;
  /**
   * Swap the ring to the ink colour, for use on an inked surface (a filled tab,
   * a dark button) where a canvas-coloured ring would disappear.
   */
  inverted?: boolean;
  /**
   * Draw the whole disc in currentColor instead of the four. For the rare place
   * that genuinely needs one colour — a single-tone print, a disabled state, or
   * a surface already carrying one of the four, where the mark would clash.
   */
  mono?: boolean;
}

// The four, as one continuous sweep rather than four quarters.
//
// Quartering the disc was the obvious way to get four colours into a mark and
// the wrong one: at 18px the seams turn into four hard edges meeting at a point
// and the thing reads as a pie chart. Blended, it reads as light through a lens
// — which is what a generation platform's mark should be doing.
//
// The stop ORDER is the whole trick. These four have to be arranged so that
// every neighbour blends into a colour worth looking at: blue→green passes
// through teal, green→yellow through lime, yellow→red through orange. The one
// pairing to never put next to each other is blue and red, which meets in the
// middle as muddy purple — so the sweep runs blue, green, yellow, red and the
// two ends never touch.
//
// One fixed gradient id, deliberately: every instance on a page defines the
// identical gradient, so the browser resolving them all to the first is exactly
// right, and this stays a plain component that server pages can render.
const GRADIENT_ID = "optiq-mark-sweep";

const STOPS = [
  { offset: "0%", color: "var(--g-blue)" },
  { offset: "36%", color: "var(--g-green)" },
  { offset: "68%", color: "var(--g-yellow)" },
  { offset: "100%", color: "var(--g-red)" },
];

export default function OptiqMark({
  size = 18,
  className = "",
  inverted = false,
  mono = false,
}: OptiqMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {!mono && (
        <defs>
          {/* Corner to corner, so the sweep crosses the widest part of the disc
              and no single colour owns a whole side. */}
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            {STOPS.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
      )}

      {mono ? (
        <circle cx="16" cy="16" r="16" className={inverted ? "fill-background" : "fill-foreground"} />
      ) : (
        <circle cx="16" cy="16" r="16" fill={`url(#${GRADIENT_ID})`} />
      )}
      <circle
        cx="16"
        cy="16"
        r="8"
        fill="none"
        className={inverted ? "stroke-foreground" : "stroke-background"}
        strokeWidth={4}
      />
    </svg>
  );
}
