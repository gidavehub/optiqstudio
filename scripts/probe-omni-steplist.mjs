/**
 * Probe: verifies the step_list input format for gemini-omni-flash-preview
 * after the Interactions API moved to the steps-based version, which rejects
 * the old turn_list shape with:
 *   400 "When using the steps-based API version, use step_list input format
 *        instead of turn_list."
 *
 * Tests three shapes so we know exactly what the live API accepts:
 *   1. bare string            (what text-only scenes used to send)
 *   2. turn_list + image      (the shape that is now failing — expect 400)
 *   3. step_list + image      (the fix)
 *
 * Run: node scripts/probe-omni-steplist.mjs
 */
import { GoogleGenAI } from "@google/genai";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const MODEL = "gemini-omni-flash-preview";
const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "global" });

const PROMPT = "A calm ocean wave rolling at sunset, cinematic. Render an approximately 4-second video.";

// 1x1 red PNG — enough to exercise the media path without a big upload.
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const cases = [
  {
    name: "1. bare string (no media)",
    input: PROMPT,
  },
  {
    name: "2. turn_list + image  [expected to FAIL]",
    input: [
      {
        role: "user",
        content: [
          { type: "image", data: TINY_PNG, mime_type: "image/png" },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  },
  {
    name: "3. step_list + image  [the fix]",
    input: [
      {
        type: "user_input",
        content: [
          { type: "image", data: TINY_PNG, mime_type: "image/png" },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  },
];

for (const c of cases) {
  process.stdout.write(`\n=== ${c.name} ===\n`);
  try {
    const interaction = await ai.interactions.create({
      model: MODEL,
      input: c.input,
      background: true,
      store: true,
    });
    console.log(`  ACCEPTED — id=${interaction.id} status=${interaction.status}`);
    // Cancel immediately; we only care that the request shape was accepted.
    try {
      await ai.interactions.cancel(interaction.id);
      console.log("  (cancelled to avoid burning a full render)");
    } catch {
      /* cancel is best-effort */
    }
  } catch (err) {
    const msg = String(err?.message || err);
    console.log(`  REJECTED — ${msg.slice(0, 300)}`);
  }
}
console.log("\nDone.");
