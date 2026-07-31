"use client";

// AgentComposer — the box you talk to the agent through.
//
// Same card as the creation wizard's vision step (that is the house prompt
// surface), and the same live speech-to-text mic every prompt console in the
// studio uses — words land in the box as they're spoken, so you can direct the
// film out loud instead of typing a paragraph of notes.

import React, { useEffect, useRef } from "react";
import { ArrowUp, Loader2, Mic, MicOff } from "lucide-react";
import { useDictation } from "../../_shared/useDictation";

interface AgentComposerProps {
  value: string;
  setValue: (v: string) => void;
  onSend: () => void;
  /** True while a turn is in flight — sending is locked, typing is not. */
  busy: boolean;
  /** The step the agent is on, shown above the box while it works. */
  activity: string | null;
  disabled?: boolean;
}

export default function AgentComposer({
  value,
  setValue,
  onSend,
  busy,
  activity,
  disabled = false,
}: AgentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useDictation((updater) => setValue(updater(value)));

  // Grow with the text, then scroll. Runs on every value change so dictated
  // words resize the box exactly like typed ones.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const canSend = !busy && !disabled && !!value.trim();

  const submit = () => {
    if (!canSend) return;
    if (dictation.recording) dictation.stop();
    onSend();
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      {activity && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <Loader2 size={11} className="shrink-0 animate-spin text-blue-400" />
          <span className="truncate font-mono text-[10px] uppercase tracking-widest text-neutral-500">
            {activity}
          </span>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-[#0e1630]/75 p-3 shadow-2xl backdrop-blur-xl transition-all duration-300 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10">
        <textarea
          ref={textareaRef}
          rows={1}
          value={dictation.recording && dictation.interim ? `${value} ${dictation.interim}`.trim() : value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          readOnly={dictation.recording}
          disabled={disabled}
          placeholder={
            dictation.recording
              ? "Listening…"
              : disabled
                ? "Generate the storyboard first…"
                : "Scene 4 drags — give it a real event, and land the tub in shot…"
          }
          className="max-h-[200px] w-full resize-none overflow-y-auto bg-transparent px-1.5 py-1 text-sm leading-relaxed text-white outline-none placeholder:text-neutral-600"
        />

        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2.5">
          <button
            type="button"
            onClick={dictation.toggle}
            disabled={disabled}
            title={dictation.recording ? "Stop dictation" : "Talk to the agent"}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all disabled:opacity-40 ${
              dictation.recording
                ? "animate-pulse border-red-500/20 bg-red-600/20 text-red-400"
                : "border-white/5 bg-white/5 text-neutral-400 hover:border-white/10 hover:text-white"
            }`}
          >
            {dictation.recording ? <MicOff size={12} /> : <Mic size={12} className="text-blue-400" />}
            {dictation.recording ? "Stop" : "Voice"}
          </button>

          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-neutral-600 sm:block">
              {busy ? "Working" : "Enter to send"}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition-all hover:bg-neutral-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
