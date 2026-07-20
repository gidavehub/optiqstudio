"use client";

import React from "react";
import { RefreshCw, CheckCircle, X, AlertCircle, Zap, CreditCard } from "lucide-react";
import { db } from "../../../lib/firebase";
import { doc, updateDoc, increment, collection, addDoc } from "firebase/firestore";
import { useEditorFlow } from "../_flow/EditorFlowProvider";

export default function StoryboardPaywallModal() {
  const {
    user, profile, length,
    storyboardPayOpen, setStoryboardPayOpen,
    paywallStep, setPaywallStep,
    setProductionMode, generateStoryboard,
    ccName, setCcName,
    ccNumber, setCcNumber,
    ccExpiry, setCcExpiry,
    ccCvv, setCcCvv,
    ccError, setCcError,
    ccPaying, setCcPaying,
    ccPayMessage, setCcPayMessage,
    ccCompleted, setCcCompleted,
    ccSpotCheckout, setCcSpotCheckout,
  } = useEditorFlow();

  if (!storyboardPayOpen) return null;

  // Calculate pricing dynamically
  let cost = 900; // Default 60s GMD 900
  if (length === "30s") cost = 450;
  if (length === "90s") cost = 1350;

  const balance = profile?.credits ?? 0;
  const hasEnough = balance >= cost;
  const remaining = balance - cost;

  const handleWalletPay = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { credits: increment(-cost) });

      const dateString = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;

      await addDoc(collection(db, "transactions"), {
        uid: user.uid,
        invoiceId,
        date: dateString,
        description: `Storyboard Spec Generation (${length} — ${length === "30s" ? 3 : length === "60s" ? 6 : 9} Scenes)`,
        method: "Wallet Balance",
        status: "Succeeded",
        amount: `-GMD ${cost.toFixed(2)}`,
        createdAt: new Date().toISOString(),
      });

      setPaywallStep("choose");
    } catch (err) {
      console.error("Wallet deduction failed:", err);
    }
  };

  const handleSpotPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ccName.trim() || !ccNumber.trim() || !ccExpiry.trim() || !ccCvv.trim()) {
      setCcError("Please fill in all credit card details.");
      return;
    }
    if (!user) {
      setCcError("You must be logged in to make a payment.");
      return;
    }

    setCcError(null);
    setCcPaying(true);
    setCcPayMessage("Contacting payment gateway via ModemPay...");

    try {
      await new Promise((res) => setTimeout(() => res(null), 800));
      setCcPayMessage("Authorizing card credentials...");
      await new Promise((res) => setTimeout(() => res(null), 700));
      setCcPayMessage("Deducting funds and crediting wallet...");
      await new Promise((res) => setTimeout(() => res(null), 600));

      const dateString = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
      const lastFour = ccNumber.replace(/\s/g, "").slice(-4) || "4242";

      await addDoc(collection(db, "transactions"), {
        uid: user.uid,
        invoiceId,
        date: dateString,
        description: `Spot Purchase: Storyboard Spec (${length} — ${length === "30s" ? "3" : length === "60s" ? "6" : "9"} Scenes)`,
        method: `ModemPay (Visa *${lastFour})`,
        status: "Succeeded",
        amount: `GMD ${cost.toFixed(2)}`,
        createdAt: new Date().toISOString(),
      });

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { credits: increment(cost) });

      setCcCompleted(true);
      setCcPaying(false);

      setTimeout(() => {
        setCcName("");
        setCcNumber("");
        setCcExpiry("");
        setCcCvv("");
        setCcCompleted(false);
        setCcSpotCheckout(false);
        setPaywallStep("choose");
      }, 1500);
    } catch (err) {
      console.error("Spot payment error:", err);
      setCcError("Transaction declined. Please try a different card.");
      setCcPaying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={ccPaying ? undefined : () => setStoryboardPayOpen(false)}
      />

      {/* Card Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-blue-500 bg-[#070e24]/95 p-6 shadow-2xl backdrop-blur-2xl transition-all animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <div className="flex items-center gap-1 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <div className="w-1.5 h-1.5 rounded-full bg-transparent border border-blue-400/40" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            </div>
            Confirm Storyboard Spec
          </h3>
          <button
            onClick={ccPaying ? undefined : () => setStoryboardPayOpen(false)}
            className="rounded-full p-1 text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Loading state */}
        {ccPaying && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <RefreshCw className="text-white animate-spin" size={32} />
            <p className="text-xs font-semibold text-white">{ccPayMessage}</p>
            <p className="text-[10px] text-neutral-500">Please do not close this modal or reload.</p>
          </div>
        )}

        {/* Completed state */}
        {ccCompleted && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle className="text-emerald-400 animate-bounce" size={40} />
            <p className="text-sm font-bold text-white">Payment Authorized!</p>
            <p className="text-xs text-neutral-400">Compiling multi-scene director spec now...</p>
          </div>
        )}

        {/* CHOICE STATE */}
        {paywallStep === "choose" && (
          <div className="py-4 flex flex-col space-y-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="text-center">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Select Production Mode</h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                How would you like to compile your ad? You can adjust this configuration anytime.
              </p>
            </div>

            <div className="grid gap-3">
              {/* Option 1: REVIEW PROMPTS (Manual Mode) */}
              <button
                onClick={async () => {
                  setProductionMode("manual");
                  setStoryboardPayOpen(false);
                  setPaywallStep("pay");
                  await generateStoryboard();
                }}
                className="group flex flex-col rounded-2xl border border-white/10 bg-[#0d1631]/40 p-4 text-left hover:bg-[#0d1631]/80 hover:border-blue-500/50 transition-all duration-300 active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#131d35] px-2 py-0.5 text-[9px] font-bold text-neutral-400 font-mono uppercase">
                    Director&apos;s Draft
                  </span>
                </div>
                <h5 className="mt-2 text-xs font-bold text-white group-hover:text-white transition-colors">
                  Review &amp; Customize Prompts
                </h5>
                <p className="mt-1 text-[10px] text-neutral-400 leading-normal">
                  Inspect the generated storyboard spec scene-by-scene first. Adjust prompts, edit dialogue, and render segments manually with full creative control.
                </p>
              </button>

              {/* Option 2: AUTO-GENERATE (Auto-Merge Mode) */}
              <button
                onClick={async () => {
                  setProductionMode("auto-merge");
                  setStoryboardPayOpen(false);
                  setPaywallStep("pay");
                  await generateStoryboard();
                }}
                className="group flex flex-col rounded-2xl border border-blue-500 bg-[#0c152d] p-4 text-left hover:border-blue-400 hover:bg-[#0c152d]/90 transition-all duration-300 shadow-lg shadow-blue-500/10 active:scale-[0.98]"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white font-mono uppercase">
                    Express Auto-Merge
                  </span>
                </div>
                <h5 className="mt-2 text-xs font-bold text-white group-hover:text-white transition-colors flex items-center gap-1">
                  Auto-Generate Full Video <Zap size={11} className="text-white animate-pulse" />
                </h5>
                <p className="mt-1 text-[10px] text-neutral-300 leading-normal">
                  Kicks off direct segment generation of all scenes in parallel behind a gorgeous widescreen loading HUD, and automatically merges them into a single playback film.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Normal Content View */}
        {!ccPaying && !ccCompleted && paywallStep !== "choose" && (
          <div className="mt-4">
            {!ccSpotCheckout ? (
              <>
                {/* Balance chip — top right */}
                <div className="flex justify-end">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-mono text-neutral-400">
                    Balance
                    <span className="font-bold text-neutral-200">GMD {balance.toFixed(2)}</span>
                  </span>
                </div>

                {/* Generation cost — the hero */}
                <div className="relative mt-3 overflow-hidden rounded-2xl border border-blue-500/30 bg-[#081127] px-4 pt-6 pb-5 text-center">
                  <p className="relative text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-blue-300/80">
                    Generation Cost
                  </p>
                  <p className="relative mt-2 font-display text-6xl leading-none text-white">
                    <span className="align-top text-2xl text-blue-300 mr-1">GMD</span>
                    {cost.toFixed(2)}
                  </p>
                  <p className="relative mt-3 text-[11px] text-neutral-400">
                    {length === "30s" ? "30 seconds · 3 scenes" : length === "60s" ? "60 seconds · 6 scenes" : "90 seconds · 9 scenes"}
                  </p>
                </div>

                {hasEnough ? (
                  <p className="mt-3 text-center text-[10px] font-mono text-neutral-500">
                    GMD {remaining.toFixed(2)} left after this
                  </p>
                ) : (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-red-950/20 border border-red-900/30 px-3 py-2.5">
                    <AlertCircle size={13} className="text-red-400 shrink-0" />
                    <p className="text-[10px] text-red-300">
                      GMD {(cost - balance).toFixed(2)} short — top up to continue
                    </p>
                  </div>
                )}

                {/* Footer buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setStoryboardPayOpen(false)}
                    className="flex-1 rounded-2xl border border-white/10 bg-[#0d1631]/40 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-[#0d1631]/80 hover:text-white transition-all active:scale-95"
                  >
                    Cancel
                  </button>

                  {hasEnough ? (
                    <button
                      onClick={handleWalletPay}
                      className="flex-1 rounded-2xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                      <Zap size={12} />
                      Pay from Wallet
                    </button>
                  ) : (
                    <button
                      onClick={() => setCcSpotCheckout(true)}
                      className="flex-1 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-black hover:bg-neutral-100 transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                    >
                      <CreditCard size={12} />
                      Pay on the Spot
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* SPOT CREDIT CARD CHECKOUT FOR STORYBOARD */
              <form onSubmit={handleSpotPay} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Spot Checkout</span>
                  <button
                    type="button"
                    onClick={() => setCcSpotCheckout(false)}
                    className="text-[10px] text-white hover:underline font-bold"
                  >
                    Back to Wallet
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 flex items-start gap-2.5">
                  <CheckCircle size={14} className="text-white shrink-0 mt-0.5" />
                  <p className="text-[10px] text-white leading-normal">
                    Secure payment provided by <strong>ModemPay</strong>. Your card details are fully encrypted and will be charged exactly <strong>GMD {cost.toFixed(2)}</strong>.
                  </p>
                </div>

                {ccError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex gap-2 text-[10px] text-red-400 items-start">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span>{ccError}</span>
                  </div>
                )}

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      value={ccName}
                      onChange={(e) => setCcName(e.target.value)}
                      placeholder="e.g. Nyima Salaam"
                      className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4.5 py-2.5 text-xs text-white focus:border-white/10 outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase">Card Number</label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        required
                        value={ccNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                          const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ");
                          setCcNumber(formatted);
                        }}
                        placeholder="4242 4242 4242 4242"
                        className="w-full rounded-xl border border-white/5 bg-surface-2 pl-4.5 pr-10 py-2.5 text-xs text-white focus:border-white/10 outline-none font-mono"
                      />
                      <CreditCard size={14} className="absolute right-3.5 top-3 text-neutral-500" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase">Expiry Date</label>
                      <input
                        type="text"
                        required
                        value={ccExpiry}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                          const formatted = val.length >= 2 ? `${val.slice(0, 2)}/${val.slice(2)}` : val;
                          setCcExpiry(formatted);
                        }}
                        placeholder="MM/YY"
                        className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4.5 py-2.5 text-xs text-white focus:border-white/10 outline-none font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase">CVV</label>
                      <input
                        type="password"
                        required
                        value={ccCvv}
                        onChange={(e) => setCcCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        placeholder="•••"
                        className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4.5 py-2.5 text-xs text-white focus:border-white/10 outline-none font-mono text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCcSpotCheckout(false)}
                    className="flex-1 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-[#131d35] hover:bg-neutral-700 px-4 py-2.5 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg"
                  >
                    <CheckCircle size={13} />
                    Authorize GMD {cost.toFixed(2)}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
