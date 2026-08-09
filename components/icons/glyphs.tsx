// ── Optiq Solid ───────────────────────────────────────────────────────────
// The house icon set. Every glyph in the product is drawn here rather than
// pulled from a generic library, because a borrowed icon set is the fastest way
// to make a product look like a template of itself.
//
// THE RULES, so a new glyph never looks bolted on:
//
//   Grid        24 x 24. Nothing outside 1.5 .. 22.5.
//   Weight      Bars are 2.6–3.4 wide. This set is deliberately HEAVY; a
//               hairline icon next to Google Sans Bold reads as a placeholder.
//   Corners     Everything is rounded. Rects carry rx; polygons get their
//               rounding from the shared stroke (see below) rather than from
//               hand-authored arcs.
//   Colour      currentColor only. No fills, no strokes, no opacity of their
//               own — a glyph takes the colour of the text it sits in.
//   Holes       A counter (the play triangle inside a frame, the + inside a
//               card) is a second subpath on the SAME path with
//               fillRule="evenodd". Under even-odd any closed subpath sitting
//               inside another is a hole regardless of winding, which is why
//               these are safe to author by hand.
//
// THE STROKE TRICK: <Icon> paints every glyph with fill AND a zero-width
// round-joined stroke. A polygon that wants soft corners just sets
// strokeWidth={2.4} — the stroke inflates the shape by half that in every
// direction and rounds the joins for free. That is why a triangle here is three
// points rather than six arcs. Glyphs that use even-odd holes never set a
// stroke: it would eat the counter from the inside.

import React from "react";

