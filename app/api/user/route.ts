import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-server";
import { ensureUser, PLAN, PLANS, CREDIT_PACKS, COSTS } from "../../../lib/credits";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const profile = await ensureUser(user.uid, {
      email: user.email,
      name: user.name,
    });
    return NextResponse.json({
      profile,
      pricing: { plan: PLAN, plans: PLANS, packs: CREDIT_PACKS, costs: COSTS },
    });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status }
    );
  }
}
