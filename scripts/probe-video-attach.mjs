/**
 * Works out how to attach a VIDEO to a prompt, for both models the product
 * talks to, instead of assuming:
 *
 *   • gemini-3.5-flash  — the storyline agent's model, generateContent @ global
 *   • gemini-omni-flash-preview — video generation, Interactions API @ global
 *
 * Two delivery shapes are possible for Gemini and they have very different
 * limits, so both are tried:
 *   inlineData  — base64 in the request body. Simple, but the whole request has
 *                 to fit the API's payload ceiling (~20MB before encoding).
 *   fileData    — a gs:// URI the model reads directly. No payload ceiling, but
 *                 the object has to already be in a bucket the project can read.
 *
 *   node scripts/probe-video-attach.mjs [path-to.mp4]
 *
 * FINDINGS (2026-08-05, davelabs-tools):
 *   • gemini-3.5-flash + inlineData video/mp4 → WORKS. It genuinely watches the
 *     clip: given the portal juice ad it described the splash, the bottle, the
 *     halved oranges and the mint, and named the dominant colour. This is what
 *     the storyline agent now uses.
 *   • gemini-3.5-flash + fileData gs:// → shape ACCEPTED, request failed only
 *     with "No such object" (the probe pointed at a path that isn't in the
 *     bucket). It was not confirmed end-to-end because the local SA
 *     (optiq-sa@) lacks storage.objects.create, so no test object could be
 *     staged from this machine. Worth finishing from a context with write
 *     access: fileData sidesteps the ~20MB inline payload ceiling entirely.
 *   • gemini-omni-flash-preview + step_list `{type:"video"}` → ACCEPTED, which
 *     matches what functions/omniVideo.js buildInput() already sends.
 */

import { GoogleAuth } from "google-auth-library";
import { GoogleGenAI } from "@google/genai";
import { readFile } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const BUCKET = "davelabs-tools";
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), "secrets", "davelabs-tools-sa.json");
}

const CLIP = process.argv[2] || path.join(process.cwd(), "public", "media", "portal-video.mp4");
const ASK = "Describe what happens in this video in one sentence, and name its dominant colour.";

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const token = async () => (await (await auth.getClient()).getAccessToken()).token;

/** Same routing vertexFetch() uses: these models serve at global/v1beta1. */
const url = (model) =>
  `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global` +
  `/publishers/google/models/${model}:generateContent`;

async function generateContent(model, parts, label) {
  try {
    const res = await fetch(url(model), {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    });
    const body = await res.text();
    if (!res.ok) {
      const msg = (() => {
        try {
          return JSON.parse(body).error?.message || body;
        } catch {
          return body;
        }
      })();
      console.log(`  ✗ ${label} → ${res.status}: ${msg.replace(/\s+/g, " ").slice(0, 220)}`);
      return false;
    }
    const said = (JSON.parse(body).candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();
    console.log(`  ✓ ${label} → 200`);
    console.log(`    model said: ${said.replace(/\s+/g, " ").slice(0, 200)}`);
    return true;
  } catch (e) {
    console.log(`  ✗ ${label} threw: ${e.message.slice(0, 150)}`);
    return false;
  }
}

async function main() {
  const buf = await readFile(CLIP);
  const b64 = buf.toString("base64");
  console.log(`clip: ${CLIP}`);
  console.log(`size: ${(buf.length / 1024 / 1024).toFixed(2)} MB raw, ${(b64.length / 1024 / 1024).toFixed(2)} MB base64\n`);

  console.log("═══ gemini-3.5-flash (storyline agent) ═══");
  await generateContent(
    "gemini-3.5-flash",
    [{ inlineData: { mimeType: "video/mp4", data: b64 } }, { text: ASK }],
    "inlineData video/mp4"
  );
  await generateContent(
    "gemini-3.5-flash",
    [
      { fileData: { fileUri: `gs://${BUCKET}/media/portal-video.mp4`, mimeType: "video/mp4" } },
      { text: ASK },
    ],
    "fileData gs:// URI"
  );

  console.log("\n═══ gemini-omni-flash-preview (video gen) ═══");
  // Omni is Interactions-only and takes a step list, not `contents`.
  const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "global" });
  try {
    const interaction = await ai.interactions.create({
      model: "gemini-omni-flash-preview",
      input: [
        {
          type: "user_input",
          content: [
            { type: "video", data: b64, mime_type: "video/mp4" },
            { text: "Continue this shot for 4 seconds, same product, same lighting.", type: "text" },
          ],
        },
      ],
      background: true,
      store: true,
    });
    console.log(`  ✓ step_list with a video part ACCEPTED — interaction ${interaction.id} (${interaction.status})`);
    console.log(`    (not polled to completion; acceptance is what we needed to know)`);
  } catch (e) {
    console.log(`  ✗ step_list video part → ${e.message.replace(/\s+/g, " ").slice(0, 220)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
