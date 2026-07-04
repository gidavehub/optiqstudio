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
 
interface Transaction {
  id: string;
  date: string;
  description: string;
  invoiceId: string;
  method: string;
  status: string;
  amount: string;
}

function BillingInner() {
  const { profile, pricing, apiFetch, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const loadTransactions = React.useCallback(() => {
    apiFetch<{ items: Transaction[] }>("/api/transactions")
      .then((data) => {
        setTransactions(data.items || []);
        setTxLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load transactions:", err);
        setTxLoading(false);
      });
  }, [apiFetch]);

  useEffect(() => {
    if (profile) {
      loadTransactions();
    }
  }, [profile, loadTransactions]);
 
  // After returning from ModemPay checkout, the webhook may land a moment
  // later — refresh a few times so the new balance shows up.
  useEffect(() => {
    if (status === "success") {
      const timers = [0, 3000, 8000, 15000].map((ms) =>
        setTimeout(() => {
          void refreshProfile();
          loadTransactions();
        }, ms)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [status, refreshProfile, loadTransactions]);
 
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
      <div className="mx-auto max-w-5xl px-8 py-10">
        
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
 
        {/* Choose Subscription Plan Section */}
        <div className="mt-10">
          <p className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest mb-4">
            Choose subscription plan
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((p: any) => {
              const isActive = profile?.plan === p.id && isSubscribed;
              const features = PLAN_FEATURES_MAP[p.id] ?? PLAN_FEATURES_MAP["pro-monthly"];
              return (
                <div
                  key={p.id}
                  className={`flex flex-col justify-between rounded-xl border p-5 transition-all bg-[#08080a]/60 ${
                    isActive ? "border-white/40 shadow-xl shadow-white/5" : "border-neutral-900 hover:border-neutral-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-white">{p.name}</h2>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{p.label}</p>
                      </div>
                      {p.id === "studio-monthly" && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-bold tracking-wider text-neutral-200 uppercase font-mono border border-white/5">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-xl font-bold text-white tracking-tight">
                      ${p.priceUsd}
                      <span className="text-[10px] font-normal font-mono text-neutral-500"> / month</span>
                    </p>
                    <ul className="mt-4 space-y-2">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-1.5 text-[11px] text-neutral-300 leading-normal">
                          <Check size={12} className="mt-0.5 shrink-0 text-white" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => void checkout("subscription", p.id)}
                    disabled={busyId !== null || isActive}
                    className={`mt-6 flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-neutral-900 text-neutral-500 border border-neutral-800 cursor-not-allowed"
                        : "bg-white text-black hover:bg-neutral-200"
                    }`}
                  >
                    {busyId === p.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Zap size={12} />
                    )}
                    {isActive ? "Your Active Plan" : `Subscribe to ${p.name}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Credit Packs Section */}
        <div className="mt-12">
          <p className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest mb-4">
            Top up credits
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-col justify-between rounded-xl border border-neutral-900 bg-[#08080a]/60 p-4 hover:border-neutral-800 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{pack.credits.toLocaleString()} credits</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">{pack.label}</p>
                </div>
                <button
                  onClick={() => void checkout("credits", pack.id)}
                  disabled={busyId !== null}
                  className="mt-4 flex items-center justify-center rounded-full border border-neutral-800 bg-black hover:bg-neutral-900 px-4 py-2 text-xs font-semibold hover:border-neutral-700 transition-colors disabled:opacity-50 w-full"
                >
                  {busyId === pack.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    `Purchase · $${pack.priceUsd}`
                  )}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-neutral-500 font-sans">
            Payments are processed securely by ModemPay. Credits are added to your balance immediately once confirmed.
          </p>
        </div>

        {/* ── TRANSACTION LEDGER / PAYMENT HISTORY (DYNAMICALLY READ FROM FIRESTORE DATABASE) ── */}
        <div className="mt-12 border-t border-neutral-900 pt-10">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="text-neutral-400" size={16} />
            <h3 className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">
              Payment History & Receipts
            </h3>
          </div>
          
          {txLoading ? (
            <div className="flex items-center justify-center p-6 text-neutral-500 text-xs font-mono uppercase tracking-wider gap-2">
              <Loader2 className="animate-spin text-neutral-400" size={14} />
              Retrieving transaction ledger...
            </div>
          ) : transactions.length > 0 ? (
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
                    {transactions.map((tx) => (
                      <tr key={tx.id || tx.invoiceId} className="hover:bg-neutral-900/20 transition-colors">
                        <td className="py-3 px-4 font-mono text-neutral-400">{tx.date}</td>
                        <td className="py-3 px-4 font-medium text-neutral-200">{tx.description}</td>
                        <td className="py-3 px-4 font-mono text-neutral-500">{tx.invoiceId}</td>
                        <td className="py-3 px-4 text-neutral-400">{tx.method}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase font-mono ${
                            tx.status?.toLowerCase() === "succeeded"
                              ? "bg-emerald-950/40 border border-emerald-900 text-emerald-400"
                              : "bg-neutral-950 border border-neutral-800 text-neutral-400"
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {tx.amount?.startsWith("$") ? tx.amount : `$${tx.amount}`}
                        </td>
                      </tr>
                    ))}
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
