import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth-server";
import { createCheckout } from "../../../../lib/modempay";
import { CREDIT_PACKS, PLAN, PLANS } from "../../../../lib/credits";

/**
 * Creates a ModemPay Payment Intent and returns the hosted checkout link.
 * body: { kind: "subscription", planId?: string } | { kind: "credits", packId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { kind, packId, planId } = await req.json();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    let amount: number;
    let title: string;
    let credits: number;
    let selectedPlanId = "pro-monthly";
    if (kind === "subscription") {
      const plan = PLANS.find((p) => p.id === planId) || PLAN;
      amount = plan.priceUsd;
      title = `${plan.name} — monthly subscription`;
      credits = plan.monthlyCredits;
      selectedPlanId = plan.id;
    } else if (kind === "credits") {
      const pack = CREDIT_PACKS.find((p) => p.id === packId);
      if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
      amount = pack.priceUsd;
      title = `Optiq Studio credits — ${pack.credits.toLocaleString()} (${pack.label})`;
      credits = pack.credits;
    } else {
      return NextResponse.json({ error: "Unknown checkout kind" }, { status: 400 });
    }

    const intent = await createCheckout({
      amount,
      title,
      description: title,
      customerEmail: user.email,
      customerName: user.name,
      metadata: {
        uid: user.uid,
        kind,
        packId: packId ?? "",
        planId: selectedPlanId,
        credits: String(credits),
      },
      returnUrl: `${appUrl}/dashboard/billing?status=success`,
      cancelUrl: `${appUrl}/dashboard/billing?status=cancelled`,
      callbackUrl: `${appUrl}/api/payments/webhook`,
    });

    return NextResponse.json({ paymentLink: intent.data.payment_link });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status }
    );
  }
}
