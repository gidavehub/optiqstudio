// Shared types + constants for the Video Studio panels.

export interface HistoryItem {
  id: string;
  status: string;
  prompt: string;
  videoUrl: string | null;
  createdAt: string;
  /** Reference images attached at generation time (Storage paths). */
  images?: { path?: string; mimeType?: string }[];
}

export const ASPECTS = ["16:9", "9:16"] as const;
export const DURATIONS = [4, 6, 8, 10] as const;
export const RESOLUTIONS = ["720p", "1080p"] as const;

export type Aspect = (typeof ASPECTS)[number];
export type Duration = (typeof DURATIONS)[number];
export type Resolution = (typeof RESOLUTIONS)[number];

export interface AttachedImage {
  id: string;
  base64: string;
  mimeType: string;
  preview: string;
}

export interface AttachedVideo {
  base64: string;
  mimeType: string;
  preview: string;
}

export interface AttachedAudio {
  base64: string;
  mimeType: string;
  preview: string;
  name: string;
}
