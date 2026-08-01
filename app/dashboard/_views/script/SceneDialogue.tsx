"use client";

// SceneDialogue — the one beat worth reading back on its own: what is actually
// said on camera.
//
// Setting, sound and action beats used to sit here too, as three more cards. But
// every one of them is already written into the compiled prompt below, so all
// they did was make the scene card taller than the scene. Dialogue stays because
// it's the line the user hears, and the line they most often want changed.

import React from "react";
import { Scene } from "../../_flow/types";

interface SceneDialogueProps {
  scene: Scene;
}

export default function SceneDialogue({ scene }: SceneDialogueProps) {
  if (!scene.dialogue) return null;

  return (
    <div className="rounded-[28px] border border-accent-line bg-accent-soft p-3.5">
      <span className="text-[9px] font-bold uppercase tracking-wide text-accent-ink">Dialogue</span>
      <p className="mt-1 text-xs italic leading-relaxed text-foreground">{`“${scene.dialogue}”`}</p>
    </div>
  );
}
