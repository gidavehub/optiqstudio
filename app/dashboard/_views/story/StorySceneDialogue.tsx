"use client";

// SceneDialogue — the one beat worth reading back on its own: the words.
//
// Setting, sound and action beats used to sit here too, as three more cards. But
// every one of them is already written into the compiled prompt below, so all
// they did was make the scene card taller than the scene. The words stay because
// they're what the user hears, and what they most often want changed.
//
// Which words those are depends on the film. An ad or a story carries DIALOGUE,
// spoken on camera and baked into the clip. A documentary carries NARRATION: its
// footage is silent, and the line is recorded separately and laid over the cut —
// which is why it renders differently and why changing it costs no render.

import React from "react";
import { Scene } from "../../_flow/types";

interface SceneDialogueProps {
  scene: Scene;
}

export default function SceneDialogue({ scene }: SceneDialogueProps) {
  const narration = String(scene.narration || "").trim();
  if (narration) {
    return (
      <div className="rounded-[28px] border border-line bg-surface-2 p-3.5">
        <span className="text-[9px] font-bold uppercase tracking-wide text-ink-3">Narration</span>
        <p className="mt-1 text-xs leading-relaxed text-foreground">{narration}</p>
      </div>
    );
  }

  if (!scene.dialogue) return null;

  return (
    <div className="rounded-[28px] border border-accent-line bg-accent-soft p-3.5">
      <span className="text-[9px] font-bold uppercase tracking-wide text-accent-ink">Dialogue</span>
      <p className="mt-1 text-xs italic leading-relaxed text-foreground">{`“${scene.dialogue}”`}</p>
    </div>
  );
}
