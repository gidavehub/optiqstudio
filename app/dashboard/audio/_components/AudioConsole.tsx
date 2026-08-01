"use client";

// AudioConsole — the docked prompt bar for the Optiq Voice Engine (narration
// script) and Optiq Music (music brief). Same silhouette as the Image/Video
// studios' bottom consoles so the whole platform feels one-for-one.

import React from "react";
import { Loader2, Mic, MicOff, Wand2 } from "lucide-react";
import { useDictation } from "../../_shared/useDictation";

interface AudioConsoleProps {
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  onGenerate: () => void;
  busy: boolean;
  generateLabel: string;
  busyLabel: string;
  maxLength: number;
  hint?: string;
  showEnhance?: boolean;
  onEnhance?: () => void;
  enhancing?: boolean;
  /** Optional slot rendered above the input (e.g. mobile speaker strip). */
  children?: React.ReactNode;
}

export default function AudioConsole({
  value,
  setValue,
  placeholder,
  onGenerate,
  busy,
  generateLabel,
  busyLabel,
  maxLength,
  hint,
  showEnhance = false,
  onEnhance,
  enhancing = false,
  children,
}: AudioConsoleProps) {
  // Live speech-to-text — dictate the script/brief instead of typing it.
  const dictation = useDictation((updater) => setValue(updater(value)));

  return (
    <div className="relative z-40 border-t border-line bg-background/90 p-4 backdrop-blur-md sm:p-5">
      {children}

      <div className="flex w-full items-end gap-3 rounded-3xl border border-line bg-surface p-3 shadow-inner transition-all duration-300">
        <textarea
          rows={1}
          value={dictation.recording && dictation.interim ? `${value} ${dictation.interim}`.trim() : value}
          maxLength={maxLength}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          readOnly={dictation.recording}
          placeholder={dictation.recording ? "Listening…" : placeholder}
          className="max-h-40 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-sm placeholder:text-faint focus:outline-none"
        />

        <button
          onClick={dictation.toggle}
          title={dictation.recording ? "Stop dictation" : "Dictate"}
          className={`shrink-0 rounded-full p-1.5 transition-colors ${
            dictation.recording
              ? "animate-pulse bg-danger-soft text-danger"
              : "text-ink-3 hover:text-foreground"
          }`}
        >
          {dictation.recording ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        {showEnhance && (
          <button
            onClick={onEnhance}
            disabled={enhancing || !value.trim()}
            title="Enhance brief"
            className="shrink-0 p-1.5 text-ink-3 transition-colors hover:text-foreground disabled:opacity-40"
          >
            {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          </button>
        )}

        <button
          onClick={onGenerate}
          disabled={busy || !value.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition-colors hover:bg-ink-2 disabled:opacity-40"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? busyLabel : generateLabel}
        </button>
      </div>

      <div className="mt-1.5 flex justify-between px-1 tabular-nums text-[10px] text-faint">
        <span>
          {value.length.toLocaleString()} / {maxLength.toLocaleString()}
        </span>
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
