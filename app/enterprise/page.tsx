import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Mail, Phone, Sparkles, Zap, Target, ShieldCheck, BarChart3, Layers } from "lucide-react";
import StartProjectButton, {
  ContactRows,
  WhatsAppIcon,
} from "../../components/EnterpriseContact";
import { CONTACT } from "../../components/enterprise-contact-data";

// /enterprise — Optiq Studio Enterprise & DaveLabs Horizon Summer '26 Page
export const metadata = {
  title: "Optiq Studio Enterprise — DaveLabs Horizon Summer '26",
  description:
    "Work directly with the DaveLabs team for custom done-with-you commercial ads or performance-driven Enterprise campaign cycles across 329+ mapped industries.",
};

const ENTERPRISE_TIERS = [
  {
    badge: "TIER 1 — CUSTOM PRODUCTION",
    title: "Done-With-You Commercial Ads",
    price: "$100 – $200",
    localPrice: "D6,500 – D13,000 per video ad",
    subtitle: "Hand-directed commercial films built for your brand",
    description: "Our in-house DaveLabs creative team writes, storyboards, directs, and polishes high-end video ads specifically tailored for your business.",
    features: [
      "Full scriptwriting & storyboard direction",
      "Custom soundscape, music & voiceover balancing",
      "Color-graded 4K cinematic export",
      "Delivered in a fraction of traditional agency time & cost",
    ],
    highlight: false,
    cta: "Start a Custom Ad",
  },
  {
    badge: "TIER 2 — FLAGSHIP CAMPAIGN ENGINE",
    title: "Enterprise Growth & Campaign Cycles",
    price: "Custom Cycle",
    localPrice: "Outcome-driven / Capped at 5 brands per cycle",
    subtitle: "A performance-driven growth engine with guaranteed ROI",
    description: "We partner with a select group of 5 organizations per cycle. We don't get paid until we deliver real business results, sales, and customer return.",
    features: [
      "AI models trained on 329+ West African & global industries",
      "Full Intelligence Dashboard included (+Retargeting & Lead Scoring)",
      "Multi-format creative slate (AI Video, Mini-Docs, Skits, Motion, Cinematic)",
      "Dedicated DaveLabs campaign director & outcome targets",
    ],
    highlight: true,
    cta: "Apply for Campaign Cycle",
  },
];

const PLATFORM_STEPS = [
  { n: "01", title: "Describe Your Product", body: "Type a short description of your business, product, or offer in plain terms." },
  { n: "02", title: "Choose Your Style & Duration", body: "Select from our curated templates, pick your style, and set your video length." },
  { n: "03", title: "Click Generate", body: "Optiq Studio's multi-agent AI system crafts, storyboards, and builds your studio-quality ad for less than $5." },
];

const MAPPED_INDUSTRIES = [
  "Retail & Fashion", "Food & Drink", "Beauty & Personal Care", "Real Estate & Property",
  "Hospitality & Tourism", "Health & Medical", "Financial Services", "Automotive",
  "Education & Training", "Agriculture & Agribusiness", "Technology & Software", "Logistics & Transport"
];

