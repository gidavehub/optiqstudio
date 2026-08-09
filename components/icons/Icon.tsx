// <Icon> — the only way a glyph gets on screen.
//
// Everything about the drawing surface is set here rather than per glyph, which
// is what keeps 60 icons looking like one set:
//
//   • fill and stroke are both currentColor, so an icon is the colour of the
//     text around it and nothing has to be re-themed.
//   • strokeWidth defaults to 0 and strokeLinejoin/Linecap are round, so any
//     glyph that wants soft corners just sets a stroke width and gets the shape
//     inflated and rounded for free (see glyphs.tsx).
//   • aria-hidden unless a title is given. Icons here are decoration sitting
//     next to a real label; the few that stand alone pass `title`.
//
// Size is in px and lands on both width/height — the grid is square.

import React from "react";
import { GLYPHS, IconName } from "./glyphs";

export interface IconProps {
  name: IconName;
  /** Rendered box, px. 18 in dense chrome, 22–26 on the big dock tiles. */
  size?: number;
  className?: string;
  /** Give this ONLY when the icon is the whole control and carries the meaning. */
  title?: string;
}

export default function Icon({ name, size = 20, className = "", title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={0}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {title ? <title>{title}</title> : null}
      {GLYPHS[name]}
    </svg>
  );
}
