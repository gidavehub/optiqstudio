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
  /**
   * The voiceover line laid over this scene. Documentaries only.
   *
   * A documentary's footage is silent — `dialogue` is always empty — and its
   * words are written by the swarm as part of the outline, then recorded over
   * the finished cut in audio post. They live on the scene (rather than only in
   * the project's `narrationScript`) so the script editor can show them beside
   * the picture they belong to, and so the agent has one place to edit.
   */
  narration?: string;
  /**
   * The short prompt a PHOTOGRAPHED scene renders from.
   *
   * Once a scene has board frames, everything the long prompt said about how
   * things LOOK is carried by the pictures instead — far more exactly — so the
   * render uses a few hundred words of what HAPPENS: the beats, the dialogue
   * verbatim with the voice that says it, every sound, and where the camera goes.
   *
   * Server-owned, written by the shot board. Only the experimental original story
   * ever has one. Empty or absent whenever the scene has no frames, or when the
   * compressor could not write one that kept every line of dialogue — in which
   * case `fullPrompt` renders, as it always did. Cleared on revision, because a
   * brief compressed from the old script is a brief that ignores the revision.
   * Always read through `renderPrompt()` in ./shotBoard.ts.
   */
  framedPrompt?: string;
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
  /** True for films built by functions/optiqDocumentary. */
  isDocumentary?: boolean;
  storyArc?: string;
  /** Documentary only: the one sentence the film lands, and how it lands it. */
  thesis?: string;
  theClose?: string;
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
// The film, photographed before it is filmed: a still of every place, a still of
// every arrangement inside those places, a still of every object whose look must
// not change, and one frame per camera setup inside every scene. Those frames are
// then attached to the scene's render as the clip's own frames — which is what
// stops the room, the seating and the props drifting between clips.
//
// EXPERIMENTAL ORIGINAL STORY ONLY. This was built for every film once and
// reverted on cost (see git tag `shot-board-experiment`): a hundred-plus images
// before a second of video is the wrong trade for an ad nobody is paying extra
// for. It is back behind one deliberately-chosen, deliberately-expensive film
// type, where the photography IS the product.
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
  /** Whether the camera itself travels across this setup's seconds. */
  cameraMove?: "locked" | "pan" | "tilt" | "push-in" | "pull-back" | "track" | "handheld-drift";
  /** The frozen instant this setup ARRIVES at, when it goes somewhere different. */
  endFrame?: string;
  /** Which dressed arrangement this setup looks at, or "" for a wide of the place. */
  settingKey?: string;
  /** True when this setup shoots back toward where a wide establishing angle stands. */
  reverseAngle?: boolean;
  characters?: string[];
  objectKeys?: string[];
  /** Absent until the frame has actually been photographed. */
  url?: string;
  path?: string;
  mimeType?: string;
  renderedAt?: string;
  /** Why this frame has no picture, when it has none. Drives the Retry button. */
  error?: string;
  /**
   * The still this setup ENDS on, for setups whose camera or action carries the
   * frame somewhere different. Photographed from the first frame, and attached
   * to the render right after it, so a pan is specified by both of its ends
   * instead of by one end and a sentence.
   */
  end?: {
    url?: string;
    path?: string;
    mimeType?: string;
    renderedAt?: string;
  };
}

export interface SceneShotBoard {
  sceneNumber: number;
  environmentKey: string | null;
  /** The designer's own one-line account of how the scene is covered. */
  coverage: string;
  shots: ShotFrame[];
  /** The short render prompt, mirrored onto the scene itself as `framedPrompt`. */
  framedPrompt?: string;
  builtAt?: string;
}

/**
 * One state of one thing: how it looks across the scenes it is true for.
 *
 * The base state is how a thing starts; every other state is a change from the
 * one before it, and its plate is photographed FROM that one — which is how the
 * meal that gets eaten in scene 2 is still eaten in scene 9.
 */
export interface ShotBoardState {
  key: string;
  name: string;
  scenes?: number[];
  isBase?: boolean;
  /** What is physically different from the state before. Empty on the base. */
  change?: string;
}

/** A place the film is shot in. */
export interface ShotBoardEnvironment {
  key: string;
  name: string;
  scenes?: number[];
  lock?: string;
  /** Where things ARE, including who sits where in a vehicle. */
  geometry?: string;
  light?: string;
  vehicle?: boolean;
  needsSecondAngle?: boolean;
  secondAngle?: string;
  states?: ShotBoardState[];
}

/** A dressed arrangement inside a place — the tier that fixes what sits where. */
export interface ShotBoardSetting {
  key: string;
  name: string;
  environmentKey: string;
  scenes?: number[];
  lock?: string;
  /** Exact positions, precise enough that two photographers would match them. */
  layout?: string;
  /** Where people go, by name: who sits in which chair, who stands where. */
  seating?: string;
  objectKeys?: string[];
  states?: ShotBoardState[];
}

