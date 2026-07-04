import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth-server";
import { startVideoGeneration, videoModelId } from "../../../../lib/vertex";
import { adminDb } from "../../../../lib/firebase-admin";
import { chargeCredits, refundCredits, videoCost } from "../../../../lib/credits";

/**
 * Kicks off a Veo generation on Vertex AI. Charges credits up front and
 * refunds them if the launch itself fails. The client polls
 * /api/video/status?id=... until the operation resolves.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const {
      prompt,
      model = "omni",
      imageBase64,
      imageMimeType,
      aspectRatio = "16:9",
      durationSeconds = 8,
      resolution = "720p",
      generateAudio = true,
      negativePrompt,
      seed,
    } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }
    const duration = Math.min(Math.max(Number(durationSeconds) || 8, 4), 8);
    const cost = videoCost(model, duration);

    await chargeCredits(user.uid, cost, `video (${model}, ${duration}s)`);

    let operationName: string;
    try {
      operationName = await startVideoGeneration({
        prompt,
        model,
        imageBase64,
        imageMimeType,
        aspectRatio,
        durationSeconds: duration,
        resolution,
        generateAudio,
        negativePrompt,
        seed,
      });
    } catch (err) {
      await refundCredits(user.uid, cost, "video launch failed");
      throw err;
    }

    const doc = await adminDb.collection("generations").add({
      uid: user.uid,
      type: "video",
      status: "generating",
      prompt,
      model,
      modelId: videoModelId(model),
      params: { aspectRatio, durationSeconds: duration, resolution, generateAudio },
      hasReferenceImage: Boolean(imageBase64),
      cost,
      operationName,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ id: doc.id, status: "generating", cost });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status }
    );
  }
}
