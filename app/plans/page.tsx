"use client";

// The paywall. No subscriptions — Optiq is pay-as-you-go on a GMD wallet.
//
// Design intent:
//   • The top third is a live mosaic of real Optiq output. The single most
//     persuasive thing we own is the footage itself, so it leads — the same
//     move the login screen makes, and the reason that screen works.
//   • A white sheet rises over it. Everything transactional lives on plain
//     white so the numbers read instantly against the cinema above.
//   • Two panels slide horizontally: what things cost → name your amount.
//     Never a new route, so the mosaic never reloads and the motion reads as
//     one continuous surface.
//
// House rules: solid colours only (no gradients), Google Sans / Roboto only,
// minimal copy.

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { db } from "../../lib/firebase";

// Reused from the retired storyboard templates — real frames Optiq produced.
const SHOWCASE = [
  "/media/template-1.mp4",
  "/media/template-6.mp4",
  "/media/template-3.mp4",
  "/media/template-9.mp4",
  "/media/template-5.mp4",
  "/media/template-11.mp4",
];

/**
 * One price per ad, covering everything — the storyboard AND every scene
 * render. Paying for the spec grants the project its scene renders up front
 * (see `prepaidRenders`), so nothing is charged again while the ad is being
 * made. Mirrors LENGTH_PRICING_GMD.
 */
const AD_PRICING = [
  { length: "30s", scenes: 3, total: 450 },
  { length: "60s", scenes: 6, total: 900, popular: true },
  { length: "90s", scenes: 9, total: 1350 },
];

/** Cheapest complete ad — used to translate a top-up into something concrete. */
const CHEAPEST_AD = 450;

/** Everything else the wallet pays for, straight from the functions pricing. */
const UNIT_PRICING = [
  { label: "Video", detail: "per second", gmd: 15 },
  { label: "Image", detail: "each", gmd: 50 },
  { label: "Voice", detail: "per 100 chars", gmd: 10 },
];

const QUICK_AMOUNTS = [450, 900, 1350, 2500];
const MIN_TOPUP = 50;

