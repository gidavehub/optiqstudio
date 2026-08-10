"use client";

// EditorFlowProvider — the single owner of storyboard-editor state.
//
// Previously all of this lived inside the monolithic dashboard/page.tsx as one
// giant component with a `view` state machine. Now the state lives here, at the
// dashboard layout level, so it survives navigation between the real routes
// (/dashboard, /dashboard/create, /dashboard/project/[id]). Each stage is its
// own page that reads this context via useEditorFlow().

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/AuthProvider";
import { db, storage } from "../../../lib/firebase";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import {
  BrandMaterial,
  DictationTarget,
  ProductionMode,
  ProjectLength,
  SceneImage,
  CharacterRef,
  SceneImagesMap,
  SceneShotBoard,
  ShotBoard,
  ShotBoardProgress,
  ShotBoardStage,
  Storyboard,
  VideoStatusMap,
  VideoTypeId,
  WizardStepId,
  FIRST_WIZARD_STEP,
  DEFAULT_VIDEO_TYPE,
  SHOT_BOARD_WORKING_STAGES,
  ProjectFace,
  defaultLengthFor,
  isExperimentalStory,
  projectHref,
  recordTake,
  scenesForLength,
  sceneTakes,
  videoType,
} from "./types";
import { renderAttachments, renderPrompt, sceneStills } from "./shotBoard";

interface EditorFlowValue {
  // Auth passthrough (handy for views that only need these two)
  user: ReturnType<typeof useAuth>["user"];
  profile: ReturnType<typeof useAuth>["profile"];

  // Paywall / production-mode
  storyboardPayOpen: boolean;
  setStoryboardPayOpen: (v: boolean) => void;
  paywallStep: "pay" | "choose";
  setPaywallStep: (v: "pay" | "choose") => void;
  productionMode: ProductionMode;
  setProductionMode: (v: ProductionMode) => void;

  // Theater playback
  theaterPlaying: boolean;
  setTheaterPlaying: (v: boolean) => void;
  currentScenePlayIdx: number;
  setCurrentScenePlayIdx: React.Dispatch<React.SetStateAction<number>>;

  // Spot checkout card fields

  // Projects
  projects: any[];
  projectsLoading: boolean;
  activeProjectId: string | null;

  // Compilation / timeline
  compileStatus: "idle" | "compiling" | "succeeded" | "failed";
  compileVideoUrl: string;
  compileError: string;
  timeline: any[];
  setTimeline: React.Dispatch<React.SetStateAction<any[]>>;
  musicUrl: string; setMusicUrl: (v: string) => void;
  musicVolume: number; setMusicVolume: (v: number) => void;

  // Wizard
  wizardStep: WizardStepId;
  setWizardStep: (v: WizardStepId) => void;
  length: ProjectLength; setLength: (v: ProjectLength) => void;
  /** Which of the three kinds of film. Decides the run-times on offer AND how
   * the finished cut is scored and narrated. */
  videoTypeId: VideoTypeId; selectVideoType: (v: VideoTypeId) => void;
  promptText: string; setPromptText: (v: string) => void;
  brandName: string; setBrandName: (v: string) => void;
  product: string; setProduct: (v: string) => void;
  brandMaterials: BrandMaterial[];
  isDragging: boolean; setIsDragging: (v: boolean) => void;

  // Prompt bar styling
  promptExpanded: boolean; setPromptExpanded: (v: boolean) => void;
  aspectRatio: string; setAspectRatio: (v: string) => void;
  aspectDropdownOpen: boolean; setAspectDropdownOpen: (v: boolean) => void;

  // Interaction
  recording: boolean;
  recordingTarget: DictationTarget | null;
  generating: boolean;
  error: string | null; setError: (v: string | null) => void;
  copiedIndex: number | null;

  // Storyboard + scene statuses
  storyboard: Storyboard | null;
  setStoryboard: React.Dispatch<React.SetStateAction<Storyboard | null>>;
  videoStatus: VideoStatusMap;
  setVideoStatus: React.Dispatch<React.SetStateAction<VideoStatusMap>>;

  // Cloud storyboard-generation progress (server-driven, survives tab close)
  /** Audio post-production: the pass that scores and narrates a finished cut.
   * Read straight off the project doc — the server owns it, so it is never
   * mirrored into local state that autosave could echo back. */
  audioStage: string | null;
  audioReport: Record<string, unknown> | null;
  requestAudioPost: () => Promise<void>;
  pipelineStage: string | null;
  pipelineProgress: { scenesDone: number; scenesTotal: number } | null;
  retryStoryboard: () => Promise<void>;

  /** True while a storyline-agent turn is rewriting this project server-side. */
  agentRunning: boolean;

  // Per-scene reference images (product/character consistency)
  sceneImages: SceneImagesMap;
  projectMaterials: SceneImage[];
  addSceneImages: (sceneIndex: number, files: FileList | File[]) => Promise<void>;
  attachMaterialToScene: (sceneIndex: number, material: SceneImage) => void;
  removeSceneImage: (sceneIndex: number, imageIndex: number) => void;

  /** The shot board: the film photographed before it is filmed. Server-owned and
   * read straight off the project doc, exactly like audioStage. Only the
   * experimental original story ever has one. */
  shotBoard: ShotBoard | null;
  shotBoardStage: ShotBoardStage;
  /** True while a pass is genuinely running — the stage alone is not enough,
   * see the note on the implementation. One definition, used everywhere. */
  shotBoardBusy: boolean;
  shotBoardProgress: ShotBoardProgress | null;
  shotBoardError: string | null;
  /** Photograph the film, or re-photograph part of it. No scenes = everything
   * that isn't photographed yet. `keepDesign` re-shoots the existing setups
   * instead of re-deciding how the scene is covered. */
  buildShotBoard: (sceneIndexes?: number[], keepDesign?: boolean) => Promise<void>;
  /**
   * The film's cast sheets — one portrait per recurring character.
   *
   * Photographed by the shot board on its first pass (the blueprint writes only
   * the PLAN), and the thing every frame containing that person is generated
   * from. Server-owned, read here, never written by the client.
   */
  characterRefs: CharacterRef[];
  /** Drop one setup from a scene's board. The picture stays in Storage. */
  removeBoardShot: (sceneIndex: number, order: number) => Promise<void>;
  /** Ask for one more angle, described in the director's own words. */
  addBoardShot: (sceneIndex: number, note: string) => Promise<void>;
  /** Put the director's own pictures on the board — already photographed. */
  addBoardShotImages: (sceneIndex: number, files: File[]) => Promise<void>;
  /** True when this project is an experimental story, i.e. one that is
   * photographed, gated and rendered only from its board. */
  isBoardFilm: boolean;
  /** Gate 1 → stage 2: the blueprint is approved, photograph the film. */
  continueToBoard: () => Promise<void>;
  /** Gate 2 → stage 3: the board is approved, shoot every scene. */
  continueToFilm: () => Promise<void>;
  /**
   * A link to one of the ACTIVE project's faces, in whichever route tree it
   * belongs to.
   *
   * The board, blueprint and agent screens are shared by both trees, so a
   * hardcoded `/dashboard/project/${id}` in any of them silently throws an
   * experimental story back onto the ad workspace — which renders, from the same
   * project id, a screen built for a different kind of film. One helper, so
   * there is one thing to get right.
   */
  projectLink: (face?: ProjectFace) => string;

  // Handlers
  startSpeechRecognition: (target?: DictationTarget) => void;
  stopSpeechRecognition: () => void;
  handleMaterialsUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  removeBrandMaterial: (index: number) => void;
  /** Pass the production mode explicitly — see the note on the implementation. */
  generateStoryboard: (mode?: ProductionMode) => Promise<void>;
  /** True once every scene of the current storyboard has rendered. */
  allScenesRendered: (scenes: unknown[], statuses: VideoStatusMap) => boolean;
  generateVideoForScene: (sceneIndex: number, promptText: string) => Promise<void>;
  /** Put an earlier (or later) take of a scene back on air — script editor,
   * media bin and timeline all follow the scene's active take. */
  selectSceneTake: (sceneIndex: number, takeIndex: number) => void;
  reviseScenePrompt: (sceneIndex: number) => Promise<void>;
  copyToClipboard: (text: string, index: number) => void;
  handleCompileProject: () => Promise<void>;
  deleteProject: (e: React.MouseEvent, projectId: string) => Promise<void>;

  // Navigation
  goHome: () => void;
  goCreate: () => void;
  openProject: (proj: any) => void;
  openProjectRoute: (id: string) => void;
}

// Stages the server-side storyboard job (functions/storyboardGenerate) streams
// into the project doc while it works. "ready" / "failed" are terminal.
const PIPELINE_WORKING_STAGES = ["queued", "analyzing", "storylining", "casting", "building"];

