import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth-server";
import { pollVideoOperation } from "../../../../lib/vertex";
import { adminDb, uploadBase64 } from "../../../../lib/firebase-admin";
import { refundCredits } from "../../../../lib/credits";

/** Polls a running video generation and finalizes it when done. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const ref = adminDb.collection("generations").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const gen = snap.data()!;
    if (gen.uid !== user.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (gen.status !== "generating") {
      return NextResponse.json({ id, ...publicFields(gen) });
    }

    const op = await pollVideoOperation(gen.operationName);
    if (!op.done) {
      return NextResponse.json({ id, status: "generating" });
    }

    if (op.error || op.videos.length === 0) {
      await refundCredits(gen.uid, gen.cost ?? 0, `video ${id} failed`);
      const update = {
        status: "failed",
        error: op.error || "Unknown failure",
        completedAt: new Date().toISOString(),
      };
      await ref.update(update);
      return NextResponse.json({ id, ...update });
    }

    const video = op.videos[0];
    let videoUrl = video.gcsUri || null;
    if (video.bytesBase64Encoded) {
      videoUrl = await uploadBase64(
        video.bytesBase64Encoded,
        `generations/${gen.uid}/${id}.mp4`,
        video.mimeType
      );
    }
    const update = {
      status: "succeeded",
      videoUrl,
      mimeType: video.mimeType,
      completedAt: new Date().toISOString(),
    };
    await ref.update(update);
    return NextResponse.json({ id, ...update });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status }
    );
  }
}

function publicFields(gen: FirebaseFirestore.DocumentData) {
  return {
    status: gen.status,
    videoUrl: gen.videoUrl ?? null,
    error: gen.error ?? null,
    prompt: gen.prompt,
    completedAt: gen.completedAt ?? null,
  };
}
