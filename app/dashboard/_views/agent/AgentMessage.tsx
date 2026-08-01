"use client";

// One turn in the storyline agent thread.
//
// The director's messages sit right, in a tight pill. The agent's sit left and
// full width, because they carry a work log and can run long — a chat bubble
// around 400 words of direction reads like a text message about a film, which is
// the wrong feeling for the room where the film gets made.

import React from "react";
import { AlertCircle, Bot, PenLine } from "lucide-react";
import AgentWorkLog from "./AgentWorkLog";
import RichText from "./RichText";
import { AgentChatMessage } from "./types";

export default function AgentMessage({ message }: { message: AgentChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-md border border-accent-line bg-surface px-4 py-2.5 text-[13px] leading-relaxed text-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  const live = message.status === "queued" || message.status === "working";
  const steps = message.steps || [];

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-accent-ink">
        <Bot size={14} />
      </span>

      <div className="min-w-0 flex-1 space-y-3">
        <AgentWorkLog steps={steps} live={live} />

        {message.text && <RichText text={message.text} />}

        {/* Nothing to show yet — the trigger hasn't picked the job up. */}
        {live && steps.length === 0 && !message.text && (
          <div className="flex items-center gap-1.5 py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-surface-3"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </div>
        )}

        {message.status === "failed" && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-danger bg-danger-soft px-3.5 py-3 text-[11px] leading-relaxed text-danger">
            <AlertCircle size={13} className="mt-px shrink-0" />
            <span>{message.error || "The agent hit an error mid-turn. Try that again."}</span>
          </div>
        )}

        {message.touchedFilm && message.status === "done" && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-surface px-2.5 py-1 text-[10px] font-bold text-accent-ink">
            <PenLine size={10} /> Script updated
          </span>
        )}
      </div>
    </div>
  );
}
