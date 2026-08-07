// Shared types + static data for the storyboard editor flow.
// Extracted from the former monolithic dashboard/page.tsx so the provider and
// each stage view can import them without duplication.

export interface Scene {
  sceneNumber: number;
  setting: string;
  action: string;
  dialogue: string;
  sound: string;
  fullPrompt: string;
}

export interface CharacterLock {
  name: string;
  description: string;
  wardrobe: string;
}

export interface Storyboard {
  title: string;
  concept: string;
  characterLock: CharacterLock;
  styleHeader: string;
  scenes: Scene[];
  /** Extra outputs from the agentic Director's Room pipeline. */
  isStory?: boolean;
  storyArc?: string;
  /** Historical name: since the no-music mandate this holds the film's UNSCORED
   * sound bed (locked silence + ambience), not a music spec. */
  musicSpec?: string;
  ambienceSpec?: string;
  /** Which of the three kinds of film the swarm built. */
  videoType?: VideoTypeId;
}

/** An image attached to a scene for product/character consistency. Lives in
 * Cloud Storage; `path` is what the render backend consumes. */
export interface SceneImage {
  name: string;
  path: string;
  url: string;
  mimeType: string;
}

export type SceneImagesMap = Record<number, SceneImage[]>;

export type SceneStatus = "idle" | "rendering" | "succeeded" | "failed";

/** One generated clip for a scene. Every render mints a take; none are thrown
 * away, because each one cost real money to make. */
export interface SceneTake {
  /** Generation id from /api/video/generate — also the dedupe key. */
  id?: string;
  url: string;
  createdAt?: string;
  /** The prompt that produced it, so the history explains itself. */
  prompt?: string;
}

export interface VideoStatusEntry {
  id?: string;
  status: SceneStatus;
  url?: string;
  error?: string;
  revisionInput?: string;
  revising?: boolean;
  editingPrompt?: boolean;
  customPrompt?: string;
  /** Every take ever rendered for this scene, oldest first. */
  takes?: SceneTake[];
  /** Index into `takes` that `url` mirrors. */
  activeTake?: number;
}

export type VideoStatusMap = Record<number, VideoStatusEntry>;

/**
 * A scene's take history. Projects that pre-date take history carry a single
 * `url`; it counts as take 1, so the next re-render adds to it instead of
 * silently replacing the only clip the director has.
 */
export function sceneTakes(entry?: VideoStatusEntry): SceneTake[] {
  if (entry?.takes?.length) return entry.takes;
  if (entry?.url) return [{ url: entry.url }];
  return [];
}

/** Index of the take `entry.url` is showing, or -1 when there are none. */
export function activeTakeIndex(entry?: VideoStatusEntry): number {
  const takes = sceneTakes(entry);
  if (takes.length === 0) return -1;
  const stored = entry?.activeTake;
  if (stored !== undefined && stored >= 0 && stored < takes.length) return stored;
  const byUrl = takes.findIndex((t) => t.url === entry?.url);
  return byUrl === -1 ? takes.length - 1 : byUrl;
}

/**
 * Append a freshly rendered take and make it the active one.
 *
 * Idempotent by generation id: the same render can be reported twice (the
 * generate call's poller and the resume-on-load poller both watch it), and that
 * must not produce two entries for one clip.
 */
export function recordTake(entry: VideoStatusEntry | undefined, take: SceneTake): VideoStatusEntry {
  const base: VideoStatusEntry = entry ?? { status: "rendering" };
  const takes = [...sceneTakes(base)];
  const existing = take.id ? takes.findIndex((t) => t.id === take.id) : -1;
  if (existing !== -1) takes[existing] = { ...takes[existing], ...take };
  else takes.push(take);
  const activeTake = existing === -1 ? takes.length - 1 : existing;
  return { ...base, status: "succeeded", url: take.url, id: take.id ?? base.id, takes, activeTake };
}

export interface TimelineItem {
  sceneIndex: number;
  videoUrl: string;
  trimStart: number;
  trimEnd: number;
  volume: number;
}

export type ProjectLength = "30s" | "60s" | "90s" | "120s" | "150s" | "180s";
export type ProductionMode = "manual" | "auto-merge" | null;
export type DashboardView = "home" | "wizard" | "storyboard";

/** The storyboard wizard is a full-screen, one-question-at-a-time flow:
 * 1 projects (create new / reopen) → 2 video type → 3 run-time →
 * 4 vision prompt → 5 orientation → 6 brand name → 7 product/service →
 * 8 brand materials + generate.
 *
 * Step 1 exists purely so the type choice gets a screen of its own with
 * nothing else competing for attention. Type comes before run-time because it
 * decides which run-times are on offer. */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Fields that support voice dictation in the wizard. */
export type DictationTarget = "prompt" | "brand" | "product";

/** Every scene of every film is rendered as a clip of exactly this length. */
export const SCENE_SECONDS = 10;

/** The GMD-per-second rate the whole platform charges for finished video. */
export const GMD_PER_SECOND = 15;

/** "90s" → 90. The stored value is the run-time, so this is the one parser. */
export function lengthSeconds(length: ProjectLength): number {
  return Number(String(length).replace(/[^0-9.]/g, "")) || 0;
}

/**
 * How many scenes a run-time buys.
 *
 * Derived rather than tabulated: this used to be `length === "30s" ? 3 : ... : 9`
 * written out in four separate places (the provider's prepaidRenders, the paywall
 * copy, the wizard's caption and the server pipeline), which silently capped
 * every film at nine scenes the moment longer run-times existed.
 */
export function scenesForLength(length: ProjectLength): number {
  return Math.round(lengthSeconds(length) / SCENE_SECONDS);
}

