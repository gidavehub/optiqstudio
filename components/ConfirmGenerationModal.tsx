"use client";

// Confirms spending wallet balance on a generation.
//
// This modal is a CONFIRMATION ONLY — it does not move money.
//
// It used to decrement `users/{uid}.credits` itself and write the billing row,
// but every generation endpoint already charges through `chargeCredits()`
// server-side. The result was a silent double charge on every single render:
// an image cost 50 on the server plus 100 here, which is a large part of why
// Direct Studio prices looked absurd. The server is now the only thing that
// touches the wallet (and writes the receipt); this just asks "shall we?".
//
// (An earlier version also offered a "Pay on the Spot" card form that collected
// card details in plain text and faked authorization with setTimeouts. Short
// balances go to the real paywall instead.)

import React from "react";
import { useRouter } from "next/navigation";
import { X, Zap, Wallet } from "lucide-react";

interface ConfirmGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cost: number;
  balance: number;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export default function ConfirmGenerationModal({
  isOpen,
  onClose,
  onConfirm,
  cost = 100,
  balance,
  title = "Confirm Clip Generation",
  description = "Direct Studio clip",
  actionLabel = "Generate Clip",
}: ConfirmGenerationModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const hasEnoughBalance = balance >= cost;
  const remainingBalance = balance - cost;
  const shortfall = cost - balance;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/25 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="glass-strong relative w-full max-w-sm overflow-hidden rounded-[28px] p-6 transition-all animate-in fade-in-50 zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-black tracking-tight text-foreground">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-1 text-[13px] text-ink-3">{description}</p>

        <div className="mt-6 text-center">
          <p className="font-display text-5xl font-black leading-none tracking-tight text-foreground">
            <span className="mr-1.5 align-top text-xl font-bold text-muted">GMD</span>
            {fmt(cost)}
          </p>
          <p className="mt-2 text-[11px] text-muted">
            {hasEnoughBalance
              ? `GMD ${fmt(remainingBalance)} left after this`
              : `GMD ${fmt(shortfall)} short`}
          </p>
        </div>

        <div className="mt-7 grid gap-2.5">
          {hasEnoughBalance ? (
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex items-center justify-center gap-2 rounded-3xl bg-foreground py-3.5 text-sm font-bold text-background transition-all hover:bg-ink-2 active:scale-[0.98]"
            >
              <Zap size={15} />
              {actionLabel}
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
            onClick={onClose}
            className="py-2 text-[13px] font-semibold text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
