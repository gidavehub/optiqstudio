// Shared types + constants for the Image Studio panels.

export interface GenerationItem {
  id: string;
  status: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
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
