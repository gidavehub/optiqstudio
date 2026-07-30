"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, X, Menu } from "lucide-react";
import MediaSlot from "../components/MediaSlot";
import { useAuth } from "../components/AuthProvider";
import LiteYouTube from "../components/news/LiteYouTube";
import { VIDEOS } from "../lib/news/videos";

/* Center nav: small uppercase links. Every one of these goes somewhere real —
   PRODUCT, RESOURCES, SOLUTIONS and COMPANY were headings for pages that don't
   exist, so they and the mega-menu they opened are gone. */
const navItems = (
  studioHref: string
): { label: string; href: string; external?: boolean }[] => [
  { label: "STUDIO", href: studioHref },
  { label: "BLOG", href: "/blog" },
  { label: "API", href: "/api-docs" },
  { label: "DAVELABS", href: "https://davelabs.co/news", external: true },
];

const HERO_LINKS = [
  { label: "OPTIQ STUDIO STORYBOARD", href: "/dashboard/create" },
  { label: "CREATIVE ADS & CAMPAIGNS", href: "#worlds" },
  { label: "VOICE AND AUDIO PRODUCTION", href: "/dashboard/audio" },
  { label: "OPTIQ STUDIO ENTERPRISE", href: "/enterprise" },
];

const PARTNERS = ["AURELIA PICTURES", "NORTHFIELD", "HELIX STUDIOS", "PALE BLUE", "MERIDIAN", "KINO+"];

const WORLD_CARDS = [
  {
    media: "/media/card-omni.jpg",
    title: "High-Converting Ads: Creative Video Engine",
    body: "Generate vertical ads with photorealistic visuals, perfect motion, and native high-fidelity sound.",
    href: "/dashboard/video",
  },
  {
    media: "/media/card-robotics.jpg",
    title: "Optiq Voice: Studio-Grade Voiceovers",
    body: "Sixteen real African, diaspora and international voices — natural narrations that sit perfectly under your ads.",
    href: "/dashboard/audio",
  },
  {
    media: "/media/card-worlds.jpg",
    title: "Scenic Backdrops: Tailored Commercial Spaces",
    body: "Set your products inside stunning cinematic scenes you can customize, light, and rotate dynamically.",
    href: "/dashboard/video",
    overlayCta: true,
  },
  {
    media: "/media/card-avatars.jpg",
    title: "Consistent Characters: Virtual Brand Faces",
    body: "Maintain precise brand alignment across campaigns with consistent digital actors and video spokespersons.",
    href: "/dashboard/create",
  },
];

const ENTERPRISE_ROWS = [
  {
    title: "Done with you, not just by AI",
    body: "Our team sits with you to capture your brand, your mission and your story — then builds it into a cinematic ad with the taste only real directors bring.",
  },
  {
    title: "Production-quality, cinematic output",
    body: "Polished, emotionally resonant brand films people don't expect from AI — crafted with professional tools by a team that has done it by hand for years.",
  },
  {
    title: "A fraction of the time and cost",
    body: "Powered by our own platform, we deliver studio-grade campaigns far faster and cheaper than a traditional production house.",
  },
];

