// Shared aspect-ratio option sets, so the desktop rails and the compact mobile
// strips draw from one source of truth. Ids match what each generation API
// expects; w/h drive the little drawn rectangle.

import type { AspectOption } from "./AspectRatioPicker";

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
