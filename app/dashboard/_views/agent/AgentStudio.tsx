"use client";

// AgentStudio — /dashboard/project/[id]/agent.
//
// The room where you talk to the film. The script editor is for surgery on one
// scene; this is for direction: "the ending doesn't land", "make scene four
// funnier", "why does every prompt have to say Black?". The agent reads the
// film, finds the beat you mean, rewrites what needs rewriting and reports back.
//
// Layout follows the creator route exactly — one column, chrome at the top,
// the prompt surface at the bottom, nothing competing in between.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Clapperboard, Edit3, Loader2, Sliders, Trash2 } from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import AgentComposer from "./AgentComposer";
import AgentMessage from "./AgentMessage";
import useAgentChat from "./useAgentChat";

// Openers that show the agent's range without making the director invent one.
const SUGGESTIONS = [
  "Read the whole storyline and tell me what's weak.",
  "Check every scene against the house rules.",
  "Make the ending land harder on the product.",
  "The opening is slow — give it a real event.",
];

export default function AgentStudio() {
  const { storyboard, activeProjectId, projects, projectsLoading, videoStatus } = useEditorFlow();
  const { user } = useAuth();
  const router = useRouter();

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const { messages, loading, busy, activity, send, clear } = useAgentChat(activeProjectId, user?.uid ?? null);

  const project = projects.find((p) => p.id === activeProjectId) ?? null;
  const scenes = useMemo(() => storyboard?.scenes ?? [], [storyboard]);

  // Follow the conversation, but never yank the view away from someone who has
  // scrolled up to re-read an earlier turn.
  useEffect(() => {
    if (!atBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const submit = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    atBottomRef.current = true;
    void send(body);
  };

  const appendToDraft = (text: string) =>
    setDraft((prev) => (prev.trim() ? `${prev.trimEnd()} ${text}` : text));

  const startNewThread = async () => {
    if (messages.length === 0) return;
    if (!confirm("Clear this conversation? The script itself is not affected.")) return;
    await clear();
  };

  const hasScript = scenes.length > 0;

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* ── TOP CHROME (pt-16 clears the floating pills) ── */}
      <header className="relative z-10 shrink-0 px-4 pb-3 pt-16 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 tabular-nums text-[9px] font-bold uppercase tracking-widest text-accent-ink">
              <Bot size={11} /> Storyline Agent
            </span>
            <h2 className="truncate text-sm font-bold tracking-tight text-foreground">
              {storyboard?.title || project?.title || "Untitled film"}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={() => void startNewThread()}
                title="Clear this conversation"
                className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-foreground active:scale-95"
              >
                <Trash2 size={12} />
                <span className="hidden sm:inline">New thread</span>
              </button>
            )}
            <button
              onClick={() => router.push(`/dashboard/project/${activeProjectId}`)}
              className="flex items-center gap-1.5 rounded-2xl border border-accent-line bg-surface px-3.5 py-2 text-[11px] font-bold text-accent-ink transition-colors hover:border-accent hover:bg-surface-2 active:scale-95"
            >
              <Edit3 size={12} /> Script
            </button>
          </div>
        </div>

        {/* Scene rail — tap a scene to aim your next message at it. */}
        {hasScript && (
          <div className="mx-auto mt-3 flex w-full max-w-3xl gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => appendToDraft("Looking at the film-wide direction:")}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] font-bold text-ink-3 transition-colors hover:border-line-2 hover:text-foreground"
            >
              <Sliders size={10} className="text-accent-ink" /> Direction
            </button>
            {scenes.map((scene, idx) => {
              const rendered = videoStatus[idx]?.status === "succeeded";
              return (
                <button
                  key={scene.sceneNumber}
                  onClick={() => appendToDraft(`Scene ${scene.sceneNumber}:`)}
                  title={scene.setting}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] font-bold text-ink-3 transition-colors hover:border-line-2 hover:text-foreground"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${rendered ? "bg-success" : "bg-surface-3"}`} />
                  Scene {scene.sceneNumber}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── THE THREAD ── */}
      <main
        ref={scrollRef}
        onScroll={onScroll}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 sm:px-6"
      >
        <div className="mx-auto w-full max-w-3xl pb-6">
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
                <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  Work the whole storyline
                </h1>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted">
                  Ask for a change, name a scene, or just think out loud. I&apos;ll read the film, rewrite what
                  needs rewriting, and keep every lock intact.
                </p>
              </div>
              <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setDraft(s)}
                    className="rounded-[28px] border border-line bg-surface-2 px-4 py-3 text-left text-[11px] font-semibold leading-relaxed text-ink-3 transition-all hover:border-accent-line hover:bg-surface hover:text-foreground active:scale-[0.98]"
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
      <footer className="relative z-10 shrink-0 px-4 pb-4 pt-2 sm:px-6">
        <AgentComposer
          value={draft}
          setValue={setDraft}
          onSend={submit}
          busy={busy}
          activity={activity}
          disabled={!hasScript}
        />
      </footer>
    </div>
  );
}
