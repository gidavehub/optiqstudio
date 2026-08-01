"use client";

// AgentWorkLog — what the agent actually did, while it does it.
//
// A film-wide rewrite is three minutes of silence unless you show the work, so
// every tool call streams in here as it starts, ticks over with its own progress
// ("4 of 9 scenes reworked"), and settles into a result. Once the turn is done
// the log folds itself away to a single line so the conversation stays readable.

import React, { useState } from "react";
import {
  AlertCircle, BookOpen, Check, ChevronDown, ChevronUp, FileText, Film, Layers,
  Loader2, PenLine, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Wrench,
} from "lucide-react";
import { AgentStep } from "./types";

const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  get_film: Film,
  read_scene: FileText,
  search_film: Search,
  check_film: ShieldCheck,
  get_doctrine: BookOpen,
  rewrite_scene: PenLine,
  rewrite_film: Layers,
  patch_scene: Wrench,
  update_direction: SlidersHorizontal,
  propagate_locks: RefreshCw,
};

export default function AgentWorkLog({ steps, live }: { steps: AgentStep[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;

  // While the agent is working the log is the content — you want to watch it.
  // Once it has answered, the prose is the content and this collapses.
  const expanded = live || open;
  const writes = steps.filter((s) => s.writes && s.status === "done").length;
  const failed = steps.filter((s) => s.status === "failed").length;

  const summary = live
    ? steps[steps.length - 1]?.label || "Working…"
    : `${steps.length} step${steps.length === 1 ? "" : "s"}${writes > 0 ? ` · ${writes} edit${writes === 1 ? "" : "s"}` : ""}${failed > 0 ? ` · ${failed} failed` : ""}`;

  return (
    <div className="rounded-[28px] border border-line bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={live}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left disabled:cursor-default"
      >
        {live ? (
          <Loader2 size={12} className="shrink-0 animate-spin text-accent-ink" />
        ) : failed > 0 ? (
          <AlertCircle size={12} className="shrink-0 text-orange" />
        ) : (
          <Check size={12} className="shrink-0 text-success" />
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-ink-3">{summary}</span>
        {!live && (expanded ? <ChevronUp size={12} className="text-faint" /> : <ChevronDown size={12} className="text-faint" />)}
      </button>

      {expanded && (
        <ol className="space-y-2 border-t border-line px-3.5 py-3">
          {steps.map((step, i) => {
            const Icon = TOOL_ICONS[step.tool] || Wrench;
            return (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border ${
                    step.status === "failed"
                      ? "border-red-500/25 bg-danger-soft text-danger"
                      : step.writes
                        ? "border-accent-line bg-surface text-accent-ink"
                        : "border-line bg-surface text-muted"
                  }`}
                >
                  {step.status === "running" ? <Loader2 size={10} className="animate-spin" /> : <Icon size={10} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-[11px] font-semibold ${
                      step.status === "failed" ? "text-danger" : "text-ink-2"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="mt-0.5 block font-mono text-[10px] leading-relaxed text-faint">
                      {step.detail}
                    </span>
                  )}
                </span>
                {step.status === "done" && <Check size={11} className="mt-1 shrink-0 text-success" />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
