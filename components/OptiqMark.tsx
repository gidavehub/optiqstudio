// The Optiq Studio mark: a solid ink disc with the "O" knocked out of it.
//
// Canonical source is app/icon.svg (the favicon), which has to hardcode its
// colours because a favicon cannot read CSS variables. This one uses the theme
// tokens instead, so it inverts correctly with the shell.
//
// Extracted because the same two circles were inlined in five places — the
// floating chrome, the editor top bar, the landing header, login and plans — and
// the agent needed a sixth. `currentColor` is not used deliberately: the ring has
// to be the CANVAS colour, not a tint of the disc, or it fills in at small sizes.

import React from "react";

interface OptiqMarkProps {
  /** Rendered width and height in px. The mark is square. */
  size?: number;
  className?: string;
  /**
   * Swap disc and ring, for use on an inked surface (a filled tab, a dark
   * button) where the default would disappear into its own background.
   */
  inverted?: boolean;
}

export default function OptiqMark({ size = 18, className = "", inverted = false }: OptiqMarkProps) {
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
      <circle cx="16" cy="16" r="16" className={inverted ? "fill-background" : "fill-foreground"} />
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
