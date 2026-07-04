import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth-server";
import { generateImage } from "../../../../lib/vertex";
import { adminDb, uploadBase64 } from "../../../../lib/firebase-admin";
import { chargeCredits, refundCredits, COSTS } from "../../../../lib/credits";

/**
 * Image + character generation. Pass referenceImages (base64) to keep a
 * character consistent across generations.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { prompt, referenceImages, aspectRatio, purpose = "image" } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

    const cost = purpose === "character" ? COSTS.characterSheet : COSTS.image;
    await chargeCredits(user.uid, cost, `${purpose} generation`);

    let image: { base64: string; mimeType: string };
    try {
      image = await generateImage({ prompt, referenceImages, aspectRatio });
    } catch (err) {
      await refundCredits(user.uid, cost, `${purpose} generation failed`);
      throw err;
    }

    const doc = adminDb.collection("generations").doc();
    const ext = image.mimeType.includes("jpeg") ? "jpg" : "png";
    const url = await uploadBase64(
      image.base64,
      `generations/${user.uid}/${doc.id}.${ext}`,
      image.mimeType
    );
    await doc.set({
      uid: user.uid,
      type: purpose === "character" ? "character" : "image",
      status: "succeeded",
      prompt,
      imageUrl: url,
      cost,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ id: doc.id, url, mimeType: image.mimeType, cost });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status }
    );
  }
}
