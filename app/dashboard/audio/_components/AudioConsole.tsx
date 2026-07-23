"use client";

// AudioConsole — the docked prompt bar for the Optiq Voice Engine (narration
// script) and Optiq Music (music brief). Same silhouette as the Image/Video
// studios' bottom consoles so the whole platform feels one-for-one.

import React from "react";
import { Loader2, Wand2 } from "lucide-react";

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
  return (
    <div className="relative z-40 border-t border-neutral-900 bg-background/90 p-4 backdrop-blur-md sm:p-5">
      {children}

      <div className="flex w-full items-end gap-3 rounded-2xl border border-neutral-800 bg-surface p-3 shadow-inner transition-all duration-300">
        <textarea
          rows={1}
          value={value}
          maxLength={maxLength}
          onChange={(e) => {
            setValue(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          placeholder={placeholder}
          className="max-h-40 flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-sm placeholder:text-neutral-600 focus:outline-none"
        />

        {showEnhance && (
          <button
            onClick={onEnhance}
            disabled={enhancing || !value.trim()}
            title="Enhance brief"
            className="shrink-0 p-1.5 text-neutral-400 transition-colors hover:text-white disabled:opacity-40"
          >
            {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          </button>
        )}

        <button
          onClick={onGenerate}
          disabled={busy || !value.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {busy ? busyLabel : generateLabel}
        </button>
      </div>

      <div className="mt-1.5 flex justify-between px-1 font-mono text-[10px] text-neutral-600">
        <span>
          {value.length.toLocaleString()} / {maxLength.toLocaleString()}
        </span>
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
