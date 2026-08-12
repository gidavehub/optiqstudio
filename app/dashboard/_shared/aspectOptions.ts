// Shared aspect-ratio option sets, so every rail and sheet draws from one
// source of truth. Ids match what each generation API expects; w/h drive the
// little rectangle the rail draws to scale — the shape IS the label, so nobody
// has to know what "9:16" means.

export interface AspectOption {
  /** Exactly what the generation API expects, e.g. "16:9". */
  id: string;
  label: string;
  /** Ratio numerator/denominator — drives the drawn rectangle's proportions. */
  w: number;
  h: number;
  /** Optional one-line hint, e.g. "Landscape · TV, YouTube". */
  hint?: string;
}

export const VIDEO_ASPECTS: readonly AspectOption[] = [
  { id: "16:9", label: "Landscape", w: 16, h: 9 },
  { id: "9:16", label: "Portrait", w: 9, h: 16 },
];

export const IMAGE_ASPECTS: readonly AspectOption[] = [
  { id: "1:1", label: "Square", w: 1, h: 1 },
  { id: "16:9", label: "Landscape", w: 16, h: 9 },
  { id: "9:16", label: "Portrait", w: 9, h: 16 },
  { id: "4:3", label: "Standard", w: 4, h: 3 },
  { id: "3:4", label: "Vertical", w: 3, h: 4 },
];
