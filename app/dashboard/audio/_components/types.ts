// Shared types + constants for the Voice Studio panels.

export const VOICES = [
  { id: "Kore", label: "Awa (Wolof)", vibe: "Soft, warm female Wolof speaker" },
  { id: "Charon", label: "Moussa (Wolof)", vibe: "Deep, resonant male Wolof speaker" },
  { id: "Leda", label: "Fatou (Mandinka)", vibe: "Bright, youthful female Mandinka speaker" },
  { id: "Fenrir", label: "Lamin (Mandinka)", vibe: "Gravelly, strong male Mandinka speaker" },
  { id: "Aoede", label: "Chioma (Igbo)", vibe: "Melodic, expressive female Igbo speaker" },
  { id: "Orus", label: "Chinedu (Igbo)", vibe: "Authoritative, firm male Igbo speaker" },
  { id: "Puck", label: "Efe (Nigerian English)", vibe: "Energetic, clear female English speaker" },
  { id: "Enceladus", label: "Kofi (African-British)", vibe: "Contemplative, British-African male accent" },
];

export interface AudioItem {
  id: string;
  prompt: string;
  audioUrl: string | null;
  status?: string;
  error?: string | null;
  createdAt: string;
}

export interface VoiceSample {
  base64: string;
  mimeType: string;
  preview: string;
  name: string;
}

export type EngineMode = "prebuilt" | "clone";
