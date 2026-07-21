"use client";

// Confirms paying for a storyboard spec, then picks the production mode.
//
// The old "Pay on the Spot" card form is gone — it collected card details in
// plain text, faked authorization with setTimeouts and credited the wallet
// without charging anything. Short balances now go to the real paywall.

import React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, X, Zap, Wallet, Edit3 } from "lucide-react";
import { db } from "../../../lib/firebase";
import { doc, updateDoc, increment, collection, addDoc } from "firebase/firestore";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import { LENGTH_PRICING_GMD } from "../_flow/types";

export default function StoryboardPaywallModal() {
  const {
    user, profile, length,
    storyboardPayOpen, setStoryboardPayOpen,
    paywallStep, setPaywallStep,
    setProductionMode, generateStoryboard,
  } = useEditorFlow();
  const router = useRouter();

  if (!storyboardPayOpen) return null;

  const cost = LENGTH_PRICING_GMD[length];
  const scenes = length === "30s" ? 3 : length === "60s" ? 6 : 9;
  const balance = profile?.credits ?? 0;
  const hasEnough = balance >= cost;
  const remaining = balance - cost;

  const handleWalletPay = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), { credits: increment(-cost) });

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
        description: `Storyboard Spec Generation (${length} — ${scenes} Scenes)`,
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => setStoryboardPayOpen(false)}
      />

      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0a1024] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.8)] transition-all animate-in fade-in-50 zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-black tracking-tight text-white">
            {paywallStep === "choose" ? "How should we build it?" : "Ready to write"}
          </h3>
          <button
            onClick={() => setStoryboardPayOpen(false)}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── STEP 2: PRODUCTION MODE ─────────────────────────────────── */}
        {paywallStep === "choose" ? (
          <div className="grid gap-3 pt-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <button
              onClick={async () => {
                setProductionMode("auto-merge");
                setStoryboardPayOpen(false);
                setPaywallStep("pay");
                await generateStoryboard();
              }}
              className="group flex items-center gap-4 rounded-2xl border border-blue-500 bg-[#0c152d] p-4 text-left transition-all hover:bg-[#101c3a] active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Zap size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white">Make the whole film</span>
                <span className="block text-[11px] text-neutral-400">Renders every scene for you</span>
              </span>
            </button>

            <button
              onClick={async () => {
                setProductionMode("manual");
                setStoryboardPayOpen(false);
                setPaywallStep("pay");
                await generateStoryboard();
              }}
              className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-white/25 hover:bg-white/[0.06] active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                <Edit3 size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-white">Let me edit first</span>
                <span className="block text-[11px] text-neutral-400">Review each scene before rendering</span>
              </span>
            </button>
          </div>
        ) : (
          /* ── STEP 1: PAY ─────────────────────────────────────────────── */
          <div>
            <p className="mt-1 text-[13px] text-neutral-400">
              {length} ad · {scenes} scenes
            </p>

            <div className="mt-6 text-center">
              <p className="font-display text-5xl font-black leading-none tracking-tight text-white">
                <span className="mr-1.5 align-top text-xl font-bold text-neutral-500">GMD</span>
                {cost.toLocaleString()}
              </p>
              <p className="mt-2 text-[11px] text-neutral-500">
                {hasEnough
                  ? `GMD ${remaining.toLocaleString()} left after this`
                  : `GMD ${(cost - balance).toLocaleString()} short`}
              </p>
            </div>

            <div className="mt-7 grid gap-2.5">
              {hasEnough ? (
                <button
                  onClick={handleWalletPay}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98]"
                >
                  <CheckCircle size={15} />
                  Pay from wallet
                </button>
              ) : (
                <button
                  onClick={() => router.push("/plans")}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98]"
                >
                  <Wallet size={15} />
                  Top up wallet
                </button>
              )}
              <button
                onClick={() => setStoryboardPayOpen(false)}
                className="py-2 text-[13px] font-semibold text-neutral-500 transition-colors hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
