import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../../lib/auth-server";
import { synthesizeSpeech } from "../../../../lib/vertex";
import { adminDb, uploadBase64 } from "../../../../lib/firebase-admin";
import { chargeCredits, refundCredits, ttsCost } from "../../../../lib/credits";

/** Voiceover synthesis via Gemini native TTS on Vertex AI. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { text, voice = "Kore", style } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json(
        { error: "Script too long (4000 character max per generation)" },
        { status: 400 }
      );
    }

    const cost = ttsCost(text);
    await chargeCredits(user.uid, cost, `voiceover (${voice})`);

    let audio: { base64Wav: string; mimeType: string };
    try {
      audio = await synthesizeSpeech({ text, voice, style });
    } catch (err) {
      await refundCredits(user.uid, cost, "voiceover failed");
      throw err;
    }

    const doc = adminDb.collection("generations").doc();
    const url = await uploadBase64(
      audio.base64Wav,
      `generations/${user.uid}/${doc.id}.wav`,
      "audio/wav"
    );
    await doc.set({
      uid: user.uid,
      type: "audio",
      status: "succeeded",
      prompt: text.slice(0, 500),
      voice,
      style: style ?? null,
      audioUrl: url,
      cost,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ id: doc.id, url, cost });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status }
    );
  }
}
