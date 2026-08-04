"use client";

// AccountPill — top-right. Used to carry four unrelated jobs in one strip:
// wallet, nav, account and sign out, with Home/Billing/API as text links wedged
// between a money chip and an avatar. Now it's two things — the balance, which
// is the number that matters, and a menu behind the avatar for everything else.
//
// That also means the phone gets the same pill as the desktop rather than a
// stripped-down one. Sign Out moves inside the menu: it's the least frequent
// and least reversible thing here, and it used to sit one mis-tap from the
// avatar.

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, FolderOpen, LogOut, Terminal, Wallet } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";

const MENU_LINKS = [
  { href: "/dashboard/billing", label: "Billing & credits", Icon: CreditCard },
  { href: "/dashboard/assets", label: "My assets", Icon: FolderOpen },
  { href: "/dashboard/developer", label: "Developer API", Icon: Terminal },
];

export default function AccountPill() {
  const { user, profile, signOut } = useAuth();
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. Both listeners only exist while the
  // menu is open, so the closed state costs nothing.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();
  const balance = (profile?.credits ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Rows drift in behind the panel. 30ms apart against a 280ms travel means
  // they're all in flight at once, so it reads as one continuous unfold rather
  // than four separate arrivals. Closing drops the delays, so the menu leaves
  // as a single piece instead of unravelling row by row.
  const rowMotion = `transition-[opacity,transform] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
    open ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
  }`;
  const rowDelay = (i: number) => ({ transitionDelay: open ? `${i * 30}ms` : "0ms" });

  return (
    <div ref={wrapRef} className="fixed top-3 right-3 z-50 sm:top-4 sm:right-4">
      <div className="glass flex items-center gap-2 rounded-full px-3 py-2 text-xs transition-all hover:border-line-2 sm:gap-3 sm:px-4 sm:py-2.5">
        {/* Wallet — the one number worth a permanent slot */}
        <Link
          href="/dashboard/billing"
          className="flex items-center gap-1.5 transition-transform active:scale-95"
        >
          <Wallet size={14} className="shrink-0 text-success" />
          <span className="font-bold whitespace-nowrap text-success">GMD {balance}</span>
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          title={user.displayName || user.email || ""}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-l border-line-2 text-[11px] font-bold uppercase transition-all active:scale-95 ${
            open ? "bg-foreground text-background" : "bg-surface-3 text-foreground"
          }`}
        >
          {initial}
        </button>
      </div>

      {/* The panel stays mounted and is driven by transitions rather than a
          keyframe on mount. That's what makes it smooth in BOTH directions —
          a conditionally-rendered menu can only animate open, and vanishing on
          close is the part that reads as abrupt. `invisible` (not hidden) is
          transitioned too, so it holds until the fade finishes and then drops
          the panel out of the focus and accessibility trees entirely. */}
      <div
        role="menu"
        aria-hidden={!open}
        // Unfolds from the avatar that opened it, so the origin is the pill's
        // corner rather than the panel's centre.
        style={{ transformOrigin: "top right" }}
        className={`glass-strong absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl py-1.5 transition-[opacity,transform,visibility] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
          open
            ? "visible translate-y-0 scale-100 opacity-100"
            : "invisible -translate-y-1.5 scale-[0.97] opacity-0"
        }`}
      >
        <div className={rowMotion} style={rowDelay(0)}>
          <div className="border-b border-line px-3.5 pb-2.5 pt-2">
            <p className="truncate text-[13px] font-bold text-foreground">
              {user.displayName || "Signed in"}
            </p>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
          </div>
        </div>

        {MENU_LINKS.map(({ href, label, Icon }, i) => (
          <div key={href} className={rowMotion} style={rowDelay(i + 1)}>
            <Link
              href={href}
              role="menuitem"
              tabIndex={open ? 0 : -1}
              // The pill survives navigation, so the menu has to be closed on
              // the click itself — otherwise it hangs open over the new page.
              onClick={() => setOpen(false)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-semibold transition-colors hover:bg-surface-2 ${
                pathname.startsWith(href) ? "text-foreground" : "text-ink-2"
              }`}
            >
              <Icon size={15} className="shrink-0 text-ink-3" />
              {label}
            </Link>
          </div>
        ))}

        <div className={rowMotion} style={rowDelay(MENU_LINKS.length + 1)}>
          <button
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={() => void signOut()}
            className="mt-1 flex w-full items-center gap-2.5 border-t border-line px-3.5 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <LogOut size={15} className="shrink-0 text-ink-3" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
