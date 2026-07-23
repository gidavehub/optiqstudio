import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, ChevronRight } from "lucide-react";

// /enterprise — Optiq Studio Enterprise. Not a subscription: a done-with-you
// service where the DaveLabs team produces cinematic, production-quality ads
// for a brand, powered by (but going beyond) the Optiq Studio platform.

export const metadata = {
  title: "Optiq Studio Enterprise — Done-With-You Production-Quality Ads",
  description:
    "Work directly with the DaveLabs team to produce cinematic, production-quality brand ads — tailored to your brand and delivered in a fraction of the time and cost of a traditional production house.",
};

const VALUE_CARDS = [
  {
    media: "/media/enterprise/enterprise-collab.jpg",
    title: "Done with you, not just by AI",
    body: "We sit with you — in the room or on the call — to capture your brand, your mission and the story you want to tell. Then our directors shape it, frame by frame, with taste a prompt can't buy.",
  },
  {
    media: "/media/enterprise/enterprise-campaign.jpg",
    title: "Production-quality, cinematic output",
    body: "Polished, emotionally resonant brand films people don't expect from AI — built with professional tools by a team that has produced this work by hand for years.",
  },
  {
    media: "/media/enterprise/enterprise-craft.jpg",
    title: "A fraction of the time and cost",
    body: "Because we're powered by our own platform, we deliver studio-grade campaigns far faster and cheaper than a traditional production house — without cutting the craft.",
  },
];

