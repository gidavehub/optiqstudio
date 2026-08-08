"use client";

// AgentStudio — /dashboard/project/[id]/agent.
//
// The room where you talk to the film. The script editor is for surgery on one
// scene; this is for direction: "the ending doesn't land", "make scene four
// funnier", "re-score it warmer". The agent reads the film, finds the beat you
// mean, rewrites what needs rewriting, and can now render and re-score too.
//
// Layout is the TIMELINE's, not the creator route's: a real top bar carrying the
// brand, the film, the way to the other two faces and the history toggle, then
// the full viewport underneath. It used to be a narrow centre column under the
// floating pills with a scene-number rail below the header — which made the most
// capable surface in the product look like a side panel.
//
// This room owns its navigation. The floating WorkspaceModeBar is deliberately
// NOT rendered here (and FloatingChrome hides too): Script and Timeline live in
// the bar below, and a floating switcher on top of it is two navigation controls
// arguing about the same three destinations.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Clapperboard, Edit3, Loader2, PanelLeft, Tv } from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import OptiqMark from "../../../../components/OptiqMark";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import useIsMobile from "../../_shared/useIsMobile";
import AgentComposer from "./AgentComposer";
import AgentMessage from "./AgentMessage";
import AgentHistory from "./AgentHistory";
import useAgentChat from "./useAgentChat";
import { AgentAttachment } from "./types";

// Openers that show the agent's range without making the director invent one.
// Two of these are new powers — rendering and re-scoring — so they belong here
// rather than being discoverable only by guessing.
const SUGGESTIONS = [
  "Read the whole storyline and tell me what's weak.",
  "The opening is slow — give it a real event.",
  "Re-score it warmer and slower.",
  "Render scene 3 for me.",
];