const FOOTER_COLS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Our Tools", href: "/dashboard" },
      { label: "Video Studio", href: "/dashboard/video" },
      { label: "Audio Studio", href: "/dashboard/audio" },
      { label: "Optiq Studio Enterprise", href: "/enterprise" },
      { label: "Image Studio", href: "/dashboard/image" },
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
      { label: "API Docs", href: "/api-docs" },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const appHref = user ? "/dashboard" : "/login";
  const links = navItems(appHref);

  return (
    <div className="min-h-screen bg-white text-black">
      {/* ── Nav: the landing page keeps its own. BlogHeader fronts /blog
          and /enterprise; this one is deliberately not that. ── */}
      <header className="sticky top-0 z-50 bg-white">
        <nav className="relative mx-auto flex h-14 max-w-[1440px] items-center px-4">
          <Link href="/" className="text-[26px] font-bold lowercase tracking-tight leading-none flex items-center gap-3 select-none">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 rounded-full">
              <circle cx="16" cy="16" r="16" fill="white" stroke="#e5e5e5" strokeWidth={1} />
              <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
            </svg>
            <span>optiq studio</span>
          </Link>

          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 lg:flex">
            {links.map((item) => {
              const cls =
                "font-mono text-[11px] font-medium tracking-[0.08em] text-black hover:text-neutral-500 transition-colors";
              return item.external ? (
                <a key={item.label} href={item.href} target="_blank" rel="noopener" className={cls}>
                  {item.label}
                </a>
              ) : (
                <Link key={item.label} href={item.href} className={cls}>
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <Link
              href="/enterprise"
              className="rounded-md bg-neutral-100 px-3.5 py-2 text-[13px] font-medium hover:bg-neutral-200 transition-colors"
            >
              Enterprise
            </Link>
            {user ? (
              <Link
                href="/dashboard"
                className="rounded-md bg-black px-3.5 py-2 text-[13px] font-medium text-white hover:bg-neutral-800 transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <>
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
                  Make an ad
                </Link>
              </>
            )}
          </div>

          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>

        {mobileOpen && (
          <div className="border-b border-neutral-200 bg-white px-6 py-4 space-y-3 lg:hidden">
            {links.map((l) =>
              l.external ? (
                <a
                  key={l.label}
                  href={l.href}
                  target="_blank"
                  rel="noopener"
                  className="block text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.label}
                  href={l.href}
                  className="block text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  {l.label}
                </Link>
              )
            )}
            <Link
              href="/enterprise"
              className="block text-sm font-semibold"
              onClick={() => setMobileOpen(false)}
            >
              Enterprise
            </Link>
            {user ? (
              <Link href="/dashboard" className="block text-sm font-semibold" onClick={() => setMobileOpen(false)}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Login
                </Link>
                <Link href={appHref} className="block text-sm font-medium" onClick={() => setMobileOpen(false)}>
                  Make an ad
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {/* ── Hero: inset rounded video card ─────────────────────────── */}
      <section className="px-3 pb-3">
        <div className="relative h-[88vh] w-full overflow-hidden rounded-xl bg-black">
          <MediaSlot
            src="/media/template-2.mp4"
            className="absolute inset-0 h-full w-full"
            alt="A warm, nostalgic brand commercial made with Optiq Studio"
          />
          <div className="absolute inset-0 bg-black/35" />

          {/* Headline bottom-left */}
          <div className="absolute bottom-12 left-8 md:left-14 text-white max-w-2xl">
            <h1 className="display text-[44px] leading-[1.05] md:text-[64px]">
              Democratizing
              <br />
              Production Quality Videos
            </h1>
            <p className="mt-4 text-[15px] text-white/80 leading-relaxed max-w-md">
              Produce photorealistic cinematic content and high-converting vertical video ads powered by state-of-the-art generative AI.
            </p>
            {/* Two doors: make it yourself, or have our team make it. Enterprise
                has to be reachable here — on mobile the nav collapses and this
                is the only place it would otherwise appear. */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Link
                href={appHref}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-[13px] font-medium text-black hover:bg-neutral-200 transition-colors"
              >
                Get Started <ChevronRight size={14} />
              </Link>
              <Link
                href="/enterprise"
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-[13px] font-medium text-black hover:bg-neutral-200 transition-colors"
              >
                Optiq Studio Enterprise <ChevronRight size={14} />
              </Link>
            </div>
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

      {/* ── Horizon Summer '26 (white) ─────────────────────────────── */}
      {/* Optiq Studio launched at the Horizon broadcast; the landing page was
          the one surface that never said so. LiteYouTube degrades to a
          reserved card while the trailer is still scheduled. */}
      <section id="horizon" className="mx-auto max-w-[1440px] px-16 pt-28 pb-24">
        <div className="grid gap-14 md:grid-cols-2 md:items-center">
          <div>
            <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-neutral-500">
              DAVELABS HORIZON SUMMER &rsquo;26
            </p>
            <h2 className="display mt-6 text-[34px] leading-[1.15] text-neutral-900 md:text-[46px]">
              Optiq Studio launched on the Horizon stage.
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-neutral-500">
              A single broadcast on 30 July 2026, three keynotes, and the arrival of
              a studio-quality commercial for less than five dollars. Optiq Studio
              Enterprise was announced in the same hour.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-2.5">
              <Link
                href="/blog/introducing-optiq-studio"
                className="rounded-md bg-black px-5 py-2.5 text-[13px] font-medium text-white hover:bg-neutral-800 transition-colors"
              >
                Read the announcement
              </Link>
              <a
                href="https://davelabs.co/news/horizon-summer-26-everything-we-announced"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-5 py-2.5 text-[13px] font-medium hover:bg-neutral-200 transition-colors"
              >
                Everything we announced
                <ArrowUpRight size={13} className="text-neutral-500" />
              </a>
            </div>
          </div>

          <div>
            <LiteYouTube
              id={VIDEOS.optiqTrailer.id}
              title={VIDEOS.optiqTrailer.title}
              premiere="Premieres 30 July, 4:00 PM GMT"
            />
            <p className="mt-4 text-[13px] text-neutral-500">
              Optiq Studio — official trailer.
            </p>
          </div>
        </div>
      </section>

      {/* ── Statement + world cards (white) ────────────────────────── */}
      <section id="worlds" className="mx-auto max-w-[1440px] px-16 pt-28 pb-24">
        <h2 className="display max-w-5xl text-[34px] leading-[1.15] text-neutral-900 md:text-[46px]">
          We help brands tell their story in production-quality video — democratizing the cinematic ads, voiceovers and campaigns that make people stop and watch.
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

      {/* ── Developer Engine band: inset blurred card ──────────────────────── */}
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
              <p className="mb-8 text-[13px] text-white/80">Optiq Studio Enterprise</p>
              <h2 className="display max-w-lg text-[26px] leading-[1.25] md:text-[30px]">
                Want it done for you? Work directly with the DaveLabs team to produce cinematic, production-quality ads — tailored to your brand and delivered in a fraction of the time and cost of a traditional production house.
              </h2>
              <Link
                href="/enterprise"
                className="mt-9 inline-block rounded-md border border-white/40 px-4 py-2 text-[13px] font-medium hover:bg-white hover:text-black transition-colors"
              >
                Explore Optiq Studio Enterprise
              </Link>
            </div>

            <div className="flex flex-col justify-center">
              {ENTERPRISE_ROWS.map((row) => (
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
                alt="Optiq Studio video reel"
              />
            </div>
          </Link>
          <div>
            <h2 className="display text-[34px] leading-[1.1] text-neutral-900 md:text-[46px]">
              High-fidelity video ads in seconds, not weeks.
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-neutral-500">
              Generate native, high-definition videos with matching sound design, lifelike characters, and precise camera controls. Elevate your brand's narrative without the overhead of physical production.
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
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                <circle cx="16" cy="16" r="16" fill="white" />
                <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
              </svg>
              <p className="text-[22px] font-bold lowercase tracking-tight">optiq studio</p>
            </div>
            <p className="max-w-[220px] text-[13px] leading-relaxed text-neutral-500">
              Democratizing production quality videos and photorealistic creations through cutting-edge generative AI.
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
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/media/davelabs-logo.png" alt="DaveLabs" className="h-4 w-auto opacity-70 invert" />
              <span className="font-mono text-[11px] tracking-[0.14em] text-neutral-500">A PRODUCT OF DAVELABS</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
