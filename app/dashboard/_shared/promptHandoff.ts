"use client";

// promptHandoff — carries a prompt AND its reference images from a detail page
// back to the studio console.
//
// The old "Remix Prompt" link passed only `?prompt=…` in the query string, which
// silently dropped the reference images that shaped the result. Images are
// megabytes of base64 — far too big for a URL — so they ride in sessionStorage
// for exactly one navigation and are consumed on arrival.

import { ReusedImage } from "./useReusePrompt";

const KEY = "optiq:prompt-handoff";

export interface PromptHandoff {
  prompt: string;
  images: ReusedImage[];
}

export function stashPromptHandoff(payload: PromptHandoff): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota or private mode — the prompt still travels in the query string.
  }
}

/** Reads and clears the pending handoff. Safe to call on every studio mount. */
export function takePromptHandoff(): PromptHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as PromptHandoff;
  } catch {
    return null;
  }
}
