"use client";

// SceneRewriteBar — plain-English rewrite of one scene.
//
// It sits directly under the compiled prompt, because that's the thing it
// rewrites: you read the prompt, you say what's wrong with it, it comes back
// changed. Shared by the desktop card and the mobile deck.

import React from "react";
import { RefreshCw, Wand2 } from "lucide-react";

interface SceneRewriteBarProps {
  value: string;
  revising: boolean;
  onChange: (v: string) => void;
  onRevise: () => void;
}

export default function SceneRewriteBar({ value, revising, onChange, onRevise }: SceneRewriteBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-3xl border border-line bg-background px-3 py-1.5 transition-colors focus-within:border-accent-line">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rewrite this scene (change the shirt colour, add rain, pan left…)"
        disabled={revising}
        className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-faint disabled:opacity-50"
      />
      <button
        onClick={onRevise}
        disabled={revising || !value.trim()}
        className="flex shrink-0 items-center gap-1 rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent hover:text-white disabled:bg-surface-2 disabled:text-muted"
      >
        {revising ? (
          <>
            <RefreshCw size={11} className="animate-spin" /> Rewriting…
          </>
        ) : (
          <>
            <Wand2 size={11} /> Rewrite
          </>
        )}
      </button>
    </div>
  );
}
