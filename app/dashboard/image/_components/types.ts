// Shared types + constants for the Image Studio panels.

export interface GenerationItem {
  id: string;
  status: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
  /** What the still was generated at — "1:1", "9:16", … Only written since
   *  aspect-correct cards landed, so older stills have nothing here. */
  aspectRatio?: string | null;
  cost?: number;
  /** Reference images attached at generation time (Storage paths). */
  images?: { path?: string; mimeType?: string }[];
}

export interface AttachedImage {
  id: string;
  base64: string;
  mimeType: string;
  preview: string;
}
