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
import { useReferenceImages } from "../../_shared/useReferenceImages";
import { AgentChatMessage } from "./types";

export default function AgentMessage({ message }: { message: AgentChatMessage }) {
  // Called before the role branch below, because hooks cannot sit behind an
  // early return. Assistant turns carry no attachments, so it resolves to [].
  // Paths are resolved with getDownloadURL rather than assembled by hand: these
  // objects are uploaded by the browser SDK and are not public, so a
  // storage.googleapis.com URL built from the path would 403.
  const attachmentUrls = useReferenceImages(message.images);

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        {/* What was attached, so reopening the thread still shows what the
            agent was looking at. Served straight from the bucket the client
            uploaded to. */}
        {attachmentUrls.length > 0 && (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5">
            {attachmentUrls.map((url) =>
              // Decided from the URL rather than by pairing back to
              // message.images by index: useReferenceImages drops any path it
              // fails to resolve, so the two lists can fall out of step.
              /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? (
                <video
                  key={url}
                  src={url}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-20 w-20 rounded-2xl border border-line object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt="Attached reference"
                  className="h-20 w-20 rounded-2xl border border-line object-cover"
                />
              )
            )}
          </div>
        )}
        {message.text && (
          <div className="max-w-[85%] rounded-3xl rounded-br-md border border-accent-line bg-surface px-4 py-2.5 text-[13px] leading-relaxed text-foreground">
            {message.text}
          </div>
        )}
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
