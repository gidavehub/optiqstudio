"use client";

// FloatingChrome — the glassmorphic furniture that floats over every dashboard
// screen: the "optiq studio" logo pill (top-left, and the home button) and the
// account pill (top-right).
//
// Lives INSIDE EditorFlowProvider (unlike the layout shell) so it can read the
// production mode: on /dashboard/project/[id] with the timeline editor active
// ("auto-merge") both pills disappear — the editor's own top bar carries the
// brand there. The script editor ("manual") and every other page keep them.

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../../../components/AuthProvider";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import AccountPill from "./AccountPill";

export default function FloatingChrome() {
  const { user } = useAuth();
  const { productionMode } = useEditorFlow();
  const pathname = usePathname();

  if (!user) return null;

  // Only the project route ITSELF can be the timeline editor. Matching on a
  // `startsWith` used to swallow the pills on /project/[id]/agent too, whose
  // header sits under them and has no brand of its own.
  const inTimelineEditor =
    /^\/dashboard\/project\/[^/]+$/.test(pathname || "") && productionMode === "auto-merge";
  if (inTimelineEditor) return null;

  return (
    <>
      {/* Top-left: brand / home. The logo IS the home button — that's why Home
          isn't duplicated in the account menu. */}
      <Link
        href="/dashboard"
        aria-label="Home"
        className="glass fixed top-3 left-3 sm:top-4 sm:left-6 z-50 flex items-center gap-2.5 rounded-full px-3 py-2.5 sm:px-5 sm:py-3 transition-all hover:border-line-2 active:scale-95 select-none cursor-pointer"
      >
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          {/* Inverted for the light shell: ink disc, canvas-coloured ring. */}
          <circle cx="16" cy="16" r="16" className="fill-foreground" />
          <circle cx="16" cy="16" r="8" fill="none" className="stroke-background" strokeWidth={4} />
        </svg>
        <span className="hidden sm:inline tabular-nums text-[14px] font-bold tracking-tight lowercase text-foreground">
          optiq studio
        </span>
      </Link>

      <AccountPill />
    </>
  );
}
