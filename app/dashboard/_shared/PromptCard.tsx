"use client";

// PromptCard — shared across the studio detail pages. Shows the generation
// prompt clamped to a fixed height with tap-to-expand, a copy action, and the
// reference images that were attached to the generation (resolved from
// Storage paths by the caller). Visual-first: media over text.

import React, { useState } from "react";
import { Check, ChevronDown, Copy, ImageIcon } from "lucide-react";

interface PromptCardProps {
  prompt: string;
  /** Resolved, displayable URLs of attached reference images. */
  referenceImageUrls?: string[];
  /** Extra chips rendered in the header row (date, id, etc.). */
  meta?: React.ReactNode;
}

export default function PromptCard({ prompt, referenceImageUrls = [], meta }: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    void navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isLong = prompt.length > 220;

  return (
    <div className="rounded-2xl border border-white/5 bg-[#0c152d]/60 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-blue-400 shrink-0">
            Prompt
          </span>
          {meta}
        </div>
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-white/5 border border-white/5 px-2.5 py-1 text-[10px] font-semibold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          {copied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Prompt body — fixed clamp, tap to expand */}
      <button
        type="button"
        onClick={() => isLong && setExpanded(!expanded)}
        className={`block w-full px-4 py-3 text-left ${isLong ? "cursor-pointer" : "cursor-default"}`}
      >
        <p
          className={`text-xs leading-relaxed text-neutral-300 whitespace-pre-line transition-all ${
            expanded ? "" : "line-clamp-3"
          }`}
        >
          {prompt}
        </p>
        {isLong && (
          <span className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300">
            <ChevronDown size={11} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            {expanded ? "Show less" : "Tap to expand"}
          </span>
        )}
      </button>

      {/* Reference images strip */}
      {referenceImageUrls.length > 0 && (
        <div className="border-t border-white/5 px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold font-mono uppercase tracking-widest text-neutral-500">
            <ImageIcon size={10} /> Reference Images ({referenceImageUrls.length})
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {referenceImageUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Reference ${i + 1}`}
                  className="h-16 w-20 rounded-lg border border-white/10 object-cover hover:border-blue-500/60 transition-colors"
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
