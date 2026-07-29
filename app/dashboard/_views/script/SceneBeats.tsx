"use client";

// SceneBeats — the human-readable half of a scene (setting, sound, action,
// dialogue) plus the rewrite box. Shared by the desktop card and mobile deck.

import React from "react";
import { RefreshCw, Wand2 } from "lucide-react";
import { Scene } from "../../_flow/types";

function Field({ label, body, tone = "neutral" }: { label: string; body: string; tone?: "neutral" | "blue" }) {
  const shell =
    tone === "blue"
      ? "border-blue-500/15 bg-blue-500/5"
      : "border-white/5 bg-white/[0.02]";
  return (
    <div className={`rounded-2xl border p-3.5 ${shell}`}>
      <span
        className={`text-[9px] font-bold uppercase tracking-wide ${
          tone === "blue" ? "text-blue-400" : "text-neutral-500"
        }`}
      >
        {label}
      </span>
      <p
        className={`mt-1 text-xs leading-relaxed ${
          tone === "blue" ? "italic text-neutral-200" : "text-neutral-300"
        }`}
      >
        {body}
      </p>
    </div>
  );
}

interface SceneBeatsProps {
  scene: Scene;
  revisionInput: string;
  revising: boolean;
  onRevisionInput: (v: string) => void;
  onRevise: () => void;
  /** Stack the setting/sound pair instead of pairing them (mobile). */
  stacked?: boolean;
}

export default function SceneBeats({
  scene,
  revisionInput,
  revising,
  onRevisionInput,
  onRevise,
  stacked = false,
}: SceneBeatsProps) {
  return (
    <div className="space-y-3.5">
      <div className={`grid gap-3.5 ${stacked ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        <Field label="Setting / environment" body={scene.setting} />
        <Field label="Diegetic audio / sound spec" body={scene.sound} />
      </div>

      <Field label="Action beats" body={scene.action} />

      {scene.dialogue && <Field label="Dialogue" body={`“${scene.dialogue}”`} tone="blue" />}

      {/* Rewrite engine */}
      <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-background px-3 py-1.5 transition-colors focus-within:border-blue-500/40">
        <input
          value={revisionInput}
          onChange={(e) => onRevisionInput(e.target.value)}
          placeholder="Rewrite this scene (change the shirt colour, add rain, pan left…)"
          disabled={revising}
          className="w-full bg-transparent text-xs text-white outline-none placeholder:text-neutral-700 disabled:opacity-50"
        />
        <button
          onClick={onRevise}
          disabled={revising || !revisionInput.trim()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-[#131d35] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-600 disabled:bg-[#131d35] disabled:text-neutral-500"
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
    </div>
  );
}
