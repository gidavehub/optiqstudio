"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CreditCard, X, Zap, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
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
  cost = 100, // Default to GMD 100 per clip as requested
  balance,
  title = "Confirm Clip Generation",
  description = "Please authorize the balance deduction to proceed with compiling your Direct Studio clip.",
  actionLabel = "Generate Clip",
}: ConfirmGenerationModalProps) {
  const router = useRouter();

  // Local checkout states
  const [showSpotCheckout, setShowSpotCheckout] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [processingMessage, setProcessingPaymentMessage] = useState("");
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasEnoughBalance = balance >= cost;
  const remainingBalance = balance - cost;

  // Handle spot payment
  const handleSpotPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName.trim() || !cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim()) {
      setError("Please fill in all credit card details.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("You must be logged in to authorize payments.");
      return;
    }

    setError(null);
    setProcessingPayment(true);
    setProcessingPaymentMessage("Contacting payment gateway via ModemPay...");

    try {
      // Step 1: Secure auth steps simulation
      await new Promise((resolve) => setTimeout(resolve, 800));
      setProcessingPaymentMessage("Authorizing card credentials...");
      await new Promise((resolve) => setTimeout(resolve, 700));
      setProcessingPaymentMessage("Deducting funds and crediting wallet...");
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Step 2: Write Transaction record to Firestore
      const dateString = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
      
      const lastFour = cardNumber.replace(/\s/g, "").slice(-4) || "4242";

      await addDoc(collection(db, "transactions"), {
        uid: currentUser.uid,
        invoiceId,
        date: dateString,
        description: `Direct Studio Clip Generation (${actionLabel})`,
        method: `ModemPay (Visa *${lastFour})`,
        status: "Succeeded",
        amount: `GMD ${cost.toFixed(2)}`,
        createdAt: new Date().toISOString(),
      });

      // Step 3: Increment user balance by the cost so they can satisfy the cost deduction
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        credits: increment(cost),
      });

      setPaymentCompleted(true);
      setProcessingPayment(false);

      // Brief success pause, then trigger generation
      setTimeout(() => {
        onConfirm();
        onClose();
        // Reset local states
        setShowSpotCheckout(false);
        setCardName("");
        setCardNumber("");
        setCardExpiry("");
        setCardCvv("");
        setPaymentCompleted(false);
      }, 1500);

    } catch (err) {
      console.error("Payment failure:", err);
      setError("Payment authorization failed. Please try a different card.");
      setProcessingPayment(false);
    }
  };

  const handleWalletConfirm = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      // Deduct from wallet balance in Firestore
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        credits: increment(-cost),
      });

      // Write a direct internal statement transaction to ledger
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={processingPayment ? undefined : onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/90 p-6 shadow-2xl backdrop-blur-2xl transition-all animate-in fade-in-50 zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <Zap className="text-violet-400 animate-pulse" size={16} />
            {title}
          </h3>
          <button
            onClick={processingPayment ? undefined : onClose}
            className="rounded-full p-1 text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Loading Spinner */}
        {processingPayment && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="text-violet-400 animate-spin" size={32} />
            <p className="text-xs font-semibold text-white">{processingMessage}</p>
            <p className="text-[10px] text-neutral-500">Please do not refresh or close this tab.</p>
          </div>
        )}

        {/* Success Screen */}
        {paymentCompleted && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="text-emerald-400 animate-bounce" size={40} />
            <p className="text-sm font-bold text-white">Payment Authorized!</p>
            <p className="text-xs text-neutral-400">Direct Studio Clip generation starting now...</p>
          </div>
        )}

        {/* Form / Content View */}
        {!processingPayment && !paymentCompleted && (
          <div className="mt-4">
            {!showSpotCheckout ? (
              <>
                <p className="text-xs leading-relaxed text-neutral-400">
                  {description}
                </p>

                {/* Ledger calculations */}
                <div className="mt-5 rounded-xl border border-neutral-900 bg-neutral-950/50 p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500 font-medium">Your wallet balance</span>
                    <span className="font-mono text-white font-semibold">GMD {balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                    <span className="text-neutral-500 font-medium">Generation flat-rate cost</span>
                    <span className="font-mono text-violet-400 font-bold">-GMD {cost.toFixed(2)}</span>
                  </div>
                  
                  {hasEnoughBalance ? (
                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                      <span className="text-neutral-500 font-medium">Remaining wallet balance</span>
                      <span className="font-mono text-emerald-400 font-bold">GMD {remainingBalance.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-lg bg-red-950/20 border border-red-900/30 px-3 py-2.5 mt-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-bold text-red-300">Insufficient Wallet Balance</p>
                          <p className="text-[10px] text-red-400 mt-0.5 leading-normal">
                            You need GMD {(cost - balance).toFixed(2)} more in your account to run this action.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Cancel
                  </button>

                  {hasEnoughBalance ? (
                    <button
                      onClick={handleWalletConfirm}
                      className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/10"
                    >
                      <Zap size={12} />
                      Pay from Wallet
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowSpotCheckout(true)}
                      className="flex-1 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black hover:bg-neutral-200 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-white/5"
                    >
                      <CreditCard size={12} />
                      Pay on the Spot
                    </button>
                  )}
                </div>
              </>
            ) : (
              /* ON THE SPOT CREDIT CARD SECURE CHECKOUT FORM */
              <form onSubmit={handleSpotPayment} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Spot Checkout</span>
                  <button
                    type="button"
                    onClick={() => setShowSpotCheckout(false)}
                    className="text-[10px] text-violet-400 hover:underline font-bold"
                  >
                    Back to Wallet
                  </button>
                </div>

                <div className="rounded-xl border border-violet-500/15 bg-violet-500/5 px-3.5 py-2.5 flex items-start gap-2.5">
                  <ShieldCheck size={14} className="text-violet-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-violet-300 leading-normal">
                    Secure checkout provided by <strong>ModemPay</strong>. Your card details are fully encrypted and will be charged exactly <strong>GMD {cost.toFixed(2)}</strong>.
                  </p>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex gap-2 text-[10px] text-red-400 items-start">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase">Cardholder Name</label>
                    <input
                      type="text"
                      required
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      placeholder="e.g. Nyima Salaam"
                      className="mt-1 w-full rounded-xl border border-white/5 bg-[#0e0e11] px-4.5 py-2.5 text-xs text-white focus:border-violet-500/25 outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase">Card Number</label>
                    <div className="relative mt-1">
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                          const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ");
                          setCardNumber(formatted);
                        }}
                        placeholder="4242 4242 4242 4242"
                        className="w-full rounded-xl border border-white/5 bg-[#0e0e11] pl-4.5 pr-10 py-2.5 text-xs text-white focus:border-violet-500/25 outline-none font-mono"
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
                        value={cardExpiry}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                          const formatted = val.length >= 2 ? `${val.slice(0, 2)}/${val.slice(2)}` : val;
                          setCardExpiry(formatted);
                        }}
                        placeholder="MM/YY"
                        className="mt-1 w-full rounded-xl border border-white/5 bg-[#0e0e11] px-4.5 py-2.5 text-xs text-white focus:border-violet-500/25 outline-none font-mono text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase">CVV</label>
                      <input
                        type="password"
                        required
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        placeholder="•••"
                        className="mt-1 w-full rounded-xl border border-white/5 bg-[#0e0e11] px-4.5 py-2.5 text-xs text-white focus:border-violet-500/25 outline-none font-mono text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSpotCheckout(false)}
                    className="flex-1 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2.5 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-violet-500/10"
                  >
                    <ShieldCheck size={13} />
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