/** A thing whose exact appearance has to survive every cut. */
export interface ShotBoardObject {
  key: string;
  name: string;
  kind?: string;
  scenes?: number[];
  anchor?: string;
  /** What must stay legible and identical every time. */
  detail?: string;
  states?: ShotBoardState[];
}

/**
 * One photograph in the hierarchy, identified by which tier it belongs to, which
 * thing it is of, and which STATE of that thing — the same table laid and cleared
 * is two plates under one key.
 */
export interface ShotBoardPlate {
  tier: "environment" | "environment-reverse" | "setting" | "object";
  key: string;
  stateKey: string;
  name: string;
  stateName?: string;
  scenes?: number[];
  geometry?: string;
  layout?: string;
  detail?: string;
  kind?: string;
  vehicle?: boolean;
  environmentKey?: string;
  url?: string;
  path?: string;
  mimeType?: string;
  builtAt?: string;
  /** Why this plate has no picture, when it has none. Drives the Retry button. */
  error?: string;
}

export interface ShotBoard {
  /** The film's world: its places, the arrangements in them, its objects, their states. */
  world?: {
    environments?: ShotBoardEnvironment[];
    settings?: ShotBoardSetting[];
    objects?: ShotBoardObject[];
    sceneWorld?: {
      sceneNumber: number;
      environmentKey: string;
      settingKeys?: string[];
      objectKeys?: string[];
    }[];
  };
  /** Every photograph, flat. Filter by `tier` to get one level of the hierarchy. */
  plates?: ShotBoardPlate[];
  /** Keyed by 0-based scene index. Firestore hands the keys back as strings. */
  scenes?: Record<string | number, SceneShotBoard>;
  violations?: string[];
  notes?: string[];
  /** What the run repaired on its own: a refused prompt rewritten, a lost picture re-taken. */
  healed?: string[];
  builtAt?: string;
}

/**
 * "framing" and the rest are working states; "ready", "partial" and "failed" are
 * terminal.
 *
 * "partial" means some scenes are photographed and some are not. On the
 * experimental story that is a state the director resolves — the board screen
 * offers a Retry per missing picture — rather than one the film renders through:
 * an unphotographed scene there has nothing to attach, and rendering it from
 * prose would silently produce the drift the board exists to prevent.
 */
export type ShotBoardStage =
  | "queued"
  | "designing"
  | "plating"
  | "framing"
  | "briefing"
  | "ready"
  | "partial"
  | "failed"
  | null;

/** The stages that mean a board pass is still working. Terminal ones are absent. */
export const SHOT_BOARD_WORKING_STAGES: string[] = [
  "queued",
  "designing",
  "plating",
  "framing",
  "briefing",
];

/**
 * How far a board run has got. Every field optional because the run reports
 * whichever counters its current step actually has — the plating step has no
 * frame count, and inventing zeroes for it would read as "0 of 0 frames done".
 */
export interface ShotBoardProgress {
  step?: string;
  scenesDone?: number;
  scenesTotal?: number;
  platesDone?: number;
  platesTotal?: number;
  framesDone?: number;
  framesTotal?: number;
  briefsDone?: number;
  briefsTotal?: number;
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

/**
 * Every run-time the platform knows about.
 *
 * Past 180s these are LONG-FORM, and only the experimental original story offers
 * them — see VIDEO_TYPES. They are listed here rather than in that one type
 * because `lengthSeconds`, `scenesForLength`, `LENGTH_PRICING_GMD` and the paywall
 * all key off this union, and a run-time a type offers but the pricing table has
 * never heard of is a film that charges NaN.
 */
export type ProjectLength =
  | "30s" | "60s" | "90s" | "120s" | "150s" | "180s"
  | "240s" | "300s" | "360s" | "420s" | "480s" | "540s" | "600s";
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
  // Long form. Same rate, deliberately: a minute of finished film costs what a
  // minute of finished film costs, and the experimental type's extra spend (a
  // hundred-odd board stills) is absorbed rather than surcharged.
  "240s": 240 * GMD_PER_SECOND,
  "300s": 300 * GMD_PER_SECOND,
  "360s": 360 * GMD_PER_SECOND,
  "420s": 420 * GMD_PER_SECOND,
  "480s": 480 * GMD_PER_SECOND,
  "540s": 540 * GMD_PER_SECOND,
  "600s": 600 * GMD_PER_SECOND,
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

export type VideoTypeId =
  | "short-film"
  | "short-film-story"
  | "short-film-story-x"
  | "short-film-documentary"
  | "dialogue-ad"
  | "voiceover-ad";

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
    // Unbranded, and the only type built by functions/optiqStory.
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
  {
    // ── THE EXPERIMENTAL ORIGINAL STORY ──────────────────────────────────────
    //
    // The only type built by functions/optiqStoryX, and the only one that
    // PHOTOGRAPHS ITS WORLD before rendering: a hierarchy of stills (place →
    // arrangement → object → state → frame) where each tier is generated from the
    // picture of the tier above, so a room cannot drift between clips.
    //
    // It is also the only long-form type. 300s is what it was built for; the
    // ladder runs to 600s because a story occasionally needs the room.
    //
    // Three things about it are unlike every other type:
    //   • It does not run start-to-finish. It stops at a BLUEPRINT the director
    //     reads and can chat with an agent about, then again at a BOARD of stills
    //     they approve, and only then renders. Nothing spends until they say so.
    //   • The video model sees ONLY the board stills — no character reference
    //     sheets ride along, because the stills already contain the people.
    //   • Its score is a SUITE of separate composed tracks laid end to end, not
    //     one track looped, because five minutes of the same 60s loop is five
    //     minutes of the same 60s loop.
    id: "short-film-story-x",
    title: "Original story — experimental",
    lengths: ["60s", "120s", "180s", "240s", "300s", "360s", "420s", "480s", "540s", "600s"],
    // Not generated yet — the picker falls back to the aurora wash when a clip is
    // missing, which is honest, and generating one spends real video quota. See
    // scripts/generate-type-clips.mjs, where it is registered and waiting.
    clip: "/media/mode-short-film-story-x.mp4",
    dialogueInVideo: true,
    ttsVoiceover: false,
    audioLabel: "Dialogue + composed score",
    card: false,
    branded: false,
  },
  {
    // Unbranded, and the only type built by functions/optiqDocumentary. Also the
    // only unbranded type whose footage is SILENT: nobody speaks on camera, and
    // the film's words are narration written by the swarm and recorded over the
    // finished cut. Like the story, it lives behind Short film rather than
    // taking a fourth card on the picker.
    id: "short-film-documentary",
    title: "Documentary",
    lengths: ["60s", "90s", "120s", "150s", "180s"],
    clip: "/media/mode-short-film-documentary.mp4",
    dialogueInVideo: false,
    ttsVoiceover: true,
    audioLabel: "Voiceover + composed score",
    card: false,
    branded: false,
  },
];

