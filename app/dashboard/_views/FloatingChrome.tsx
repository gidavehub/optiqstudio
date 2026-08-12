"use client";

// FloatingChrome — the glassmorphic furniture that floats over every dashboard
// screen: the "optiq studio" logo pill (top-left, and the home button) and the
// account pill (top-right).
//
// Lives INSIDE EditorFlowProvider (unlike the layout shell) so it can read the
// production mode: on /dashboard/project/[id] with the timeline editor active
// ("auto-merge") both pills disappear — the editor's own top bar carries the
// brand there. The script editor ("manual") and every other page keep them.
//
// The four studios and the agent room suppress them too, but for a different
// reason: those routes float a full StudioIsland across the top which already
// carries the mark, the wallet and the account menu. Leaving these pills up
// would put three floating chromes on one edge, two of them saying the same
// thing. See app/dashboard/_shell/StudioIsland.tsx.

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import OptiqMark from "../../../components/OptiqMark";
import { useAuth } from "../../../components/AuthProvider";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import { SHELL_ROUTES } from "../_shell/nav";
import AccountPill from "./AccountPill";

export default function FloatingChrome() {
  const { user } = useAuth();
  const { productionMode } = useEditorFlow();
  const pathname = usePathname();

  if (!user) return null;

  // Surfaces that carry the brand themselves, so the pills would only collide
  // with it. Note the timeline test is anchored — a `startsWith` would also
  // swallow the pills on every sub-route of a project regardless of its mode.
  const path = pathname || "";
  const inTimelineEditor = /^\/dashboard\/project\/[^/]+$/.test(path) && productionMode === "auto-merge";
  const inAgentRoom = /^\/dashboard\/project\/[^/]+\/agent$/.test(path);
  // Exact match, not startsWith: the studios' DETAIL routes (/dashboard/video/[id]
  // and friends) are ordinary pages with no island, and they still want the pills.
  const inStudioShell = SHELL_ROUTES.includes(path);
  if (inTimelineEditor || inAgentRoom || inStudioShell) return null;

  return (
    <>
      {/* Top-left: brand / home. The logo IS the home button — that's why Home
          isn't duplicated in the account menu. */}
      <Link
        href="/dashboard"
        aria-label="Home"
        className="glass fixed top-3 left-3 sm:top-4 sm:left-6 z-50 flex items-center gap-2.5 rounded-full px-3 py-2.5 sm:px-5 sm:py-3 transition-all hover:border-line-2 active:scale-95 select-none cursor-pointer"
      >
        <OptiqMark size={22} />
        <span className="hidden sm:inline tabular-nums text-[14px] font-bold tracking-tight lowercase text-foreground">
          optiq studio
        </span>
      </Link>

      <AccountPill />
    </>
  );
}
