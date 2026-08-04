import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronRight } from "lucide-react";
import StartProjectButton, { ContactRows } from "@/components/EnterpriseContact";
import BlogFooter from "@/components/news/BlogFooter";
import BlogHeader from "@/components/news/BlogHeader";
import ProgressiveBlur from "@/components/news/ProgressiveBlur";
import { HORIZON } from "@/lib/horizon-assets";
import { jsonLdScript } from "@/lib/news/jsonld";
import { SITE, url } from "@/lib/news/site";

// /enterprise — the two Optiq Studio Enterprise tiers announced in Keynote 3
// of DaveLabs Horizon Summer '26: Custom Video Production, and the outcome-paid
// Enterprise Campaign Engine.

const TITLE = "Optiq Studio Enterprise — custom production and outcome-paid campaigns";
const DESCRIPTION =
  "Two tiers. Custom Video Production from $100 per ad, made by the DaveLabs creative team. Or the Enterprise Campaign Engine — five organisations per cycle, paid on results, not deliverables.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "Optiq Studio Enterprise",
    "custom video production",
    "enterprise video ads",
    "performance marketing agency",
    "pay on results marketing",
    "campaign engine",
    "video production The Gambia",
    "West Africa marketing agency",
  ],
  alternates: { canonical: "/enterprise" },
  openGraph: {
    type: "website",
    url: url("/enterprise"),
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE.name,
    locale: SITE.locale,
    images: [
      { url: url(HORIZON["optiq-horizon"].og), width: 1200, height: 670, alt: "Optiq Studio Enterprise" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [url(HORIZON["optiq-horizon"].og)],
    site: SITE.twitter,
  },
};

const WRAP = "mx-auto max-w-[1600px] px-5 sm:px-8 lg:px-12";

const TIER_ONE = [
  "A working session to understand your business, audience and the story this campaign has to tell",
  "Scriptwriting, storyboarding and full directorial oversight by our team",
  "Custom sound design, music and voice, finished in professional tools",
  "Colour-graded 4K finishing, reviewed with you until it is right",
  "A fraction of the time and cost of a traditional production house",
];

const TIER_TWO = [
  "Five organisations per campaign cycle — no more, so every campaign gets real attention",
  "Paid on outcomes: return on investment, sales, customer lifetime value",
  "Audience models drawn from 329+ mapped industries",
  "A custom Intelligence Dashboard with real-time attribution",
  "Creative produced on the same platform and by the same team behind Optiq Studio",
];

// Re-encoded from the 1.5MB JPEG masters to ~50-95kb webp, with an inline LQIP
// so the cards don't pop in as you scroll past them.
const VALUE_CARDS = [
  {
    media: "/media/enterprise/enterprise-collab.webp",
    blur: "data:image/webp;base64,UklGRmwAAABXRUJQVlA4IGAAAADwAQCdASoQAAkAA4BaJZACsAEWSS0gG8AA/slX6tc6IQen/SRAaF69kUgLspR1K8Wv3FxDgUt5soBaELPV+lmelzVu7AF77/UjcZPlzP1jtpy11kkWg7/UlzH3/S+ZrgA=",
    title: "Done with you, not just by AI",
    body: "We sit with you — in the room or on the call — to capture your brand, your mission and the story you want to tell. Then our directors shape it, frame by frame, with taste a prompt can't buy.",
  },
  {
    media: "/media/enterprise/enterprise-campaign.webp",
    blur: "data:image/webp;base64,UklGRmQAAABXRUJQVlA4IFgAAAAQAgCdASoQAAkAA4BaJQBOj+ACgl3jil8AAP7drq0tJkpUEKLHpvQWtJ2G1FgJmWfH9kaicfpCRABrbqL7l0JLqjNYZyY5IPQyKzMUuBxVRFsLPT5MLgAA",
    title: "Production-quality, cinematic output",
    body: "Polished, emotionally resonant brand films people don't expect from AI — built with professional tools by a team that has produced this work by hand for years.",
  },
  {
    media: "/media/enterprise/enterprise-craft.webp",
    blur: "data:image/webp;base64,UklGRl4AAABXRUJQVlA4IFIAAADQAQCdASoQAAkAA4BaJQBOgBt0/rf+AAD+9Y9ZPBPe18REycJ+s8qmyPxFKmXoZLxmnbMtAG0873F45gXfYXZuipCdKTw0NUqft4huZpvs8lAA",
    title: "A fraction of the time and cost",
    body: "Because we're powered by our own platform, we deliver studio-grade campaigns far faster and cheaper than a traditional production house — without cutting the craft.",
  },
];

const DASHBOARD = [
  { title: "Source & platform attribution", body: "Every lead and sale traced back to the exact video, platform, placement and audience that produced it." },
  { title: "Audience intelligence", body: "Who is actually converting — age, location, device, interest — so the next wave points at the people already saying yes." },
  { title: "AI lead scoring", body: "Every interaction scored for intent. The model learns which behaviours precede a sale and ranks your warm audience." },
  { title: "Retargeting engine", body: "The people who watched, clicked and nearly bought, automatically re-approached with the creative most likely to close them." },
  { title: "Creative performance", body: "A live leaderboard of which formats and hooks earn the cheapest results, so budget flows to the winners mid-cycle." },
  { title: "Privacy-first by design", body: "Everything aggregated and anonymised. We work in cohorts and signals, never personal records." },
];

const CYCLE = [
  { when: "Week 0", title: "Kickoff & creative lock", body: "We align on the story, lock the format mix and reach budget, build the script slate, and stand up the dashboard and tracking before a dalasi is spent." },
  { when: "Weeks 1–4", title: "Production wave", body: "The heavy lift. Renders first to seed the feed, motion and mini-docs follow, any cinematic work goes into its shoot. Publishing begins as soon as the first cuts clear approval." },
  { when: "Weeks 4–10", title: "Publish, read, reallocate", body: "Content ships on a steady cadence while the dashboard reads what's working. Mid-cycle we shift budget toward the winning creative and retarget the warm audience that didn't convert." },
  { when: "Weeks 11–12", title: "Report & renew", body: "A full end-of-cycle report against the model — views, results, cost per outcome, what we'd do differently — and the plan for the next wave." },
];

const INDUSTRIES = [
  "Food & Drink",
  "Retail & Fashion",
  "Beauty & Personal Care",
  "Real Estate & Property",
  "Automotive & Industrial",
  "Hospitality & Tourism",
  "Professional & Financial Services",
  "Agriculture & Agribusiness",
];

export default function EnterprisePage() {
  const banner = HORIZON["horizon-banner"];
  const founder = HORIZON["dave-keynote"];

  return (
    <div className="min-h-screen bg-white text-[#1f1f1f]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Optiq Studio Enterprise",
          serviceType: "Video production and performance marketing",
          provider: { "@id": `${SITE.origin}/#organization` },
          areaServed: ["GM", "SN", "NG", "GH", "Worldwide"],
          description: DESCRIPTION,
          url: url("/enterprise"),
          offers: [
            {
              "@type": "Offer",
              name: "Custom Video Production",
              description: "A custom commercial produced by the DaveLabs creative team.",
              priceSpecification: {
                "@type": "PriceSpecification",
                minPrice: 100,
                maxPrice: 200,
                priceCurrency: "USD",
              },
            },
            {
              "@type": "Offer",
              name: "Enterprise Campaign Engine",
              description:
                "An outcome-paid campaign cycle. Five organisations per cycle; payment is contingent on delivered business results.",
              availability: "https://schema.org/LimitedAvailability",
            },
          ],
        })}
      />

      <BlogHeader />
      <ProgressiveBlur />

      <main className="pt-[68px]">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="px-3 pt-4 sm:px-5 lg:px-8">
          <div className="relative overflow-hidden rounded-[24px] bg-[#f1f3f4] sm:rounded-[32px]">
            <Image
              src={banner.src}
              alt="DaveLabs Horizon Summer '26"
              width={banner.width}
              height={banner.height}
              priority
              fetchPriority="high"
              placeholder="blur"
              blurDataURL={banner.blurDataURL}
              sizes="(max-width: 1600px) 100vw, 1600px"
              className="w-full"
            />
          </div>
        </section>

        <section className={`${WRAP} py-12 md:py-16`}>
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#5f6368]">
            Optiq Studio Enterprise · DaveLabs Horizon Summer &rsquo;26
          </p>
          <h1 className="mt-4 max-w-[1000px] text-[34px] font-normal leading-[1.07] tracking-[-0.03em] sm:text-[52px] lg:text-[62px]">
            Want it done for you?
          </h1>
          <p className="mt-7 max-w-[700px] text-[18px] leading-[1.7] text-[#5f6368]">
            Optiq Studio puts a whole production studio in your hands. Optiq Studio
            Enterprise puts our team behind the camera for you — either a custom
            commercial made by our creative directors, or a full campaign cycle we only
            get paid for once it works.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <StartProjectButton className="inline-flex items-center gap-2 rounded-full bg-[#1f1f1f] px-6 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-black">
              Start an enterprise project <ChevronRight size={16} />
            </StartProjectButton>
            <Link
              href="/blog/optiq-studio-enterprise"
              className="inline-flex items-center gap-2 rounded-full border border-[#dadce0] px-6 py-3.5 text-[15px] font-medium text-[#1f1f1f] transition-colors hover:bg-[#f8f9fa]"
            >
              Read the announcement
            </Link>
          </div>
        </section>

        {/* ── Statement ──────────────────────────────────────────── */}
        <section className={`${WRAP} border-t border-[#e8eaed] py-16 md:py-24`}>
          <h2 className="max-w-[1100px] text-[30px] font-normal leading-[1.12] tracking-[-0.026em] sm:text-[44px]">
            Long before Optiq Studio was a platform, our team was making
            production-quality ads by hand.
          </h2>
          <p className="mt-7 max-w-[680px] text-[17px] leading-[1.7] text-[#5f6368]">
            Now you choose the route — the AI route, or the full production route with
            our team and partners. Either way it&rsquo;s crafted by us: cinematic, and
            unmistakably yours.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {VALUE_CARDS.map((card) => (
              <div key={card.title}>
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#f1f3f4]">
                  <Image
                    src={card.media}
                    alt=""
                    fill
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL={card.blur}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <h3 className="mt-5 text-[20px] font-medium leading-snug">{card.title}</h3>
                <p className="mt-2.5 text-[15px] leading-[1.7] text-[#5f6368]">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── The two tiers ──────────────────────────────────────── */}
        <section className="border-t border-[#e8eaed] bg-[#f8f9fa] py-16 md:py-24">
          <div className={WRAP}>
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#5f6368]">
              Two tiers
            </p>
            <h2 className="mt-5 max-w-[900px] text-[30px] font-normal leading-[1.12] tracking-[-0.026em] sm:text-[42px]">
              One makes you a commercial. The other is accountable for the outcome.
            </h2>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {/* Tier 1 */}
              <div className="flex flex-col rounded-2xl border border-[#dadce0] bg-white p-8 sm:p-10">
                <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-[#5f6368]">
                  Tier one
                </p>
                <h3 className="mt-4 text-[26px] font-medium leading-tight tracking-[-0.02em] sm:text-[30px]">
                  Custom Video Production
                </h3>
                <p className="mt-4 text-[16px] leading-[1.7] text-[#5f6368]">
                  A done-with-you production. Our in-house creative team works directly
                  with your business, from the first working session through to the
                  colour-graded master.
                </p>
                <div className="mt-7 flex items-baseline gap-3 border-y border-[#e8eaed] py-6">
                  <span className="text-[40px] font-normal leading-none tracking-[-0.03em]">
                    $100–$500
                  </span>
                  <span className="text-[15px] text-[#5f6368]">per video ad</span>
                </div>
                <p className="mt-3 text-[13px] text-[#5f6368]">D6,500 – D32,500</p>
                <ul className="mt-7 flex flex-1 flex-col gap-3.5">
                  {TIER_ONE.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.6]">
                      <Check size={16} className="mt-1 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <StartProjectButton className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-[#1f1f1f] px-6 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-black">
                  Commission a video <ChevronRight size={16} />
                </StartProjectButton>
              </div>

              {/* Tier 2 */}
              <div className="flex flex-col rounded-2xl bg-[#1f1f1f] p-8 text-white sm:p-10">
                <div className="flex items-center justify-between gap-4">
                  <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-white/60">
                    Tier two · Flagship
                  </p>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-white/80">
                    5 per cycle
                  </span>
                </div>
                <h3 className="mt-4 text-[26px] font-medium leading-tight tracking-[-0.02em] sm:text-[30px]">
                  Enterprise Campaign Engine
                </h3>
                <p className="mt-4 text-[16px] leading-[1.7] text-white/70">
                  Not a video generator. An outcome-driven growth engine — creative,
                  media, attribution and retargeting run as one cycle by our team.
                </p>
                <div className="mt-7 border-y border-white/15 py-6">
                  <span className="text-[28px] font-normal leading-tight tracking-[-0.024em] sm:text-[32px]">
                    We don&rsquo;t get paid until we deliver results.
                  </span>
                </div>
                <ul className="mt-7 flex flex-1 flex-col gap-3.5">
                  {TIER_TWO.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.6] text-white/85">
                      <Check size={16} className="mt-1 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <StartProjectButton className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-medium text-[#1f1f1f] transition-colors hover:bg-[#f1f3f4]">
                  Apply for a campaign cycle <ChevronRight size={16} />
                </StartProjectButton>
              </div>
            </div>
          </div>
        </section>

        {/* ── The cycle ──────────────────────────────────────────── */}
        <section className={`${WRAP} border-t border-[#e8eaed] py-16 md:py-24`}>
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#5f6368]">
            Enterprise growth campaign cycles
          </p>
          <h2 className="mt-5 max-w-[900px] text-[30px] font-normal leading-[1.12] tracking-[-0.026em] sm:text-[42px]">
            A three-month cycle. We publish continuously, learn continuously, and close
            every cycle with a report that feeds the next.
          </h2>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {CYCLE.map((phase) => (
              <div key={phase.when} className="border-t border-[#dadce0] pt-5">
                <p className="font-mono text-[13px] text-[#5f6368]">{phase.when}</p>
                <h3 className="mt-2.5 text-[19px] font-medium leading-snug">{phase.title}</h3>
                <p className="mt-2.5 text-[15px] leading-[1.65] text-[#5f6368]">{phase.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Intelligence Dashboard ─────────────────────────────── */}
        <section className="border-t border-[#e8eaed] bg-[#f8f9fa] py-16 md:py-24">
          <div className={WRAP}>
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#5f6368]">
              The intelligence layer
            </p>
            <h2 className="mt-5 max-w-[900px] text-[30px] font-normal leading-[1.12] tracking-[-0.026em] sm:text-[42px]">
              Every campaign ships with a dashboard. Know exactly which video earned
              which customer.
            </h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-[#e8eaed] sm:grid-cols-2 lg:grid-cols-3">
              {DASHBOARD.map((cap) => (
                <div key={cap.title} className="bg-white px-7 py-9">
                  <h3 className="text-[18px] font-medium leading-snug">{cap.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.7] text-[#5f6368]">{cap.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 329 industries ─────────────────────────────────────── */}
        <section className={`${WRAP} border-t border-[#e8eaed] py-16 md:py-24`}>
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-20">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#5f6368]">
                329+ mapped industries
              </p>
              <h2 className="mt-5 text-[30px] font-normal leading-[1.12] tracking-[-0.026em] sm:text-[42px]">
                We know who your customers are and what makes them buy.
              </h2>
              <p className="mt-6 max-w-[520px] text-[17px] leading-[1.7] text-[#5f6368]">
                Our models are trained on demographic and behavioural data across 329+
                industries in The Gambia, West Africa and comparable global markets. A
                hotel ad sells a feeling months in advance. A mechanic&rsquo;s ad sells
                trust in eight seconds.
              </p>
              <Link
                href="/blog/329-industries"
                className="mt-7 inline-flex items-center gap-2 text-[16px] font-medium text-[#1f1f1f] hover:underline"
              >
                Read the research <ArrowUpRight size={16} />
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-[#e8eaed] sm:grid-cols-2">
              {INDUSTRIES.map((industry) => (
                <li key={industry} className="bg-[#f8f9fa] px-6 py-5 text-[15px] font-medium">
                  {industry}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Powered by DaveLabs ────────────────────────────────── */}
        <section className="border-t border-[#e8eaed] py-16 md:py-24">
          <div className={`${WRAP} grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-20`}>
            <div className="overflow-hidden rounded-2xl bg-[#f1f3f4]">
              <Image
                src={founder.src}
                alt="Godswill Iyke Dave presenting at DaveLabs Horizon Summer '26"
                width={founder.width}
                height={founder.height}
                loading="lazy"
                placeholder="blur"
                blurDataURL={founder.blurDataURL}
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="w-full"
              />
            </div>
            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#5f6368]">
                Powered by DaveLabs
              </p>
              <blockquote className="mt-5 text-[24px] font-normal leading-[1.28] tracking-[-0.02em] sm:text-[32px]">
                &ldquo;We measure success by your return on investment, your sales, and
                your customer lifetime value.&rdquo;
              </blockquote>
              <p className="mt-6 text-[15px] text-[#5f6368]">
                Godswill Iyke Dave, Founder and CEO, DaveLabs — Keynote 3, DaveLabs
                Horizon Summer &rsquo;26
              </p>
              <a
                href="https://davelabs.co/news/watch-davelabs-horizon-summer-26"
                target="_blank"
                rel="noopener"
                className="mt-7 inline-flex items-center gap-2 text-[16px] font-medium text-[#1f1f1f] hover:underline"
              >
                Watch the keynote <ArrowUpRight size={16} />
              </a>
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section className="px-3 pb-3 sm:px-5 lg:px-8">
          <div className="mx-auto grid max-w-[1600px] gap-10 rounded-[24px] bg-[#1f1f1f] px-7 py-16 text-white sm:rounded-[32px] sm:px-14 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="text-[28px] font-normal leading-[1.12] tracking-[-0.024em] sm:text-[40px]">
                Let&rsquo;s make your brand&rsquo;s film.
              </h2>
              <p className="mt-5 max-w-[440px] text-[16px] leading-[1.7] text-white/70">
                Tell us your brand and the story. We&rsquo;ll take it from there.
              </p>
              <StartProjectButton className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-medium text-[#1f1f1f] transition-colors hover:bg-[#f1f3f4]">
                Start an enterprise project <ArrowUpRight size={16} />
              </StartProjectButton>
            </div>
            <div>
              <p className="mb-4 font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-white/60">
                Reach us directly
              </p>
              <ContactRows />
            </div>
          </div>
        </section>
      </main>

      <BlogFooter />
    </div>
  );
}
