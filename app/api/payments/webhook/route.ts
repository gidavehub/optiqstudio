import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "../../../../lib/modempay";
import { adminDb } from "../../../../lib/firebase-admin";
import { activateSubscription, addCredits } from "../../../../lib/credits";

/**
 * ModemPay webhook receiver.
 *
 * Register this URL in the ModemPay dashboard (Developers → Webhooks):
 *   https://<your-domain>/api/payments/webhook
 * and copy the signing secret into MODEM_WEBHOOK_SECRET.
 *
 * Fulfillment is idempotent: each charge id is recorded in the payments
 * collection and only processed once, so ModemPay's retries are safe.
 */
export async function POST(req: NextRequest) {
  let event;
  try {
    const rawBody = await req.text();
    event = verifyWebhook(rawBody, req.headers.get("x-modem-signature"));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad signature" },
      { status: 400 }
    );
  }

  try {
    if (event.event === "charge.succeeded") {
      const charge = event.payload;
      const meta = charge.metadata || {};
      const uid = meta.uid;

      const ref = adminDb.collection("payments").doc(charge.id);
      const isNew = await adminDb.runTransaction(async (tx: any) => {
        const snap = await tx.get(ref);
        if (snap.exists) return false;
        tx.set(ref, {
          uid: uid ?? null,
          kind: meta.kind ?? "unknown",
          credits: Number(meta.credits) || 0,
          amount: charge.amount,
          currency: charge.currency,
          reference: charge.transaction_reference ?? null,
          email: charge.customer_email ?? null,
          receivedAt: new Date().toISOString(),
        });
        return true;
      });

      if (isNew && uid) {
        if (meta.kind === "subscription") {
          await activateSubscription(uid);
        } else {
          const credits = Number(meta.credits) || 0;
          if (credits > 0) {
            await addCredits(uid, credits, `purchase ${charge.id}`);
          }
        }
      }
    }
    // Always 200 so ModemPay stops retrying events we've acknowledged.
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook fulfillment error:", err);
    // Non-200 → ModemPay retries (up to 3x, 10 min apart), which we want for
    // transient Firestore failures since fulfillment is idempotent.
    return NextResponse.json({ error: "Fulfillment failed" }, { status: 500 });
  }
}
