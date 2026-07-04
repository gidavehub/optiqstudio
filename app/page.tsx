"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, X, Menu } from "lucide-react";
import MediaSlot from "../components/MediaSlot";
import { useAuth } from "../components/AuthProvider";

/* Center nav: small uppercase links; PRODUCT opens a mega-menu. */
const NAV_ITEMS = ["RESEARCH", "PRODUCT", "RESOURCES", "SOLUTIONS", "COMPANY"];

const MEGA_MENU: { heading: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Our Tools", href: "/dashboard" },
      { label: "API", href: "mailto:hello@optiq.studio", external: true },
      { label: "Use Cases", href: "#worlds" },
      { label: "Pricing", href: "/dashboard/billing" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { label: "Academy", href: "#", external: true },
      { label: "Help Center", href: "#", external: true },
      { label: "Ways to Use Optiq Studio", href: "#worlds", external: true },
    ],
  },
  {
    heading: "Featured Tools",
    links: [
      { label: "Video Studio", href: "/dashboard/video" },
      { label: "Omni 1.5 (Video)", href: "/dashboard/video" },
      { label: "Characters", href: "/dashboard/characters" },
      { label: "Voice Studio", href: "/dashboard/audio" },
      { label: "Assets", href: "/dashboard/assets" },
      { label: "Prompt Enhancer", href: "/dashboard/video" },
    ],
  },
  {
    heading: "Professionals",
    links: [
      { label: "For Enterprises", href: "mailto:hello@optiq.studio" },
      { label: "For Education", href: "mailto:hello@optiq.studio" },
      { label: "Data Security", href: "#" },
    ],
  },
];

const HERO_LINKS = [
  { label: "OPTIQ STUDIO CHARACTERS", href: "/dashboard/characters" },
  { label: "MEDIA AND ENTERTAINMENT", href: "#worlds" },
  { label: "VOICE AND AUDIO", href: "/dashboard/audio" },
  { label: "GENERAL WORLD MODELS", href: "#research" },
];

const PARTNERS = ["AURELIA PICTURES", "NORTHFIELD", "HELIX STUDIOS", "PALE BLUE", "MERIDIAN", "KINO+"];

const WORLD_CARDS = [
  {
    media: "/media/card-omni.jpg",
    title: "Omni 1.5: A New Frontier for Generative Video",
    body: "Our best video model yet — cinematic motion, native sound and precise prompt control.",
    href: "/dashboard/video",
  },
  {
    media: "/media/card-robotics.jpg",
    title: "Omni Fast: Iteration at the Speed of Thought",
    body: "A distilled model for drafts and lookdev, tuned for loops measured in seconds.",
    href: "/dashboard/video",
  },
  {
    media: "/media/card-worlds.jpg",
    title: "Worlds: Interactive and Explorable Scenes",
    body: "Generate spaces you can move through, relight and reshoot from any angle.",
    href: "/dashboard/video",
    overlayCta: true,
  },
  {
    media: "/media/card-avatars.jpg",
    title: "Characters: Real-time Video Personas",
    body: "Faces that stay consistent across every shot, ready for narration and dialogue.",
    href: "/dashboard/characters",
  },
];

const RESEARCH_ROWS = [
  {
    title: "OWM-1",
    body: "Our first general world model — a step toward simulation you can direct.",
  },
  {
    title: "Omni 1.5",
    body: "State-of-the-art motion quality, prompt adherence and visual fidelity.",
  },
  {
    title: "General World Models",
    body: "Our long-term effort to build systems that understand the visual world and its dynamics.",
  },
];

