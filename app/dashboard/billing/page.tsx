"use client";
 
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Zap, CreditCard, Receipt, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
 
const PLAN_FEATURES_MAP: Record<string, string[]> = {
  "pro-monthly": [
    "GMD 1,000.00 wallet credit every month",
    "Gemini Omni Flash video generation",
    "Flat rate of GMD 100.00 per direct generation",
    "Character consistency tools",
    "Voice Studio with all profiles",
    "Standard rendering queue",
  ],
  "studio-monthly": [
    "GMD 2,500.00 wallet credit every month",
    "Gemini Omni Flash video generation",
    "Flat rate of GMD 100.00 per direct generation",
    "Character consistency tools",
    "Voice Studio with all profiles",
    "2x faster priority queue",
    "Dedicated rendering slots",
  ],
  "enterprise-monthly": [
    "GMD 4,500.00 wallet credit every month",
    "Gemini Omni Flash video generation",
    "Flat rate of GMD 100.00 per direct generation",
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
  const isSubscribed = profile?.planStatus === "active";

  const convertTxAmount = (amount: string) => {
    const clean = amount.replace(/[^0-9.]/g, "");
    const num = parseFloat(clean);
    if (!isNaN(num)) {
      if (num === 100) return "GMD 7,000.00";
      if (num === 50) return "GMD 3,500.00";
      if (num === 12 || num === 15) return "GMD 1,000.00";
      if (num === 1000) return "GMD 7,000.00";
      if (num === 500) return "GMD 3,500.00";
      if (num === 10000) return "GMD 7,000.00";
      return `GMD ${(num * 70).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return amount.replace("$", "GMD ");
  };

  const gmdPacks = [
    { id: "pack-1000", credits: 1000, priceGmd: 1000, label: "Starter Top-up (GMD 1,000)" },
    { id: "pack-5000", credits: 3500, priceGmd: 3500, label: "Creator Top-up (GMD 3,500)" },
    { id: "pack-12000", credits: 7000, priceGmd: 7000, label: "Studio Top-up (GMD 7,000)" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <div className="mx-auto max-w-5xl px-8 py-10">
        
        {/* Header Title */}
        <div className="flex items-center gap-3">
          <CreditCard className="text-neutral-400" size={24} />
          <div>
            <h1 className="text-[24px] font-bold tracking-tight">Plans & Wallet</h1>
            <p className="mt-1 text-xs text-neutral-500">
              Your wallet balance powers every generation. Top up with Gambian Dalasis (GMD) to fund your creative campaign pipeline.
            </p>
          </div>
        </div>

        {status === "success" && (
          <div className="mt-6 rounded-xl border border-emerald-950 bg-emerald-950/30 px-4 py-3.5 text-xs text-emerald-300">
            Payment received — your balance will appear in your wallet within a few seconds of confirmation.
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
        <div className="mt-8 flex items-center justify-between rounded-xl border border-neutral-900 bg-surface px-6 py-5 shadow-inner">
          <div>
            <p className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">
              CURRENT WALLET BALANCE
            </p>
            <p className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums text-white">
              GMD {profile ? profile.credits.toLocaleString() : "—"}
              <span className="ml-2 text-xs font-normal font-mono text-neutral-500 uppercase tracking-wider">
                GMD Balance
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">
              ACTIVE ACCOUNT PLAN
            </p>
            <p className="mt-2 text-sm font-semibold text-neutral-200">
              Optiq Studio Production Workspace
            </p>
          </div>
        </div>

        {/* Platform Production Rates Section */}
        <div className="mt-10">
          <p className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest mb-4">
            Platform Production Rates & Pricing (GMD)
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Cinematic Production Videos Card */}
            <div className="rounded-2xl border border-white/5 bg-surface/60 p-6 flex flex-col justify-between">
              <div>
                <span className="rounded bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-[8px] font-bold font-mono text-neutral-300 uppercase tracking-widest">
                  Cinematic Ads
                </span>
                <h3 className="mt-3 text-sm font-bold text-white uppercase tracking-wider">Multi-Scene Director Specs</h3>
                <p className="mt-1 text-[10px] text-neutral-500">Fully synthesized multi-scene advertising campaigns matching your exact brand accents and actors.</p>
                
                <div className="mt-6 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-white/[0.02] pb-2">
                    <span className="text-xs text-neutral-300">30-Second Commercial Spec</span>
                    <span className="text-xs font-mono font-bold text-white">GMD 450.00</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.02] pb-2">
                    <span className="text-xs text-neutral-300">60-Second Commercial Spec</span>
                    <span className="text-xs font-mono font-bold text-white">GMD 900.00</span>
                  </div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs text-neutral-300">90-Second Commercial Spec</span>
                    <span className="text-xs font-mono font-bold text-white">GMD 1,350.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Assets Card */}
            <div className="rounded-2xl border border-white/5 bg-surface/60 p-6 flex flex-col justify-between">
              <div>
                <span className="rounded bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-[8px] font-bold font-mono text-neutral-300 uppercase tracking-widest">
                  Individual Assets
                </span>
                <h3 className="mt-3 text-sm font-bold text-white uppercase tracking-wider">A-La-Carte Syntheses</h3>
                <p className="mt-1 text-[10px] text-neutral-500">Direct studio asset generation rates. Charged per single generation request from your wallet balance.</p>
                
                <div className="mt-6 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-white/[0.02] pb-2">
                    <span className="text-xs text-neutral-300">6-Second Premium B-Roll Clip</span>
                    <span className="text-xs font-mono font-bold text-white">GMD 300.00</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.02] pb-2">
                    <span className="text-xs text-neutral-300">10-Second Premium B-Roll Clip</span>
                    <span className="text-xs font-mono font-bold text-white">GMD 500.00</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.02] pb-2">
                    <span className="text-xs text-neutral-300">Brand Style Logo / Creative AI Image</span>
                    <span className="text-xs font-mono font-bold text-white">GMD 50.00</span>
                  </div>
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-xs text-neutral-300">Custom Audio track / Voiceover Synthesis</span>
                    <span className="text-xs font-mono font-bold text-white">GMD 100.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Credit Packs Section */}
        <div className="mt-12">
          <p className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-widest mb-4">
            Top up wallet balance
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {gmdPacks.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-col justify-between rounded-xl border border-neutral-900 bg-surface/60 p-4 hover:border-neutral-800 transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-white">GMD {pack.priceGmd.toLocaleString()}.00</p>
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
                    `Purchase Pack`
                  )}
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-neutral-500 font-sans">
            Payments are processed securely by ModemPay. Balance is added to your wallet immediately once confirmed.
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
            <div className="rounded-xl border border-neutral-900 bg-surface/60 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-neutral-900 bg-background text-neutral-500 font-mono text-[9px] uppercase tracking-wider">
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
                          {convertTxAmount(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-900 bg-background p-6 text-center text-neutral-500 text-xs font-mono uppercase tracking-wider">
              No transactions found on this account yet. Top up your wallet or subscribe above to see receipts.
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
