"use client";

// Wallet & billing. Optiq is pay-as-you-go: there are no subscriptions, so this
// page is about one thing — the GMD balance, what it gets spent on, and topping
// it up. Rates shown here are read from the same numbers the functions charge.

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Receipt, Wallet, ShieldCheck } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";

interface Transaction {
  id: string;
  date: string;
  description: string;
  invoiceId: string;
  method: string;
  status: string;
  amount: string;
}

/** One price per ad — the storyboard AND every scene render are included. */
const AD_RATES = [
  { label: "30-second ad", detail: "3 scenes", total: 450 },
  { label: "60-second ad", detail: "6 scenes", total: 900 },
  { label: "90-second ad", detail: "9 scenes", total: 1350 },
];

/** Direct Studio rates, mirrored from the functions pricing table. */
const ASSET_RATES = [
  { label: "Video", detail: "per second", price: "GMD 15" },
  { label: "Video", detail: "10-second clip", price: "GMD 150" },
  { label: "Image", detail: "per generation", price: "GMD 50" },
  { label: "Voice", detail: "per 100 characters", price: "GMD 10" },
  { label: "Character sheet", detail: "per set", price: "GMD 150" },
];

function BillingInner() {
  const { profile, apiFetch, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get("status");

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
    if (profile) loadTransactions();
  }, [profile, loadTransactions]);

  // The webhook may land a moment after we return from checkout.
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

  const balance = profile?.credits ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      {/* pt-24 clears the fixed FloatingChrome pills (logo + account) */}
      <div className="mx-auto max-w-4xl px-5 pb-16 pt-24 sm:px-8">
        <div className="flex items-center gap-3">
          <Wallet className="text-neutral-400" size={22} />
          <div>
            <h1 className="text-[22px] font-bold tracking-tight sm:text-[24px]">Wallet</h1>
            <p className="mt-0.5 text-xs text-neutral-500">
              Pay only for what you make. No subscription, and your balance never expires.
            </p>
          </div>
        </div>

        {status === "success" && (
          <div className="mt-6 rounded-xl border border-emerald-950 bg-emerald-950/30 px-4 py-3.5 text-xs text-emerald-300">
            Payment received — your balance updates within a few seconds of confirmation.
          </div>
        )}
        {status === "cancelled" && (
          <div className="mt-6 rounded-xl border border-neutral-900 bg-neutral-950 px-4 py-3.5 text-xs text-neutral-400">
            Checkout cancelled. No charge was made.
          </div>
        )}
        {/* ── BALANCE + TOP UP ──────────────────────────────────────────── */}
        <div className="mt-8 rounded-2xl border border-white/5 bg-surface p-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-500">
            Current balance
          </p>
          <p className="mt-2 font-display text-4xl font-extrabold tracking-tight tabular-nums text-white sm:text-5xl">
            <span className="mr-1.5 align-top text-lg font-bold text-neutral-500">GMD</span>
            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>

          {/* Topping up lives in one place — the paywall — so there is a single
              amount entry and a single checkout path to maintain. */}
          <button
            onClick={() => router.push("/plans?topup=1")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.99]"
          >
            <Wallet size={16} />
            Top up wallet
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-neutral-500">
            <ShieldCheck size={11} /> Card or mobile money, secured by ModemPay
          </p>
        </div>

        {/* ── WHAT THINGS COST ──────────────────────────────────────────── */}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/5 bg-surface/60 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Complete ads</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
              One price covers the script, the cast and every scene rendered.
            </p>
            <div className="mt-4 space-y-2.5">
              {AD_RATES.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between border-b border-white/[0.04] pb-2.5 last:border-0"
                >
                  <span className="text-xs text-neutral-200">
                    {r.label}
                    <span className="ml-1.5 text-[10px] text-neutral-500">{r.detail}</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    GMD {r.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-surface/60 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Direct Studio</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
              Single assets generated outside an ad, charged per request.
            </p>
            <div className="mt-4 space-y-2.5">
              {ASSET_RATES.map((r) => (
                <div
                  key={`${r.label}-${r.detail}`}
                  className="flex items-center justify-between border-b border-white/[0.04] pb-2.5 last:border-0"
                >
                  <span className="text-xs text-neutral-200">
                    {r.label}
                    <span className="ml-1.5 text-[10px] text-neutral-500">{r.detail}</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-white">{r.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── HISTORY ───────────────────────────────────────────────────── */}
        <div className="mt-12 border-t border-white/5 pt-10">
          <div className="mb-4 flex items-center gap-2">
            <Receipt className="text-neutral-400" size={15} />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400">
              Payment history
            </h3>
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 font-mono text-xs uppercase tracking-wider text-neutral-500">
              <Loader2 className="animate-spin text-neutral-400" size={14} />
              Loading…
            </div>
          ) : transactions.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-white/5 bg-surface/60">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/5 bg-background font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="hidden px-4 py-3 font-semibold sm:table-cell">Method</th>
                      <th className="hidden px-4 py-3 font-semibold sm:table-cell">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-neutral-300">
                    {transactions.map((tx) => (
                      <tr key={tx.id || tx.invoiceId} className="transition-colors hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-neutral-400">{tx.date}</td>
                        <td className="px-4 py-3 font-medium text-neutral-200">{tx.description}</td>
                        <td className="hidden px-4 py-3 text-neutral-400 sm:table-cell">{tx.method}</td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                              tx.status?.toLowerCase() === "succeeded"
                                ? "border border-emerald-900 bg-emerald-950/40 text-emerald-400"
                                : "border border-neutral-800 bg-neutral-950 text-neutral-400"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        {/* Amounts are already GMD — shown exactly as recorded */}
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-mono font-bold ${
                            tx.amount?.trim().startsWith("-") ? "text-neutral-400" : "text-emerald-400"
                          }`}
                        >
                          {tx.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-white/5 bg-background p-8 text-center">
              <p className="font-mono text-xs uppercase tracking-wider text-neutral-500">No transactions yet</p>
              <button
                onClick={() => router.push("/plans")}
                className="mt-3 text-xs font-bold text-blue-400 hover:underline"
              >
                See what things cost
              </button>
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