function PaywallInner() {
  const { user, profile, loading, apiFetch } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Billing links straight to the amount entry; everyone else starts on the
  // pricing panel so they see what things cost before naming a number.
  const [panel, setPanel] = useState<0 | 1>(searchParams.get("topup") === "1" ? 1 : 0);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bonusDismissed, setBonusDismissed] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const balance = profile?.credits ?? 0;

  // The amount field must NOT autoFocus. Both panels live on one rail, so
  // focusing an off-screen input makes the browser scroll it into view — which
  // dumped users straight onto "How much?" and fought every attempt to go back.
  // Focus is therefore granted only once the panel is actually showing, and the
  // rail's scroll position is pinned back to 0 either way.
  useEffect(() => {
    if (railRef.current) railRef.current.scrollLeft = 0;
    if (panel === 1) {
      const t = setTimeout(() => amountRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
    amountRef.current?.blur();
  }, [panel]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Derived rather than stored in state: the bonus is celebrated whenever the
  // profile still says it is unseen and the user hasn't waved it away.
  const celebrate =
    !bonusDismissed && (profile?.welcomeBonus ?? 0) > 0 && !profile?.welcomeBonusSeen;

  const dismissCelebration = async () => {
    setBonusDismissed(true);
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { welcomeBonusSeen: true });
    } catch {
      /* cosmetic only — never block the user on this */
    }
  };

  const parsedAmount = useMemo(() => {
    const n = Number(amount.replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }, [amount]);

  const amountValid = parsedAmount >= MIN_TOPUP;

  const checkout = async () => {
    if (!amountValid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ paymentLink: string }>("/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({ kind: "topup", amountGmd: parsedAmount }),
      });
      window.location.href = data.paymentLink;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="flex h-dvh items-center justify-center bg-black">
        <Loader2 className="animate-spin text-neutral-500" size={22} />
      </main>
    );
  }

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-black">
      {/* ── PROOF: a live wall of what the platform makes ─────────────── */}
      <div className="relative h-[34dvh] min-h-[200px] w-full shrink-0 overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-3 gap-1.5 p-1.5">
          {SHOWCASE.map((src) => (
            <div key={src} className="relative overflow-hidden rounded-lg bg-neutral-950">
              <video
                src={src}
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover opacity-45 saturate-[0.9]"
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-black/45" />

        <button
          onClick={() => router.push("/dashboard")}
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-transform active:scale-90 hover:bg-black/80"
        >
          <X size={16} />
        </button>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center px-6 text-center">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="16" fill="white" />
              <circle cx="16" cy="16" r="8" fill="none" stroke="black" strokeWidth={4} />
            </svg>
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-white">
              optiq studio
            </span>
          </div>
        </div>
      </div>

      {/* ── THE SHEET ─────────────────────────────────────────────────── */}
      <div className="relative -mt-5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.6)]">
        {/* Two panels on one rail */}
        <div
          ref={railRef}
          className="flex h-full w-[200%] flex-1 overflow-hidden transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ transform: panel === 0 ? "translateX(0)" : "translateX(-50%)" }}
        >
          {/* ── PANEL 0 — WHAT IT COSTS ─────────────────────────────── */}
          <section className="flex h-full w-1/2 flex-col overflow-y-auto px-5 pb-5 pt-5 sm:px-8">
            <div className="mx-auto w-full max-w-lg">
              <h1 className="text-[26px] font-black leading-tight tracking-tight text-neutral-900 sm:text-3xl">
                Pay only for what you make
              </h1>
              <p className="mt-1.5 text-[13px] text-neutral-500">
                No subscription. Your balance never expires.
              </p>

              {/* Wallet */}
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-neutral-100 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                  Your wallet
                </span>
                <span className="font-display text-xl font-bold text-neutral-900">
                  GMD {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Ad pricing */}
              <p className="mt-6 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                One price per ad
              </p>
              <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                {AD_PRICING.map((tier) => (
                  <div
                    key={tier.length}
                    className={`relative flex flex-col items-center rounded-2xl border-2 px-2 py-4 text-center ${
                      tier.popular ? "border-blue-600 bg-blue-50" : "border-neutral-200 bg-white"
                    }`}
                  >
                    {tier.popular && (
                      <span className="absolute -top-2.5 whitespace-nowrap rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                        Most picked
                      </span>
                    )}
                    <span className="font-display text-2xl font-black text-neutral-900">{tier.length}</span>
                    <span className="mt-0.5 text-[10px] text-neutral-500">{tier.scenes} scenes</span>
                    <span
                      className={`mt-2 text-[13px] font-bold ${
                        tier.popular ? "text-blue-700" : "text-neutral-900"
                      }`}
                    >
                      GMD {tier.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                Script, cast and every scene rendered — nothing else to pay.
              </p>

              {/* Unit pricing */}
              <p className="mt-6 text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                Or piece by piece
              </p>
              <div className="mt-2.5 divide-y divide-neutral-100 rounded-2xl border border-neutral-200">
                {UNIT_PRICING.map((u) => (
                  <div key={u.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[13px] font-semibold text-neutral-800">
                      {u.label}
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-400">{u.detail}</span>
                    </span>
                    <span className="text-[13px] font-bold text-neutral-900">GMD {u.gmd}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mx-auto mt-6 w-full max-w-lg pb-2">
              <button
                onClick={() => setPanel(1)}
                className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-4 text-[15px] font-bold text-white transition-transform active:scale-[0.98] hover:bg-neutral-800"
              >
                Top up wallet <ArrowRight size={16} />
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="mt-2 w-full py-2.5 text-[13px] font-semibold text-neutral-500 hover:text-neutral-800"
              >
                Maybe later
              </button>
            </div>
          </section>

          {/* ── PANEL 1 — NAME YOUR AMOUNT ──────────────────────────── */}
          <section className="flex h-full w-1/2 flex-col overflow-y-auto px-5 pb-5 pt-5 sm:px-8">
            <div className="mx-auto w-full max-w-lg">
              <button
                onClick={() => setPanel(0)}
                className="-ml-1 flex items-center gap-1.5 py-1 text-[13px] font-semibold text-neutral-500 hover:text-neutral-900"
              >
                <ArrowLeft size={15} /> Back
              </button>

              <h2 className="mt-3 text-[26px] font-black leading-tight tracking-tight text-neutral-900 sm:text-3xl">
                How much?
              </h2>

              {/* The amount */}
              <div className="mt-6 flex items-center justify-center gap-2 border-b-2 border-neutral-900 pb-3">
                <span className="font-display text-2xl font-bold text-neutral-400">GMD</span>
                <input
                  ref={amountRef}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  inputMode="numeric"
                  placeholder="0"
                  aria-label="Top-up amount in Gambian Dalasi"
                  className="w-full min-w-0 bg-transparent text-center font-display text-5xl font-black tracking-tight text-neutral-900 outline-none placeholder:text-neutral-300 sm:text-6xl"
                />
              </div>

              {/* Quick picks */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(String(q))}
                    className={`rounded-xl border-2 py-2.5 text-[13px] font-bold transition-colors ${
                      parsedAmount === q
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                    }`}
                  >
                    {q.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* What it buys — the number made concrete */}
              {amountValid && (
                <p className="mt-5 rounded-2xl bg-neutral-100 px-4 py-3 text-center text-[13px] text-neutral-600">
                  {parsedAmount >= CHEAPEST_AD ? (
                    <>
                      About{" "}
                      <span className="font-bold text-neutral-900">
                        {Math.floor(parsedAmount / CHEAPEST_AD)}
                      </span>{" "}
                      complete 30-second {Math.floor(parsedAmount / CHEAPEST_AD) === 1 ? "ad" : "ads"}
                    </>
                  ) : (
                    <>
                      Adds to your balance —{" "}
                      <span className="font-bold text-neutral-900">GMD {CHEAPEST_AD.toLocaleString()}</span> covers a
                      full 30-second ad
                    </>
                  )}
                </p>
              )}

              {amount !== "" && !amountValid && (
                <p className="mt-4 text-center text-[12px] font-semibold text-red-600">
                  Minimum top-up is GMD {MIN_TOPUP}
                </p>
              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="mx-auto mt-6 w-full max-w-lg pb-2">
              <button
                onClick={checkout}
                disabled={!amountValid || busy}
                className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold transition-all ${
                  amountValid && !busy
                    ? "bg-neutral-900 text-white active:scale-[0.98] hover:bg-neutral-800"
                    : "cursor-not-allowed bg-neutral-200 text-neutral-400"
                }`}
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                {busy ? "Opening checkout…" : "Continue to checkout"}
              </button>
              <p className="mt-2.5 text-center text-[11px] text-neutral-400">
                Card or mobile money, secured by ModemPay
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* ── WELCOME BONUS ─────────────────────────────────────────────── */}
      {celebrate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
              <Check size={26} strokeWidth={3} className="text-white" />
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-tight text-neutral-900">
              GMD {(profile?.welcomeBonus ?? 1000).toLocaleString()} is on us
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
              Already in your wallet — enough for your first ad. Nothing to pay yet.
            </p>
            <button
              onClick={dismissCelebration}
              className="mt-6 w-full rounded-2xl bg-neutral-900 py-3.5 text-[15px] font-bold text-white transition-transform active:scale-[0.98] hover:bg-neutral-800"
            >
              Start creating
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function PaywallPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-dvh items-center justify-center bg-black">
          <Loader2 className="animate-spin text-neutral-500" size={22} />
        </main>
      }
    >
      <PaywallInner />
    </Suspense>
  );
}
