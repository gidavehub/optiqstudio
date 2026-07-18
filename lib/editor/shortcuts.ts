/**
 * Optiq Editor Engine — keyboard shortcut resolution (pure).
 *
 * Maps a key event to an abstract EditorAction. The UI calls `resolveShortcut`
 * on keydown and dispatches the result; nothing here touches the engine or the
 * DOM, so the whole map is unit-tested. Uses `meta` on macOS and `ctrl`
 * elsewhere transparently (both are accepted for undo/redo/etc).
 */

export type EditorAction =
  | { type: "playPause" }
  | { type: "split" }
  | { type: "delete" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "nudge"; direction: "left" | "right"; frame: boolean }
  | { type: "zoom"; direction: "in" | "out" }
  | { type: "seek"; to: "start" | "end" }
  | { type: "toggleSnap" }
  | { type: "duplicate" };

export interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  /** When the event targets a text field, the UI sets this so we ignore it. */
  isEditingText?: boolean;
}

/** Resolve a key event to an action, or null if it isn't a shortcut. */
export function resolveShortcut(e: KeyEventLike): EditorAction | null {
  if (e.isEditingText) return null;
  const mod = !!(e.ctrlKey || e.metaKey);
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  // Mod-chords first so plain-letter rules don't shadow them.
  if (mod) {
    switch (key) {
      case "z":
        return e.shiftKey ? { type: "redo" } : { type: "undo" };
      case "y":
        return { type: "redo" };
      case "d":
        return { type: "duplicate" };
      default:
        return null;
    }
  }

  switch (key) {
    case " ":
    case "Spacebar": // legacy key name
      return { type: "playPause" };
    case "s":
    case "b": // razor/blade
      return { type: "split" };
    case "Delete":
    case "Backspace":
      return { type: "delete" };
    case "ArrowLeft":
      return { type: "nudge", direction: "left", frame: !e.shiftKey };
    case "ArrowRight":
      return { type: "nudge", direction: "right", frame: !e.shiftKey };
    case "Home":
      return { type: "seek", to: "start" };
    case "End":
      return { type: "seek", to: "end" };
    case "+":
    case "=":
      return { type: "zoom", direction: "in" };
    case "-":
    case "_":
      return { type: "zoom", direction: "out" };
    case "m":
      return { type: "toggleSnap" };
    default:
      return null;
  }
}
