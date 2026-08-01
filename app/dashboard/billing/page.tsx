"use client";

// Wallet & billing. Optiq is pay-as-you-go: there are no subscriptions, so this
// page is about one thing — the GMD balance, what it gets spent on, and topping
// it up. Rates shown here are read from the same numbers the functions charge.

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Receipt, Wallet, ShieldCheck, RefreshCw } from "lucide-react";
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

function BillingInner() {
  const { profile, apiFetch, pricing, refreshProfile } = useAuth();

  /** Direct Studio rates, read from the same table the functions charge. */
  const ASSET_RATES = React.useMemo(() => {
    const c = pricing?.costs;
    const perSecond = c?.videoPerSecond?.omni ?? 15;
    const musicSecs = c?.musicDefaultSeconds ?? 30;
    return [
      { label: "Video", detail: "per second", price: `GMD ${perSecond}` },
      { label: "Video", detail: "10-second clip", price: `GMD ${perSecond * 10}` },
      { label: "Image", detail: "per generation", price: `GMD ${c?.image ?? 10}` },
      {
        label: "Voice",
        detail: "per 100 characters",
        price: `GMD ${Math.round((c?.ttsPerCharacter ?? 0.05) * 100)}`,
      },
      {
        label: "Music",
        detail: `per ${musicSecs}s track`,
        price: `GMD ${Math.ceil((c?.musicPerSecond ?? 2) * musicSecs)}`,
      },
    ];
  }, [pricing]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const status = searchParams.get("status");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<string | null>(null);

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

  // Safety net: re-checks ModemPay for paid-but-uncredited charges and claims
  // them. Idempotent server-side, so pressing it twice cannot double-credit.
  const recoverPayment = async () => {
    setRecovering(true);
    setRecoverMsg(null);
    try {
      const r = await apiFetch<{ credited: number; creditedGmd: number }>(
        "/api/payments/reconcile",
        { method: "POST", body: "{}" }
      );
      if (r.credited > 0) {
        setRecoverMsg(`Recovered GMD ${r.creditedGmd.toLocaleString()} — balance updated.`);
        await refreshProfile();
        loadTransactions();
      } else {
        setRecoverMsg("No missing payments found. Everything you have paid for is on your balance.");
      }
    } catch (err) {
      setRecoverMsg(err instanceof Error ? err.message : "Could not check payments.");
    } finally {
      setRecovering(false);
    }
  };

  const balance = profile?.credits ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      {/* pt-24 clears the fixed FloatingChrome pills (logo + account) */}
      <div className="mx-auto max-w-4xl px-5 pb-16 pt-24 sm:px-8">
        <div className="flex items-center gap-3">
          <Wallet className="text-ink-3" size={22} />
          <div>
            <h1 className="text-[22px] font-bold tracking-tight sm:text-[24px]">Wallet</h1>
            <p className="mt-0.5 text-xs text-muted">
              Pay only for what you make. No subscription, and your balance never expires.
            </p>
          </div>
        </div>

        {status === "success" && (
          <div className="mt-6 rounded-2xl border border-emerald-950 bg-success-soft px-4 py-3.5 text-xs text-success">
            Payment received — your balance updates within a few seconds of confirmation.
          </div>
        )}
        {status === "cancelled" && (
          <div className="mt-6 rounded-2xl border border-line bg-background px-4 py-3.5 text-xs text-ink-3">
            Checkout cancelled. No charge was made.
          </div>
        )}
        {/* ── BALANCE + TOP UP ──────────────────────────────────────────── */}
        <div className="mt-8 rounded-3xl border border-line bg-surface p-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            Current balance
          </p>
          <p className="mt-2 font-display text-4xl font-extrabold tracking-tight tabular-nums text-foreground sm:text-5xl">
            <span className="mr-1.5 align-top text-lg font-bold text-muted">GMD</span>
            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>

          {/* Topping up lives in one place — the paywall — so there is a single
              amount entry and a single checkout path to maintain. */}
          <button
            onClick={() => router.push("/plans?topup=1")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-3xl bg-foreground py-4 text-sm font-bold text-background transition-all hover:bg-ink-2 active:scale-[0.99]"
          >
            <Wallet size={16} />
            Top up wallet
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-muted">
            <ShieldCheck size={11} /> Card or mobile money, secured by ModemPay
          </p>

          <div className="mt-5 border-t border-line pt-4">
            <button
              onClick={recoverPayment}
              disabled={recovering}
              className="flex w-full items-center justify-center gap-2 text-[11px] font-semibold text-ink-3 transition-colors hover:text-foreground disabled:opacity-50"
            >
              {recovering ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              Paid but balance not updated? Recover it
            </button>
            {recoverMsg && (
              <p className="mt-2.5 text-center text-[11px] text-ink-2">{recoverMsg}</p>
            )}
          </div>
        </div>

        {/* ── WHAT THINGS COST ──────────────────────────────────────────── */}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-[28px] border border-line bg-surface/60 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Complete ads</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              One price covers the script, the cast and every scene rendered.
            </p>
            <div className="mt-4 space-y-2.5">
              {AD_RATES.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between border-b border-white/[0.04] pb-2.5 last:border-0"
                >
                  <span className="text-xs text-foreground">
                    {r.label}
                    <span className="ml-1.5 text-[10px] text-muted">{r.detail}</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    GMD {r.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-surface/60 p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Direct Studio</h3>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              Single assets generated outside an ad, charged per request.
            </p>
            <div className="mt-4 space-y-2.5">
              {ASSET_RATES.map((r) => (
                <div
                  key={`${r.label}-${r.detail}`}
                  className="flex items-center justify-between border-b border-white/[0.04] pb-2.5 last:border-0"
                >
                  <span className="text-xs text-foreground">
                    {r.label}
                    <span className="ml-1.5 text-[10px] text-muted">{r.detail}</span>
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground">{r.price}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── HISTORY ───────────────────────────────────────────────────── */}
        <div className="mt-12 border-t border-line pt-10">
          <div className="mb-4 flex items-center gap-2">
            <Receipt className="text-ink-3" size={15} />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-ink-3">
              Payment history
            </h3>
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 font-mono text-xs uppercase tracking-wider text-muted">
              <Loader2 className="animate-spin text-ink-3" size={14} />
              Loading…
            </div>
          ) : transactions.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface/60">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-line bg-background font-mono text-[9px] uppercase tracking-wider text-muted">
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="hidden px-4 py-3 font-semibold sm:table-cell">Method</th>
                      <th className="hidden px-4 py-3 font-semibold sm:table-cell">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-ink-2">
                    {transactions.map((tx) => (
                      <tr key={tx.id || tx.invoiceId} className="transition-colors hover:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-ink-3">{tx.date}</td>
                        <td className="px-4 py-3 font-medium text-foreground">{tx.description}</td>
                        <td className="hidden px-4 py-3 text-ink-3 sm:table-cell">{tx.method}</td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase ${
                              tx.status?.toLowerCase() === "succeeded"
                                ? "border border-emerald-900 bg-emerald-950/40 text-success"
                                : "border border-line bg-background text-ink-3"
                            }`}
                          >
                            {tx.status}
                          </span>
                        </td>
                        {/* Amounts are already GMD — shown exactly as recorded */}
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-mono font-bold ${
                            tx.amount?.trim().startsWith("-") ? "text-ink-3" : "text-success"
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
            <div className="rounded-3xl border border-line bg-background p-8 text-center">
              <p className="font-mono text-xs uppercase tracking-wider text-muted">No transactions yet</p>
              <button
                onClick={() => router.push("/plans")}
                className="mt-3 text-xs font-bold text-accent-ink hover:underline"
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
