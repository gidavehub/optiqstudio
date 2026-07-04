import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-server";
import { adminDb } from "../../../lib/firebase-admin";

/** Lists the signed-in user's generations, newest first. ?type=video|image|audio|character */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const type = req.nextUrl.searchParams.get("type");

    let query = adminDb
      .collection("generations")
      .where("uid", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(40);
    if (type) query = query.where("type", "==", type) as typeof query;

    const snap = await query.get();
    const items = snap.docs.map((d: any) => {
      const g = d.data();
      return {
        id: d.id,
        type: g.type,
        status: g.status,
        prompt: g.prompt,
        videoUrl: g.videoUrl ?? null,
        imageUrl: g.imageUrl ?? null,
        audioUrl: g.audioUrl ?? null,
        cost: g.cost ?? 0,
        createdAt: g.createdAt,
      };
    });
    return NextResponse.json({ items });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status }
    );
  }
}
