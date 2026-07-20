"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Zap, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

const PLAN_FEATURES_MAP: Record<string, string[]> = {
  "pro-monthly": [
    "10,000 credits every month ($100 value)",
    "Gemini Omni Flash video generation",
    "30 credits/second rendering (high quality)",
    "Character consistency tools",
    "Voice Studio with all profiles",
    "Standard rendering queue",
  ],
  "studio-monthly": [
    "28,000 credits every month ($280 value — $30 bonus)",
    "Gemini Omni Flash video generation",
    "30 credits/second rendering (high quality)",
    "Character consistency tools",
    "Voice Studio with all profiles",
    "2x faster priority queue",
    "Dedicated rendering slots",
  ],
  "enterprise-monthly": [
    "55,000 credits every month ($550 value — $100 bonus)",
    "Gemini Omni Flash video generation",
    "30 credits/second rendering (high quality)",
    "Character consistency tools",
    "Voice Studio with all profiles",
    "Ultra-priority VIP queue",
    "Dedicated cloud resources",
    "Direct technical support",
  ],
};

export default function PlansPage() {
  const { profile, pricing, apiFetch, refreshProfile } = useAuth();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkout = async (kind: "subscription" | "credits", id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const data = await apiFetch<{ paymentLink: string }>("/api/payments/checkout", {
        method: "POST",
        body: JSON.stringify({
          kind,
          packId: kind === "credits" ? id : undefined,
          planId: kind === "subscription" ? id : undefined,
        }),
      });
      window.location.href = data.paymentLink;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusyId(null);
    }
  };

  const plans = pricing?.plans ?? [
    { id: "pro-monthly", name: "Optiq Pro", priceUsd: 100, monthlyCredits: 10_000, label: "Professional creator" },
    { id: "studio-monthly", name: "Optiq Studio", priceUsd: 250, monthlyCredits: 28_000, label: "Team & studio production" },
    { id: "enterprise-monthly", name: "Optiq Enterprise", priceUsd: 450, monthlyCredits: 55_000, label: "Unlimited power & scaling" },
  ];

  const packs = pricing?.packs ?? [
    { id: "pack-1000", credits: 1_000, priceUsd: 12, label: "Starter pack" },
    { id: "pack-5000", credits: 5_000, priceUsd: 50, label: "Creator pack" },
    { id: "pack-12000", credits: 12_000, priceUsd: 100, label: "Studio pack" },
  ];

  const isSubscribed = profile?.planStatus === "active";

  return (
    <main className="min-h-screen bg-[#08070c] text-white px-6 py-16 flex flex-col items-center">
      
      {/* Upper Navigation Back */}
      <div className="w-full max-w-6xl flex justify-between items-center mb-12">
        <Link href="/" className="text-lg font-medium tracking-tight lowercase">
          optiq studio
        </Link>
        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
        >
          Go to Workspace <ArrowRight size={13} />
        </button>
      </div>

      <div className="w-full max-w-5xl text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
          Choose Your Plan
        </h1>
        <p className="mt-3 text-neutral-400 max-w-xl mx-auto text-sm leading-relaxed">
          Unlock high-fidelity cinematic video, regular image generation, character studio, and human-like voice synthesis.
        </p>
      </div>

      {error && (
        <div className="w-full max-w-5xl mb-6 rounded-xl border border-red-950 bg-red-950/30 px-4 py-3.5 text-xs text-red-300 text-center">
          {error}
        </div>
      )}

      {/* Subscription Plans Side-by-Side 3-Column Grid */}
      <div className="w-full max-w-5xl grid gap-6 md:grid-cols-3 mb-16">
        {plans.map((p) => {
          const isActive = profile?.plan === p.id && isSubscribed;
          const features = PLAN_FEATURES_MAP[p.id] ?? PLAN_FEATURES_MAP["pro-monthly"];
          const isStudio = p.id === "studio-monthly";

          return (
            <div
              key={p.id}
              className={`relative rounded-2xl border p-6 flex flex-col justify-between transition-all bg-[#08080c]/60 ${
                isStudio ? "border-white/30 shadow-2xl shadow-white/5" : "border-neutral-900"
              } ${
                isActive ? "border-white/30" : "hover:border-neutral-700"
              }`}
            >
              {isStudio && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[9px] font-bold tracking-wider text-black uppercase font-mono border border-neutral-200">
                  RECOMMENDED
                </span>
              )}

              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">{p.name}</h2>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{p.label}</p>
                  </div>
                </div>

                <p className="mt-4 text-3xl font-extrabold text-white tracking-tight">
                  ${p.priceUsd}
                  <span className="text-xs font-normal font-mono text-neutral-500"> / month</span>
                </p>

                <ul className="mt-6 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-neutral-300 leading-relaxed">
                      <Check size={13} className="mt-0.5 shrink-0 text-white" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => void checkout("subscription", p.id)}
                disabled={busyId !== null || isActive}
                className={`mt-8 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-not-allowed"
                    : isStudio
                    ? "bg-white text-black hover:bg-neutral-200"
                    : "bg-neutral-800 hover:bg-neutral-700 text-white"
                }`}
              >
                {busyId === p.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Zap size={13} />
                )}
                {isActive ? "Your Active Plan" : `Subscribe to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Credit packs: Shown if subscribed, locked otherwise */}
      <div className="w-full max-w-5xl border-t border-neutral-900 pt-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="text-white" size={18} />
              Pay-As-You-Go Credit Top-ups
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              Top up your balance on-the-fly. Buy packages of credits instantly to power your generations.
            </p>
          </div>
          {!isSubscribed && (
            <div className="rounded-lg bg-neutral-950/80 border border-neutral-800 px-3.5 py-1.5 text-[11px] text-neutral-400 flex items-center gap-2 max-w-xs self-start md:self-auto">
              <ShieldCheck size={13} className="text-neutral-500" />
              <span>Only available to active subscribers.</span>
            </div>
          )}
        </div>

        {/* Dynamic opacity grid for packs */}
        <div className={`grid gap-4 md:grid-cols-3 transition-opacity duration-300 ${isSubscribed ? "opacity-100" : "opacity-40 select-none"}`}>
          {packs.map((pack) => (
            <div
              key={pack.id}
              className={`flex flex-col justify-between rounded-xl border p-5 bg-[#08080c]/60 ${
                isSubscribed ? "border-neutral-900 hover:border-neutral-800" : "border-neutral-950"
              }`}
            >
              <div>
                <p className="text-sm font-bold text-white">{pack.credits.toLocaleString()} credits</p>
                <p className="text-[10px] text-neutral-500 mt-1">{pack.label}</p>
              </div>
              <button
                onClick={() => isSubscribed && void checkout("credits", pack.id)}
                disabled={busyId !== null || !isSubscribed}
                className={`mt-4 flex items-center justify-center rounded-full border text-xs font-semibold px-4 py-2 transition-colors w-full ${
                  isSubscribed
                    ? "border-neutral-800 bg-black hover:bg-neutral-900 hover:border-neutral-700 text-white"
                    : "border-neutral-950 bg-neutral-950 text-neutral-600 cursor-not-allowed"
                }`}
              >
                {busyId === pack.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  `Purchase Pack · $${pack.priceUsd}`
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center max-w-lg mx-auto">
          <p className="text-[11px] text-neutral-600 leading-relaxed">
            Payments are processed securely via ModemPay in Gambian Dalasi (GMD). Dynamic rate exchange converter handles conversion smoothly from local cards.
          </p>
        </div>
      </div>

    </main>
  );
}
