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

// ── The shot board ──────────────────────────────────────────────────────────
//
// The film, photographed before it is filmed: a still of every location, a still
// of every object whose look must not change, and one frame per camera setup
// inside every scene. Those frames are then attached to the scene's render as
// the clip's own frames — which is what stops the room, the seating and the
// props drifting between clips.
//
// Entirely SERVER-OWNED. Built by functions/shotBoard (see functions/shotBoardRun.js),
// read here, and never written by the client — the same rule audioStage follows,
// for the same reason: an autosave echoing stale status over a running job is how
// a finished pass ends up looking unfinished forever.

/** One camera setup, and the still that was photographed of it. */
export interface ShotFrame {
  id?: string;
  order: number;
  /** "0.0–5.0s" — where this setup sits inside the ten seconds. */
  time: string;
  /** Six words, for the strip. "Low wide from the passenger footwell". */
  label: string;
  camera: string;
  blocking: string;
  /** The frozen instant this still shows. */
  firstFrame: string;
  /** What moves across this setup's seconds once the clip is running. */
  motion: string;
  entry: "straight-into-action" | "held-then-moves";
  characters?: string[];
  propKeys?: string[];
  /** Absent until the frame has actually been photographed. */
  url?: string;
  path?: string;
  mimeType?: string;
  renderedAt?: string;
}

export interface SceneShotBoard {
  sceneNumber: number;
  locationKey: string | null;
  /** The designer's own one-line account of how the scene is covered. */
  coverage: string;
  shots: ShotFrame[];
  builtAt?: string;
}

/** A location, and the empty-room plate photographed of it. */
export interface ShotBoardPlate {
  key: string;
  name: string;
  scenes?: number[];
  /** Locations only: where things are, including who sits where in a vehicle. */
  geometry?: string;
  /** Objects only: what must stay legible and identical every time. */
  detail?: string;
  kind?: string;
  vehicle?: boolean;
  url?: string;
  path?: string;
  mimeType?: string;
}

export interface ShotBoard {
  continuity?: {
    locations?: ShotBoardPlate[];
    props?: ShotBoardPlate[];
  };
  setPlates?: ShotBoardPlate[];
  propPlates?: ShotBoardPlate[];
  /** Keyed by 0-based scene index. Firestore hands the keys back as strings. */
  scenes?: Record<string | number, SceneShotBoard>;
  violations?: string[];
  notes?: string[];
  builtAt?: string;
}

/**
 * "framing" and the rest are working states; "ready", "partial" and "failed" are
 * terminal. "partial" is honest rather than broken — some scenes are photographed
 * and the rest render from their prompts, exactly as every film did before the
 * board existed.
 */
export type ShotBoardStage =
  | "queued"
  | "designing"
  | "plating"
  | "framing"
  | "ready"
  | "partial"
  | "failed"
  | null;

export const SHOT_BOARD_WORKING_STAGES = ["queued", "designing", "plating", "framing"];

export interface ShotBoardProgress {
  step?: string;
  scenesDone?: number;
  scenesTotal?: number;
  platesDone?: number;
  platesTotal?: number;
  framesDone?: number;
  framesTotal?: number;
  queuedForContinuation?: number;
}

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

/**
 * The storyboard wizard is a full-screen, one-question-at-a-time flow.
 *
 * Steps are IDENTIFIED, not numbered. They used to be `1 | 2 | … | 8` and the
 * numbers were written into every branch, which is why this file used to carry
 * the comment "steps shifted by one when the video-type screen was inserted at
 * 2" — every insertion re-numbered the whole flow by hand. It also cannot express
 * what the flow now actually is: an original story skips three steps, because it
 * has no brand, no product and no materials to collect.
 *
 * The order and the membership both come from `wizardStepsFor`.
 */
export type WizardStepId =
  | "projects"   // create new / reopen. Its own screen, nothing competing.
  | "type"       // what kind of film. First, because it decides everything below.
  | "mode"       // short film only: advert or original story.
  | "length"     // run-time. After type, which decides the run-times on offer.
  | "vision"     // the prompt.
  | "canvas"     // orientation.
  | "brand"      // ads only.
  | "product"    // ads only.
  | "materials"; // ads only, and the step that generates.

