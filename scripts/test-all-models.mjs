/**
 * Quick health check of every Vertex model Optiq Studio uses.
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\Projects\optiq\secrets\davelabs-tools-sa.json
 *   node scripts/test-all-models.mjs
 */
import { GoogleAuth } from "google-auth-library";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const P = "davelabs-tools";
const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const tok = async () => (await (await auth.getClient()).getAccessToken()).token;

const glob = (m) => `https://aiplatform.googleapis.com/v1beta1/projects/${P}/locations/global/publishers/google/models/${m}:generateContent`;
const central = (m, method) => `https://us-central1-aiplatform.googleapis.com/v1/projects/${P}/locations/us-central1/publishers/google/models/${m}:${method}`;

const results = [];
async function run(label, model, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ label, model, ok: true, secs: ((Date.now() - t0) / 1000).toFixed(1), detail });
  } catch (e) {
    results.push({ label, model, ok: false, secs: ((Date.now() - t0) / 1000).toFixed(1), detail: String(e.message || e).slice(0, 90) });
  }
}
async function postJson(url, body) {
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${await tok()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).replace(/\s+/g, " ").slice(0, 80)}`);
  return r.json();
}

async function main() {
  // 1) TEXT — gemini-3.5-flash (storyboard swarm, enhance, narration writer)
  await run("Text", "gemini-3.5-flash", async () => {
    const j = await postJson(glob("gemini-3.5-flash"), { contents: [{ role: "user", parts: [{ text: "Reply with the single word: OK" }] }] });
    const t = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
    return `reply="${t}"`;
  });

  // 2) IMAGE — gemini-3.1-flash-image
  await run("Image", "gemini-3.1-flash-image", async () => {
    const j = await postJson(glob("gemini-3.1-flash-image"), { contents: [{ role: "user", parts: [{ text: "a red apple, product photo" }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "1:1" } } });
    const il = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!il?.data) throw new Error("no image returned");
    return `${il.mimeType} ${(Buffer.from(il.data, "base64").length / 1024).toFixed(0)}KB`;
  });

  // 3) TTS — gemini-3.1-flash-tts-preview
  await run("TTS", "gemini-3.1-flash-tts-preview", async () => {
    const j = await postJson(glob("gemini-3.1-flash-tts-preview"), { contents: [{ role: "user", parts: [{ text: "Hello from Optiq Studio." }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Enceladus" } } } } });
    const il = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (!il?.data) throw new Error("no audio returned");
    return `${il.mimeType?.slice(0, 24)} ${(Buffer.from(il.data, "base64").length / 1024).toFixed(0)}KB`;
  });

  // 4) MUSIC — lyria-002
  await run("Music", "lyria-002", async () => {
    const j = await postJson(central("lyria-002", "predict"), { instances: [{ prompt: "A warm uplifting instrumental for a brand advert, no vocals" }], parameters: { sample_count: 1 } });
    const b = j.predictions?.[0]?.bytesBase64Encoded;
    if (!b) throw new Error("no audio returned");
    return `WAV ${(Buffer.from(b, "base64").length / 1024).toFixed(0)}KB`;
  });

  // 5) VIDEO — gemini-omni-flash-preview (Interactions API; create only, no wait)
  await run("Video (Omni)", "gemini-omni-flash-preview", async () => {
    const { GoogleGenAI } = require("C:/Projects/optiq/functions/node_modules/@google/genai");
    const ai = new GoogleGenAI({ vertexai: true, project: P, location: "global" });
    const it = await ai.interactions.create({
      model: "gemini-omni-flash-preview",
      input: [{ type: "user_input", content: [{ type: "text", text: "a calm ocean wave at sunset, 5 seconds" }] }],
      background: true, store: true,
    });
    if (!it?.id) throw new Error("no interaction id");
    return `interaction ${it.id.slice(0, 12)}… status=${it.status}`;
  });

  console.log("\n  MODEL                            RESULT");
  console.log("  " + "─".repeat(70));
  for (const r of results) {
    const mark = r.ok ? "✓ OK  " : "✗ FAIL";
    console.log(`  ${mark} ${r.label.padEnd(14)} ${r.model.padEnd(30)} ${r.secs}s  ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n  ${results.length - failed}/${results.length} models healthy${failed ? ` — ${failed} FAILED` : " — all good"}`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
