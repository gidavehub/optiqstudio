"use client";

// AgentStudio — /dashboard/project/[id]/agent.
//
// The room where you talk to the film. The script editor is for surgery on one
// scene; this is for direction: "the ending doesn't land", "make scene four
// funnier", "re-score it warmer". The agent reads the film, finds the beat you
// mean, rewrites what needs rewriting, and can render and re-score too.
//
// It now sits in the SAME shell as the four studios — floating island, bold
// rail, two-layer dock — because it is the most capable surface in the product
// and it used to look like a side panel with a toolbar bolted on. Only the
// contents of the three regions differ:
//
//   island   the three faces of a film (Agent / Script / Timeline) rather than
//            the four studios — that's what "where can I go from here" means
//            once you are inside a project. The mark still goes to the portal.
//   rail     the conversation history.
//   wall     the conversation itself.
//   dock     Attach / Record / New chat / History over one box. Enter sends.
//
// The floating WorkspaceModeBar is still deliberately NOT rendered here, for the
// same reason as before: Script and Timeline are in the island, and a floating
// switcher on top of it is two controls arguing about three destinations.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../../components/AuthProvider";
import OptiqMark from "../../../../components/OptiqMark";
import { Icon } from "../../../../components/icons";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import StudioShell from "../../_shell/StudioShell";
import StudioDock from "../../_shell/StudioDock";
import DockAttachments from "../../_shell/DockAttachments";
import type { NavItem } from "../../_shell/types";
import AgentMessage from "./AgentMessage";
import AgentHistory from "./AgentHistory";
import useAgentChat from "./useAgentChat";
import useAudioTranscription from "./useAudioTranscription";
import { AgentAttachment } from "./types";

// Openers that show the agent's range without making the director invent one.
// Two of these are powers you would otherwise only find by guessing —
// rendering and re-scoring — so they belong on the empty state.
const SUGGESTIONS = [
  "Read the whole storyline and tell me what's weak.",
  "The opening is slow — give it a real event.",
  "Re-score it warmer and slower.",
  "Render scene 3 for me.",
];

// Vertex carries an attachment as base64 inside the request body, and the
// request itself has a payload ceiling around 20MB. Base64 inflates a file by
// roughly a third, so anything much past 14MB raw will be rejected by the API
// rather than by us — better to say so at the point of attaching.
const MAX_ATTACHMENT_BYTES = 14 * 1024 * 1024;

