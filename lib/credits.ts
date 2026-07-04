import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin";

/**
 * Optiq Studio credit economy.
 *
 * Everything is denominated in credits, tracked on users/{uid}.credits and
 * mutated only through Firestore transactions so concurrent generations can't
 * double-spend.
 */

export const SIGNUP_CREDITS = 0;

export const PLANS = [
  {
    id: "pro-monthly",
    name: "Optiq Pro",
    priceUsd: 100,
    monthlyCredits: 10_000,
    label: "Professional creator",
  },
  {
    id: "studio-monthly",
    name: "Optiq Studio",
    priceUsd: 250,
    monthlyCredits: 28_000,
    label: "Team & studio production",
  },
  {
    id: "enterprise-monthly",
    name: "Optiq Enterprise",
    priceUsd: 450,
    monthlyCredits: 55_000,
    label: "Unlimited power & scaling",
  },
] as const;

export const PLAN = PLANS[0];

export const CREDIT_PACKS = [
  { id: "pack-1000", credits: 1_000, priceUsd: 12, label: "Starter pack" },
  { id: "pack-5000", credits: 5_000, priceUsd: 50, label: "Creator pack" },
  { id: "pack-12000", credits: 12_000, priceUsd: 100, label: "Studio pack" },
] as const;

/** Per-action pricing. Video is priced per generated second. */
export const COSTS = {
  videoPerSecond: { omni: 12, "omni-fast": 5 } as Record<string, number>,
  image: 5,
  /** TTS per 100 characters (min charge 5). */
  ttsPer100Chars: 1,
  ttsMinimum: 5,
  characterSheet: 15,
  promptEnhance: 0,
};

export function videoCost(model: "omni" | "omni-fast", seconds: number): number {
  return (COSTS.videoPerSecond[model] ?? COSTS.videoPerSecond.omni) * seconds;
}

export function ttsCost(text: string): number {
  return Math.max(COSTS.ttsMinimum, Math.ceil(text.length / 100) * COSTS.ttsPer100Chars);
}

export class InsufficientCreditsError extends Error {
  status = 402;
  constructor(needed: number, available: number) {
    super(`Not enough credits: need ${needed}, have ${available}`);
  }
}

export interface UserProfile {
  credits: number;
  plan: string | null;
  planStatus: "active" | "none";
  planRenewsAt: string | null;
  email: string | null;
  name: string | null;
  createdAt: string;
}

/** Creates the user doc with signup credits on first touch; returns profile. */
export async function ensureUser(
  uid: string,
  info?: { email?: string; name?: string }
): Promise<UserProfile> {
  const ref = adminDb.collection("users").doc(uid);
  return adminDb.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const data = snap.data() as UserProfile;
      return data;
    }
    const profile: UserProfile = {
      credits: SIGNUP_CREDITS,
      plan: null,
      planStatus: "none",
      planRenewsAt: null,
      email: info?.email ?? null,
      name: info?.name ?? null,
      createdAt: new Date().toISOString(),
    };
    tx.set(ref, profile);
    return profile;
  });
}

/** Atomically deducts credits; throws InsufficientCreditsError when short. */
export async function chargeCredits(
  uid: string,
  amount: number,
  reason: string
): Promise<number> {
  if (amount <= 0) {
    const snap = await adminDb.collection("users").doc(uid).get();
    return (snap.data()?.credits as number) ?? 0;
  }
  const ref = adminDb.collection("users").doc(uid);
  return adminDb.runTransaction(async (tx: any) => {
    const snap = await tx.get(ref);
    const available = (snap.data()?.credits as number) ?? 0;
    if (available < amount) throw new InsufficientCreditsError(amount, available);
    tx.update(ref, { credits: FieldValue.increment(-amount) });
    tx.set(ref.collection("ledger").doc(), {
      delta: -amount,
      reason,
      at: new Date().toISOString(),
    });
    return available - amount;
  });
}

export async function addCredits(
  uid: string,
  amount: number,
  reason: string
): Promise<void> {
  const ref = adminDb.collection("users").doc(uid);
  await ref.set({ credits: FieldValue.increment(amount) }, { merge: true });
  await ref.collection("ledger").add({
    delta: amount,
    reason,
    at: new Date().toISOString(),
  });
}

/** Refund helper for failed generations. */
export async function refundCredits(
  uid: string,
  amount: number,
  reason: string
): Promise<void> {
  if (amount > 0) await addCredits(uid, amount, `refund: ${reason}`);
}

export async function activateSubscription(uid: string): Promise<void> {
  const renews = new Date();
  renews.setMonth(renews.getMonth() + 1);
  await adminDb.collection("users").doc(uid).set(
    {
      plan: PLAN.id,
      planStatus: "active",
      planRenewsAt: renews.toISOString(),
    },
    { merge: true }
  );
  await addCredits(uid, PLAN.monthlyCredits, `subscription: ${PLAN.name}`);
}