export default function EnterprisePage() {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100">
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
              <ArrowLeft size={13} /> Back to Studio
            </Link>
            <StartProjectButton className="rounded-md bg-black px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-neutral-800">
              Talk to DaveLabs Team
            </StartProjectButton>
          </div>
        </nav>
      </header>

      {/* ── Major Event Hero Banner ────────────────────────────────────── */}
      <section className="px-3 pt-3 pb-6">
        <div className="mx-auto max-w-[1440px] overflow-hidden rounded-2xl bg-neutral-900 text-white shadow-2xl">
          {/* Official Horizon '26 Banner Graphic */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/media/davelabs_horizon_banner.png"
              alt="DaveLabs Horizon '26 Official Event Banner"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            <div className="absolute top-6 left-6 rounded-full bg-white/10 backdrop-blur px-3.5 py-1 text-[11px] font-mono font-bold tracking-widest text-white border border-white/20">
              MAJOR EVENT • HORIZON SUMMER ’26
            </div>
          </div>

          {/* Hero Content Band */}
          <div className="px-6 py-10 sm:px-14 md:py-14">
            <div className="flex items-center gap-2 text-amber-400 font-mono text-[12px] font-bold tracking-wider uppercase mb-3">
              <Sparkles size={15} /> DaveLabs Flagship Announcement
            </div>
            <h1 className="display text-[38px] leading-[1.05] sm:text-[56px] md:text-[72px] text-white">
              DaveLabs Horizon Summer ’26
            </h1>
            <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-neutral-300 sm:text-[18px]">
              Democratizing high-end video ads across Africa and beyond. Choose self-service AI generation for <strong className="text-white">less than $5</strong> on Optiq Studio, or partner with the DaveLabs team for custom Enterprise campaigns.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <StartProjectButton className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-[14px] font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98]">
                Book Enterprise Consultation <ChevronRight size={16} />
              </StartProjectButton>
              <a
                href="https://amaka.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 text-[14px] font-medium text-white transition-colors hover:bg-white/10"
              >
                Visit Amaka AI (amaka.app) <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Enterprise Tiers Section ─────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-14">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <p className="font-mono text-[12px] font-bold tracking-[0.16em] uppercase text-neutral-500 mb-2">
            OPTIQ STUDIO ENTERPRISE SOLUTIONS
          </p>
          <h2 className="display text-[32px] leading-tight sm:text-[44px] text-neutral-900">
            Two Ways to Scale Your Brand&apos;s Video Ads
          </h2>
          <p className="mt-3 text-[15px] text-neutral-600">
            Whether you need a single studio-grade commercial or a full outcome-driven campaign engine, DaveLabs handles the heavy lifting.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {ENTERPRISE_TIERS.map((tier) => (
            <div
              key={tier.badge}
              className={`relative flex flex-col justify-between rounded-2xl p-8 sm:p-10 transition-all ${
                tier.highlight
                  ? "bg-neutral-900 text-white shadow-xl ring-2 ring-amber-400/50"
                  : "bg-neutral-50 border border-neutral-200 text-black"
              }`}
            >
              <div>
                <span
                  className={`inline-block rounded-full px-3 py-1 font-mono text-[11px] font-bold tracking-wider ${
                    tier.highlight
                      ? "bg-amber-400 text-black"
                      : "bg-neutral-200 text-neutral-800"
                  }`}
                >
                  {tier.badge}
                </span>

                <h3 className="mt-5 text-[26px] font-bold leading-tight">{tier.title}</h3>
                <p className={`mt-1 text-[13px] ${tier.highlight ? "text-neutral-400" : "text-neutral-500"}`}>
                  {tier.subtitle}
                </p>

                <div className="mt-6 border-y py-4 border-neutral-200/20">
                  <div className="text-[36px] font-bold tracking-tight">{tier.price}</div>
                  <div className={`text-[13px] font-medium ${tier.highlight ? "text-amber-300" : "text-neutral-600"}`}>
                    {tier.localPrice}
                  </div>
                </div>

                <p className={`mt-5 text-[14px] leading-relaxed ${tier.highlight ? "text-neutral-300" : "text-neutral-600"}`}>
                  {tier.description}
                </p>

                <ul className="mt-6 space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[14px]">
                      <Check
                        size={17}
                        className={`mt-0.5 shrink-0 ${tier.highlight ? "text-amber-400" : "text-black"}`}
                      />
                      <span className={tier.highlight ? "text-neutral-200" : "text-neutral-800"}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <StartProjectButton
                  className={`w-full justify-center rounded-xl py-3.5 text-[14px] font-bold transition-all ${
                    tier.highlight
                      ? "bg-amber-400 text-black hover:bg-amber-300"
                      : "bg-black text-white hover:bg-neutral-800"
                  }`}
                >
                  {tier.cta}
                </StartProjectButton>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Self-Service Platform Highlight ──────────────────────────── */}
      <section className="bg-neutral-900 text-white py-16 px-6 sm:px-14">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="font-mono text-[12px] font-bold uppercase tracking-widest text-amber-400">
                SELF-SERVICE OPTIQ STUDIO PLATFORM
              </span>
              <h2 className="display mt-3 text-[32px] leading-tight sm:text-[44px]">
                Studio-Quality Video Ads for Less Than $5
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-neutral-300">
                Small business owners no longer need thousands of dollars to create high-converting video ads. In just 3 easy steps, our smart AI multi-agent system handles storyboarding, cinematography, script reasoning, and music compilation.
              </p>

              <div className="mt-8 space-y-6">
                {PLATFORM_STEPS.map((s) => (
                  <div key={s.n} className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 font-mono text-[14px] font-bold text-amber-300">
                      {s.n}
                    </span>
                    <div>
                      <h4 className="text-[17px] font-bold text-white">{s.title}</h4>
                      <p className="mt-1 text-[13px] text-neutral-400">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-950 p-8 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="font-mono text-[12px] font-bold text-neutral-400">OPTIQ STUDIO PLATFORM</span>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-mono text-[11px] font-bold text-emerald-400">
                  LIVE ACCESS • amaka.app
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[12px] font-mono text-neutral-400">STEP 1 — PROMPT INPUT</div>
                  <div className="mt-1 text-[14px] font-medium text-white">
                    &quot;Create a high-energy commercial for a West African fashion brand, warm studio lighting...&quot;
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[12px] font-mono text-neutral-400">STEP 2 — DURATION & TEMPLATE</div>
                  <div className="mt-1 text-[14px] text-amber-300 font-bold">10s Cinematic Ad • Retail & Fashion</div>
                </div>

                <div className="rounded-xl bg-amber-400 p-4 text-center text-black font-bold text-[15px]">
                  STEP 3 — GENERATE AD (Less than $5)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mapped Industries Grid ───────────────────────────────────── */}
      <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="font-mono text-[12px] font-bold tracking-widest text-neutral-500 uppercase">
            329+ INDUSTRIES MAPPED
          </p>
          <h2 className="display mt-2 text-[30px] sm:text-[38px] text-neutral-900">
            Priced & Tailored for Your Market
          </h2>
          <p className="mt-2 text-[14px] text-neutral-600">
            Our AI models and Enterprise campaign engines are specifically calibrated for businesses across The Gambia and West Africa.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {MAPPED_INDUSTRIES.map((ind) => (
            <div
              key={ind}
              className="flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-[13px] font-medium text-neutral-800 transition-colors hover:border-black hover:bg-white"
            >
              <Check size={15} className="shrink-0 text-amber-600" />
              <span>{ind}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Direct Contact & CTA Band ───────────────────────────────── */}
      <section className="px-3 pb-6">
        <div className="mx-auto grid max-w-[1440px] gap-10 rounded-2xl bg-black px-6 py-16 text-white md:grid-cols-2 md:items-center sm:px-16">
          <div>
            <span className="font-mono text-[11px] font-bold tracking-widest text-amber-400 uppercase">
              WORK WITH DAVELABS TEAM
            </span>
            <h2 className="display mt-2 text-[30px] leading-tight sm:text-[42px]">
              Ready to scale your brand with video ads?
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-neutral-300">
              Reach out to our founders and creative directors directly. We reply fast and help you pick the exact right campaign tier.
            </p>
            <StartProjectButton className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-[15px] font-bold text-black transition-transform hover:scale-[1.02]">
              Start an Enterprise Project <ArrowUpRight size={16} />
            </StartProjectButton>
          </div>

          <div>
            <p className="mb-4 font-mono text-[11px] font-bold tracking-widest text-neutral-400 uppercase">
              DIRECT ENTERPRISE CONTACTS
            </p>
            <ContactRows />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mx-auto max-w-[1440px] px-6 py-10 sm:px-16">
        <div className="flex flex-wrap items-center justify-center gap-3 border-b border-neutral-200 pb-8">
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#25D366" }}
          >
            <WhatsAppIcon size={17} /> {CONTACT.phoneDisplay}
          </a>
          <a
            href={CONTACT.phoneHref}
            className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-neutral-800"
          >
            <Phone size={16} /> Call Us
          </a>
          <a
            href={`mailto:${CONTACT.emails[0]}${CONTACT.mailSubject}`}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1a56db" }}
          >
            <Mail size={16} /> {CONTACT.emails[0]}
          </a>
        </div>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-[13px] text-neutral-500 hover:text-black">
            ← Back to Optiq Studio Dashboard
          </Link>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/media/davelabs-logo.png" alt="DaveLabs" className="h-4 w-auto opacity-70" />
            <span className="font-mono text-[11px] tracking-[0.14em] text-neutral-500">
              © 2026 DAVELABS • ALL RIGHTS RESERVED
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
