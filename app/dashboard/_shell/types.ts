// Shared shapes for the bold studio shell — the floating island, the rail and
// the two-layer dock. Kept in one file so a studio can describe its whole
// surface as data and let the shell do the drawing.

import type { IconName } from "../../../components/icons";

/** One destination in the floating island. */
export interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  /** Client-side route. Omit and pass onSelect for in-place switches. */
  href?: string;
  onSelect?: () => void;
}

/**
 * One of the four big buttons on the dock's upper layer. This is where the
 * affordances that used to be 16px glyphs inside the input bar now live —
 * attach, dictate, enhance — at a size you can actually hit.
 */
export interface DockTile {
  id: string;
  /** One or two words. This is a button, not a sentence. */
  label: string;
  icon: IconName;
  onSelect?: () => void;
  /** Inked (foreground fill) — the tile is doing something right now. */
  active?: boolean;
  /** Spinner in place of the glyph. */
  busy?: boolean;
  /** Red ink rather than black — recording, destructive. */
  danger?: boolean;
  disabled?: boolean;
  /** Number in the corner, e.g. how many references are attached. */
  badge?: number;
  /** Small word under the label, e.g. the current aspect on the Shape tile. */
  value?: string;
  /** Turns the tile into a file picker instead of a plain button. */
  file?: {
    accept: string;
    multiple?: boolean;
    onFiles: (files: File[]) => void;
  };
}

/** Handed to a studio's tile builder so a tile can drive the shell itself. */
export interface ShellHelpers {
  /** Opens the rail. On phones that's a sheet; on desktop the rail is already
   *  there, so this pulses it instead of doing nothing. */
  openRail: () => void;
  railOpen: boolean;
}