const STEPS = [
  { n: "01", title: "We meet your brand", body: "A working session to understand your business, your audience, your mission and the exact story this campaign needs to tell." },
  { n: "02", title: "We direct it", body: "Our team writes, storyboards and directs the ad — blending our prompt-craft, our platform and years of hands-on production expertise." },
  { n: "03", title: "We craft it to finish", body: "Sound, music, pacing, colour — finished to production quality in professional tools, reviewed with you until it's right." },
  { n: "04", title: "You share it", body: "A cinematic, high-converting ad ready for every screen — the kind of film people stop to watch and remember your brand by." },
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-[1440px] items-center px-4 sm:px-6">
          <Link href="/" className="flex select-none items-center gap-3 text-[22px] font-bold lowercase leading-none tracking-tight">
            <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <circle cx="16" cy="16" r="16" fill="white" stroke="#e5e5e5" strokeWidth={1} />
              <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
            </svg>
            <span>optiq studio</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-neutral-600 hover:text-black sm:flex"
            >
              <ArrowLeft size={13} /> Back to Optiq Studio
            </Link>
            <a
              href="mailto:optiq@davelabs.co?subject=Optiq%20Studio%20Enterprise%20project"
              className="rounded-md bg-black px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800"
            >
              Start a project
            </a>
          </div>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="px-3 pb-3">
        <div className="relative h-[78vh] w-full overflow-hidden rounded-xl bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/enterprise/enterprise-hero.jpg" alt="A DaveLabs creative director on a commercial film set" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/45" />
          <div className="absolute bottom-12 left-8 max-w-2xl text-white md:left-14">
            <p className="mb-4 font-mono text-[12px] font-semibold tracking-[0.14em] text-white/70">OPTIQ STUDIO ENTERPRISE</p>
            <h1 className="display text-[52px] leading-[1.02] md:text-[82px]">
              Want it done for you?
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/85">
              Choose the AI route or the full production route — either way, our team makes your cinematic ad, at a
              fraction of the time and cost.
            </p>
            <a
              href="mailto:optiq@davelabs.co?subject=Optiq%20Studio%20Enterprise%20project"
              className="mt-7 inline-flex items-center gap-1.5 rounded-md bg-white px-5 py-2.5 text-[13px] font-medium text-black transition-colors hover:bg-neutral-200"
            >
              Start a project <ChevronRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ── Statement ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 pb-8 pt-24 sm:px-16">
        <h2 className="display max-w-4xl text-[30px] leading-[1.15] text-neutral-900 md:text-[44px]">
          Optiq Studio puts a whole production studio in your hands. Optiq Studio Enterprise puts our team behind the
          camera for you.
        </h2>
        <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-neutral-500">
          Long before Optiq Studio was a platform, our team was making production-quality ads by hand. Now you choose
          the route — the AI route, or the full production route with our team and partners. Either way it&apos;s
          crafted by us: cinematic, and unmistakably yours.
        </p>
      </section>

      {/* ── Value cards ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 py-10 sm:px-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {VALUE_CARDS.map((card) => (
            <div key={card.title}>
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.media} alt={card.title} className="h-full w-full object-cover" />
              </div>
              <h3 className="mt-4 text-[18px] font-medium leading-snug text-neutral-900">{card.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Process ─────────────────────────────────────────────────── */}
      <section className="px-3 py-10">
        <div className="mx-auto max-w-[1440px] overflow-hidden rounded-xl bg-neutral-900 px-6 py-20 text-white sm:px-16">
          <p className="mb-3 font-mono text-[12px] tracking-[0.14em] text-white/60">HOW IT WORKS</p>
          <h2 className="display max-w-2xl text-[26px] leading-[1.2] md:text-[34px]">
            A small, senior team — writing, directing and finishing your ad end to end.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="border-t border-white/20 pt-5">
                <p className="font-mono text-[13px] text-white/50">{s.n}</p>
                <h3 className="mt-2 text-[17px] font-medium">{s.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/60">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Not a subscription ──────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-16">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="display text-[28px] leading-[1.15] text-neutral-900 md:text-[38px]">
              Not a subscription. A partnership.
            </h2>
            <p className="mt-5 max-w-md text-[14px] leading-relaxed text-neutral-500">
              Enterprise isn&apos;t a plan you buy — it&apos;s a service we run with you, priced per project. It costs a
              little more than generating it yourself in Optiq Studio, because you&apos;re getting our team, our
              direction and a finish built for broadcast.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "Cinematic, production-quality output — not templated AI",
              "Tailored to your brand, mission and campaign",
              "Custom sound, music and voice, finished professionally",
              "A fraction of the time and cost of a production house",
            ].map((point) => (
              <li key={point} className="flex items-start gap-3 border-t border-neutral-200 pt-3 text-[14px] text-neutral-800">
                <Check size={16} className="mt-0.5 shrink-0 text-black" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Powered by DaveLabs ────────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 pb-16 sm:px-16">
        <div className="flex flex-col items-center gap-5 rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-14 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/davelabs-logo.png" alt="DaveLabs" className="h-12 w-auto" />
          <div>
            <p className="text-[15px] font-medium text-neutral-900">Powered by the DaveLabs team</p>
            <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-neutral-500">
              Optiq Studio is a product of DaveLabs. Enterprise is where the same team that built the platform brings its
              craft directly to your brand.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA band ────────────────────────────────────────────────── */}
      <section className="px-3 pb-3">
        <div className="mx-auto flex max-w-[1440px] flex-col items-start justify-between gap-6 rounded-xl bg-black px-6 py-16 text-white sm:flex-row sm:items-center sm:px-16">
          <div>
            <h2 className="display text-[26px] leading-[1.15] md:text-[34px]">Let&apos;s make your brand&apos;s film.</h2>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/60">
              Tell us your brand and the story. We&apos;ll take it from there.
            </p>
            <div className="mt-5 flex flex-col gap-1.5 text-[13px]">
              <a href="mailto:optiq@davelabs.co" className="text-white/85 transition-colors hover:text-white">optiq@davelabs.co</a>
              <a href="mailto:sales@davelabs.co" className="text-white/85 transition-colors hover:text-white">sales@davelabs.co</a>
              <a href="https://wa.me/2207810880" className="text-white/85 transition-colors hover:text-white">+220 781 0880 &middot; call &amp; WhatsApp</a>
            </div>
          </div>
          <a
            href="mailto:optiq@davelabs.co?subject=Optiq%20Studio%20Enterprise%20project"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-white px-6 py-3 text-[14px] font-medium text-black transition-colors hover:bg-neutral-200"
          >
            Start an enterprise project <ArrowUpRight size={15} />
          </a>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-10 sm:px-16">
        <Link href="/" className="text-[13px] text-neutral-500 hover:text-black">
          ← Optiq Studio
        </Link>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/media/davelabs-logo.png" alt="DaveLabs" className="h-4 w-auto opacity-70" />
          <span className="font-mono text-[11px] tracking-[0.14em] text-neutral-500">A PRODUCT OF DAVELABS</span>
        </div>
      </footer>
    </div>
  );
}