/** The types that appear on "What are we making?" — three, across at any width. */
export const VIDEO_TYPE_CARDS: VideoType[] = VIDEO_TYPES.filter((t) => t.card);

/** Every branch of the short-film choice: an advert, a story, or a documentary. */
export function isShortFilm(id?: VideoTypeId | string | null): boolean {
  return (
    id === "short-film" ||
    id === "short-film-story" ||
    id === "short-film-story-x" ||
    id === "short-film-documentary"
  );
}

/**
 * The experimental original story — the photographed, gated, long-form one.
 *
 * Its own predicate because a LOT of code has to branch on it: the wizard's
 * length ladder, the three-stage flow, the board route, the render attachments
 * and the score suite. Comparing the literal in a dozen places is how one of them
 * ends up comparing the wrong literal.
 */
export function isExperimentalStory(id?: VideoTypeId | string | null): boolean {
  return id === "short-film-story-x";
}

/** The faces a project can be opened on. "" is the workspace itself. */
export type ProjectFace = "" | "agent" | "board";

/**
 * Where a project lives.
 *
 * The experimental story has its OWN route tree — /dashboard/project/story/[id]
 * rather than /dashboard/project/[id] — because it is not the same product. It
 * runs in three gated stages, it renders from photographs instead of reference
 * images, and it is the only type with a board. Bending one workspace to serve
 * both meant every tweak to either had to be checked against the other; a
 * separate tree means the story screens can be cut to the story without asking
 * permission from the ad screens.
 *
 * ONE function decides it, because a link that guesses wrong lands the director
 * on a workspace built for a different kind of film — and the two trees render
 * different components off the same project id, so it fails confusingly rather
 * than loudly.
 */
export function projectHref(
  videoType: VideoTypeId | string | null | undefined,
  id: string,
  face: ProjectFace = ""
): string {
  const base = isExperimentalStory(videoType)
    ? `/dashboard/project/story/${id}`
    : `/dashboard/project/${id}`;
  return face ? `${base}/${face}` : base;
}

/**
 * The four things a short film can be, in the order they are shown.
 *
 * The ADVERT comes first and is what picking "Short film" already means, so a
 * director who wants what this platform has always made does not have to choose
 * anything — they press Continue. The other three are unbranded and each routes to
 * its own storyboard system.
 */
export interface ShortFilmMode {
  id: VideoTypeId;
  title: string;
  /** One line. The cover clip is the explanation; this only confirms it. */
  blurb: string;
  clip: string;
  /**
   * Shown as a small marker on the card. Only the experimental mode carries one,
   * because it is the only mode that behaves unlike the others — it costs more,
   * takes far longer, and stops twice for approval on the way.
   */
  badge?: string;
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
  {
    // Last, because it is the one to reach for deliberately rather than by
    // default: it photographs the film's whole world before rendering a frame.
    id: "short-film-story-x",
    title: "Original story — experimental",
    blurb: "Up to 10 min. Photographed before filming.",
    clip: "/media/mode-short-film-story-x.mp4",
    badge: "Experimental",
  },
  {
    id: "short-film-documentary",
    title: "Documentary",
    blurb: "Something real, told by a narrator.",
    clip: "/media/mode-short-film-documentary.mp4",
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
