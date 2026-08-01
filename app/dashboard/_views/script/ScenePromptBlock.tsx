"use client";

// ScenePromptBlock — the compiled scene prompt, viewed or edited.
//
// These prompts are deliberately long (the Optiq Skills swarm writes 500–2,000
// words per scene). Rendering all of that inline turned the script deck into an
// endless wall of monospace, so the block is CLAMPED by default with a fade and
// an explicit expand toggle, and the word count is shown up front so the length
// is information rather than a surprise.

import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Copy, Edit3 } from "lucide-react";

interface ScenePromptBlockProps {
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  onToggleEdit: () => void;
  onCopy: () => void;
  copied: boolean;
  /** Collapsed height. Mobile gets a shorter window than desktop. */
  collapsedClass?: string;
}

export default function ScenePromptBlock({
  value,
  editing,
  onChange,
  onToggleEdit,
  onCopy,
  copied,
  collapsedClass = "max-h-40",
}: ScenePromptBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  // Only worth a toggle when there's meaningfully more to see.
  const clampable = !editing && words > 70;

  return (
    <div className="rounded-[28px] border border-line bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
          Compiled prompt
          <span className="ml-1.5 font-mono normal-case tracking-normal text-faint">
            {words.toLocaleString()} words
          </span>
        </span>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onCopy}
            className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-accent-ink"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={onToggleEdit}
            className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-accent-ink"
          >
            <Edit3 size={11} />
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="mt-2.5 w-full resize-y rounded-2xl border border-accent-line bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground outline-none"
        />
      ) : (
        <div className="relative mt-2.5">
          <div
            className={`overflow-y-auto whitespace-pre-line rounded-2xl border border-line bg-background p-3.5 font-mono text-[11px] leading-relaxed text-ink-3 ${
              clampable && !expanded ? collapsedClass : "max-h-[60vh]"
            }`}
          >
            {value}
          </div>
          {clampable && !expanded && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-2xl bg-gradient-to-t from-background to-transparent" />
          )}
        </div>
      )}

      {clampable && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-muted transition-colors hover:text-accent-ink"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Collapse" : `Read all ${words.toLocaleString()} words`}
        </button>
      )}
    </div>
  );
}
