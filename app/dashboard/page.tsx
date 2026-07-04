"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Clapperboard,
  GraduationCap,
  Megaphone,
  Search,
  Share2,
  Video,
  X,
} from "lucide-react";
import MediaSlot from "../../components/MediaSlot";
import { useAuth } from "../../components/AuthProvider";

const TABS = ["Starter Kits", "Custom", "Image", "Video", "Audio", "Models"] as const;
type Tab = (typeof TABS)[number];

const KITS = [
  {
    id: "film",
    title: "Film or shorts",
    subtitle: "Scenes, characters, VFX & narrative",
    icon: Clapperboard,
  },
  {
    id: "marketing",
    title: "Marketing",
    subtitle: "Product, campaign & brand content",
    icon: Megaphone,
  },
  {
    id: "social",
    title: "Social",
    subtitle: "Reels, TikToks & platform-ready content",
    icon: Share2,
  },
  {
    id: "education",
    title: "Educational content",
    subtitle: "Animation & storytelling",
    icon: GraduationCap,
  },
];

interface AppCard {
  title: string;
  badge?: string;
  body: string;
  href: string;
  media: string;
  type: "video" | "image" | "audio" | "model";
  kits: string[];
}

const APPS: AppCard[] = [
  {
    title: "Video Studio",
    badge: "NEW",
    body: "Turn a prompt or a still frame into a cinematic shot with native audio.",
    href: "/dashboard/video",
    media: "/media/app-video.jpg",
    type: "video",
    kits: ["film", "marketing", "social", "education"],
  },
  {
    title: "Image Studio",
    badge: "NEW",
    body: "Generate ultra-realistic images and digital art from text descriptions.",
    href: "/dashboard/image",
    media: "/media/app-character.jpg",
    type: "image",
    kits: ["film", "marketing", "social", "education"],
  },
  {
    title: "Scene Builder",
    body: "Start from an image, lock the look, then bring it to life shot by shot.",
    href: "/dashboard/video",
    media: "/media/app-scene.jpg",
    type: "video",
    kits: ["film", "education"],
  },
  {
    title: "Character Studio",
    body: "Design a face once and keep it consistent across every frame.",
    href: "/dashboard/characters",
    media: "/media/app-character.jpg",
    type: "image",
    kits: ["film", "social", "education"],
  },
  {
    title: "Talking Persona",
    body: "Pair a consistent character with generated narration for avatar-style clips.",
    href: "/dashboard/characters",
    media: "/media/app-avatar.jpg",
    type: "image",
    kits: ["social", "marketing"],
  },
  {
    title: "Voice Studio",
    body: "Studio-grade voiceovers in eight voices with natural delivery directions.",
    href: "/dashboard/audio",
    media: "/media/app-voice.jpg",
    type: "audio",
    kits: ["film", "marketing", "social", "education"],
  },
];

const MODEL_CARDS: AppCard[] = [
  {
    title: "Gemini Omni Flash",
    body: "Frontier video model. Cinematic motion, native audio, 4–10s shots.",
    href: "/dashboard/video",
    media: "/media/app-video.jpg",
    type: "model",
    kits: [],
  },
  {
    title: "Optiq Image",
    body: "High-fidelity stills and character sheets with reference consistency.",
    href: "/dashboard/characters",
    media: "/media/app-character.jpg",
    type: "model",
    kits: [],
  },
  {
    title: "Optiq Voice",
    body: "Native text-to-speech with controllable pace, tone and emotion.",
    href: "/dashboard/audio",
    media: "/media/app-voice.jpg",
    type: "model",
    kits: [],
  },
];

