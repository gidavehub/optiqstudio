"use client";
 
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Zap } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
 
const PLAN_FEATURES_MAP: Record<string, string[]> = {
  "pro-monthly": [
    "10,000 credits every month",
    "Gemini Omni Flash video generation",
    "1080p renders with native audio",
    "Character consistency tools",
    "Voice Studio with all profiles",
    "Standard rendering queue",
  ],
  "studio-monthly": [
    "28,000 credits every month",
    "Gemini Omni Flash video generation",
    "1080p renders with native audio",
    "Character consistency tools",
    "Voice Studio with all profiles",
    "2x faster priority queue",
    "Dedicated rendering slots",
  ],
  "enterprise-monthly": [
    "55,000 credits every month",
    "Gemini Omni Flash video generation",
    "1080p renders with native audio",
    "Character consistency tools",
    "Voice Studio with all profiles",
    "Ultra-priority VIP queue",
    "Dedicated cloud resources",
    "Direct technical support",
  ],
};
 
function BillingInner() {
  const { profile, pricing, apiFetch, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
 
  // After returning from ModemPay checkout, the webhook may land a moment
  // later — refresh a few times so the new balance shows up.
  useEffect(() => {
    if (status === "success") {
      const timers = [0, 3000, 8000, 15000].map((ms) =>
        setTimeout(() => void refreshProfile(), ms)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [status, refreshProfile]);
 
  const checkout = async (kind: "subscription" | "credits", id?: string) => {
    setBusyId(id ?? "subscription");
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
  const packs = pricing?.packs ?? [];
  const isSubscribed = profile?.planStatus === "active";
 
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-10">
        <h1 className="text-[26px] font-semibold tracking-tight">Plan & Credits</h1>
        <p className="mt-1 text-[13px] text-neutral-500">
          Credits power every generation. Subscribe for the best rate, or top up any time.
        </p>
 
        {status === "success" && (
          <div className="mt-5 rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            Payment received — your credits will appear within a few seconds of
            confirmation.
          </div>
        )}
        {status === "cancelled" && (
          <div className="mt-5 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-neutral-400">
            Checkout cancelled. No charge was made.
          </div>
        )}
      {error && (
        <div className="mt-5 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
 
      {/* Balance */}
      <div className="mt-8 flex items-center justify-between rounded-xl border border-line bg-surface px-6 py-5">
        <div>
          <p className="eyebrow">Current balance</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {profile ? profile.credits.toLocaleString() : "—"}
            <span className="ml-2 text-sm font-normal text-neutral-500">credits</span>
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow">Plan</p>
          <p className="mt-1 text-sm font-medium">
            {isSubscribed
              ? (profile?.plan === "enterprise-monthly"
                ? "Optiq Enterprise"
                : profile?.plan === "studio-monthly"
                ? "Optiq Studio"
                : "Optiq Pro")
              : "Free"}
            {isSubscribed && profile?.planRenewsAt && (
              <span className="block text-[11px] font-normal text-neutral-500">
                Renews {new Date(profile.planRenewsAt).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      </div>
 
      <div className="mt-10 grid gap-6 md:grid-cols-[1.3fr_1fr]">
        {/* Subscription plans */}
        <div className="space-y-6">
          <p className="eyebrow">Choose subscription plan</p>
          {plans.map((p: any) => {
            const isActive = profile?.plan === p.id && isSubscribed;
            const features = PLAN_FEATURES_MAP[p.id] ?? PLAN_FEATURES_MAP["pro-monthly"];
            return (
              <div
                key={p.id}
                className={`rounded-xl border p-6 transition-all bg-surface ${
                  isActive ? "border-white/40 shadow-lg shadow-white/5" : "border-line"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">{p.label}</p>
                  </div>
                  {p.id === "studio-monthly" && (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-neutral-200">
                      POPULAR
                    </span>
                  )}
                </div>
                <p className="mt-3 text-3xl font-semibold">
                  ${p.priceUsd}
                  <span className="text-sm font-normal text-neutral-500"> / month</span>
                </p>
                <ul className="mt-4 space-y-2">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px] text-neutral-300">
                      <Check size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => void checkout("subscription", p.id)}
                  disabled={busyId !== null || isActive}
                  className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-white/10 text-neutral-400 border border-white/10 cursor-not-allowed"
                      : "bg-white text-black hover:bg-neutral-200"
                  }`}
                >
                  {busyId === p.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                  {isActive ? "Your Active Plan" : `Subscribe to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
 
          {/* Credit packs */}
          <div className="space-y-4">
            <p className="eyebrow">Top up credits</p>
            <div className="space-y-3">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-medium">{pack.credits.toLocaleString()} credits</p>
                    <p className="text-[11px] text-neutral-500">{pack.label}</p>
                  </div>
                  <button
                    onClick={() => void checkout("credits", pack.id)}
                    disabled={busyId !== null}
                    className="flex min-w-[76px] items-center justify-center rounded-full border border-line px-4 py-2 text-xs font-medium hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    {busyId === pack.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      `$${pack.priceUsd}`
                    )}
                  </button>
                </div>
              ))}
            </div>
            <p className="pt-1 text-[11px] leading-relaxed text-neutral-600">
              Payments are processed securely by ModemPay. Credits are added to
              your account the moment your payment is confirmed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
 
export default function BillingPage() {
  return (
    <Suspense>
      <BillingInner />
    </Suspense>
  );
}
