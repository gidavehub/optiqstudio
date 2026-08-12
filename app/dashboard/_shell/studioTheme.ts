// Which of the four each studio owns.
//
// One colour per studio, not a palette per studio. The shell puts the matching
// `.studio-*` class on its root (see app/globals.css) and everything below
// paints from --studio / --studio-on / --studio-soft / --studio-ink, so a whole
// screen retints from this one table.
//
// `tint` is the same colour as a raw value, for the places that need it as a
// prop rather than through the cascade — the island's nav marks, which have to
// keep their own colour even while sitting on another studio's fill.

export type StudioColor = "blue" | "red" | "yellow" | "green";

const TINTS: Record<StudioColor, string> = {
  blue: "var(--g-blue)",
  red: "var(--g-red)",
  yellow: "var(--g-yellow)",
  green: "var(--g-green)",
};

const OWNERS: Record<string, StudioColor> = {
  video: "blue",
  image: "red",
  voice: "yellow",
  music: "green",
  // The agent room is the film's own room, and film is Video's colour.
  agent: "blue",
  script: "blue",
  timeline: "blue",
};

/** The studio's colour name. Unknown ids fall back to blue, the house accent. */
export function studioColor(id: string): StudioColor {
  return OWNERS[id] ?? "blue";
}

/** The class that binds --studio* for everything underneath. */
export function studioClass(id: string): string {
  return `studio-${studioColor(id)}`;
}

/** The raw colour, for `tint` props and inline fills. */
export function studioTint(id: string): string {
  return TINTS[studioColor(id)];
}

const ONS: Record<StudioColor, string> = {
  blue: "var(--g-blue-on)",
  red: "var(--g-red-on)",
  yellow: "var(--g-yellow-on)",
  green: "var(--g-green-on)",
};

/**
 * The type colour that survives on that studio's fill. Never assume white:
 * yellow carries near-black. Pair every use of studioTint with this.
 */
export function studioOn(id: string): string {
  return ONS[studioColor(id)];
}
