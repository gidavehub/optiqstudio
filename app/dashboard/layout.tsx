"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Clapperboard,
  CreditCard,
  FolderOpen,
  LayoutGrid,
  Loader2,
  LogOut,
  Mic,
  Users,
  Code,
} from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

const RAIL = [
  { label: "Home", href: "/dashboard", icon: LayoutGrid },
  { label: "Video Studio", href: "/dashboard/video", icon: Clapperboard },
  { label: "Voice Studio", href: "/dashboard/audio", icon: Mic },
  { label: "Characters", href: "/dashboard/characters", icon: Users },
  { label: "Assets", href: "/dashboard/assets", icon: FolderOpen },
  { label: "Plan & Credits", href: "/dashboard/billing", icon: CreditCard },
  { label: "API & Developers", href: "/dashboard/developer", icon: Code },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    } else if (!loading && user && profile && profile.planStatus !== "active" && pathname !== "/dashboard/billing") {
      router.replace("/dashboard/billing");
    }
  }, [loading, user, profile, pathname, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="animate-spin text-neutral-500" size={22} />
      </div>
    );
  }

  const initial = (user.displayName || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="flex h-screen flex-col bg-black text-white">
      <div className="flex min-h-0 flex-1">
        {/* Slim icon rail */}
        <aside className="flex w-[52px] shrink-0 flex-col items-center border-r border-white/5 bg-[#0a0a0a] py-3">
          <Link
            href="/"
            className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg text-white hover:opacity-80 transition-opacity"
            title="optiq studio"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.2" />
              <circle cx="12" cy="12" r="4.2" fill="currentColor" />
            </svg>
          </Link>
          <nav className="flex flex-col items-center gap-1.5">
            {RAIL.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-neutral-500 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col items-center gap-2">
            <button
              onClick={() => void signOut()}
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:text-white transition-colors"
            >
              <LogOut size={15} />
            </button>
            <Link
              href="/dashboard/billing"
              title={user.displayName || user.email || ""}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-[13px] font-semibold"
            >
              {initial}
            </Link>
          </div>
        </aside>

        {/* Page content */}
        <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
