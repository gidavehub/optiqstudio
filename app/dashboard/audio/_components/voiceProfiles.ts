// The Optiq Voice Engine speaker catalog — the single source of truth for the
// 16 voice profiles shown in Audio Studio.
//
// Each profile pairs a distinct Gemini prebuilt voice (`voice`, sent to the
// generation API) with a face image and a pre-generated sample clip, both keyed
// by the stable `id`:
//   face:   /media/voice-faces/<id>.jpg
//   sample: /media/voice-samples/<id>.wav
//
// The samples + faces are produced by scripts/generate-voice-assets.mjs, whose
// id → voice mapping MUST stay in sync with this list. No voice cloning — these
// prebuilt speakers are the whole engine.

export interface VoiceProfile {
  id: string;
  name: string;
  accent: string;
  region: "West Africa" | "East Africa" | "Southern Africa" | "Diaspora" | "International";
  gender: "female" | "male";
  voice: string; // Gemini prebuilt voice name
  vibe: string;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  // ── West Africa (Gambia / Nigeria) ────────────────────────────────────────
  { id: "awa-wolof", name: "Awa", accent: "Wolof", region: "West Africa", gender: "female", voice: "Kore", vibe: "Soft, warm Gambian storyteller" },
  { id: "moussa-wolof", name: "Moussa", accent: "Wolof", region: "West Africa", gender: "male", voice: "Charon", vibe: "Deep, resonant and reassuring" },
  { id: "fatou-mandinka", name: "Fatou", accent: "Mandinka", region: "West Africa", gender: "female", voice: "Leda", vibe: "Bright, youthful and cheerful" },
  { id: "lamin-mandinka", name: "Lamin", accent: "Mandinka", region: "West Africa", gender: "male", voice: "Fenrir", vibe: "Strong, grounded and bold" },
  { id: "chioma-igbo", name: "Chioma", accent: "Igbo", region: "West Africa", gender: "female", voice: "Aoede", vibe: "Melodic, expressive and inviting" },
  { id: "chinedu-igbo", name: "Chinedu", accent: "Igbo", region: "West Africa", gender: "male", voice: "Orus", vibe: "Authoritative, firm and clear" },
  { id: "efe-naija", name: "Efe", accent: "Nigerian English", region: "West Africa", gender: "female", voice: "Puck", vibe: "Energetic, lively and modern" },
  { id: "zainab-hausa", name: "Zainab", accent: "Hausa", region: "West Africa", gender: "female", voice: "Callirrhoe", vibe: "Poised, graceful and elegant" },

  // ── East & Southern Africa ────────────────────────────────────────────────
  { id: "amara-swahili", name: "Amara", accent: "Kenyan · Swahili", region: "East Africa", gender: "female", voice: "Autonoe", vibe: "Warm, gentle East African" },
  { id: "jabari-swahili", name: "Jabari", accent: "Tanzanian · Swahili", region: "East Africa", gender: "male", voice: "Iapetus", vibe: "Calm, steady and clear" },
  { id: "thabo-southafrican", name: "Thabo", accent: "South African", region: "Southern Africa", gender: "male", voice: "Algenib", vibe: "Bright, upbeat and friendly" },

  // ── Diaspora & International ───────────────────────────────────────────────
  { id: "kofi-afrobrit", name: "Kofi", accent: "African–British", region: "Diaspora", gender: "male", voice: "Enceladus", vibe: "Thoughtful, smooth and calm" },
  { id: "marcus-american", name: "Marcus", accent: "African–American", region: "Diaspora", gender: "male", voice: "Algieba", vibe: "Smooth, deep and charismatic" },
  { id: "grace-american", name: "Grace", accent: "American English", region: "International", gender: "female", voice: "Achernar", vibe: "Confident, polished narrator" },
  { id: "eleanor-british", name: "Eleanor", accent: "British English", region: "International", gender: "female", voice: "Vindemiatrix", vibe: "Refined, articulate and clear" },
  { id: "wei-chinese", name: "Wei", accent: "Chinese · Mandarin", region: "International", gender: "male", voice: "Umbriel", vibe: "Measured, clear and professional" },
];

export const VOICE_REGIONS: VoiceProfile["region"][] = [
  "West Africa",
  "East Africa",
  "Southern Africa",
  "Diaspora",
  "International",
];
