import { NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebase-admin";

export async function GET() {
  try {
    const docRef = adminDb.collection("sessions").doc("unicef");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const defaultState = {
        currentSegmentId: "welcome",
        mode: "video",
        gesture: "none",
        subtitles: "Good evening, class. Welcome to my classroom...",
        isPlaying: false,
        updatedAt: Date.now(),
      };
      await docRef.set(defaultState);
      return NextResponse.json(defaultState);
    }

    return NextResponse.json(docSnap.data());
  } catch (error: any) {
    console.error("Error in GET /api/session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const docRef = adminDb.collection("sessions").doc("unicef");

    const updateData: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (body.currentSegmentId !== undefined) updateData.currentSegmentId = body.currentSegmentId;
    if (body.mode !== undefined) updateData.mode = body.mode;
    if (body.gesture !== undefined) updateData.gesture = body.gesture;
    if (body.subtitles !== undefined) updateData.subtitles = body.subtitles;
    if (body.isPlaying !== undefined) updateData.isPlaying = body.isPlaying;
    if (body.activeResponseId !== undefined) updateData.activeResponseId = body.activeResponseId;

    await docRef.set(updateData, { merge: true });

    // Fetch the fully merged doc to return it
    const updatedSnap = await docRef.get();
    return NextResponse.json({ success: true, state: updatedSnap.data() });
  } catch (error: any) {
    console.error("Error in POST /api/session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
