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
import { LENGTH_PRICING_GMD, scenesForLength, videoType, formatRunTime } from "../_flow/types";

export default function StoryboardPaywallModal() {
  const {
    user, profile, length, videoTypeId,
    storyboardPayOpen, setStoryboardPayOpen,
    paywallStep, setPaywallStep,
    setProductionMode, generateStoryboard,
  } = useEditorFlow();
  const router = useRouter();

  if (!storyboardPayOpen) return null;

  const cost = LENGTH_PRICING_GMD[length];
  const scenes = scenesForLength(length);
  const kind = videoType(videoTypeId);
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
        description: `Storyboard Spec Generation (${kind.title} · ${formatRunTime(length)} — ${scenes} Scenes)`,
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
        className="absolute inset-0 bg-foreground/25 backdrop-blur-sm transition-opacity"
        onClick={() => setStoryboardPayOpen(false)}
      />

      <div className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-line bg-surface p-6 shadow-[0_24px_60px_rgba(16,24,40,0.16)] transition-all animate-in fade-in-50 zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-black tracking-tight text-foreground">
            {paywallStep === "choose" ? "How should we build it?" : "Ready to write"}
          </h3>
          <button
            onClick={() => setStoryboardPayOpen(false)}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── STEP 2: PRODUCTION MODE ─────────────────────────────────── */}
        {paywallStep === "choose" ? (
          <div className="grid gap-3 pt-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            {/* The mode is handed to generateStoryboard directly. Relying on
                setProductionMode landing first is a race the callback loses —
                it kept writing "manual" onto auto-produced projects, which is
                why "make the whole film" stopped at the script. */}
            <button
              onClick={async () => {
                setProductionMode("auto-merge");
                setStoryboardPayOpen(false);
                setPaywallStep("pay");
                await generateStoryboard("auto-merge");
              }}
              className="group flex items-center gap-4 rounded-3xl border border-accent bg-surface p-4 text-left transition-all hover:bg-surface-2 active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-white">
                <Zap size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">Make the whole film</span>
                <span className="block text-[11px] text-ink-3">
                  Writes the script, renders every scene, opens the timeline
                </span>
              </span>
            </button>

            <button
              onClick={async () => {
                setProductionMode("manual");
                setStoryboardPayOpen(false);
                setPaywallStep("pay");
                await generateStoryboard("manual");
              }}
              className="group flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-left transition-all hover:border-line-2 hover:bg-surface-2 active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-foreground">
                <Edit3 size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">Let me edit first</span>
                <span className="block text-[11px] text-ink-3">Review each scene before rendering</span>
              </span>
            </button>
          </div>
        ) : (
          /* ── STEP 1: PAY ─────────────────────────────────────────────── */
          <div>
            <p className="mt-1 text-[13px] text-ink-3">
              {kind.title} · {formatRunTime(length)} · {scenes} scenes
            </p>
            <p className="mt-0.5 text-[11px] text-muted">{kind.audioLabel}</p>

            <div className="mt-6 text-center">
              <p className="font-display text-5xl font-black leading-none tracking-tight text-foreground">
                <span className="mr-1.5 align-top text-xl font-bold text-muted">GMD</span>
                {cost.toLocaleString()}
              </p>
              <p className="mt-2 text-[11px] text-muted">
                {hasEnough
                  ? `GMD ${remaining.toLocaleString()} left after this`
                  : `GMD ${(cost - balance).toLocaleString()} short`}
              </p>
            </div>

            <div className="mt-7 grid gap-2.5">
              {hasEnough ? (
                <button
                  onClick={handleWalletPay}
                  className="flex items-center justify-center gap-2 rounded-3xl bg-foreground py-3.5 text-sm font-bold text-background transition-all hover:bg-ink-2 active:scale-[0.98]"
                >
                  <CheckCircle size={15} />
                  Pay from wallet
                </button>
              ) : (
                <button
                  onClick={() => router.push("/plans")}
                  className="flex items-center justify-center gap-2 rounded-3xl bg-foreground py-3.5 text-sm font-bold text-background transition-all hover:bg-ink-2 active:scale-[0.98]"
                >
                  <Wallet size={15} />
                  Top up wallet
                </button>
              )}
              <button
                onClick={() => setStoryboardPayOpen(false)}
                className="py-2 text-[13px] font-semibold text-muted transition-colors hover:text-foreground"
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
