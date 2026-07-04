"use client";

import React, { useEffect, useState } from "react";
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
  Image,
} from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

const RAIL = [
  { label: "Home", href: "/dashboard", icon: LayoutGrid },
  { label: "Video Studio", href: "/dashboard/video", icon: Clapperboard },
  { label: "Image Studio", href: "/dashboard/image", icon: Image },
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
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

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
      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        {/* Animated Expandable Sidebar */}
        <aside
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`flex shrink-0 flex-col items-start border-r border-white/5 bg-[#0a0a0a] py-4 transition-all duration-300 ease-in-out z-30 ${
            hovered ? "w-[220px] px-3" : "w-[52px] px-2 items-center"
          }`}
        >
          {/* Logo Section */}
          <Link
            href="/"
            className={`flex items-center gap-2 w-full mb-5 hover:opacity-80 transition-opacity ${
              hovered ? "px-1.5" : "justify-center"
            }`}
            title="optiq studio"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.2" />
                <circle cx="12" cy="12" r="4.2" fill="currentColor" />
              </svg>
            </div>
            <span
              className={`text-[15px] font-bold tracking-tight text-white transition-all duration-300 origin-left ${
                hovered ? "opacity-100 scale-100" : "opacity-0 scale-75 w-0 overflow-hidden"
              }`}
            >
              optiq studio
            </span>
          </Link>

          {/* Navigation Rails */}
          <nav className="flex flex-col gap-1.5 w-full">
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
                  title={hovered ? undefined : item.label}
                  className={`flex h-9 items-center rounded-lg transition-colors gap-3 w-full ${
                    hovered ? "px-2.5" : "justify-center"
                  } ${
                    active
                      ? "bg-white/10 text-white font-medium"
                      : "text-neutral-500 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.8} className="shrink-0" />
                  <span
                    className={`text-[13px] transition-all duration-300 origin-left ${
                      hovered ? "opacity-100 scale-100" : "opacity-0 scale-75 w-0 overflow-hidden"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Footer Controls */}
          <div className="mt-auto flex flex-col gap-2 w-full">
            <button
              onClick={() => void signOut()}
              title={hovered ? undefined : "Sign out"}
              className={`flex h-9 items-center rounded-lg text-neutral-600 hover:text-white hover:bg-white/5 transition-colors gap-3 w-full ${
                hovered ? "px-2.5" : "justify-center"
              }`}
            >
              <LogOut size={15} className="shrink-0" />
              <span
                className={`text-[13px] transition-all duration-300 origin-left ${
                  hovered ? "opacity-100 scale-100" : "opacity-0 scale-75 w-0 overflow-hidden"
                }`}
              >
                Sign out
              </span>
            </button>
            <Link
              href="/dashboard/billing"
              title={hovered ? undefined : (user.displayName || user.email || "")}
              className={`flex h-9 items-center rounded-lg hover:bg-white/5 transition-colors gap-3 w-full ${
                hovered ? "px-1" : "justify-center"
              }`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-[13px] font-semibold text-white">
                {initial}
              </div>
              <span
                className={`text-[12px] font-medium text-neutral-300 truncate transition-all duration-300 origin-left ${
                  hovered ? "opacity-100 scale-100" : "opacity-0 scale-75 w-0 overflow-hidden"
                }`}
              >
                {user.displayName || user.email || ""}
              </span>
            </Link>
          </div>
        </aside>

        {/* Page content */}
        <div className="min-w-0 flex-1 overflow-hidden transition-all duration-300">{children}</div>
      </div>
    </div>
  );
}
