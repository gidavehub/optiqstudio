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
  musicSpec?: string;
  ambienceSpec?: string;
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

export type ProjectLength = "30s" | "60s" | "90s";
export type ProductionMode = "manual" | "auto-merge" | null;
export type DashboardView = "home" | "wizard" | "storyboard";

/** The storyboard wizard is a full-screen, one-question-at-a-time flow:
 * 1 projects (create new / reopen) → 2 run-time → 3 vision prompt →
 * 4 orientation → 5 brand name → 6 product/service →
 * 7 brand materials + generate.
 *
 * Step 1 exists purely so the run-time choice gets a screen of its own with
 * nothing else competing for attention. */
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Fields that support voice dictation in the wizard. */
export type DictationTarget = "prompt" | "brand" | "product";

/** Spec-generation price per run-time, in GMD (mirrors StoryboardPaywallModal). */
export const LENGTH_PRICING_GMD: Record<ProjectLength, number> = {
  "30s": 450,
  "60s": 900,
  "90s": 1350,
};

export interface BrandMaterial {
  name: string;
  data: string;
}
