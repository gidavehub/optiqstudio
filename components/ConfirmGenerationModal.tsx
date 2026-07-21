"use client";

// Confirms spending wallet balance on a generation.
//
// This used to offer a "Pay on the Spot" card form when the wallet was short.
// That form collected card details in plain text, faked the authorization with
// a few setTimeouts, and then simply incremented the balance — no money ever
// moved. It has been removed. When funds are short we now send the user to the
// real paywall, which starts on the pricing panel and steps into checkout.

import React from "react";
import { useRouter } from "next/navigation";
import { X, Zap, Wallet } from "lucide-react";
import { doc, updateDoc, increment, collection, addDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

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

  const handleWalletConfirm = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, { credits: increment(-cost) });

      const dateString = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;

      await addDoc(collection(db, "transactions"), {
        uid: currentUser.uid,
        invoiceId,
        date: dateString,
        description: `Deduction: Direct Studio Clip (${actionLabel})`,
        method: "Wallet Balance",
        status: "Succeeded",
        amount: `-GMD ${cost.toFixed(2)}`,
        createdAt: new Date().toISOString(),
      });

      onConfirm();
      onClose();
    } catch (err) {
      console.error("Wallet deduction error:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0a1024] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.8)] transition-all animate-in fade-in-50 zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <p className="mt-1 text-[13px] text-neutral-400">{description}</p>

        <div className="mt-6 text-center">
          <p className="font-display text-5xl font-black leading-none tracking-tight text-white">
            <span className="mr-1.5 align-top text-xl font-bold text-neutral-500">GMD</span>
            {cost.toLocaleString()}
          </p>
          <p className="mt-2 text-[11px] text-neutral-500">
            {hasEnoughBalance
              ? `GMD ${remainingBalance.toLocaleString()} left after this`
              : `GMD ${shortfall.toLocaleString()} short`}
          </p>
        </div>

        <div className="mt-7 grid gap-2.5">
          {hasEnoughBalance ? (
            <button
              onClick={handleWalletConfirm}
              className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold text-black transition-all hover:bg-neutral-200 active:scale-[0.98]"
            >
              <Zap size={15} />
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
            onClick={onClose}
            className="py-2 text-[13px] font-semibold text-neutral-500 transition-colors hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