/** Where a fresh wizard starts. */
export const FIRST_WIZARD_STEP: WizardStepId = "projects";

/**
 * The steps this kind of film actually asks for, in order.
 *
 * An ORIGINAL STORY has no brand, no product and no logo to upload, so it is not
 * asked for any of them — a wizard that collects a brand name for a film with no
 * brand is collecting a placeholder, and the swarm downstream would dutifully
 * write a film selling "Client".
 */
export function wizardStepsFor(id: VideoTypeId): WizardStepId[] {
  const steps: WizardStepId[] = ["projects", "type"];
  if (isShortFilm(id)) steps.push("mode");
  steps.push("length", "vision", "canvas");
  if (videoType(id).branded) steps.push("brand", "product", "materials");
  return steps;
}

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

export type VideoTypeId = "short-film" | "short-film-story" | "dialogue-ad" | "voiceover-ad";

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
  /**
   * Does this type get its own card on "What are we making?"
   *
   * The original story does not: it is reached by picking Short film and then
   * choosing between an advert and a story. Three cards is the picker's whole
   * design — a fourth would push it off a phone — and the ad/story choice is a
   * different question from the format anyway.
   */
  card: boolean;
  /**
   * Is this film selling something?
   *
   * The one flag that decides which of the two storyboard systems builds it:
   * `true` → functions/optiqSkills (the ad swarm), `false` → functions/optiqStory.
   * It also decides whether the wizard collects a brand brief at all.
   */
  branded: boolean;
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
    card: true,
    branded: true,
  },
  {
    id: "voiceover-ad",
    title: "Narrator",
    lengths: ["30s", "60s", "90s"],
    clip: "/media/type-voiceover-ad.mp4",
    dialogueInVideo: false,
    ttsVoiceover: true,
    audioLabel: "Voiceover + composed score",
    card: true,
    branded: true,
  },
  {
    id: "dialogue-ad",
    title: "Dialogue",
    lengths: ["30s", "60s", "90s"],
    clip: "/media/type-dialogue-ad.mp4",
    dialogueInVideo: true,
    ttsVoiceover: false,
    audioLabel: "Dialogue + composed score",
    card: true,
    branded: true,
  },
  {
    // The only unbranded type, and the only one built by functions/optiqStory.
    // Not a card: it lives behind Short film, on its own screen.
    id: "short-film-story",
    title: "Original story",
    lengths: ["60s", "90s", "120s", "150s", "180s"],
    clip: "/media/mode-short-film-story.mp4",
    dialogueInVideo: true,
    ttsVoiceover: false,
    audioLabel: "Dialogue + composed score",
    card: false,
    branded: false,
  },
];

/** The types that appear on "What are we making?" — three, across at any width. */
export const VIDEO_TYPE_CARDS: VideoType[] = VIDEO_TYPES.filter((t) => t.card);

/** Both halves of the short-film choice: an advert, or a story told for itself. */
export function isShortFilm(id?: VideoTypeId | string | null): boolean {
  return id === "short-film" || id === "short-film-story";
}

/**
 * The two things a short film can be, in the order they are shown.
 *
 * The ADVERT comes first and is what picking "Short film" already means, so a
 * director who wants what this platform has always made does not have to choose
 * anything — they press Continue.
 */
export interface ShortFilmMode {
  id: VideoTypeId;
  title: string;
  /** One line. The cover clip is the explanation; this only confirms it. */
  blurb: string;
  clip: string;
}

export const SHORT_FILM_MODES: ShortFilmMode[] = [
  {
    id: "short-film",
    title: "Advert",
    blurb: "Your product, told as a film.",
    clip: "/media/mode-short-film-ad.mp4",
  },
  {
    id: "short-film-story",
    title: "Original story",
    blurb: "A story for its own sake. No brand, no pitch.",
    clip: "/media/mode-short-film-story.mp4",
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
