"use client";

// StudioIsland — the floating top bar.
//
// It does NOT stick to the top edge. It floats: inset on all three sides with
// its own shadow, so the wall of work scrolls underneath it rather than being
// pushed down by it. That's the whole point of the shape — the page reads as
// one continuous canvas with a control surface hovering over it.
//
// It carries three things and refuses a fourth:
//   1. where you are (the mark + the studio's name)
//   2. where you can go (the nav — big, bold, hittable, never a dropdown)
//   3. the wallet, because that number decides whether you press Generate
//
// Everything else — settings, attachments, enhance — lives in the rail or the
// dock. This is why the old top-left logo pill and top-right account pill are
// suppressed on these routes: three floating chromes arguing over one edge is
// exactly the mess this replaces.

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OptiqMark from "../../../components/OptiqMark";
import { Icon } from "../../../components/icons";
import { useAuth } from "../../../components/AuthProvider";
import { studioOn, studioTint } from "./studioTheme";
import type { NavItem } from "./types";

interface StudioIslandProps {
  items: readonly NavItem[];
  activeId: string;
  /** The line under the nav on wide screens — what this screen IS. */
  title: string;
  /** Shown on phones, where the rail is a sheet rather than a column. */
  onOpenRail: () => void;
  railLabel: string;
  railOpen: boolean;
}

export default function StudioIsland({
  items,
  activeId,
  title,
  onOpenRail,
  railLabel,
  railOpen,
}: StudioIslandProps) {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the account menu on an outside click or Escape. Both listeners only
  // exist while it's open, so the closed state costs nothing.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const balance = (profile?.credits ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
  const initial = (user?.displayName || user?.email || "?").charAt(0).toUpperCase();

  const go = (item: NavItem) => {
    if (item.onSelect) item.onSelect();
    else if (item.href) router.push(item.href);
  };

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-40 sm:inset-x-5 sm:top-4">
      {/* Three tracks, not a flex row. The middle column is `auto` between two
          equal `1fr`s, so the nav sits on the island's TRUE centre line — the
          same line the console below is centred on — no matter how wide the
          brand gets on the left or how long the balance runs on the right. A
          flex row can't do that: it centres the leftovers, not the element. */}
      <div className="glass-strong pointer-events-auto grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-[26px] p-2 sm:gap-3 sm:rounded-[30px] sm:p-2.5">
        {/* ── LEFT ── brand, and the screen's own name beside it. The title is
            orientation rather than navigation, so it's the first thing to go. */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard"
            aria-label="Portal"
            title="Portal"
            className="flex h-11 shrink-0 items-center gap-2.5 rounded-[20px] px-2.5 transition-colors hover:bg-surface-2 active:scale-95 sm:h-12 sm:px-3"
          >
            <OptiqMark size={24} />
            <span className="hidden text-[15px] font-bold lowercase tracking-tight text-foreground xl:inline">
              optiq
            </span>
          </Link>
          <span className="hidden min-w-0 truncate border-l border-line-2 pl-3 text-[13px] font-bold tracking-tight text-ink-3 2xl:block">
            {title}
          </span>
        </div>

        {/* ── CENTRE ── The four studios (or, in the agent room, the three faces
            of a film). Big enough to hit without looking, labelled from md up
            and icon-only below it — never collapsed into a menu.

            Each destination keeps its OWN colour, on and off: the Video mark is
            blue on the Music screen too. That's what makes the nav a set of
            four products rather than four grey words, and it's why the active
            fill is read from the item, not from the shell's --studio. */}
        <nav className="flex min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-none sm:gap-2">
          {items.map((item) => {
            const active = item.id === activeId;
            const tint = studioTint(item.id);
            return (
              <button
                key={item.id}
                onClick={() => go(item)}
                aria-current={active ? "page" : undefined}
                title={item.label}
                style={active ? { background: tint, color: studioOn(item.id) } : undefined}
                className={`flex h-11 shrink-0 items-center gap-2 rounded-[18px] px-3 text-[14px] font-bold tracking-tight transition-all active:scale-95 sm:h-12 sm:rounded-[20px] sm:px-4 ${
                  active ? "" : "text-ink-3 hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon name={item.icon} size={19} tint={active ? undefined : tint} />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ── RIGHT ── */}
        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          {/* Settings, on the sizes where the rail isn't a visible column. */}
          <button
            onClick={onOpenRail}
            aria-expanded={railOpen}
            title={railLabel}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-[18px] border px-3 text-[13px] font-bold transition-all active:scale-95 lg:hidden ${
              railOpen
                ? "border-transparent bg-[var(--studio)] text-[var(--studio-on)]"
                : "border-line-2 text-ink-2 hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            <Icon name="sliders" size={18} />
            <span className="hidden sm:inline">{railLabel}</span>
          </button>

          {/* Wallet — the number that decides whether you press the big button. */}
          <Link
            href="/dashboard/billing"
            title="Billing & credits"
            className="hidden h-11 shrink-0 items-center gap-2 rounded-[18px] border border-line-2 px-3.5 transition-colors hover:bg-surface-2 active:scale-95 sm:flex sm:h-12 sm:rounded-[20px]"
          >
            <Icon name="wallet" size={18} tint="var(--g-green)" />
            <span className="whitespace-nowrap text-[14px] font-bold tabular-nums text-[var(--g-green-ink)]">
              {balance}
            </span>
          </Link>

          {/* Account */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Account"
            title={user?.displayName || user?.email || "Account"}
            className={`flex h-11 w-11 items-center justify-center rounded-full text-[15px] font-bold uppercase transition-all active:scale-95 sm:h-12 sm:w-12 ${
              menuOpen ? "bg-foreground text-background" : "bg-surface-3 text-foreground hover:bg-surface-2"
            }`}
          >
            {initial}
          </button>

          <div
            role="menu"
            aria-hidden={!menuOpen}
            style={{ transformOrigin: "top right" }}
            className={`glass-strong absolute right-0 mt-2.5 w-60 overflow-hidden rounded-[22px] py-1.5 transition-[opacity,transform,visibility] duration-200 ${
              menuOpen
                ? "visible translate-y-0 scale-100 opacity-100"
                : "invisible -translate-y-1.5 scale-[0.97] opacity-0"
            }`}
          >
            <div className="border-b border-line px-4 pb-2.5 pt-2">
              <p className="truncate text-[13px] font-bold text-foreground">
                {user?.displayName || "Signed in"}
              </p>
              <p className="truncate text-[11px] text-muted">{user?.email}</p>
            </div>
            {[
              { href: "/dashboard/billing", label: "Billing & credits", icon: "card" as const },
              { href: "/dashboard/assets", label: "My assets", icon: "folder" as const },
              { href: "/dashboard/developer", label: "Developer API", icon: "terminal" as const },
            ].map((row) => (
              <Link
                key={row.href}
                href={row.href}
                role="menuitem"
                tabIndex={menuOpen ? 0 : -1}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <Icon name={row.icon} size={17} className="text-ink-3" />
                {row.label}
              </Link>
            ))}
            <button
              role="menuitem"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => void signOut()}
              className="mt-1 flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Icon name="logout" size={17} className="text-ink-3" />
              Sign out
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
