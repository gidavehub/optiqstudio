import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { adminAuth, adminDb, adminStorage, STORAGE_BUCKET } from "../../../../lib/firebase-admin";
import { avatarCost, chargeCredits, refundCredits } from "../../../../lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODAL_SUBMIT_URL = process.env.MODAL_SUBMIT_URL || "";
const MODAL_SUBMIT_TOKEN = process.env.OPTIQ_SUBMIT_TOKEN || "";

async function requireUid(req: NextRequest): Promise<string> {
  const authz = req.headers.get("authorization") || "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) throw new Error("unauthorized");
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.uid;
}

export async function POST(req: NextRequest) {
  let uid: string;
  try {
    uid = await requireUid(req);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const text = String(body.text || "").trim();
  const backend: "musetalk" | "latentsync" =
    body.backend === "latentsync" ? "latentsync" : "musetalk";
  const faceBase64 = body.faceBase64 as string | undefined;
  const faceMimeType = String(body.faceMimeType || "image/png");
  const voiceBase64 = body.voiceBase64 as string | undefined;
  const voiceMimeType = String(body.voiceMimeType || "audio/wav");

  if (!text) return Response.json({ error: "Script text is required" }, { status: 400 });
  if (!faceBase64) return Response.json({ error: "A face image is required" }, { status: 400 });
  if (!voiceBase64) return Response.json({ error: "A voice sample is required" }, { status: 400 });
  if (!MODAL_SUBMIT_URL || !MODAL_SUBMIT_TOKEN) {
    return Response.json({ error: "Avatar service is not configured" }, { status: 500 });
  }

  const cost = avatarCost(text, backend);
  try {
    await chargeCredits(uid, cost, `avatar:${backend}`);
  } catch (e: any) {
    return Response.json({ error: e?.message || "Insufficient credits" }, { status: e?.status || 402 });
  }

  const jobId = `avatar_${randomUUID()}`;
  const faceExt = faceMimeType.includes("png") ? "png" : "jpg";
  const facePath = `inputs/${jobId}/face.${faceExt}`;
  const voicePath = `inputs/${jobId}/voice.wav`;
  const outputPath = `outputs/${jobId}.mp4`;

  try {
    const bucket = adminStorage.bucket(STORAGE_BUCKET);
    await bucket.file(facePath).save(Buffer.from(faceBase64, "base64"), {
      contentType: faceMimeType,
      resumable: false,
    });
    await bucket.file(voicePath).save(Buffer.from(voiceBase64, "base64"), {
      contentType: voiceMimeType,
      resumable: false,
    });

    // One doc in `generations` (client-readable, shows in history + drives the
    // avatar page's realtime status). The Modal worker updates this same doc.
    await adminDb.collection("generations").doc(jobId).set({
      uid,
      type: "avatar",
      backend,
      text,
      prompt: text,
      faceImagePath: facePath,
      voiceSamplePath: voicePath,
      outputPath,
      status: "queued",
      progress: 0,
      error: null,
      cost,
      createdAt: new Date().toISOString(),
    });

    const r = await fetch(MODAL_SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, backend, token: MODAL_SUBMIT_TOKEN }),
    });
    if (!r.ok) throw new Error(`Render service rejected the job (${r.status})`);

    return Response.json({ id: jobId });
  } catch (e: any) {
    await refundCredits(uid, cost, `avatar failed: ${jobId}`).catch(() => {});
    await adminDb
      .collection("generations")
      .doc(jobId)
      .set({ status: "failed", error: String(e?.message || e) }, { merge: true })
      .catch(() => {});
    return Response.json({ error: e?.message || "Failed to start render" }, { status: 500 });
  }
}