export default function DashboardHome() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("Starter Kits");
  const [kit, setKit] = useState("film");
  const [query, setQuery] = useState("");
  const [showBanner, setShowBanner] = useState(true);

  const { heading, subheading, cards } = useMemo(() => {
    let list: AppCard[];
    let heading: string;
    let subheading = "Recommended apps to get you started";

    if (tab === "Starter Kits") {
      const active = KITS.find((k) => k.id === kit) ?? KITS[0];
      heading = active.title;
      list = APPS.filter((a) => a.kits.includes(active.id));
    } else if (tab === "Models") {
      heading = "Models";
      subheading = "The engines behind every generation";
      list = MODEL_CARDS;
    } else if (tab === "Custom") {
      heading = "All tools";
      list = APPS;
    } else {
      heading = tab;
      list = APPS.filter((a) => a.type === tab.toLowerCase());
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q)
      );
    }
    return { heading, subheading, cards: list };
  }, [tab, kit, query]);

  return (
    <div className="flex h-full flex-col">
      {/* Promo banner */}
      {showBanner && profile?.planStatus !== "active" && (
        <div className="relative flex items-center justify-center gap-3 bg-gradient-to-r from-[#3b3a1e] via-[#4a4526] to-[#1f1d10] px-10 py-2">
          <p className="text-[12px] text-neutral-100">
            Gemini Omni Flash is live. Pro members get 10,000 monthly credits.{" "}
            <Link href="/dashboard/billing" className="underline underline-offset-2">
              See plans
            </Link>
          </p>
          <Link
            href="/dashboard/billing"
            className="rounded-md bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-white/25 transition-colors"
          >
            Upgrade
          </Link>
          <button
            onClick={() => setShowBanner(false)}
            className="absolute right-3 text-neutral-300 hover:text-white"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left panel */}
        <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-[#191322] via-[#100d14] to-[#0a0a0a] px-5 pt-8">
          <h1 className="text-[20px] font-semibold tracking-tight">
            What do you want to create?
          </h1>

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5">
            <Search size={14} className="text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search apps and tools"
              className="w-full bg-transparent text-[13px] placeholder:text-neutral-600"
            />
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-4 overflow-x-auto border-b border-white/10 pb-0 text-[13px]">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`whitespace-nowrap pb-2.5 transition-colors ${
                  tab === t
                    ? "border-b-2 border-white font-medium text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Starter kit categories */}
          {tab === "Starter Kits" && (
            <div className="mt-4 space-y-2 pb-6">
              {KITS.map((k) => {
                const Icon = k.icon;
                const active = kit === k.id;
                return (
                  <button
                    key={k.id}
                    onClick={() => setKit(k.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-white/25 bg-white/[0.07]"
                        : "border-transparent bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
                      <Icon size={15} strokeWidth={1.8} />
                    </span>
                    <span>
                      <span className="block text-[13px] font-medium">{k.title}</span>
                      <span className="block text-[11px] text-neutral-500">{k.subtitle}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Content area */}
        <main className="min-w-0 flex-1 overflow-y-auto px-10 pt-8 pb-16">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[26px] font-semibold tracking-tight">{heading}</h2>
              <p className="mt-1 text-[13px] text-neutral-500">{subheading}</p>
            </div>
            <Link
              href="/dashboard/billing"
              className="rounded-full bg-white/5 px-3.5 py-1.5 text-[12px] text-neutral-300 hover:bg-white/10 transition-colors"
              title="Credits"
            >
              {profile ? `${profile.credits.toLocaleString()} credits` : "…"}
            </Link>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-x-5 gap-y-8 xl:grid-cols-3">
            {cards.map((app) => (
              <Link key={app.title + app.body} href={app.href} className="group">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-[#131313]">
                  <MediaSlot
                    src={app.media}
                    kind="image"
                    className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
                    alt={app.title}
                  />
                  <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 backdrop-blur-sm">
                    <Video size={13} className="text-white" />
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <h3 className="text-[15px] font-medium">{app.title}</h3>
                  {app.badge && (
                    <span className="rounded bg-violet-600 px-1.5 py-0.5 text-[9px] font-bold tracking-wide">
                      {app.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-neutral-500">
                  {app.body}
                </p>
              </Link>
            ))}
            {cards.length === 0 && (
              <p className="col-span-full py-16 text-center text-sm text-neutral-600">
                Nothing matches that search.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