// The storyline-agent function can't run longer than its own 540s ceiling, so a
// project still flagged "running" past this lost its turn to a crash or a
// timeout. Treating that as finished is what stops one dead turn from disabling
// the editor's autosave for good.
const AGENT_TURN_CEILING_MS = 10 * 60 * 1000;

// The same guard for the shot board. One pass is bounded by the function's own
// 540s ceiling; a long film takes several, and each one re-stamps
// shotBoardStartedAt, so this only has to cover a single invocation. Without it a
// pass that died before writing a terminal stage would leave the board screen
// spinning forever with no error on it and no way to retry.
const SHOT_BOARD_PASS_CEILING_MS = 12 * 60 * 1000;

// Firestore rejects `undefined` anywhere in a written value, and scene statuses
// collect optional fields (`error`, `customPrompt`, `id`) as they go.
const cleanUndefined = (obj: any): any => {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) clean[key] = cleanUndefined(val);
  }
  return clean;
};

const EditorFlowContext = createContext<EditorFlowValue | null>(null);

export function useEditorFlow(): EditorFlowValue {
  const ctx = useContext(EditorFlowContext);
  if (!ctx) throw new Error("useEditorFlow must be used within EditorFlowProvider");
  return ctx;
}

export function EditorFlowProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, apiFetch, refreshProfile } = useAuth();
  const router = useRouter();

  // Paywall
  const [storyboardPayOpen, setStoryboardPayOpen] = useState(false);
  const [paywallStep, setPaywallStep] = useState<"pay" | "choose">("pay");
  const [productionMode, setProductionMode] = useState<ProductionMode>(null);
  const [theaterPlaying, setTheaterPlaying] = useState(false);
  const [currentScenePlayIdx, setCurrentScenePlayIdx] = useState(0);

  // Projects
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [routeProjectId, setRouteProjectId] = useState<string | null>(null);

  // Compilation / timeline
  const [compileStatus, setCompileStatus] = useState<"idle" | "compiling" | "succeeded" | "failed">("idle");
  const [compileVideoUrl, setCompileVideoUrl] = useState<string>("");
  const [compileError, setCompileError] = useState<string>("");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [musicUrl, setMusicUrl] = useState<string>("");
  const [musicVolume, setMusicVolume] = useState<number>(0.6);

  // Wizard
  const [wizardStep, setWizardStep] = useState<WizardStepId>(FIRST_WIZARD_STEP);
  const [length, setLength] = useState<ProjectLength>("30s");
  const [videoTypeId, setVideoTypeId] = useState<VideoTypeId>(DEFAULT_VIDEO_TYPE);
  const [promptText, setPromptText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [product, setProduct] = useState("");
  const [brandMaterials, setBrandMaterials] = useState<BrandMaterial[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [promptExpanded, setPromptExpanded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [aspectDropdownOpen, setAspectDropdownOpen] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<DictationTarget | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatusMap>({});

  // Cloud-generation progress for the active project. The storyboard is now
  // built by a server-side Firestore-triggered job (functions/storyboardGenerate)
  // that streams its stage into the project doc, so this survives a closed tab
  // and resumes on reopen. `null` = not a cloud-generating project.
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [pipelineProgress, setPipelineProgress] = useState<{ scenesDone: number; scenesTotal: number } | null>(null);

  // The storyline agent (functions/storylineAgent) rewrites scenes server-side
  // from /dashboard/project/[id]/agent. `scriptRevision` is a server-owned
  // counter it bumps on every write; whenever it moves past what we've applied,
  // the editor adopts the doc's script. `agentStatus` is the other half of the
  // deal — while a turn runs the debounced autosave below stands down, so a
  // save queued moments earlier can't land on top of the agent's work.
  const appliedRevisionRef = useRef(0);

  // ─── WHICH FILM THE STATE IN THIS PROVIDER BELONGS TO ─────────────────────
  //
  // The provider holds ONE set of scenes, videoStatus and timeline, and it is
  // reused as the director moves between films. That is fine while the two are
  // kept in step, and it corrupts a film the moment they are not — which is how
  // clips from one project ended up inside another:
  //
  //   • A render poller ticks every 5s and writes its clip into videoStatus by
  //     SCENE INDEX. It was stored on `window._scene_poll_3`, keyed by index
  //     alone, so it survived leaving the film. Open film A with scene 3
  //     rendering, move to film B, and A's poller writes A's clip into B's
  //     scene 3 — after which autosave persists it to B's document.
  //   • The debounced autosave fires 1.5s after a change, against whatever
  //     `activeProjectId` says at that moment. Switch films inside that window
  //     and the previous film's scenes are written over the new one's.
  //
  // Both are fixed the same way: everything asynchronous captures the project it
  // started for, and refuses to write when that is no longer the project on
  // screen. This ref is what it checks against — the id the CURRENT state was
  // loaded for, which is not the same thing as the id the router is pointing at.
  const stateProjectIdRef = useRef<string | null>(null);

  /**
   * Every render poller, keyed by project AND scene.
   *
   * A Map on a ref rather than globals on `window`: two films can legitimately
   * have a scene 3 in flight, and `window._scene_poll_3` can only hold one of
   * them — so the second overwrote the first's handle and the first ran forever,
   * unstoppable and writing into whatever film was open.
   */
  const scenePollersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const pollerKey = (projectId: string | null, sceneIndex: number) => `${projectId || "none"}:${sceneIndex}`;

  const stopScenePoller = useCallback((projectId: string | null, sceneIndex: number) => {
    const key = pollerKey(projectId, sceneIndex);
    const existing = scenePollersRef.current.get(key);
    if (existing) {
      clearInterval(existing);
      scenePollersRef.current.delete(key);
    }
  }, []);

  /** Everything in flight, for every film. Used when the film on screen changes. */
  const stopAllScenePollers = useCallback(() => {
    for (const interval of scenePollersRef.current.values()) clearInterval(interval);
    scenePollersRef.current.clear();
  }, []);

  // Derived, never stored: a boolean in state would be frozen at whatever the
  // last snapshot said, and a project whose turn crashed sends no further
  // snapshots — so a stale "running" would never clear. Recomputing on render
  // means the ceiling is re-checked every time it actually matters.
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const agentRunning =
    activeProject?.agentStatus === "running" &&
    Date.now() - Date.parse(activeProject.agentStartedAt || "") < AGENT_TURN_CEILING_MS;

  // Per-scene reference images. Mirrored in a ref so generation callbacks fired
  // right after a state update (or from stale closures) always see the latest.
  const [sceneImages, setSceneImages] = useState<SceneImagesMap>({});
  const [projectMaterials, setProjectMaterials] = useState<SceneImage[]>([]);
  const sceneImagesRef = useRef<SceneImagesMap>({});
  // Same trick for the board: a render fired from a stale closure must attach
  // the frames that exist NOW, not the ones that existed when it was created.
  const shotBoardRef = useRef<ShotBoard | null>(null);
  const isBoardFilmRef = useRef(false);
  useEffect(() => {
    sceneImagesRef.current = sceneImages;
  }, [sceneImages]);

  // ─── PROJECT STATE LOADER (no navigation) ─────────────────────────────────
  const loadProjectState = useCallback((proj: any) => {
    // The film on screen is changing. Anything still polling belongs to the one
    // being left, and its next tick would write a clip into this one — so it
    // stops here, before a single piece of the new film is loaded. The state and
    // the id it belongs to are set together and never drift.
    stopAllScenePollers();
    stateProjectIdRef.current = proj?.id || null;

    // A project whose cloud job hasn't produced scenes yet: leave the storyboard
    // null so the workspace shows the live "generating" state (driven by
    // pipelineStage), not an empty scene grid.
    const stillGenerating =
      PIPELINE_WORKING_STAGES.includes(proj.pipelineStage) &&
      (!proj.scenes || proj.scenes.length === 0);

    setPipelineStage(proj.pipelineStage || null);
    setPipelineProgress(proj.pipelineProgress || null);
    appliedRevisionRef.current = Number(proj.scriptRevision) || 0;

    if (stillGenerating) {
      setStoryboard(null);
    } else {
      setStoryboard({
        title: proj.title,
        concept: proj.concept,
        styleHeader: proj.styleHeader || "",
        characterLock: proj.characterLock || { name: "", description: "", wardrobe: "" },
        scenes: proj.scenes || [],
        isStory: proj.isStory,
        isDocumentary: proj.isDocumentary,
        storyArc: proj.storyArc,
        thesis: proj.thesis,
        theClose: proj.theClose,
        musicSpec: proj.musicSpec,
        ambienceSpec: proj.ambienceSpec,
      });
    }
    if (proj.pipelineStage === "failed") setError(proj.pipelineError || "Storyboard generation failed");

    setSceneImages(proj.sceneImages || {});
    setProjectMaterials(proj.materials || []);
    setLength(proj.length);
    // Films made before types existed carry dialogue in their footage, so an
    // unset value resolves to the dialogue ad — NOT to the wizard's default,
    // which would silence them in audio post. See LEGACY_VIDEO_TYPE.
    setVideoTypeId(videoType(proj.videoType).id);
    setBrandName(proj.brandName || "");
    setProduct(proj.product || "");
    setPromptText(proj.concept || "");
    setAspectRatio(proj.aspectRatio || "16:9");
    setVideoStatus(proj.videoStatus || {});
    setActiveProjectId(proj.id);
    setProductionMode(proj.productionMode || "manual");
    setCompileStatus(proj.compileStatus || "idle");
    setCompileVideoUrl(proj.compileVideoUrl || "");
    setCompileError(proj.compileError || "");
    setTimeline(proj.timeline || []);
    setMusicUrl(proj.musicUrl || "");
    setMusicVolume(proj.musicVolume ?? 0.6);
  }, []);

  // ─── NAVIGATION ───────────────────────────────────────────────────────────
  const goHome = useCallback(() => router.push("/dashboard"), [router]);
  const goCreate = useCallback(() => {
    // "Create" always starts a BRAND-NEW project — never resume a previous
    // (possibly stuck) generation. Without this reset, a stale activeProjectId
    // left the /create route showing a past project's "writing your story…"
    // stage with its fields autofilled, and a fresh generate duplicated it.
    // Leaving every film. Pollers from the one being left would otherwise keep
    // ticking into the blank state this is about to create, and then into
    // whatever film is started next.
    stopAllScenePollers();
    stateProjectIdRef.current = null;
    setActiveProjectId(null);
    setRouteProjectId(null);
    setStoryboard(null);
    setGenerating(false);
    setPipelineStage(null);
    setPipelineProgress(null);
    setVideoStatus({});
    setTimeline([]);
    setError(null);
    setCompileStatus("idle");
    setCompileVideoUrl("");
    setCompileError("");
    setPromptText("");
    setBrandName("");
    setProduct("");
    setBrandMaterials([]);
    setProductionMode(null);
    setWizardStep(FIRST_WIZARD_STEP);
    router.push("/dashboard/create");
  }, [router]);
  const openProject = useCallback(
    (proj: any) => {
      loadProjectState(proj);
      router.push(projectHref(proj.videoType, proj.id));
    },
    [loadProjectState, router]
  );
  const openProjectRoute = useCallback((id: string) => setRouteProjectId(id), []);

  // Clean up any polling intervals on unmount
  useEffect(() => {
    // Every poller for every film. The old version walked indexes 0..19 on
    // `window`, so a film with more than twenty scenes left the rest running for
    // the life of the tab — and this only ever ran on unmount, which does not
    // happen when the director moves between films inside the app.
    return () => stopAllScenePollers();
  }, [stopAllScenePollers]);

  // ─── FIRESTORE PAST PROJECTS REAL-TIME LISTENER ──────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "projects"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        list.sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setProjects(list);
        setProjectsLoading(false);
      },
      (err) => {
        console.error("Failed to fetch past projects:", err);
        setProjectsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // ─── ADOPT A SCRIPT THE SERVER REWROTE ────────────────────────────────────
  // Narrower than loadProjectState on purpose: the storyline agent only ever
  // touches the script and the film-wide locks, so an in-flight render, the
  // timeline and the production mode are all left exactly as they are. The one
  // thing it does carry over from videoStatus is `customPrompt` — the script
  // editor renders `customPrompt || fullPrompt`, so a stale override would hide
  // the agent's rewrite behind the text it just replaced.
  const adoptServerScript = useCallback((proj: any) => {
    setStoryboard({
      title: proj.title,
      concept: proj.concept,
      styleHeader: proj.styleHeader || "",
      characterLock: proj.characterLock || { name: "", description: "", wardrobe: "" },
      scenes: proj.scenes || [],
      isStory: proj.isStory,
      isDocumentary: proj.isDocumentary,
      storyArc: proj.storyArc,
      thesis: proj.thesis,
      theClose: proj.theClose,
      musicSpec: proj.musicSpec,
      ambienceSpec: proj.ambienceSpec,
    });
    setVideoStatus((prev) => {
      const serverStatus = proj.videoStatus || {};
      const next = { ...prev };
      (proj.scenes || []).forEach((_: unknown, idx: number) => {
        const custom = serverStatus[idx]?.customPrompt;
        if (custom !== undefined) next[idx] = { ...next[idx], customPrompt: custom };
      });
      return next;
    });
  }, []);

  // ─── AUTO-SYNC STATE TO FIRESTORE ON STATE MUTATIONS ──────────────────────
  useEffect(() => {
    if (!user || !activeProjectId || !storyboard) return;
    // While the agent is mid-turn the server owns the script. Writing here
    // would be the same class of bug as echoing compileStatus back: our
    // debounced copy is older than what the agent just wrote.
    if (agentRunning) return;
    // AND THE STATE MUST BELONG TO THE FILM WE ARE ABOUT TO WRITE IT TO. This
    // write is debounced by 1.5s and sends the WHOLE scene array; switching
    // films inside that window used to land the previous film's scenes, clips
    // and timeline on the new film's document. The ref is set by
    // loadProjectState in the same breath as the state itself, so a mismatch
    // means exactly one thing: what is in memory is not this project's.
    if (stateProjectIdRef.current !== activeProjectId) return;

    const updateFirebaseProject = async () => {
      try {
        const projRef = doc(db, "projects", activeProjectId);
        await updateDoc(
          projRef,
          cleanUndefined({
            videoStatus,
            scenes: storyboard.scenes,
            title: storyboard.title,
            concept: storyboard.concept,
            styleHeader: storyboard.styleHeader,
            characterLock: storyboard.characterLock,
            musicSpec: storyboard.musicSpec ?? null,
            ambienceSpec: storyboard.ambienceSpec ?? null,
            aspectRatio,
            sceneImages,
            materials: projectMaterials,
            productionMode: productionMode || "manual",
            // compileStatus / compileVideoUrl / compileError are deliberately
            // NOT written here. They are owned by the server (projectCompile),
            // exactly like pipelineStage. Echoing local state back raced the
            // server: a debounced write still holding "compiling" could land
            // after the server wrote "succeeded", clobbering it — after which
            // doc and local agreed on "compiling" and the export UI spun
            // forever. We only ever read these.
            timeline,
            musicUrl,
            musicVolume,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.error("Failed to auto-save project state to Firestore:", err);
      }
    };

    const timeout = setTimeout(() => void updateFirebaseProject(), 1500);
    return () => clearTimeout(timeout);
  }, [
    videoStatus,
    activeProjectId,
    storyboard,
    productionMode,
    user,
    timeline,
    musicUrl,
    musicVolume,
    aspectRatio,
    sceneImages,
    projectMaterials,
    agentRunning,
  ]);

  // ─── RESUME/ACTIVATE PROJECT FROM /project/[id] ROUTE ─────────────────────
  useEffect(() => {
    if (routeProjectId && projects.length > 0) {
      const match = projects.find((p) => p.id === routeProjectId);
      if (match) {
        if (activeProjectId !== match.id) {
          loadProjectState(match);
        } else {
          if (match.compileStatus !== compileStatus) setCompileStatus(match.compileStatus || "idle");
          if (match.compileVideoUrl !== compileVideoUrl) setCompileVideoUrl(match.compileVideoUrl || "");
          if (match.compileError !== compileError) setCompileError(match.compileError || "");
        }
      }
    }
  }, [routeProjectId, projects, activeProjectId, compileStatus, compileVideoUrl, compileError, loadProjectState]);

  // ─── HYDRATE FROM THE CLOUD STORYBOARD JOB ────────────────────────────────
  // Reflects the server-side generation stage into the UI in real time (via the
  // projects onSnapshot listener). When the job reaches "ready" we load the
  // freshly-written scenes; when it "failed" we surface the error. This is what
  // makes a reopened tab resume at the exact stage the cloud is at.
  useEffect(() => {
    if (!activeProjectId) return;
    const match = projects.find((p) => p.id === activeProjectId);
    if (!match) return;

    setPipelineStage(match.pipelineStage || null);
    setPipelineProgress(match.pipelineProgress || null);

    // A storyline-agent turn rewrote the script. Adopt it — this is what makes
    // an edit made in the chat show up in the script editor immediately, with
    // no reload and no polling.
    const revision = Number(match.scriptRevision) || 0;
    if (storyboard && revision !== appliedRevisionRef.current) {
      appliedRevisionRef.current = revision;
      adoptServerScript(match);
    }

    if (match.pipelineStage === "ready") {
      const loadedCount = storyboard?.scenes.length ?? 0;
      const docCount = match.scenes?.length ?? 0;
      if (!storyboard || (docCount > 0 && loadedCount !== docCount)) {
        loadProjectState(match);
      }
      setGenerating(false);
    } else if (match.pipelineStage === "failed") {
      setError(match.pipelineError || "Storyboard generation failed");
      setGenerating(false);
    } else if (PIPELINE_WORKING_STAGES.includes(match.pipelineStage)) {
      setGenerating(true);
    }
  }, [projects, activeProjectId, storyboard, loadProjectState, adoptServerScript]);

  // ─── INITIALIZE TIMELINE FROM COMPLETED VIDEOS ──────────────────────────
  useEffect(() => {
    if (!storyboard || !videoStatus) return;
    const completedCount = storyboard.scenes.filter(
      (_, idx) => videoStatus[idx]?.status === "succeeded"
    ).length;
    if (completedCount === storyboard.scenes.length && timeline.length === 0) {
      const defaultTimeline = storyboard.scenes.map((_, idx) => ({
        sceneIndex: idx,
        videoUrl: videoStatus[idx]?.url || "",
        trimStart: 0,
        trimEnd: 10,
        volume: 1.0,
      }));
      setTimeline(defaultTimeline);
    }
  }, [storyboard, videoStatus, timeline.length]);

  const handleCompileProject = useCallback(async () => {
    if (!activeProjectId || timeline.length === 0) return;
    setCompileStatus("compiling");
    setCompileError("");
    try {
      const payload = {
        projectId: activeProjectId,
        timeline: timeline.map((item, idx) => ({
          sceneIndex: item.sceneIndex,
          videoUrl: videoStatus[item.sceneIndex]?.url || item.videoUrl,
          trimStart: Number(item.trimStart) ?? 0,
          trimEnd: Number(item.trimEnd) ?? 10,
          volume: Number(item.volume) ?? 1.0,
          playOrder: idx,
        })),
        musicUrl: musicUrl || null,
        musicVolume: Number(musicVolume) ?? 0.2,
      };
      await apiFetch<{ status: string }>("/api/project/compile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      console.log("Compilation triggered successfully");
    } catch (err: any) {
      console.error("Failed to trigger project compilation:", err);
      setCompileStatus("failed");
      setCompileError(err.message || "Request failed");
    }
  }, [activeProjectId, timeline, videoStatus, musicUrl, musicVolume, apiFetch]);

  const deleteProject = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this storyboard project?")) return;
    try {
      await deleteDoc(doc(db, "projects", projectId));
    } catch (err) {
      console.error("Failed to delete project document from Firestore:", err);
    }
  }, []);

  // Voice dictation — the same speech-to-text pipeline works on every wizard
  // text field (vision prompt, brand name, product/service).
  const startSpeechRecognition = useCallback(
    (target: DictationTarget = "prompt") => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser. Please type instead.");
        return;
      }
      const fieldByTarget: Record<DictationTarget, { value: string; set: (v: string) => void }> = {
        prompt: { value: promptText, set: setPromptText },
        brand: { value: brandName, set: setBrandName },
        product: { value: product, set: setProduct },
      };
      const field = fieldByTarget[target];
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";
      const initialText = field.value;
      rec.onstart = () => {
        setRecording(true);
        setRecordingTarget(target);
      };
      rec.onresult = (e: any) => {
        let sessionText = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) sessionText += e.results[i][0].transcript + " ";
        }
        const trimmed = sessionText.trim();
        if (trimmed) field.set(initialText ? `${initialText} ${trimmed}` : trimmed);
      };
      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setRecording(false);
        setRecordingTarget(null);
      };
      rec.onend = () => {
        setRecording(false);
        setRecordingTarget(null);
      };
      (window as any)._rec = rec;
      rec.start();
    },
    [promptText, brandName, product]
  );

  const stopSpeechRecognition = useCallback(() => {
    if ((window as any)._rec) (window as any)._rec.stop();
    setRecording(false);
    setRecordingTarget(null);
  }, []);

  const processUploadedFiles = useCallback((files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBrandMaterials((prev) => [...prev, { name: file.name, data: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleMaterialsUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) processUploadedFiles(files);
    },
    [processUploadedFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) processUploadedFiles(files);
    },
    [processUploadedFiles]
  );

  const removeBrandMaterial = useCallback((index: number) => {
    setBrandMaterials((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Inline scene video generation using Gemini Omni Flash
  const generateVideoForScene = useCallback(
    async (sceneIndex: number, promptTextArg: string) => {
      // The film this render belongs to, captured now. Every write below checks
      // it: a render outlives the screen it was started from, and a clip written
      // into whatever film happens to be open is the bug this guards.
      const renderProjectId = activeProjectId;
      const ownsScreen = () => stateProjectIdRef.current === renderProjectId;

      stopScenePoller(renderProjectId, sceneIndex);

      setVideoStatus((prev) => {
        const copy = { ...prev };
        if (copy[sceneIndex]) {
          const updated = { ...copy[sceneIndex], status: "rendering" as const };
          delete updated.error;
          copy[sceneIndex] = updated;
        } else {
          copy[sceneIndex] = { status: "rendering" as const };
        }
        return copy;
      });

      try {
        // What rides along with the render.
        //
        // A BOARD FILM attaches its photographed FRAMES and nothing else — no
        // character sheets, no uploads, no fallback. The frames were generated
        // FROM the sheets and the plates, so they already contain all of it, and a
        // studio portrait on a grey backdrop handed to the video model is the
        // contamination the board replaced. The rule lives in ./shotBoard.ts
        // beside its server-side twin, because the agent renders through that one
        // and must attach exactly the same thing.
        //
        // Every OTHER kind of film keeps the behaviour it has always had: this
        // scene's reference images, read straight from Storage. Making the board
        // the only source for all films is precisely what broke unphotographed
        // scenes last time — they attached nothing at all, silently.
        const refs = isBoardFilmRef.current
          ? renderAttachments(shotBoardRef.current, sceneIndex)
          : sceneImagesRef.current[sceneIndex] || [];
        const res = await apiFetch<{ id: string }>("/api/video/generate", {
          method: "POST",
          body: JSON.stringify({
            prompt: promptTextArg,
            model: "omni",
            aspectRatio,
            durationSeconds: 10,
            // Clips keep their own natively-generated audio (dialogue, ambience,
            // any sound the prompt calls for) — the platform no longer composes
            // separate music/TTS.
            generateAudio: true,
            // Lets the server draw this scene from the ad's prepaid allowance
            // instead of charging again.
            projectId: activeProjectId,
            imagePaths: refs.map((img) => ({ path: img.path, mimeType: img.mimeType })),
          }),
        });

        if (ownsScreen()) {
          setVideoStatus((prev) => {
            const copy = { ...prev };
            if (copy[sceneIndex]) {
              const updated = { ...copy[sceneIndex], status: "rendering" as const, id: res.id };
              delete updated.error;
              copy[sceneIndex] = updated;
            }
            return copy;
          });
        }

        const intervalId = setInterval(async () => {
          // The film moved on while this was in flight. Stop, and write nothing:
          // the render itself is unaffected and its result is on the project
          // document, which is where the workspace reads it from on return.
          if (!ownsScreen()) {
            stopScenePoller(renderProjectId, sceneIndex);
            return;
          }
          try {
            const status = await apiFetch<{ status: string; videoUrl?: string; error?: string }>(
              `/api/video/status?id=${res.id}`
            );
            if (status.status === "succeeded" && status.videoUrl) {
              clearInterval(intervalId);
              // Kept as a NEW take rather than an overwrite: the clip this
              // replaces cost money to make, and the director may well want it
              // back after seeing the re-render.
              const url = status.videoUrl;
              setVideoStatus((prev) => ({
                ...prev,
                [sceneIndex]: recordTake(prev[sceneIndex], {
                  id: res.id,
                  url,
                  createdAt: new Date().toISOString(),
                  prompt: promptTextArg,
                }),
              }));
              void refreshProfile();
            } else if (status.status === "failed" || status.status === "succeeded") {
              // "succeeded" with no clip is a failure with a friendlier name —
              // recording it as a take would put a dead entry in the history.
              clearInterval(intervalId);
              setVideoStatus((prev) => ({
                ...prev,
                [sceneIndex]: {
                  ...prev[sceneIndex],
                  status: "failed",
                  error: status.error || "Generation failed",
                },
              }));
              void refreshProfile();
            }
          } catch {
            /* ignore status network glitches */
          }
        }, 5000);

        scenePollersRef.current.set(pollerKey(renderProjectId, sceneIndex), intervalId);
      } catch (err) {
        setVideoStatus((prev) => ({
          ...prev,
          [sceneIndex]: {
            ...prev[sceneIndex],
            status: "failed",
            error: err instanceof Error ? err.message : "Request failed",
          },
        }));
      }
    },
    [apiFetch, refreshProfile, aspectRatio, activeProjectId, stopScenePoller]
  );

  // Put a different take of a scene back on air. Everything downstream reads
  // the scene's `url` — the script editor, the media bin, and (via
  // syncSceneTakes) the clips already cut into the timeline — so switching the
  // active take is all it costs to swap a scene across the whole film.
  const selectSceneTake = useCallback((sceneIndex: number, takeIndex: number) => {
    setVideoStatus((prev) => {
      const entry = prev[sceneIndex];
      const takes = sceneTakes(entry);
      const take = takes[takeIndex];
      if (!take || !entry) return prev;
      return {
        ...prev,
        [sceneIndex]: {
          ...entry,
          status: "succeeded",
          url: take.url,
          id: take.id ?? entry.id,
          takes,
          activeTake: takeIndex,
        },
      };
    });
  }, []);

  // Resume background polling with existing generation ID
  const resumePollingForScene = useCallback(
    async (sceneIndex: number, generationId: string) => {
      // Same ownership rule as generateVideoForScene — this resumes a render
      // that was already in flight, so it is if anything MORE likely to outlive
      // the screen that started it.
      const renderProjectId = activeProjectId;
      const ownsScreen = () => stateProjectIdRef.current === renderProjectId;

      stopScenePoller(renderProjectId, sceneIndex);

      setVideoStatus((prev) => {
        const copy = { ...prev };
        if (copy[sceneIndex]) {
          const updated = { ...copy[sceneIndex], status: "rendering" as const, id: generationId };
          delete updated.error;
          copy[sceneIndex] = updated;
        } else {
          copy[sceneIndex] = { status: "rendering" as const, id: generationId };
        }
        return copy;
      });

      const intervalId = setInterval(async () => {
        if (!ownsScreen()) {
          stopScenePoller(renderProjectId, sceneIndex);
          return;
        }
        try {
          const status = await apiFetch<{ status: string; videoUrl?: string; error?: string }>(
            `/api/video/status?id=${generationId}`
          );
          if (status.status === "succeeded" && status.videoUrl) {
            clearInterval(intervalId);
            const url = status.videoUrl;
            setVideoStatus((prev) => ({
              ...prev,
              [sceneIndex]: recordTake(prev[sceneIndex], {
                id: generationId,
                url,
                createdAt: new Date().toISOString(),
              }),
            }));
            void refreshProfile();
          } else if (status.status === "failed" || status.status === "succeeded") {
            clearInterval(intervalId);
            setVideoStatus((prev) => ({
              ...prev,
              [sceneIndex]: {
                ...prev[sceneIndex],
                status: "failed",
                error: status.error || "Generation failed",
              },
            }));
            void refreshProfile();
          }
        } catch {
          /* ignore status network glitches */
        }
      }, 5000);

      scenePollersRef.current.set(pollerKey(renderProjectId, sceneIndex), intervalId);
    },
    [apiFetch, refreshProfile, activeProjectId, stopScenePoller]
  );

  // Uploads the wizard's brand materials to per-user Storage so the cloud job
  // (and later the media library) can read them by path.
  const uploadBrandMaterials = useCallback(
    async (projectId: string): Promise<SceneImage[]> => {
      if (!user || brandMaterials.length === 0) return [];
      try {
        return await Promise.all(
          brandMaterials.map(async (mat, i) => {
            const safeName = mat.name.replace(/[^\w.-]/g, "_");
            const path = `users/${user.uid}/projects/${projectId}/materials/${i}-${safeName}`;
            const fileRef = storageRef(storage, path);
            await uploadString(fileRef, mat.data, "data_url");
            const url = await getDownloadURL(fileRef);
            const mimeType = /^data:([^;]+);/.exec(mat.data)?.[1] || "image/png";
            return { name: mat.name, path, url, mimeType };
          })
        );
      } catch (uploadErr) {
        console.error("Failed to persist brand materials to Storage:", uploadErr);
        return [];
      }
    },
    [user, brandMaterials]
  );

  // Trigger Storyboard Generation — fully cloud-managed. The client only
  // creates the project doc, uploads materials, and drops a job in
  // `storyboardJobs`. The server-side trigger (functions/storyboardGenerate)
  // runs the whole Optiq Skills swarm and writes the scenes + live stage back
  // to the project doc, so generation survives a closed tab and resumes on
  // reopen. No HTTP wait, no client-side result write.
  //
  // `mode` is passed EXPLICITLY rather than read off state. The paywall's two
  // buttons call `setProductionMode(...)` and then `generateStoryboard()` in the
  // same handler, so the callback still closed over the PREVIOUS mode (null) and
  // wrote `productionMode: "manual"` onto the project. When the swarm finished,
  // loadProjectState read that back and dropped the user in the script editor —
  // which is exactly the "auto-generate only writes the script" bug. Whoever
  // starts the run now states which mode they meant.
  /**
   * Choose the kind of film.
   *
   * Also repairs the run-time, because the two are coupled: the run-times on
   * offer differ per type (a short film starts at 60s, an ad at 30s), so
   * switching type while an out-of-range length is selected would otherwise
   * leave the wizard holding an invalid pair and charge for it.
   */
  const selectVideoType = useCallback((id: VideoTypeId) => {
    setVideoTypeId(id);
    setLength((current) => (videoType(id).lengths.includes(current) ? current : defaultLengthFor(id)));
  }, []);

  const generateStoryboard = useCallback(async (mode?: ProductionMode) => {
    const runMode: ProductionMode = mode || productionMode || "manual";
    if (!promptText.trim()) {
      alert("Please describe your campaign or video pitch.");
      return;
    }
    if (!user) {
      alert("Please sign in to generate a storyboard.");
      return;
    }

    setProductionMode(runMode);
    setGenerating(true);
    setError(null);
    setStoryboard(null);
    setSceneImages({});
    sceneImagesRef.current = {};
    setProjectMaterials([]);
    setPipelineStage("queued");
    setPipelineProgress(null);

    // An original story has no brand and no product, and the wizard never asked
    // for them. Writing the usual placeholders here would hand the story swarm a
    // company called "Client" selling a thing called "Product offering", and it
    // would faithfully write a film about them.
    const branded = videoType(videoTypeId).branded;
    const filmBrandName = branded ? brandName || "Client" : null;
    const filmProduct = branded ? product || "Product offering" : null;

    try {
      // 1. Create the project doc up front so it appears in "past projects" and
      //    the workspace can start showing progress immediately.
      const docRef = await addDoc(collection(db, "projects"), {
        uid: user.uid,
        title: "Optiq Skills at work…",
        concept: promptText,
        length,
        videoType: videoTypeId,
        brandName: filmBrandName,
        product: filmProduct,
        aspectRatio,
        scenes: [],
        styleHeader: "",
        characterLock: "",
        videoStatus: {},
        productionMode: runMode,
        pipelineStage: "queued",
        pipelineError: null,
        // An ad is one price: the spec payment covers every scene render, so
        // the project carries an allowance the render endpoint draws down.
        prepaidRenders: scenesForLength(length),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const projectId = docRef.id;
      // A NEW film is now what the provider's state describes. Claimed here, in
      // the same breath as activeProjectId, or the first autosave would see a
      // mismatch and skip — and anything still polling from the film the
      // director came from would write into this one.
      stopAllScenePollers();
      stateProjectIdRef.current = projectId;
      setActiveProjectId(projectId);
      setRouteProjectId(projectId);
      router.push(projectHref(videoTypeId, projectId));

      // 2. Upload brand materials, then record them on the project.
      const uploadedMaterials = await uploadBrandMaterials(projectId);
      if (uploadedMaterials.length > 0) {
        setProjectMaterials(uploadedMaterials);
        await updateDoc(doc(db, "projects", projectId), { materials: uploadedMaterials });
      }

      // 3. Enqueue the cloud job. Everything else happens server-side.
      //
      // The EXPERIMENTAL story goes to a different collection, because it is a
      // different shape of job: it writes a BLUEPRINT and stops, rather than
      // running through to "ready". Its board and its renders are enqueued later,
      // by the director, from the two gates.
      const jobCollection = isExperimentalStory(videoTypeId)
        ? "storyXBlueprintJobs"
        : "storyboardJobs";
      await addDoc(collection(db, jobCollection), {
        uid: user.uid,
        projectId,
        prompt: promptText,
        length,
        // The one field the server routes on: "short-film-story" goes to
        // functions/optiqStory, "short-film-story-x" to functions/optiqStoryX,
        // "short-film-documentary" to functions/optiqDocumentary, and everything
        // else to functions/optiqSkills.
        videoType: videoTypeId,
        brandName: filmBrandName,
        product: filmProduct,
        aspectRatio,
        productionMode: runMode,
        materialPaths: uploadedMaterials,
        status: "queued",
        createdAt: new Date().toISOString(),
      });
      // Generation continues in the cloud; the hydration effect flips the UI
      // out of "generating" once the project doc reaches a terminal stage.
    } catch (err) {
      console.error("Failed to enqueue storyboard generation:", err);
      setError(err instanceof Error ? err.message : "Could not start storyboard generation");
      setGenerating(false);
      setPipelineStage("failed");
    }
  }, [
    promptText,
    user,
    length,
    videoTypeId,
    brandName,
    product,
    aspectRatio,
    productionMode,
    router,
    uploadBrandMaterials,
  ]);

  // ─── AUDIO POST-PRODUCTION ────────────────────────────────────────────────
  //
  // The score and the narration are written against the FINISHED cut, so this
  // can only run once every scene has rendered. It is a long server job, so the
  // client only enqueues it and then watches `audioStage` on the project.
  //
  // Deliberately read from the project doc rather than mirrored into state: it
  // is server-owned, and mirroring server status into client state is what let
  // an autosave echo stale status back over the top of it.
  //
  // Read once, here: everything below that the SERVER owns — audio post and the
  // shot board both — comes off this doc rather than out of local state.
  const activeProjectDoc = projects.find((p) => p.id === activeProjectId) ?? null;
  const audioStage: string | null = activeProjectDoc?.audioStage ?? null;
  const audioReport = (activeProjectDoc?.audioReport as Record<string, unknown> | undefined) ?? null;

  // ─── THE SHOT BOARD ───────────────────────────────────────────────────────
  //
  // The film photographed before it is filmed — see functions/shotBoardRun.js.
  // Read straight off the project doc for the same reason audioStage is.
  //
  // Only an experimental original story has one, and for that type the board is
  // load-bearing rather than an enhancement: its scenes render from their frames
  // and have no usable long prompt to fall back to.
  const isBoardFilm = isExperimentalStory(
    (activeProjectDoc?.videoType as VideoTypeId | undefined) ?? videoTypeId
  );
  const shotBoard = (activeProjectDoc?.shotBoard as ShotBoard | undefined) ?? null;
  // Read off the project doc for the same reason shotBoard and audioStage are:
  // the sheets are written by the board job, and mirroring server state into
  // client state is how an autosave echoes a stale copy back over it.
  const characterRefs = (activeProjectDoc?.characterRefs as CharacterRef[] | undefined) ?? [];
  const shotBoardStage = (activeProjectDoc?.shotBoardStage as ShotBoardStage) ?? null;
  const shotBoardProgress = (activeProjectDoc?.shotBoardProgress as ShotBoardProgress | undefined) ?? null;
  const shotBoardError = (activeProjectDoc?.shotBoardError as string | undefined) ?? null;

  /**
   * True while a pass is genuinely running.
   *
   * Derived, never stored, and bounded by the ceiling — because a board film
   * HOLDS ITS RENDERS until the board is done, and a stage that never reaches a
   * terminal value (a job that was never delivered, a function that died before
   * its catch) would strand the film at the door with no error on screen. Past
   * the ceiling we treat the pass as gone, and the board screen offers a retry.
   * Same reasoning as agentRunning.
   */
  const shotBoardBusy =
    SHOT_BOARD_WORKING_STAGES.includes(shotBoardStage || "") &&
    Date.now() - Date.parse(activeProjectDoc?.shotBoardStartedAt || "") < SHOT_BOARD_PASS_CEILING_MS;

  useEffect(() => {
    shotBoardRef.current = shotBoard;
  }, [shotBoard]);
  useEffect(() => {
    isBoardFilmRef.current = isBoardFilm;
  }, [isBoardFilm]);

  const buildShotBoard = useCallback(
    async (sceneIndexes?: number[], keepDesign?: boolean) => {
      if (!user || !activeProjectId) return;
      try {
        await updateDoc(doc(db, "projects", activeProjectId), {
          shotBoardStage: "queued",
          // Stamped on every enqueue: a board film waits for its board before it
          // renders, and a job that never fires must not hold it there forever.
          // See shotBoardBusy.
          shotBoardStartedAt: new Date().toISOString(),
          shotBoardError: null,
          updatedAt: new Date().toISOString(),
        });
        await addDoc(collection(db, "shotBoardJobs"), {
          uid: user.uid,
          projectId: activeProjectId,
          scope: sceneIndexes?.length ? { scenes: sceneIndexes, keepDesign: !!keepDesign } : null,
          status: "queued",
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to enqueue the shot board:", err);
        setError(err instanceof Error ? err.message : "Could not start photographing this film");
      }
    },
    [user, activeProjectId]
  );

  // ─── EDITING THE BOARD BY HAND ────────────────────────────────────────────
  //
  // The board is derived — the swarm decides how many setups a scene takes and
  // what each one sees — and for the most part that is the right default. But
  // the director is the one looking at the result, and two judgements are theirs
  // alone: "this angle is wrong, lose it" and "this scene needs one more".
  //
  // Both edit `shotBoard.scenes[i].shots`, which is server-owned everywhere else
  // in this file. That is safe here for a specific reason: the board job only
  // ever writes while it is running, `shotBoardBusy` is false when these are
  // reachable, and the runner treats the stored shot list as the design under
  // keepDesign — so a hand-edited list is honoured rather than overwritten.

  /** The scene's board entry, or null. Firestore returns index keys as strings. */
  const boardEntryFor = useCallback(
    (sceneIndex: number) => {
      const scenes = (activeProjectDoc?.shotBoard as ShotBoard | undefined)?.scenes as
        | Record<string, SceneShotBoard>
        | undefined;
      return scenes?.[sceneIndex] ?? scenes?.[String(sceneIndex)] ?? null;
    },
    [activeProjectDoc]
  );

  /**
   * Drop one setup from a scene.
   *
   * The picture itself is left in Storage. It is small, the project still owns
   * it, and a director who deletes an angle and immediately wants it back is a
   * likelier event than the few kilobytes mattering — see functions/orphanSweep.js
   * for what does eventually collect it, once the project itself goes.
   */
  const removeBoardShot = useCallback(
    async (sceneIndex: number, order: number) => {
      if (!activeProjectId) return;
      const entry = boardEntryFor(sceneIndex);
      if (!entry) return;
      const remaining = (entry.shots || [])
        .filter((shot) => (shot.order ?? 0) !== order)
        // Re-numbered so the setups stay a contiguous 0..n. The shot-board
        // clause numbers the attached images from this order and tells the video
        // model "ATTACHED IMAGE 2 is where this setup ends" — a gap in it points
        // the model at the wrong picture.
        .map((shot, i) => ({ ...shot, order: i }));
      const updated: SceneShotBoard = { ...entry, shots: remaining };

      try {
        await updateDoc(doc(db, "projects", activeProjectId), {
          [`shotBoard.scenes.${sceneIndex}`]: updated,
          // The mirror the render path reads. Kept in step here, or the scene
          // would still attach the still that was just removed. Same helper the
          // render uses, so the two cannot disagree about what a setup flattens
          // to.
          [`sceneImages.${sceneIndex}`]: sceneStills({ scenes: { [sceneIndex]: updated } }, sceneIndex),
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Could not remove the board shot:", err);
        setError(err instanceof Error ? err.message : "Could not remove that board shot");
      }
    },
    [activeProjectId, boardEntryFor]
  );

  /**
   * Ask for one more angle on a scene, in the director's own words.
   *
   * Appended to the stored shot list as an un-photographed setup and then handed
   * to the board with keepDesign, which is what makes this cheap: the runner
   * takes the stored list as the design and — since the frame-reuse added
   * alongside this — photographs only the setup that has no picture yet. One
   * image, not a whole scene's worth.
   */
  const addBoardShot = useCallback(
    async (sceneIndex: number, note: string) => {
      if (!activeProjectId || !note.trim()) return;
      const entry = boardEntryFor(sceneIndex);
      if (!entry) return;
      const shots = entry.shots || [];
      const order = shots.length;

      // Written into the fields the frame prompt is actually built from. The
      // director's sentence is the shot; there is no second pass that "designs"
      // it, because the whole point is that they already said what they want.
      const addition = {
        order,
        time: "",
        label: note.trim().slice(0, 60),
        camera: note.trim(),
        blocking: "",
        firstFrame: note.trim(),
        motion: "",
        endFrame: "",
        cameraMove: "locked",
        entry: "straight-into-action",
        settingKey: shots[0]?.settingKey || "",
        characters: shots[0]?.characters || [],
        objectKeys: [],
      };

      try {
        await updateDoc(doc(db, "projects", activeProjectId), {
          [`shotBoard.scenes.${sceneIndex}`]: { ...entry, shots: [...shots, addition] },
          updatedAt: new Date().toISOString(),
        });
        await buildShotBoard([sceneIndex], true);
      } catch (err) {
        console.error("Could not add the board shot:", err);
        setError(err instanceof Error ? err.message : "Could not add that board shot");
      }
    },
    [activeProjectId, boardEntryFor, buildShotBoard]
  );

  /**
   * Put the director's OWN pictures on the board.
   *
   * The board is derived, and for the look of a film that is right — a frame the
   * system photographed is built from the place plate, the arrangement inside it
   * and the cast sheets, and it agrees with every other frame because of it. But
   * a director with a reference in their hand — a location photo, a still from
   * something they are quoting, a frame they made elsewhere — had no way to put
   * it in front of the video model at all.
   *
   * A dropped image is ALREADY a photograph, which is what makes this cheap and
   * why it does not touch the shot-board job: there is nothing to design and
   * nothing to generate. It is appended as a setup that is already shot, and the
   * next render attaches it exactly like any other frame.
   *
   * Read as data URLs and uploaded with `uploadString`, the same path
   * uploadBrandMaterials takes — and into the film's own shotboard folder, so
   * deleting the project takes these with it (see cleanupDeletedProject).
   */
  const addBoardShotImages = useCallback(
    async (sceneIndex: number, files: File[]) => {
      if (!user || !activeProjectId || files.length === 0) return;
      const entry = boardEntryFor(sceneIndex);
      if (!entry) {
        setError("This scene has no board yet — photograph it first, then add your own stills.");
        return;
      }

      // Anything that is not an image would upload happily and then be attached
      // to a video render as an unreadable blob.
      const images = files.filter((file) => file.type.startsWith("image/"));
      const rejected = files.length - images.length;
      if (images.length === 0) {
        setError("Those aren't images. A board shot has to be a picture.");
        return;
      }

      try {
        const shots = entry.shots || [];
        const added = await Promise.all(
          images.map(async (file, i) => {
            const data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ""));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            const safeName = file.name.replace(/[^\w.-]/g, "_");
            // A fresh path every time: Storage serves generated media immutably,
            // so re-using a name would serve the previous picture.
            const path = `users/${user.uid}/projects/${activeProjectId}/shotboard/upload-s${
              sceneIndex + 1
            }-${Date.now().toString(36)}-${i}-${safeName}`;
            const fileRef = storageRef(storage, path);
            await uploadString(fileRef, data, "data_url");
            const url = await getDownloadURL(fileRef);
            return {
              order: shots.length + i,
              time: "",
              label: file.name.replace(/\.[^.]+$/, "").slice(0, 60) || `Added still ${shots.length + i + 1}`,
              camera: "",
              blocking: "",
              firstFrame: "",
              motion: "",
              endFrame: "",
              cameraMove: "locked" as const,
              entry: "straight-into-action" as const,
              settingKey: shots[0]?.settingKey || "",
              characters: shots[0]?.characters || [],
              objectKeys: [],
              // Already photographed — that is the whole point.
              url,
              path,
              mimeType: file.type || "image/png",
              renderedAt: new Date().toISOString(),
              /** So the board screen can say which stills the system did not take. */
              uploaded: true,
            };
          })
        );

        const updated: SceneShotBoard = { ...entry, shots: [...shots, ...added] };
        await updateDoc(doc(db, "projects", activeProjectId), {
          [`shotBoard.scenes.${sceneIndex}`]: updated,
          // The mirror the render reads, through the same helper, so the two
          // cannot disagree about what this scene attaches.
          [`sceneImages.${sceneIndex}`]: sceneStills({ scenes: { [sceneIndex]: updated } }, sceneIndex),
          updatedAt: new Date().toISOString(),
        });
        if (rejected > 0) {
          setError(`Added ${added.length}. Skipped ${rejected} file(s) that weren't images.`);
        }
      } catch (err) {
        console.error("Could not add board shot images:", err);
        setError(err instanceof Error ? err.message : "Could not add those stills");
      }
    },
    [user, activeProjectId, boardEntryFor]
  );

  // ─── THE TWO GATES ────────────────────────────────────────────────────────
  //
  // What makes this film type different from every other one: it does not run
  // start to finish. It stops after the blueprint and again after the board, and
  // these are the two buttons that release it. Both are named for the product
  // concept rather than the mechanism, because "Continue" is a promise about
  // money and the workspace needs something honest to label.

  /**
   * GATE 1 → STAGE 2. The director has read the blueprint and wants the film
   * photographed. This is the first action on this film type that spends
   * anything but tokens.
   *
   * No scope: everything not already photographed gets photographed.
   */
  const continueToBoard = useCallback(async () => {
    if (!isBoardFilm) return;
    await buildShotBoard();
  }, [isBoardFilm, buildShotBoard]);

  /**
   * GATE 2 → STAGE 3. The board is approved; shoot the film.
   *
   * Flipping productionMode to "auto-merge" is what does it — the auto-render
   * effect further down then walks every idle scene and renders it. That effect
   * already refuses to start while the board is not "ready", so this cannot
   * accidentally shoot an unphotographed film even if it is called early.
   */
  const continueToFilm = useCallback(async () => {
    if (!activeProjectId) return;
    setProductionMode("auto-merge");
    try {
      await updateDoc(doc(db, "projects", activeProjectId), {
        productionMode: "auto-merge",
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Could not start the render pass:", err);
      setError(err instanceof Error ? err.message : "Could not start rendering");
    }
  }, [activeProjectId]);

  const projectLink = useCallback(
    (face: ProjectFace = "") =>
      projectHref(
        (activeProjectDoc?.videoType as VideoTypeId | undefined) ?? videoTypeId,
        activeProjectId || "",
        face
      ),
    [activeProjectDoc?.videoType, videoTypeId, activeProjectId]
  );

  const requestAudioPost = useCallback(async () => {
    if (!user || !activeProjectId) return;
    try {
      await updateDoc(doc(db, "projects", activeProjectId), {
        // The clip set ships WITH the request, in the same write, and before the
        // job exists. The pass cuts its timeline from this exact field, and the
        // autosave that normally maintains it is debounced by 1.5s and stands
        // down completely while an agent turn runs — so at the moment the last
        // scene lands and this fires, the stored copy can still be several
        // scenes behind. The job would then measure a film that was missing
        // most of its clips and write that back as the timeline.
        videoStatus: cleanUndefined(videoStatus),
        audioStage: "queued",
        audioError: null,
        updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, "audioPostJobs"), {
        uid: user.uid,
        projectId: activeProjectId,
        status: "queued",
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to enqueue audio post-production:", err);
      setError(err instanceof Error ? err.message : "Could not start audio post-production");
    }
  }, [user, activeProjectId, videoStatus]);

  /**
   * True once every scene has a clip.
   *
   * A CLIP, not a verdict. This gates audio post — the score is written against
   * the finished cut — and it used to require `status === "succeeded"` on every
   * scene. So a film that was completely shot, and then had one re-render
   * refused, stopped being scoreable: the clip was right there and playing, and
   * the film was held back by the outcome of an attempt to replace it.
   */
  const allScenesRendered = useCallback(
    (scenes: unknown[], statuses: VideoStatusMap) =>
      scenes.length > 0 && scenes.every((_, idx) => !!statuses[idx]?.url),
    []
  );

  // Retry a failed cloud generation on the SAME project (free — the spec was
  // already paid for). Re-enqueues a fresh job from the project's stored brief.
  const retryStoryboard = useCallback(async () => {
    if (!user || !activeProjectId) return;
    setError(null);
    setStoryboard(null);
    setGenerating(true);
    setPipelineStage("queued");
    setPipelineProgress(null);
    try {
      await updateDoc(doc(db, "projects", activeProjectId), {
        pipelineStage: "queued",
        pipelineError: null,
        updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, "storyboardJobs"), {
        uid: user.uid,
        projectId: activeProjectId,
        prompt: promptText,
        length,
        videoType: videoTypeId,
        // Same rule as the first attempt: a story retry must not acquire a brand
        // it never had. See generateStoryboard.
        brandName: videoType(videoTypeId).branded ? brandName || "Client" : null,
        product: videoType(videoTypeId).branded ? product || "Product offering" : null,
        aspectRatio,
        productionMode: productionMode || "manual",
        materialPaths: projectMaterials,
        status: "queued",
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to retry storyboard generation:", err);
      setError(err instanceof Error ? err.message : "Could not restart generation");
      setGenerating(false);
      setPipelineStage("failed");
    }
  }, [user, activeProjectId, promptText, length, videoTypeId, brandName, product, aspectRatio, productionMode, projectMaterials]);

  // Kick off scoring the moment the last scene lands, so a finished film arrives
  // already scored instead of waiting for the director to ask.
  //
  // Guarded three ways, because this spends Vertex quota: only when every scene
  // has actually rendered, only when the project has never had a pass (or the
  // last one failed), and only once per mount via a ref — `audioStage` reaches
  // us through a Firestore snapshot, so between enqueueing and the write landing
  // this effect can re-run with the old value and queue a second job.
  const audioKickedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeProjectId || !storyboard) return;
    const sceneCount = storyboard.scenes.length;
    if (sceneCount === 0) return;
    if (!allScenesRendered(storyboard.scenes, videoStatus)) return;
    if (audioStage && audioStage !== "failed") return;
    if (audioKickedRef.current === activeProjectId) return;
    audioKickedRef.current = activeProjectId;
    void requestAudioPost();
  }, [activeProjectId, storyboard, videoStatus, audioStage, allScenesRendered, requestAudioPost]);

  // ─── AUTO-RESUME OR INITIATE QUEUED GENERATIONS ON PROJECT LOAD ──────────
  //
  // A BOARD FILM WAITS FOR ITS SHOT BOARD before it starts rendering. That
  // ordering is the whole point of photographing a film first: a clip shot before
  // its frames exist is the clip the board was built to prevent, and re-rendering
  // it later costs real money.
  //
  // Unlike the reverted version, it does not go on a board that failed or came
  // back partial: on this film type an unphotographed scene has nothing to attach
  // and its long prompt was deliberately written NOT to describe how anything
  // looks, so rendering it anyway buys a clip of the wrong film. The board screen
  // asks the director to retry instead.
  useEffect(() => {
    if (!storyboard || !activeProjectId) return;
    const boardHolding = isBoardFilm && shotBoardStage !== "ready";
    storyboard.scenes.forEach((scene, idx) => {
      const status = videoStatus[idx];
      const isPolling = scenePollersRef.current.has(pollerKey(activeProjectId, idx));
      if (!status || status.status === "succeeded" || status.status === "failed") return;
      if (status.status === "rendering" && status.id && !isPolling) {
        void resumePollingForScene(idx, status.id);
      } else if (
        productionMode === "auto-merge" &&
        !boardHolding &&
        (status.status === "idle" || (status.status === "rendering" && !status.id)) &&
        !isPolling
      ) {
        void generateVideoForScene(idx, renderPrompt(scene, status.customPrompt));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyboard, activeProjectId, productionMode, isBoardFilm, shotBoardStage]);

  const reviseScenePrompt = useCallback(
    async (sceneIndex: number) => {
      if (!storyboard) return;
      const scene = storyboard.scenes[sceneIndex];
      const status = videoStatus[sceneIndex];
      if (!status?.revisionInput?.trim()) return;

      setVideoStatus((prev) => ({
        ...prev,
        [sceneIndex]: { ...prev[sceneIndex], revising: true },
      }));

      try {
        const res = await apiFetch<{ revisedPrompt: string }>("/api/story/revise", {
          method: "POST",
          body: JSON.stringify({
            scenePrompt: scene.fullPrompt,
            revisionRequest: status.revisionInput,
            characterLock: storyboard.characterLock,
            styleHeader: storyboard.styleHeader,
            // Continuity context: the reviser keeps this scene flowing from the
            // one before it and into the one after it, on the same music bed.
            previousScenePrompt: storyboard.scenes[sceneIndex - 1]?.fullPrompt || null,
            nextScenePrompt: storyboard.scenes[sceneIndex + 1]?.fullPrompt || null,
            musicSpec: storyboard.musicSpec || null,
            // Decides which sandbox's reviser runs, and whether it may write
            // dialogue into this scene at all — a narrated film's footage is
            // silent by construction.
            videoType: videoTypeId,
            // Documentary only: the voiceover over this scene. The reviser builds
            // the picture around it — leaving the voice room to sit, and never
            // letting the picture repeat what the line already says.
            narration: scene.narration || null,
          }),
        });

        const updatedScenes = [...storyboard.scenes];
        updatedScenes[sceneIndex] = {
          ...scene,
          fullPrompt: res.revisedPrompt,
          // The short shooting brief was compressed from the script as it read
          // BEFORE this revision, so it no longer describes what the director
          // just asked for. Dropping it sends the render back to the revised full
          // prompt — correct, just longer-winded — until the scene is
          // re-photographed and a new brief is written from the new script.
          framedPrompt: "",
          action: `[REVISED] ${scene.action}`,
        };
        setStoryboard({ ...storyboard, scenes: updatedScenes });

        setVideoStatus((prev) => ({
          ...prev,
          [sceneIndex]: {
            ...prev[sceneIndex],
            revising: false,
            revisionInput: "",
            customPrompt: res.revisedPrompt,
          },
        }));
      } catch (err) {
        alert("Revision failed: " + (err instanceof Error ? err.message : String(err)));
        setVideoStatus((prev) => ({
          ...prev,
          [sceneIndex]: { ...prev[sceneIndex], revising: false },
        }));
      }
    },
    [storyboard, videoStatus, apiFetch, videoTypeId]
  );

  // ─── PER-SCENE REFERENCE IMAGE MANAGEMENT ────────────────────────────────
  const updateSceneImages = useCallback((sceneIndex: number, next: SceneImage[]) => {
    setSceneImages((prev) => {
      const map = { ...prev, [sceneIndex]: next };
      sceneImagesRef.current = map;
      return map;
    });
  }, []);

  const addSceneImages = useCallback(
    async (sceneIndex: number, files: FileList | File[]) => {
      if (!user || !activeProjectId) return;
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      try {
        const uploaded = await Promise.all(
          list.map(async (file) => {
            const safeName = file.name.replace(/[^\w.-]/g, "_");
            const path = `users/${user.uid}/projects/${activeProjectId}/materials/${Date.now()}-${safeName}`;
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const fileRef = storageRef(storage, path);
            await uploadString(fileRef, dataUrl, "data_url");
            const url = await getDownloadURL(fileRef);
            return { name: file.name, path, url, mimeType: file.type } as SceneImage;
          })
        );
        setProjectMaterials((prev) => [...prev, ...uploaded]);
        updateSceneImages(sceneIndex, [...(sceneImagesRef.current[sceneIndex] || []), ...uploaded]);
      } catch (err) {
        console.error("Failed to upload scene reference images:", err);
        alert("Image upload failed. Please try again.");
      }
    },
    [user, activeProjectId, updateSceneImages]
  );

  const attachMaterialToScene = useCallback(
    (sceneIndex: number, material: SceneImage) => {
      const current = sceneImagesRef.current[sceneIndex] || [];
      if (current.some((img) => img.path === material.path)) return;
      updateSceneImages(sceneIndex, [...current, material]);
    },
    [updateSceneImages]
  );

  const removeSceneImage = useCallback(
    (sceneIndex: number, imageIndex: number) => {
      const current = sceneImagesRef.current[sceneIndex] || [];
      updateSceneImages(sceneIndex, current.filter((_, i) => i !== imageIndex));
    },
    [updateSceneImages]
  );

  const copyToClipboard = useCallback((text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const value: EditorFlowValue = {
    user,
    profile,
    storyboardPayOpen, setStoryboardPayOpen,
    paywallStep, setPaywallStep,
    productionMode, setProductionMode,
    theaterPlaying, setTheaterPlaying,
    currentScenePlayIdx, setCurrentScenePlayIdx,
    projects, projectsLoading, activeProjectId,
    compileStatus, compileVideoUrl, compileError,
    timeline, setTimeline,
    musicUrl, setMusicUrl,
    musicVolume, setMusicVolume,
    wizardStep, setWizardStep,
    length, setLength,
    videoTypeId, selectVideoType,
    promptText, setPromptText,
    brandName, setBrandName,
    product, setProduct,
    brandMaterials, isDragging, setIsDragging,
    promptExpanded, setPromptExpanded,
    aspectRatio, setAspectRatio,
    aspectDropdownOpen, setAspectDropdownOpen,
    recording, recordingTarget, generating, error, setError, copiedIndex,
    storyboard, setStoryboard,
    videoStatus, setVideoStatus,
    audioStage, audioReport, requestAudioPost,
    pipelineStage, pipelineProgress, retryStoryboard,
    agentRunning,
    sceneImages, projectMaterials,
    addSceneImages, attachMaterialToScene, removeSceneImage,
    shotBoard, shotBoardStage, shotBoardProgress, shotBoardError, shotBoardBusy, buildShotBoard,
    characterRefs,
    removeBoardShot, addBoardShot, addBoardShotImages,
    isBoardFilm, continueToBoard, continueToFilm, projectLink,
    startSpeechRecognition, stopSpeechRecognition,
    handleMaterialsUpload, handleDrop, removeBrandMaterial,
    generateStoryboard, allScenesRendered, generateVideoForScene, selectSceneTake, reviseScenePrompt,
    copyToClipboard, handleCompileProject, deleteProject,
    goHome, goCreate, openProject, openProjectRoute,
  };

  return <EditorFlowContext.Provider value={value}>{children}</EditorFlowContext.Provider>;
}