export default function AgentStudio() {
  const {
    storyboard, activeProjectId, projects, projectsLoading, videoStatus,
    setProductionMode, goHome,
  } = useEditorFlow();
  const { user, apiFetch } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();

  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const {
    messages, loading, busy, activity, send,
    threads, activeThreadId, selectThread, newThread, deleteThread,
  } = useAgentChat(activeProjectId, user?.uid ?? null);

  const project = projects.find((p) => p.id === activeProjectId) ?? null;
  const scenes = useMemo(() => storyboard?.scenes ?? [], [storyboard]);
  const hasScript = scenes.length > 0;
  const renderedCount = useMemo(
    () => scenes.filter((_, idx) => videoStatus[idx]?.status === "succeeded").length,
    [scenes, videoStatus]
  );

  // Follow the conversation, but never yank the view away from someone who has
  // scrolled up to re-read an earlier turn.
  useEffect(() => {
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Switching conversation should land at the bottom of it, not wherever the
  // previous one was scrolled to.
  useEffect(() => {
    atBottomRef.current = true;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeThreadId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  // Both other faces live on the project route and are chosen by production mode,
  // so leaving here means setting the mode and navigating in one go.
  const goToScript = () => {
    setProductionMode("manual");
    router.push(`/dashboard/project/${activeProjectId}`);
  };
  const goToTimeline = () => {
    setProductionMode("auto-merge");
    router.push(`/dashboard/project/${activeProjectId}`);
  };

  // Reference stills staged for the next message. Read as base64 up front, the
  // same way the Image and Video studio consoles do it, so send() only has to
  // push bytes to Storage.
  const [images, setImages] = useState<AgentAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  // Vertex carries an attachment as base64 inside the request body, and the
  // request itself has a payload ceiling around 20MB. Base64 inflates a file by
  // roughly a third, so anything much past 14MB raw will be rejected by the API
  // rather than by us — better to say so at the point of attaching.
  const MAX_ATTACHMENT_BYTES = 14 * 1024 * 1024;

  const attachImages = (files: FileList | null) => {
    for (const file of Array.from(files || [])) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) continue;
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setAttachError(
          `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — attachments have to stay under 14MB.`
        );
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachError(null);
        setImages((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2, 9),
            base64: dataUrl.split(",")[1],
            mimeType: file.type,
            preview: dataUrl,
            kind: isVideo ? "video" : "image",
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  // The names this film actually contains, handed to the transcriber so it
  // spells them instead of guessing. This is the fix for the one weakness the
  // round-trip probe found: "Banjul" came back "banjo" and "Amaka" came back
  // "Omaka" with no context. Brand, product and every character name.
  const spellingHints = useMemo(() => {
    const names = new Set<string>();
    if (project?.brandName) names.add(String(project.brandName));
    if (project?.product) names.add(String(project.product));
    if (storyboard?.title) names.add(storyboard.title);
    // The cast is film-wide, held on the storyboard's characterLock rather than
    // per scene.
    if (storyboard?.characterLock?.name) names.add(storyboard.characterLock.name);
    return Array.from(names).filter((n) => n.trim().length > 1);
    // Depends on `project` and `storyboard` wholesale rather than the individual
    // fields: the React compiler infers the coarser dependency and refuses to
    // optimize the component when the two disagree.
  }, [project, storyboard]);

  const transcribe = useCallback(
    async (audioBase64: string, mimeType: string) => {
      const res = await apiFetch<{ text: string }>("/api/transcribe", {
        method: "POST",
        body: JSON.stringify({ audioBase64, mimeType, hints: spellingHints }),
      });
      return res.text || "";
    },
    [apiFetch, spellingHints]
  );

  const submit = () => {
    const body = draft.trim();
    // An attachment on its own is a valid turn.
    if (!body && images.length === 0) return;
    const attached = images;
    setDraft("");
    setImages([]);
    atBottomRef.current = true;
    void send(body, attached);
  };

  const historyPanel = (
    <AgentHistory
      threads={threads}
      activeThreadId={activeThreadId}
      onSelect={(id) => {
        selectThread(id);
        setHistoryOpen(false);
      }}
      onNew={() => {
        newThread();
        setHistoryOpen(false);
      }}
      onDelete={(id) => void deleteThread(id)}
      asSheet={isMobile}
      onClose={() => setHistoryOpen(false)}
    />
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* ── TOP BAR ───────────────────────────────────────────────────────────
          This room's only navigation. Built to survive a 375px phone: the film's
          title is the one thing that flexes and truncates, everything else is
          shrink-0, and the two labels that aren't load-bearing (Portal, History)
          drop away before the destinations do. */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line bg-surface/90 px-2 py-2 backdrop-blur-md sm:gap-3 sm:px-4 sm:py-2.5">
        <button
          onClick={goHome}
          aria-label="Back to portal"
          title="Back to portal"
          className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-foreground sm:px-2.5"
        >
          <ChevronLeft size={12} /> <span className="hidden md:inline">Portal</span>
        </button>

        <button
          onClick={() => setHistoryOpen((v) => !v)}
          aria-label="Conversation history"
          title="Conversation history"
          className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-colors active:scale-95 sm:px-2.5 ${
            historyOpen && !isMobile
              ? "border-accent-line bg-surface-2 text-accent-ink"
              : "border-line bg-surface text-ink-3 hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          <PanelLeft size={12} />
          <span className="hidden lg:inline">History</span>
          {threads.length > 0 && (
            <span className="tabular-nums text-[10px] text-faint">{threads.length}</span>
          )}
        </button>

        {/* The agent's identity IS the product's — this is Optiq itself, not a
            generic robot. The mark holds on a phone even when the word can't. */}
        <span className="flex shrink-0 items-center gap-2 pl-0.5">
          <OptiqMark size={18} />
          <span className="hidden tabular-nums text-[12px] font-bold lowercase tracking-tight text-foreground lg:inline">
            optiq agent
          </span>
        </span>

        {/* The only flexible element, so it is what gives way when space runs out. */}
        <h1 className="min-w-0 flex-1 truncate border-l border-surface-2 pl-2 text-xs font-bold text-foreground sm:pl-3">
          {storyboard?.title || project?.title || "Untitled film"}
        </h1>

        {hasScript && (
          <span className="hidden shrink-0 tabular-nums text-[10px] text-faint xl:inline">
            {renderedCount}/{scenes.length} rendered
          </span>
        )}

        {/* The ways out. Icon-only on phones, labelled from `sm` up — and never
            offering the room you're already in. */}
        <div className="flex shrink-0 items-center gap-1 border-l border-surface-2 pl-1.5 sm:pl-2.5">
          <button
            onClick={goToScript}
            title="Script editor"
            aria-label="Script editor"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-accent-ink active:scale-95 sm:px-2.5"
          >
            <Edit3 size={12} /> <span className="hidden sm:inline">Script</span>
          </button>
          <button
            onClick={goToTimeline}
            title="Timeline editor"
            aria-label="Timeline editor"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-accent-ink active:scale-95 sm:px-2.5"
          >
            <Tv size={12} /> <span className="hidden sm:inline">Timeline</span>
          </button>
        </div>
      </div>

      {/* ── BODY: history | conversation ─────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {!isMobile && historyOpen && historyPanel}

        <div className="flex min-w-0 flex-1 flex-col">
          <main
            ref={scrollRef}
            onScroll={onScroll}
            className="min-h-0 flex-1 overflow-y-auto px-3 pt-4 sm:px-6"
          >
            {/* Wider than the old max-w-3xl: this is a full screen now, and a
                work log of twelve tool calls needs the room. */}
            <div className="mx-auto w-full max-w-4xl pb-6">
              {projectsLoading || loading ? (
                <div className="flex items-center justify-center gap-2 py-24 tabular-nums text-[10px] uppercase tracking-widest text-muted">
                  <Loader2 size={12} className="animate-spin" /> Opening the room…
                </div>
              ) : !hasScript ? (
                <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                  <Clapperboard size={22} className="text-faint" />
                  <h3 className="text-sm font-bold text-foreground">There&apos;s no script here yet</h3>
                  <p className="max-w-xs text-[11px] leading-relaxed text-muted">
                    Generate the storyboard first — then bring it back here and we&apos;ll work it over together.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-6 py-16 text-center sm:py-24">
                  <div>
                    <OptiqMark size={34} className="mx-auto mb-4" />
                    <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                      Work the whole film
                    </h1>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted">
                      Ask for a change, name a scene, or just think out loud. I can rewrite the script,
                      render scenes and re-score the film.
                    </p>
                  </div>
                  <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setDraft(s)}
                        className="rounded-[22px] border border-line bg-surface-2 px-4 py-3 text-left text-[11px] font-semibold leading-relaxed text-ink-3 transition-all hover:border-accent-line hover:bg-surface hover:text-foreground active:scale-[0.98]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6 pt-2">
                  {messages.map((message) => (
                    <AgentMessage key={message.id} message={message} />
                  ))}
                </div>
              )}
            </div>
          </main>

          {/* ── COMPOSER ── */}
          <footer className="shrink-0 px-3 pb-3 pt-2 sm:px-6 sm:pb-4">
            <div className="mx-auto w-full max-w-4xl">
              <AgentComposer
                value={draft}
                setValue={setDraft}
                onSend={submit}
                busy={busy}
                activity={activity}
                disabled={!hasScript}
                images={images}
                onAttach={attachImages}
                onRemoveImage={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
                attachError={attachError}
                transcribe={transcribe}
              />
            </div>
          </footer>
        </div>
      </div>

      {/* ── MOBILE: history as a sheet ──────────────────────────────────────── */}
      {isMobile && historyOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          <div className="relative ml-0 h-full w-[86%] max-w-[320px] border-r border-line shadow-2xl">
            {historyPanel}
          </div>
        </div>
      )}
    </div>
  );
}
