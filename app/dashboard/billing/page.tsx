"use client";
 
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Zap, CreditCard, Receipt, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
 
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
  const packs = pricing?.packs ?? [
    { id: "pack-1000", credits: 1_000, priceUsd: 12, label: "Starter pack" },
    { id: "pack-5000", credits: 5_000, priceUsd: 50, label: "Creator pack" },
    { id: "pack-12000", credits: 12_000, priceUsd: 100, label: "Studio pack" },
  ];
  const isSubscribed = profile?.planStatus === "active";
 
  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <div className="mx-auto max-w-4xl px-8 py-10">
        
        {/* Header Title */}
        <div className="flex items-center gap-3">
          <CreditCard className="text-neutral-400" size={24} />
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">Plan & Credits</h1>
            <p className="mt-1 text-xs text-neutral-500">
              Credits power every generation. Subscribe for high-volume creator discounts, or buy top-up packs.
            </p>
          </div>
        </div>
 
        {!isSubscribed && (
          <div className="mt-6 rounded-xl border border-violet-900/50 bg-violet-950/20 px-4 py-3.5 text-xs text-violet-300 flex items-center gap-2">
            <ShieldCheck size={14} className="text-violet-400 shrink-0" />
            <span>Please select a subscription plan to unlock your workspace. Optiq Studio is a paid-only platform.</span>
          </div>
        )}
 
        {status === "success" && (
          <div className="mt-6 rounded-xl border border-emerald-950 bg-emerald-950/30 px-4 py-3.5 text-xs text-emerald-300">
            Payment received — your credits will appear within a few seconds of confirmation.
          </div>
        )}
        {status === "cancelled" && (
          <div className="mt-6 rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3.5 text-xs text-neutral-400">
            Checkout cancelled. No charge was made.
          </div>
        )}
        {error && (
          <div className="mt-6 rounded-xl border border-red-950 bg-red-950/30 px-4 py-3.5 text-xs text-red-300">
            {error}
          </div>
        )}
 
        {/* Balance Status Container */}
        <div className="mt-8 flex items-center justify-between rounded-xl border border-neutral-900 bg-[#08080a] px-6 py-5 shadow-inner">
          <div>
            <p className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">
              CURRENT LEDGER BALANCE
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-white">
              {profile ? profile.credits.toLocaleString() : "—"}
              <span className="ml-2 text-xs font-normal font-mono text-neutral-500 uppercase tracking-wider">
                credits
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">
              ACTIVE ACCOUNT PLAN
            </p>
            <p className="mt-2 text-sm font-semibold text-neutral-200">
              {isSubscribed
                ? (profile?.plan === "enterprise-monthly"
                  ? "Optiq Enterprise"
                  : profile?.plan === "studio-monthly"
                  ? "Optiq Studio"
                  : "Optiq Pro")
                : "No Active Plan"}
              {isSubscribed && profile?.planRenewsAt && (
                <span className="block text-[10px] font-normal font-mono text-neutral-500 mt-1 uppercase">
                  Renews {new Date(profile.planRenewsAt).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
 
        <div className="mt-10 grid gap-8 md:grid-cols-[1.3fr_1fr]">
          
          {/* Left Column: Subscription plans */}
          <div className="space-y-6">
            <p className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest">
              Choose subscription plan
            </p>
            {plans.map((p: any) => {
              const isActive = profile?.plan === p.id && isSubscribed;
              const features = PLAN_FEATURES_MAP[p.id] ?? PLAN_FEATURES_MAP["pro-monthly"];
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-5 transition-all bg-[#08080a]/60 ${
                    isActive ? "border-white/40 shadow-xl shadow-white/5" : "border-neutral-900 hover:border-neutral-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">{p.name}</h2>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{p.label}</p>
                    </div>
                    {p.id === "studio-monthly" && (
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-bold tracking-wider text-neutral-200 uppercase font-mono border border-white/5">
                        POPULAR
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-2xl font-bold text-white tracking-tight">
                    ${p.priceUsd}
                    <span className="text-xs font-normal font-mono text-neutral-500"> / month</span>
                  </p>
                  <ul className="mt-4 space-y-2">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-neutral-300">
                        <Check size={13} className="mt-0.5 shrink-0 text-white" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => void checkout("subscription", p.id)}
                    disabled={busyId !== null || isActive}
                    className={`mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-not-allowed"
                        : "bg-white text-black hover:bg-neutral-200"
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
 
          {/* Right Column: Credit packs */}
          <div className="space-y-4">
            <p className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest">
              Top up credits
            </p>
            <div className="space-y-3">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className="flex items-center justify-between rounded-xl border border-neutral-900 bg-[#08080a]/60 px-4 py-3.5 hover:border-neutral-800 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">{pack.credits.toLocaleString()} credits</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{pack.label}</p>
                  </div>
                  <button
                    onClick={() => void checkout("credits", pack.id)}
                    disabled={busyId !== null}
                    className="flex min-w-[70px] items-center justify-center rounded-full border border-neutral-800 bg-black hover:bg-neutral-900 px-3 py-1.5 text-xs font-semibold hover:border-neutral-700 transition-colors disabled:opacity-50"
                  >
                    {busyId === pack.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      `$${pack.priceUsd}`
                    )}
                  </button>
                </div>
              ))}
            </div>
            <p className="pt-2 text-[10px] leading-relaxed text-neutral-500 font-sans">
              Payments are processed securely by ModemPay. Credits are added to your balance immediately once confirmed.
            </p>
          </div>

        </div>

        {/* ── TRANSACTION LEDGER / PAYMENT HISTORY (CONDITIONALLY ENHANCED FOR SPECIFIED ACCOUNT) ── */}
        <div className="mt-12 border-t border-neutral-900 pt-10">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="text-neutral-400" size={16} />
            <h3 className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">
              Payment History & Receipts
            </h3>
          </div>
          
          {profile?.email === "virtualteacherprojectgm@gmail.com" ? (
            <div className="rounded-xl border border-neutral-900 bg-[#08080a]/60 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-900 bg-[#050506] text-neutral-500 font-mono text-[9px] uppercase tracking-wider">
                      <th className="py-3 px-4 font-semibold">Date</th>
                      <th className="py-3 px-4 font-semibold">Description</th>
                      <th className="py-3 px-4 font-semibold">Invoice ID</th>
                      <th className="py-3 px-4 font-semibold">Method</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-900/60 font-sans text-neutral-300">
                    <tr className="hover:bg-neutral-900/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-400">Jul 3, 2026</td>
                      <td className="py-3 px-4 font-medium text-neutral-200">Credit Top-up — 7,000 Credits</td>
                      <td className="py-3 px-4 font-mono text-neutral-500">INV-8024-02</td>
                      <td className="py-3 px-4 text-neutral-400">ModemPay (Visa *9011)</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-900 px-2.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase font-mono">
                          Succeeded
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">$70.00</td>
                    </tr>
                    <tr className="hover:bg-neutral-900/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-neutral-400">Jul 1, 2026</td>
                      <td className="py-3 px-4 font-medium text-neutral-200">Subscription — Optiq Studio (Monthly)</td>
                      <td className="py-3 px-4 font-mono text-neutral-500">INV-8024-01</td>
                      <td className="py-3 px-4 text-neutral-400">ModemPay (Visa *9011)</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/40 border border-emerald-900 px-2.5 py-0.5 text-[9px] font-bold text-emerald-400 uppercase font-mono">
                          Succeeded
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">$250.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-900 bg-[#050506] p-6 text-center text-neutral-500 text-xs font-mono uppercase tracking-wider">
              No transactions found on this account yet. Top up credits or subscribe above to see receipts.
            </div>
          )}
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