/**
 * Spec-generation price per run-time, in GMD.
 *
 * One price per film, covering the storyboard AND every scene render — see the
 * `prepaidRenders` allowance. Derived from the platform rate so a new run-time
 * cannot be added at an inconsistent price.
 */
export const LENGTH_PRICING_GMD: Record<ProjectLength, number> = {
  "30s": 30 * GMD_PER_SECOND,
  "60s": 60 * GMD_PER_SECOND,
  "90s": 90 * GMD_PER_SECOND,
  "120s": 120 * GMD_PER_SECOND,
  "150s": 150 * GMD_PER_SECOND,
  "180s": 180 * GMD_PER_SECOND,
};

// ── Video types ─────────────────────────────────────────────────────────────
//
// Three kinds of film, chosen before anything else, because the choice decides
// the available run-times AND how the finished cut is scored and narrated.
//
// The rule they all share: the video model NEVER generates music. Lyria 3 Pro
// composes every score after generation, against the finished cut. What differs
// between them is only where the VOICE comes from — see
// functions/optiqSkills/knowledge/13-sound-policy.md.

export type VideoTypeId = "short-film" | "dialogue-ad" | "voiceover-ad";

export interface VideoType {
  id: VideoTypeId;
  /** The whole card. Deliberately one or two words — nobody reads a paragraph
   * to pick a format, and the cover clip already says what it is. */
  title: string;
  /** Run-times offered for this type, in the order they're shown. */
  lengths: ProjectLength[];
  /** Looping cover clip in /public/media. See scripts/generate-type-clips.mjs. */
  clip: string;
  /** Does the generated footage carry spoken dialogue? */
  dialogueInVideo: boolean;
  /** Is narration added afterwards as a TTS voiceover? */
  ttsVoiceover: boolean;
  /** Audio treatment, spelled out once on the payment confirmation. */
  audioLabel: string;
}

/**
 * Order is the on-screen order, and it is deliberate: the narrated ad sits in
 * the MIDDLE because it is the default, and a default that isn't centred reads
 * like an afterthought.
 */
export const VIDEO_TYPES: VideoType[] = [
  {
    id: "short-film",
    title: "Short film",
    // Capped at 180s deliberately: 18 scenes is already the most the storyboard
    // job can build inside one function invocation. 300s waits for a chunked job.
    lengths: ["60s", "90s", "120s", "150s", "180s"],
    clip: "/media/type-short-film.mp4",
    dialogueInVideo: true,
    ttsVoiceover: false,
    audioLabel: "Dialogue + composed score",
  },
  {
    id: "voiceover-ad",
    title: "Narrator",
    lengths: ["30s", "60s", "90s"],
    clip: "/media/type-voiceover-ad.mp4",
    dialogueInVideo: false,
    ttsVoiceover: true,
    audioLabel: "Voiceover + composed score",
  },
  {
    id: "dialogue-ad",
    title: "Dialogue",
    lengths: ["30s", "60s", "90s"],
    clip: "/media/type-dialogue-ad.mp4",
    dialogueInVideo: true,
    ttsVoiceover: false,
    audioLabel: "Dialogue + composed score",
  },
];

/** What a NEW project starts on. */
export const DEFAULT_VIDEO_TYPE: VideoTypeId = "voiceover-ad";

/**
 * What an unset or unrecognised STORED value resolves to — which is not the same
 * thing as the wizard's default, and must not be.
 *
 * Every film made before types existed carries dialogue in its footage. Resolving
 * those to the narrated type would set their footage gain to 0 in audio post and
 * silence the performances the director already paid to render.
 */
export const LEGACY_VIDEO_TYPE: VideoTypeId = "dialogue-ad";

export function videoType(id?: VideoTypeId | string | null): VideoType {
  return VIDEO_TYPES.find((t) => t.id === id) ?? VIDEO_TYPES.find((t) => t.id === LEGACY_VIDEO_TYPE)!;
}

// ── Run-times, for humans ───────────────────────────────────────────────────

/**
 * "150s" → "2 min 30s".
 *
 * Raw seconds stop reading as a duration somewhere past a minute: "150s" makes
 * you do arithmetic, "2 min 30s" doesn't. Sub-minute run-times stay in seconds,
 * where they're already clearer than "0 min 30s".
 */
export function formatRunTime(length: ProjectLength): string {
  const total = lengthSeconds(length);
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return secs === 0 ? `${mins} min` : `${mins} min ${secs}s`;
}

/**
 * The span a type offers, as one compact label: "1–3 min", "30–90s".
 *
 * Kept in a single unit rather than mixing them — "30s–1 min 30s" is technically
 * right and impossible to skim.
 */
export function formatRunTimeRange(lengths: ProjectLength[]): string {
  if (lengths.length === 0) return "";
  const first = lengthSeconds(lengths[0]);
  const last = lengthSeconds(lengths[lengths.length - 1]);
  if (lengths.length === 1) return formatRunTime(lengths[0]);
  if (first < 60 || last < 60) return `${first}–${last}s`;
  const whole = first % 60 === 0 && last % 60 === 0;
  return whole ? `${first / 60}–${last / 60} min` : `${formatRunTime(lengths[0])}–${formatRunTime(lengths[lengths.length - 1])}`;
}

/**
 * The run-time to fall back to when the type changes under a chosen length.
 * Picking "short film" while 30s is selected must not leave an invalid pair.
 */
export function defaultLengthFor(id: VideoTypeId): ProjectLength {
  const type = videoType(id);
  return type.lengths.includes("60s") ? "60s" : type.lengths[0];
}

export interface BrandMaterial {
  name: string;
  data: string;
}
