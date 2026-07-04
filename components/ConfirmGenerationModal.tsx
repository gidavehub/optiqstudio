"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CreditCard, X, Zap } from "lucide-react";

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
  cost,
  balance,
  title = "Confirm Generation",
  description = "Please confirm the credit deduction to proceed with your generation.",
  actionLabel = "Proceed Generation",
}: ConfirmGenerationModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const hasEnoughCredits = balance >= cost;
  const remainingBalance = balance - cost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glassmorphism backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/80 p-6 shadow-2xl backdrop-blur-xl transition-all animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <Zap className="text-violet-400" size={16} />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="mt-4">
          <p className="text-xs leading-relaxed text-neutral-400">
            {description}
          </p>

          {/* Ledger Calculation */}
          <div className="mt-5 rounded-xl border border-neutral-900 bg-neutral-950/40 p-4 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-500 font-medium">Your current balance</span>
              <span className="font-mono text-white font-semibold">{balance.toLocaleString()} credits</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
              <span className="text-neutral-500 font-medium">Generation cost</span>
              <span className="font-mono text-violet-400 font-bold">-{cost.toLocaleString()} credits</span>
            </div>
            
            {hasEnoughCredits ? (
              <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                <span className="text-neutral-500 font-medium">Remaining balance</span>
                <span className="font-mono text-emerald-400 font-bold">{remainingBalance.toLocaleString()} credits</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-red-950/30 border border-red-900/40 px-3 py-2.5 mt-3">
                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-bold text-red-300">Insufficient balance</p>
                  <p className="text-[10px] text-red-400 mt-0.5 leading-normal">
                    You need {(cost - balance).toLocaleString()} more credits to launch this action.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-white/5 bg-white/5 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
          >
            Cancel
          </button>

          {hasEnoughCredits ? (
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white hover:from-violet-500 hover:to-fuchsia-500 transition-all flex items-center justify-center gap-1.5"
            >
              <Zap size={12} />
              Confirm & Pay
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                router.push("/plans");
              }}
              className="flex-1 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-1.5"
            >
              <CreditCard size={12} />
              Upgrade / Top up
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