export const GLYPHS = {
  // ── The four studios + the agent ────────────────────────────────────────
  // These five carry the most weight in the product: they're the island's
  // navigation, so they have to be legible at 18px and distinct in silhouette.

  /** Video Studio — a frame with the play knocked out of it. */
  video: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 4h12a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Zm4.6 4.85v6.3L16.6 12l-6-3.15Z"
    />
  ),

  /** Image Studio — a frame with a sun and a ridge knocked out. */
  image: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm3 3.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5.8 17.5h12.4l-4.3-5.6-2.6 3.3-1.7-2-3.8 4.3Z"
    />
  ),

  /** Voice Engine — capsule and cradle. Also the dictate affordance. */
  voice: (
    <>
      <rect x="8.5" y="2" width="7" height="12.4" rx="3.5" />
      <path d="M6 10.75a1.25 1.25 0 0 1 2.5 0 3.5 3.5 0 0 0 7 0 1.25 1.25 0 0 1 2.5 0 6 6 0 0 1-4.75 5.87V19.5H15.5a1.25 1.25 0 1 1 0 2.5h-7a1.25 1.25 0 1 1 0-2.5h2.25v-2.88A6 6 0 0 1 6 10.75Z" />
    </>
  ),

  /** Optiq Music — beamed pair. */
  music: (
    <>
      <path d="M7.8 6.18 22 3.02V6.7L7.8 9.86V6.18Z" />
      <rect x="7.8" y="6" width="2.6" height="12.4" rx="1.3" />
      <rect x="19.4" y="3" width="2.6" height="12.4" rx="1.3" />
      <circle cx="7.1" cy="18.4" r="3.3" />
      <circle cx="18.7" cy="15.4" r="3.3" />
    </>
  ),

  /** Optiq Agent — the ringed core of the brand mark, with its swarm around it. */
  agent: (
    <>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 5.4a6.6 6.6 0 1 1 0 13.2 6.6 6.6 0 0 1 0-13.2Zm0 3.4a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z"
      />
      <circle cx="12" cy="2.3" r="2.3" />
      <circle cx="20.5" cy="19.2" r="2.3" />
      <circle cx="3.5" cy="19.2" r="2.3" />
    </>
  ),

  // ── Places ───────────────────────────────────────────────────────────────

  home: (
    <path d="M11.05 2.42a1.5 1.5 0 0 1 1.9 0l8.5 6.96c.35.28.55.71.55 1.16v9.71c0 .97-.78 1.75-1.75 1.75h-4.5v-5.75c0-.97-.78-1.75-1.75-1.75h-4c-.97 0-1.75.78-1.75 1.75V22h-4.5A1.75 1.75 0 0 1 2 20.25v-9.71c0-.45.2-.88.55-1.16l8.5-6.96Z" />
  ),

  /** The wall of past work. */
  grid: (
    <>
      <rect x="2.6" y="2.6" width="8.3" height="8.3" rx="2.7" />
      <rect x="13.1" y="2.6" width="8.3" height="8.3" rx="2.7" />
      <rect x="2.6" y="13.1" width="8.3" height="8.3" rx="2.7" />
      <rect x="13.1" y="13.1" width="8.3" height="8.3" rx="2.7" />
    </>
  ),

  /** Timeline / cut. */
  film: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm.4 3.1v2.6h2.9V6.1H5.4Zm10.3 0v11.8h2.9V6.1h-2.9Zm-10.3 5v2.6h2.9v-2.6H5.4Zm0 5v2.6h2.9v-2.6H5.4Z"
    />
  ),

  /** Script / storyboard page. */
  script: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 2h12a2.6 2.6 0 0 1 2.6 2.6v14.8A2.6 2.6 0 0 1 18 22H6a2.6 2.6 0 0 1-2.6-2.6V4.6A2.6 2.6 0 0 1 6 2Zm1.6 4.3v2.5h8.8V6.3H7.6Zm0 5v2.5h8.8v-2.5H7.6Zm0 5v2.5h5.4v-2.5H7.6Z"
    />
  ),

  // ── Composer affordances ────────────────────────────────────────────────

  /** Attach stills or clips — a card with a plus cut out of it. */
  addMedia: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm4.75 4.4v3.35H7.4v2.5h3.35v3.35h2.5v-3.35h3.35v-2.5h-3.35V7.4h-2.5Z"
    />
  ),

  /** Attach a voice reference / anything audio. */
  waveform: (
    <>
      <rect x="1.9" y="9.4" width="2.6" height="5.2" rx="1.3" />
      <rect x="6.3" y="6" width="2.6" height="12" rx="1.3" />
      <rect x="10.7" y="2.6" width="2.6" height="18.8" rx="1.3" />
      <rect x="15.1" y="6" width="2.6" height="12" rx="1.3" />
      <rect x="19.5" y="9.4" width="2.6" height="5.2" rx="1.3" />
    </>
  ),

  /** Enhance — a wand, not a burst of stars. */
  enhance: (
    <>
      <path d="M17.9 2.98a2.2 2.2 0 0 1 3.12 3.12L7.22 19.9a2.2 2.2 0 0 1-3.12-3.12L17.9 2.98Z" />
      <path d="M5 1.7 6.85 5 5 8.3 3.15 5 5 1.7Z" strokeWidth={1.4} />
    </>
  ),

  /** Send. */
  send: (
    <path d="M10.75 20.25V7.63l-4.6 4.6a1.77 1.77 0 0 1-2.5-2.5l7.6-7.6a1.77 1.77 0 0 1 2.5 0l7.6 7.6a1.77 1.77 0 0 1-2.5 2.5l-4.6-4.6v12.62a1.75 1.75 0 0 1-3.5 0Z" />
  ),

  play: <path d="M8 3.8 20.6 12 8 20.2V3.8Z" strokeWidth={2.6} />,

  pause: (
    <>
      <rect x="4.6" y="3" width="5.4" height="18" rx="2.4" />
      <rect x="14" y="3" width="5.4" height="18" rx="2.4" />
    </>
  ),

  stop: <rect x="4" y="4" width="16" height="16" rx="4.4" />,

  // ── Verbs ────────────────────────────────────────────────────────────────

  close: (
    <path d="m12 9.17 6.36-6.36a2 2 0 1 1 2.83 2.83L14.83 12l6.36 6.36a2 2 0 1 1-2.83 2.83L12 14.83l-6.36 6.36a2 2 0 0 1-2.83-2.83L9.17 12 2.81 5.64a2 2 0 0 1 2.83-2.83L12 9.17Z" />
  ),

  check: <path d="m4.6 12.4 4.9 4.9L19.4 7.4" strokeWidth={3.4} fill="none" />,

  plus: (
    <path d="M10.1 3.9a1.9 1.9 0 0 1 3.8 0v6.2h6.2a1.9 1.9 0 0 1 0 3.8h-6.2v6.2a1.9 1.9 0 0 1-3.8 0v-6.2H3.9a1.9 1.9 0 0 1 0-3.8h6.2V3.9Z" />
  ),

  minus: <rect x="3" y="10.1" width="18" height="3.8" rx="1.9" />,

  more: (
    <>
      <circle cx="12" cy="4.4" r="2.4" />
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="19.6" r="2.4" />
    </>
  ),

  menu: (
    <>
      <rect x="3" y="4.6" width="18" height="3.2" rx="1.6" />
      <rect x="3" y="10.4" width="18" height="3.2" rx="1.6" />
      <rect x="3" y="16.2" width="18" height="3.2" rx="1.6" />
    </>
  ),

  /** History / side panel. */
  panelLeft: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 3h14a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm5.4 3.1v11.8H19V6.1h-8.6Z"
    />
  ),

  chevronLeft: <path d="M15.2 4.6 7.8 12l7.4 7.4" strokeWidth={3.2} fill="none" />,
  chevronRight: <path d="M8.8 4.6 16.2 12l-7.4 7.4" strokeWidth={3.2} fill="none" />,
  chevronUp: <path d="M4.6 15.2 12 7.8l7.4 7.4" strokeWidth={3.2} fill="none" />,
  chevronDown: <path d="M4.6 8.8 12 16.2l7.4-7.4" strokeWidth={3.2} fill="none" />,

  arrowLeft: (
    <path d="M3.75 12a1.75 1.75 0 0 1 .51-1.24l6.6-6.6a1.75 1.75 0 0 1 2.48 2.48L9.48 10.5h9.02a1.75 1.75 0 0 1 0 3.5H9.48l3.86 3.86a1.75 1.75 0 1 1-2.48 2.48l-6.6-6.6A1.75 1.75 0 0 1 3.75 12Z" />
  ),
  arrowRight: (
    <path d="M20.25 12a1.75 1.75 0 0 0-.51-1.24l-6.6-6.6a1.75 1.75 0 0 0-2.48 2.48l3.86 3.86H5.5a1.75 1.75 0 0 0 0 3.5h9.02l-3.86 3.86a1.75 1.75 0 1 0 2.48 2.48l6.6-6.6c.33-.33.51-.78.51-1.24Z" />
  ),
  arrowUpRight: (
    <path d="M7.6 4.4h10.25c1.02 0 1.85.83 1.85 1.85V16.5a1.85 1.85 0 1 1-3.7 0v-5.79l-8.44 8.44a1.85 1.85 0 0 1-2.62-2.62l8.44-8.44H7.6a1.85 1.85 0 1 1 0-3.69Z" />
  ),

  trash: (
    <>
      <path d="M9.4 1.8h5.2a2 2 0 0 1 2 2v.9h3.6a1.65 1.65 0 0 1 0 3.3H3.8a1.65 1.65 0 0 1 0-3.3h3.6v-.9a2 2 0 0 1 2-2Zm.9 2.9h3.4v-.5h-3.4v.5Z" />
      <path d="M5.6 9.6h12.8l-.78 10.4a2.3 2.3 0 0 1-2.3 2.13H8.68a2.3 2.3 0 0 1-2.29-2.13L5.6 9.6Z" />
    </>
  ),

  copy: (
    <>
      <path d="M8 2h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z" />
      <path d="M3.4 6.6v11a3 3 0 0 0 3 3h11a3 3 0 0 1-3 1.4H6.4a4.4 4.4 0 0 1-4.4-4.4V9.6a3 3 0 0 1 1.4-3Z" />
      <path d="M2 9.6a3 3 0 0 1 3-3v11a3 3 0 0 0 3 3h11a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9.6Z" />
    </>
  ),

  refresh: (
    <path d="M12 3.4c2.6 0 4.93 1.2 6.45 3.08V4.9a1.7 1.7 0 0 1 3.4 0v5.5c0 .94-.76 1.7-1.7 1.7h-5.5a1.7 1.7 0 0 1 0-3.4h2.06A5.2 5.2 0 1 0 17.16 14a1.7 1.7 0 1 1 3.28.9A8.6 8.6 0 1 1 12 3.4Z" />
  ),

  download: (
    <>
      <path d="M10.2 2.9a1.8 1.8 0 0 1 3.6 0v7.35l2.35-2.35a1.8 1.8 0 1 1 2.55 2.55l-5.43 5.42a1.8 1.8 0 0 1-2.54 0L5.3 10.45A1.8 1.8 0 0 1 7.85 7.9l2.35 2.35V2.9Z" />
      <rect x="2.6" y="17.6" width="18.8" height="3.6" rx="1.8" />
    </>
  ),

  upload: (
    <>
      <path d="M10.2 21.1V13.75L7.85 16.1A1.8 1.8 0 0 1 5.3 13.55l5.43-5.42a1.8 1.8 0 0 1 2.54 0l5.43 5.42a1.8 1.8 0 1 1-2.55 2.55l-2.35-2.35v7.35a1.8 1.8 0 0 1-3.6 0Z" />
      <rect x="2.6" y="2.8" width="18.8" height="3.6" rx="1.8" />
    </>
  ),

  share: (
    <>
      <circle cx="18.4" cy="5.2" r="3.4" />
      <circle cx="18.4" cy="18.8" r="3.4" />
      <circle cx="5.6" cy="12" r="3.4" />
      <path d="m7.6 9.4 9-4.6M7.6 14.6l9 4.6" strokeWidth={2.6} fill="none" />
    </>
  ),

  edit: (
    <>
      <path d="M16.3 2.7a2.4 2.4 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.8 1.8-5-5 1.8-1.8Z" />
      <path d="m13.3 5.5 5 5-8.4 8.4-6.3 1.3 1.3-6.3 8.4-8.4Z" />
    </>
  ),

  // ── Account & system ─────────────────────────────────────────────────────

  wallet: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.6 3.6h12.2a3 3 0 0 1 3 3v.9h.6a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-.6v.9a3 3 0 0 1-3 3H4.6a3 3 0 0 1-3-3V6.6a3 3 0 0 1 3-3Zm11.9 6.9a1.75 1.75 0 1 0 0 3.5h2.9v-3.5h-2.9Z"
    />
  ),

  card: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.4 4h15.2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H4.4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm-.5 4.4v1.9h16.2V8.4H3.9Zm0 5.5v1.8h4.9v-1.8H3.9Z"
    />
  ),

  folder: (
    <path d="M2 6.2a3 3 0 0 1 3-3h3.9c.8 0 1.55.38 2.02 1.03l1.06 1.47h7.02a3 3 0 0 1 3 3v9.1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V6.2Z" />
  ),

  terminal: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.4 3h15.2a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H4.4a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm2.5 5.35 2.9 2.9-2.9 2.9 1.85 1.85 4.75-4.75L8.75 6.5 6.9 8.35ZM13 15.05v2.2h5v-2.2h-5Z"
    />
  ),

  logout: (
    <>
      <path d="M4 5a3 3 0 0 1 3-3h4.6a1.8 1.8 0 0 1 0 3.6H7.6v12.8h4a1.8 1.8 0 0 1 0 3.6H7a3 3 0 0 1-3-3V5Z" />
      <path d="M15.55 7.15a1.8 1.8 0 0 1 2.55 0l3.5 3.58a1.8 1.8 0 0 1 0 2.54l-3.5 3.58a1.8 1.8 0 1 1-2.55-2.54l.53-.51h-4.3a1.8 1.8 0 0 1 0-3.6h4.3l-.53-.5a1.8 1.8 0 0 1 0-2.55Z" />
    </>
  ),

  user: (
    <>
      <circle cx="12" cy="7.2" r="4.7" />
      <path d="M3.4 20.1c0-3.85 3.85-6.3 8.6-6.3s8.6 2.45 8.6 6.3a1.9 1.9 0 0 1-1.9 1.9H5.3a1.9 1.9 0 0 1-1.9-1.9Z" />
    </>
  ),

  clock: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.8a10.2 10.2 0 1 1 0 20.4 10.2 10.2 0 0 1 0-20.4Zm-1.6 4.4v6.55l4.85 2.9 1.6-2.68-3.35-2V6.2h-3.1Z"
    />
  ),

  layers: (
    <>
      <path d="M11.15 2.16a2 2 0 0 1 1.7 0l8.3 3.9a1.05 1.05 0 0 1 0 1.9l-8.3 3.9a2 2 0 0 1-1.7 0l-8.3-3.9a1.05 1.05 0 0 1 0-1.9l8.3-3.9Z" />
      <path d="m2.4 11.3 2.9-1.36 5.85 2.75a2 2 0 0 0 1.7 0l5.85-2.75 2.9 1.36a1.05 1.05 0 0 1 0 1.9l-8.3 3.9a2 2 0 0 1-1.7 0l-8.3-3.9a1.05 1.05 0 0 1 0-1.9Z" />
      <path d="m2.4 16.6 2.9-1.36 5.85 2.75a2 2 0 0 0 1.7 0l5.85-2.75 2.9 1.36a1.05 1.05 0 0 1 0 1.9l-8.3 3.9a2 2 0 0 1-1.7 0l-8.3-3.9a1.05 1.05 0 0 1 0-1.9Z" />
    </>
  ),

  sliders: (
    <>
      <rect x="2" y="4.4" width="20" height="3.2" rx="1.6" />
      <rect x="2" y="16.4" width="20" height="3.2" rx="1.6" />
      <circle cx="8.6" cy="6" r="3.6" />
      <circle cx="15.4" cy="18" r="3.6" />
    </>
  ),

  alert: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.28 2.9a2 2 0 0 1 3.44 0l9.02 15.5a2 2 0 0 1-1.72 3.01H2.98a2 2 0 0 1-1.72-3.01L10.28 2.9Zm.22 5.5v5.6h3v-5.6h-3Zm0 7.5v2.9h3v-2.9h-3Z"
    />
  ),

  info: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.8a10.2 10.2 0 1 1 0 20.4 10.2 10.2 0 0 1 0-20.4Zm-1.5 3.9v3h3v-3h-3Zm0 4.9v7.7h3v-7.7h-3Z"
    />
  ),

  checkCircle: (
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.8a10.2 10.2 0 1 1 0 20.4 10.2 10.2 0 0 1 0-20.4Zm-1.75 11.44-2.1-2.1-2.12 2.12 4.22 4.23 7.72-7.72-2.12-2.12-5.6 5.59Z"
    />
  ),

  /** Indeterminate progress — spin it with className="animate-spin". */
  spinner: (
    <path
      d="M12 3.2a8.8 8.8 0 1 0 8.8 8.8"
      fill="none"
      strokeWidth={3.2}
    />
  ),

  // ── Aspect ratios, drawn as the shape they actually make ────────────────
  landscape: <rect x="2.4" y="6.4" width="19.2" height="11.2" rx="2.6" />,
  portrait: <rect x="6.4" y="2.4" width="11.2" height="19.2" rx="2.6" />,
  squareShape: <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3" />,

  // ── Odds and ends the studios reach for ─────────────────────────────────

  volume: (
    <>
      <path d="M11.3 2.9a1.6 1.6 0 0 1 2.6 1.25v15.7a1.6 1.6 0 0 1-2.6 1.25L6.3 17H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2.3l5-4.1Z" />
      <path d="M17.2 7.5a6.4 6.4 0 0 1 0 9M20 4.4a10.4 10.4 0 0 1 0 15.2" strokeWidth={2.6} fill="none" />
    </>
  ),

  volumeOff: (
    <>
      <path d="M11.3 2.9a1.6 1.6 0 0 1 2.6 1.25v15.7a1.6 1.6 0 0 1-2.6 1.25L6.3 17H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2.3l5-4.1Z" />
      <path d="m17.4 9 5 6m0-6-5 6" strokeWidth={2.8} fill="none" />
    </>
  ),

  /** Mic with a bar through it — stop recording. */
  micOff: (
    <>
      <path d="M8.5 5.5a3.5 3.5 0 0 1 7 0v6.02L8.5 4.52V5.5Z" />
      <path d="M6 10.75a1.25 1.25 0 0 1 2.5 0 3.5 3.5 0 0 0 5.3 3l1.85 1.85a6 6 0 0 1-2.4 1.02V19.5h2.25a1.25 1.25 0 1 1 0 2.5h-7a1.25 1.25 0 1 1 0-2.5h2.25v-2.88A6 6 0 0 1 6 10.75Z" />
      <path d="M3.1 2.6a1.6 1.6 0 0 1 2.26 0L21.4 18.64a1.6 1.6 0 1 1-2.26 2.26L3.1 4.86a1.6 1.6 0 0 1 0-2.26Z" />
    </>
  ),

  /** A single sound bar cluster — the "listening" state. */
  pulse: (
    <>
      <rect x="2.4" y="10.2" width="3.2" height="3.6" rx="1.6" />
      <rect x="7.6" y="6.4" width="3.2" height="11.2" rx="1.6" />
      <rect x="12.8" y="2.6" width="3.2" height="18.8" rx="1.6" />
      <rect x="18" y="8.4" width="3.2" height="7.2" rx="1.6" />
    </>
  ),

  message: (
    <path d="M4.6 2.8h14.8a3 3 0 0 1 3 3v8.6a3 3 0 0 1-3 3h-7.1l-4.72 3.85A1.2 1.2 0 0 1 5.7 20.3v-2.9h-1.1a3 3 0 0 1-3-3V5.8a3 3 0 0 1 3-3Z" />
  ),

  lock: (
    <>
      <path d="M12 1.8a5.4 5.4 0 0 1 5.4 5.4v2.4h-3.2V7.2a2.2 2.2 0 0 0-4.4 0v2.4H6.6V7.2A5.4 5.4 0 0 1 12 1.8Z" />
      <rect x="3.6" y="9.4" width="16.8" height="12.8" rx="3.2" />
    </>
  ),
} as const;

export type IconName = keyof typeof GLYPHS;

/** Every glyph name, for the icon sheet at /dashboard/developer and for tests. */
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];
