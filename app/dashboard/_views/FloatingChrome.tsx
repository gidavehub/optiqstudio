"use client";

// FloatingChrome — the glassmorphic "optiq studio" logo pill (top-left) and
// the account/nav pill (top-right) that float over every dashboard screen.
//
// Lives INSIDE EditorFlowProvider (unlike the layout shell) so it can read the
// production mode: on /dashboard/project/[id] with the timeline editor active
// ("auto-merge") both pills disappear — the editor's own top bar carries the
// brand there. The script editor ("manual") and every other page keep them.

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import { useEditorFlow } from "../_flow/EditorFlowProvider";

export default function FloatingChrome() {
  const { user, profile, signOut } = useAuth();
  const { productionMode } = useEditorFlow();
  const pathname = usePathname();

  if (!user) return null;

  // Only the project route ITSELF can be the timeline editor. Matching on a
  // `startsWith` used to swallow the pills on /project/[id]/agent too, whose
  // header sits under them and has no brand of its own.
  const inTimelineEditor =
    /^\/dashboard\/project\/[^/]+$/.test(pathname || "") && productionMode === "auto-merge";
  if (inTimelineEditor) return null;

  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();

  const balance = (profile?.credits ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Mobile keeps the same two floating pills — just distilled to what a phone
  // actually needs (home, balance, account, sign out). No bottom bar, no side
  // panel, no hamburger: the logo IS the home button and the pills stay put.
  return (
    <>
      {/* Top-left: brand / home */}
      <Link
        href="/dashboard"
        aria-label="Home"
        className="fixed top-3 left-3 sm:top-4 sm:left-6 z-50 flex items-center gap-2.5 rounded-full bg-surface/80 border border-line backdrop-blur-md px-3 py-2.5 sm:px-5 sm:py-3 shadow-2xl transition-all hover:border-line-2 active:scale-95 select-none cursor-pointer"
      >
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <circle cx="16" cy="16" r="16" fill="white" />
          <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
        </svg>
        <span className="hidden sm:inline font-mono text-[14px] font-bold tracking-tight lowercase text-foreground">
          optiq studio
        </span>
      </Link>

      {/* Top-right: balance + account + sign out */}
      <div className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 flex items-center gap-2 sm:gap-4.5 rounded-full bg-surface/80 border border-line backdrop-blur-md px-3 py-2 sm:px-5 sm:py-2.5 text-xs shadow-2xl transition-all hover:border-line-2">
        {/* Wallet — the one number that matters on a phone */}
        <Link
          href="/dashboard/billing"
          className="flex items-center gap-1.5 sm:border-r sm:border-line-2 sm:pr-3.5 active:scale-95 transition-transform"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="font-bold text-success whitespace-nowrap">GMD {balance}</span>
          <span className="hidden sm:inline text-muted font-medium">Balance</span>
        </Link>

        {/* Desktop-only nav — on mobile the logo covers Home and the wallet
            chip covers Billing, so nothing is stranded. */}
        <nav className="hidden sm:flex items-center gap-3.5">
          <Link
            href="/dashboard"
            className={`font-semibold hover:text-foreground transition-colors ${
              pathname === "/dashboard" ? "text-foreground" : "text-ink-3"
            }`}
          >
            Home
          </Link>
          <Link
            href="/dashboard/billing"
            className={`font-semibold hover:text-foreground transition-colors ${
              pathname.startsWith("/dashboard/billing") ? "text-foreground" : "text-ink-3"
            }`}
          >
            Billing
          </Link>
          <Link
            href="/dashboard/developer"
            className={`font-semibold hover:text-foreground transition-colors ${
              pathname.startsWith("/dashboard/developer") ? "text-foreground" : "text-ink-3"
            }`}
          >
            API
          </Link>
        </nav>

        {/* Account initial (desktop also shows the email) */}
        <Link
          href="/dashboard/billing"
          className="flex items-center gap-2 sm:border-l sm:border-line-2 sm:pl-3.5 active:scale-95 transition-transform"
          title={user.displayName || user.email || ""}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-bold text-foreground uppercase">
            {initial}
          </div>
          <span className="hidden lg:inline font-medium text-ink-2 max-w-[100px] truncate">
            {user.displayName || user.email || ""}
          </span>
        </Link>

        {/* Sign out — icon only on mobile */}
        <button
          onClick={() => void signOut()}
          aria-label="Sign out"
          className="border-l border-line-2 pl-2 sm:pl-3.5 font-bold text-muted hover:text-danger active:scale-95 transition-all flex items-center gap-1.5"
        >
          <span className="hidden sm:inline">Sign Out</span>
          <LogOut size={13} />
        </button>
      </div>
    </>
  );
}