export default function AgentStudio() {
  const { storyboard, activeProjectId, projects, projectsLoading, videoStatus, setProductionMode } =
    useEditorFlow();
  const { user, apiFetch } = useAuth();
  const router = useRouter();

  const [draft, setDraft] = useState("");
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

  // Both other faces live on the project route and are chosen by production
  // mode, so leaving here means setting the mode and navigating in one go.
  const navItems: readonly NavItem[] = [
    { id: "agent", label: "Agent", icon: "agent" },
    {
      id: "script",
      label: "Script",
      icon: "script",
      onSelect: () => {
        setProductionMode("manual");
        router.push(`/dashboard/project/${activeProjectId}`);
      },
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: "film",
      onSelect: () => {
        setProductionMode("auto-merge");
        router.push(`/dashboard/project/${activeProjectId}`);
      },
    },
  ];

  // Reference stills staged for the next message. Read as base64 up front, the
  // same way the Image and Video studio docks do it, so send() only has to push
  // bytes to Storage.
  const [images, setImages] = useState<AgentAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);

  const attachFiles = (files: File[]) => {
    for (const file of files) {
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

  // Recorded audio to 3.5-flash, not Web Speech — see useAudioTranscription.
  // The transcript lands appended, so dictating twice builds one instruction.
  const dictation = useAudioTranscription(
    (text) => setDraft((prev) => (prev.trim() ? `${prev.trimEnd()} ${text}` : text)),
    transcribe
  );

  const submit = () => {
    // Stopping the recorder kicks off a round trip to the model, so hitting
    // send mid-recording can't also send: the words aren't in the box yet. Stop
    // and let the transcript land — the next press sends it.
    if (dictation.recording) {
      dictation.stop();
      return;
    }
    const body = draft.trim();
    // An attachment on its own is a valid turn.
    if (!body && images.length === 0) return;
    const attached = images;
    setDraft("");
    setImages([]);
    atBottomRef.current = true;
    void send(body, attached);
  };

  return (
    <StudioShell
      navItems={navItems}
      activeId="agent"
      title={storyboard?.title || project?.title || "Untitled film"}
      railLabel="Conversations"
      onDropFiles={attachFiles}
      dropHint="Drop stills or clips for the agent to watch"
      scrollRef={scrollRef}
      onScroll={onScroll}
      rail={
        <AgentHistory
          threads={threads}
          activeThreadId={activeThreadId}
          onSelect={selectThread}
          onNew={newThread}
          onDelete={(id) => void deleteThread(id)}
        />
      }
      dock={({ openRail }) => (
        <StudioDock
          tiles={[
            {
              id: "attach",
              label: "Attach",
              icon: "addMedia",
              badge: images.length,
              disabled: !hasScript,
              file: { accept: "image/*,video/*", multiple: true, onFiles: attachFiles },
            },
            {
              id: "record",
              label: dictation.recording ? "Stop" : dictation.transcribing ? "Writing" : "Record",
              icon: dictation.recording ? "micOff" : "voice",
              danger: dictation.recording,
              busy: dictation.transcribing,
              disabled: !hasScript || dictation.transcribing,
              onSelect: dictation.toggle,
            },
            {
              id: "new",
              label: "New chat",
              icon: "plus",
              onSelect: newThread,
            },
            {
              id: "threads",
              label: "History",
              icon: "panelLeft",
              badge: threads.length,
              onSelect: openRail,
            },
          ]}
          value={draft}
          setValue={setDraft}
          readOnly={dictation.recording || dictation.transcribing}
          disabled={!hasScript}
          // A still on its own is a turn, and so is "stop recording".
          allowEmptySubmit={images.length > 0 || dictation.recording}
          submitOnEnter
          placeholder={
            dictation.recording
              ? "Recording — press Stop when you're done…"
              : dictation.transcribing
                ? "Writing down what you said…"
                : !hasScript
                  ? "Generate the storyboard first…"
                  : "Scene 4 drags — give it a real event, and land the tub in shot…"
          }
          onSubmit={submit}
          busy={busy}
          hint={hasScript ? `${renderedCount}/${scenes.length} rendered · Enter to send` : undefined}
          attachments={
            <>
              {activity && (
                <div className="mb-2.5 flex items-center gap-2.5 rounded-[20px] border border-line-2 bg-surface px-4 py-3">
                  <Icon name="spinner" size={16} className="animate-spin text-accent-ink" />
                  <span className="truncate text-[13px] font-bold tracking-tight text-ink-2">{activity}</span>
                </div>
              )}
              <DockAttachments
                items={images.map((img) => ({ id: img.id, kind: img.kind, preview: img.preview }))}
                onRemove={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
              />
            </>
          }
          error={attachError || dictation.error}
          onDismissError={() => setAttachError(null)}
        />
      )}
    >
      {/* The shell owns the scroller (see scrollRef above) — mounting another
          one here would nest two and give the room two scrollbars. */}
      <div className="mx-auto w-full max-w-4xl pb-6">
          {projectsLoading || loading ? (
            <div className="flex items-center justify-center gap-2.5 py-24 text-[13px] font-bold tracking-tight text-muted">
              <Icon name="spinner" size={16} className="animate-spin" /> Opening the room…
            </div>
          ) : !hasScript ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <Icon name="film" size={30} className="text-faint" />
              <h3 className="text-[20px] font-bold tracking-tight text-foreground">
                There&apos;s no script here yet
              </h3>
              <p className="max-w-xs text-[13px] font-semibold leading-relaxed text-muted">
                Generate the storyboard first — then bring it back here and we&apos;ll work it over together.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-7 py-14 text-center sm:py-20">
              <div>
                <OptiqMark size={40} className="mx-auto mb-5" />
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Work the whole film
                </h1>
                <p className="mx-auto mt-2.5 max-w-md text-[14px] font-semibold leading-relaxed text-muted">
                  Ask for a change, name a scene, or think out loud. I can rewrite the script,
                  render scenes and re-score the film.
                </p>
              </div>
              <div className="grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft(s)}
                    className="rounded-[22px] border border-line-2 bg-surface px-5 py-4 text-left text-[14px] font-semibold leading-relaxed text-ink-2 transition-all hover:border-foreground hover:bg-foreground hover:text-background active:scale-[0.98]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 pt-1">
              {messages.map((message) => (
                <AgentMessage key={message.id} message={message} />
              ))}
            </div>
          )}
      </div>
    </StudioShell>
  );
}
