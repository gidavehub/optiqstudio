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
  UserSquare,
} from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

const RAIL = [
  { label: "Home", href: "/dashboard", icon: LayoutGrid },
  { label: "Video Studio", href: "/dashboard/video", icon: Clapperboard },
  { label: "Image Studio", href: "/dashboard/image", icon: Image },
  { label: "Voice Studio", href: "/dashboard/audio", icon: Mic },
  { label: "Avatar Studio", href: "/dashboard/avatar", icon: UserSquare },
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
    <div className="flex h-screen flex-col bg-black text-white relative overflow-hidden">
      {/* Symmetrical Glassmorphic Top-Left Logo / Brand */}
      <Link
        href="/dashboard"
        className="absolute top-4 left-6 z-50 flex items-center gap-3 rounded-full bg-[#0d0d0d]/80 border border-white/10 backdrop-blur-md px-5 py-3 shadow-2xl transition-all hover:border-white/20 select-none cursor-pointer"
      >
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <circle cx="16" cy="16" r="16" fill="white" />
          <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
        </svg>
        <span className="font-mono text-[14px] font-bold tracking-tight lowercase text-white">
          optiq studio
        </span>
      </Link>

      {/* Floating Glassmorphic Top Bar / Settings Menu */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-4.5 rounded-full bg-[#0d0d0d]/80 border border-white/10 backdrop-blur-md px-5 py-2.5 text-xs shadow-2xl transition-all hover:border-white/20">
        {/* Profile Initial and Email */}
        <Link
          href="/dashboard/billing"
          className="flex items-center gap-2 border-r border-white/15 pr-3.5"
          title={user.displayName || user.email || ""}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-[11px] font-bold text-white uppercase">
            {initial}
          </div>
          <span className="hidden sm:inline font-medium text-neutral-300 max-w-[100px] truncate">
            {user.displayName || user.email || ""}
          </span>
        </Link>

        {/* Real-time Wallet Display */}
        <Link
          href="/dashboard/billing"
          className="flex items-center gap-1.5 border-r border-white/15 pr-3.5"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-bold text-emerald-400">
            GMD {(profile?.credits ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-neutral-500 font-medium">Balance</span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-3.5">
          <Link
            href="/dashboard"
            className={`font-semibold hover:text-white transition-colors ${
              pathname === "/dashboard" ? "text-white" : "text-neutral-400"
            }`}
          >
            Home
          </Link>
          <Link
            href="/dashboard/billing"
            className={`font-semibold hover:text-white transition-colors ${
              pathname.startsWith("/dashboard/billing") ? "text-white" : "text-neutral-400"
            }`}
          >
            Billing
          </Link>
          <Link
            href="/dashboard/developer"
            className={`font-semibold hover:text-white transition-colors ${
              pathname.startsWith("/dashboard/developer") ? "text-white" : "text-neutral-400"
            }`}
          >
            API
          </Link>
        </nav>

        {/* Sign Out Action */}
        <button
          onClick={() => void signOut()}
          className="border-l border-white/15 pl-3.5 font-bold text-neutral-500 hover:text-red-400 transition-colors flex items-center gap-1.5"
        >
          <span>Sign Out</span>
          <LogOut size={13} />
        </button>
      </div>

      {/* Main Full-Screen Layout Wrapper */}
      <div className="flex min-h-0 flex-1 relative overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto transition-all duration-300">
          {children}
        </div>
      </div>
    </div>
  );
}
