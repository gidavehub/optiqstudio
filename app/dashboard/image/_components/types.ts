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

export const ASPECTS = [
  { id: "1:1", label: "Square", desc: "1:1 · Social, avatars", iconClass: "w-4 h-4" },
  { id: "16:9", label: "Widescreen", desc: "16:9 · Landscape, Cinematic", iconClass: "w-6 h-3.5" },
  { id: "9:16", label: "Portrait", desc: "9:16 · Mobile, Stories", iconClass: "w-3.5 h-6" },
  { id: "4:3", label: "Standard", desc: "4:3 · Classic Photography", iconClass: "w-5 h-4" },
  { id: "3:4", label: "Vertical", desc: "3:4 · Editorial, Posters", iconClass: "w-4 h-5" },
];