const FOOTER_COLS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Our Tools", href: "/dashboard" },
      { label: "Video Studio", href: "/dashboard/video" },
      { label: "Voice Studio", href: "/dashboard/audio" },
      { label: "Characters", href: "/dashboard/characters" },
      { label: "Pricing", href: "/dashboard/billing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#research" },
      { label: "News", href: "#news" },
      { label: "Careers", href: "mailto:hello@optiq.studio" },
      { label: "Contact", href: "mailto:hello@optiq.studio" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Help Center", href: "#" },
      { label: "API Docs", href: "#" },
      { label: "Status", href: "#" },
      { label: "Terms of Use", href: "#" },
      { label: "Privacy Policy", href: "#" },
    ],
  },
  {
    heading: "Social",
    links: [
      { label: "X", href: "#" },
      { label: "YouTube", href: "#" },
      { label: "Instagram", href: "#" },
      { label: "Discord", href: "#" },
      { label: "LinkedIn", href: "#" },
    ],
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const appHref = user ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-white text-black" onMouseLeave={() => setMenuOpen(null)}>
      {/* ── Nav ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white">
        <nav className="relative mx-auto flex h-14 max-w-[1440px] items-center px-4">
          <Link href="/" className="text-[22px] font-bold lowercase tracking-tight leading-none">
            optiq studio
          </Link>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onMouseEnter={() => setMenuOpen(item === "PRODUCT" ? "PRODUCT" : null)}
                className="font-mono text-[11px] font-medium tracking-[0.08em] text-black hover:text-neutral-500 transition-colors"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <a
              href="mailto:hello@optiq.studio"
              className="rounded-md bg-neutral-100 px-3.5 py-2 text-[13px] font-medium hover:bg-neutral-200 transition-colors"
            >
              Enterprise Sales
            </a>
            <Link
              href="/login"
              className="rounded-md bg-neutral-100 px-3.5 py-2 text-[13px] font-medium hover:bg-neutral-200 transition-colors"
            >
              Login
            </Link>
            <Link
              href={appHref}
              className="rounded-md bg-black px-3.5 py-2 text-[13px] font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              Try Optiq Studio
            </Link>
          </div>

          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {/* Mega-menu */}
        {menuOpen === "PRODUCT" && (
          <div
            className="absolute inset-x-0 top-14 z-50 border-b border-neutral-800 bg-black/95 text-white backdrop-blur"
            onMouseLeave={() => setMenuOpen(null)}
          >
            <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-x-16 gap-y-10 px-16 py-12 md:grid-cols-4">
              {MEGA_MENU.map((col) => (
                <div key={col.heading}>
                  <p className="mb-4 text-[12px] text-neutral-500">{col.heading}</p>
                  <ul className="space-y-2.5">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        <Link
                          href={l.href}
                          className="inline-flex items-center gap-1 text-[14px] text-neutral-200 hover:text-white transition-colors"
                        >
                          {l.label}
                          {l.external && <ArrowUpRight size={11} className="text-neutral-500" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {mobileOpen && (
          <div className="border-b border-neutral-200 bg-white px-6 py-4 space-y-3 lg:hidden">
            {["Research", "Product", "Company"].map((l) => (
              <Link key={l} href="#worlds" className="block text-sm" onClick={() => setMobileOpen(false)}>
                {l}
              </Link>
            ))}
            <Link href="/login" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>
              Login
            </Link>
            <Link href={appHref} className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>
              Try Optiq Studio
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero: inset rounded video card ─────────────────────────── */}
      <section className="px-3 pb-3">
        <div className="relative h-[88vh] w-full overflow-hidden rounded-xl bg-black">
          <MediaSlot
            src="/media/hero.mp4"
            poster="/media/hero.jpg"
            className="absolute inset-0 h-full w-full"
            alt="Underwater shipwreck exploration, generated with Omni"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Headline bottom-left */}
          <div className="absolute bottom-12 left-8 md:left-14 text-white">
            <h1 className="display text-[44px] leading-[1.05] md:text-[64px]">
              Building AI to
              <br />
              Picture the World
            </h1>
            <Link
              href={appHref}
              className="mt-7 inline-flex items-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-[13px] font-medium text-black hover:bg-neutral-200 transition-colors"
            >
              Get Started <ChevronRight size={14} />
            </Link>
          </div>

          {/* Center-right index links */}
          <div className="absolute right-10 top-1/2 hidden -translate-y-1/2 flex-col items-start gap-3.5 md:flex">
            {HERO_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="font-mono text-[12px] font-semibold tracking-[0.06em] text-white/70 hover:text-white transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Partner band ───────────────────────────────────────────── */}
      <section className="bg-black py-7">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-center gap-x-14 gap-y-4 px-6">
          {PARTNERS.map((p) => (
            <span key={p} className="font-mono text-[12px] tracking-[0.14em] text-neutral-600">
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* ── Statement + world cards (white) ────────────────────────── */}
      <section id="worlds" className="mx-auto max-w-[1440px] px-16 pt-28 pb-24">
        <h2 className="display max-w-5xl text-[34px] leading-[1.15] text-neutral-900 md:text-[46px]">
          AI is changing how stories are told, how ideas take shape and how the
          next era of film, art and entertainment gets made.
        </h2>

        <div className="mt-14 grid grid-cols-2 gap-5 md:grid-cols-4">
          {WORLD_CARDS.map((card) => (
            <Link key={card.title} href={card.href} className="group">
              <div className="relative aspect-[10/9] overflow-hidden rounded-lg bg-neutral-100">
                <MediaSlot
                  src={card.media}
                  kind="image"
                  className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  alt={card.title}
                />
                {card.overlayCta && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-md bg-black/40 px-4 py-2 text-[12px] font-medium text-white backdrop-blur-sm">
                      Learn more <ChevronRight size={11} className="inline" />
                    </span>
                  </span>
                )}
              </div>
              <h3 className="mt-4 text-[17px] font-medium leading-snug text-neutral-900">
                {card.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{card.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Research band: inset blurred card ──────────────────────── */}
      <section id="research" className="px-3 pb-3">
        <div className="relative overflow-hidden rounded-xl bg-neutral-900">
          <MediaSlot
            src="/media/research-bg.jpg"
            kind="image"
            className="absolute inset-0 h-full w-full scale-125 blur-[70px] opacity-90"
            alt=""
          />
          <div className="absolute inset-0 bg-black/25" />

          <div className="relative mx-auto grid max-w-[1440px] gap-16 px-14 py-24 text-white md:grid-cols-2">
            <div>
              <p className="mb-8 text-[13px] text-white/80">Optiq Studio Research</p>
              <h2 className="display max-w-lg text-[26px] leading-[1.25] md:text-[30px]">
                We are building foundational world models — systems able to
                simulate spaces, stories and experiences. The next frontier of
                intelligence will come from models that can understand,
                perceive, generate and act in the world.
              </h2>
              <Link
                href={appHref}
                className="mt-9 inline-block rounded-md border border-white/40 px-4 py-2 text-[13px] font-medium hover:bg-white hover:text-black transition-colors"
              >
                Learn more
              </Link>
            </div>

            <div className="flex flex-col justify-center">
              {RESEARCH_ROWS.map((row) => (
                <div key={row.title} className="group border-t border-white/25 py-5 last:border-b">
                  <div className="flex items-start justify-between gap-6">
                    <div>
                      <h3 className="text-[17px] font-medium">{row.title}</h3>
                      <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-white/60">
                        {row.body}
                      </p>
                    </div>
                    <ArrowUpRight size={15} className="mt-1 shrink-0 text-white/50 group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── News (white) ───────────────────────────────────────────── */}
      <section id="news" className="mx-auto max-w-[1440px] px-16 py-28">
        <div className="grid gap-14 md:grid-cols-2 md:items-center">
          <Link href="/dashboard/video" className="group block overflow-hidden rounded-lg bg-neutral-100">
            <div className="aspect-video w-full overflow-hidden">
              <MediaSlot
                src="/media/news-omni.mp4"
                className="h-full w-full transition-transform duration-700 group-hover:scale-[1.02]"
                alt="Omni 1.5 reel"
              />
            </div>
          </Link>
          <div>
            <h2 className="display text-[34px] leading-[1.1] text-neutral-900 md:text-[46px]">
              Omni 1.5: a new frontier for video generation.
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-neutral-500">
              Longer shots, native sound and a deeper grasp of light and
              motion — available today for every Optiq Studio subscriber.
            </p>
            <Link
              href={appHref}
              className="mt-8 inline-block rounded-md bg-black px-5 py-2.5 text-[13px] font-medium text-white hover:bg-neutral-800 transition-colors"
            >
              Try it now
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer (black) ─────────────────────────────────────────── */}
      <footer className="bg-black text-white">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-16 py-20 md:grid-cols-5">
          <div>
            <p className="text-[22px] font-bold lowercase tracking-tight">optiq studio</p>
            <p className="mt-4 max-w-[220px] text-[13px] leading-relaxed text-neutral-500">
              An applied AI research company shaping the next era of art,
              entertainment and human creativity.
            </p>
          </div>
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <p className="mb-5 text-[12px] text-neutral-500">{col.heading}</p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[13px] text-neutral-300 hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-neutral-900">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between px-16 py-6">
            <p className="text-[11px] text-neutral-600">© {new Date().getFullYear()} Optiq Studio, Inc.</p>
            <p className="font-mono text-[11px] tracking-[0.14em] text-neutral-600">MADE WITH OMNI</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
