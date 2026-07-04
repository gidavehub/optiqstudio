import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "../../../lib/auth-server";
import { generateText } from "../../../lib/vertex";

/** Rewrites a rough idea into a rich cinematic video prompt (free action). */
export async function POST(req: NextRequest) {
  try {
    await requireUser(req);
    const { prompt } = await req.json();
    if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

    const enhanced = await generateText({
      system:
        "You are a cinematography prompt director for a text-to-video model. " +
        "Rewrite the user's idea as one vivid generation prompt under 120 words: " +
        "subject, action, setting, camera movement, lens, lighting, mood, and " +
        "color grade. Output only the prompt text — no preamble, no quotes.",
      prompt,
    });

    return NextResponse.json({ prompt: enhanced });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status }
    );
  }
}
