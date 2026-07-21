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

export interface VideoStatusEntry {
  id?: string;
  status: SceneStatus;
  url?: string;
  error?: string;
  revisionInput?: string;
  revising?: boolean;
  editingPrompt?: boolean;
  customPrompt?: string;
}

export type VideoStatusMap = Record<number, VideoStatusEntry>;

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
