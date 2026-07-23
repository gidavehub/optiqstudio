/**
 * Tests the ad-narration pipeline the storyboard now bakes: writeAdNarration
 * (Gemini picks a voice + writes narration + tagline) → ttsGenerate (Gemini 3.1
 * Flash TTS speaks both). Proves it returns real audio before we trust it.
 *
 *   set GOOGLE_APPLICATION_CREDENTIALS=...
 *   node scripts/test-voiceover.mjs
 */
import { GoogleAuth } from "google-auth-library";
import { writeFile } from "fs/promises";

const P = "davelabs-tools";
const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const token = async () => (await (await auth.getClient()).getAccessToken()).token;
const OUT = process.env.OUT || ".";

const VOICES = {
  "gambian-english": { voice: "Enceladus", style: "a warm, wise Gambian English advertisement narrator — calm, confident and emotive" },
  "nigerian-british-male": { voice: "Iapetus", style: "a polished Nigerian-British male advertisement narrator" },
  "nigerian-british-female": { voice: "Vindemiatrix", style: "a polished Nigerian-British female advertisement narrator" },
  "cinematic-deep": { voice: "Charon", style: "a deep, slow, wise cinematic narrator with gravitas" },
};

const glob = (m) => `https://aiplatform.googleapis.com/v1beta1/projects/${P}/locations/global/publishers/google/models/${m}:generateContent`;

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function writeAdNarration() {
  const schema = { type: "OBJECT", properties: { voiceKey: { type: "STRING", enum: Object.keys(VOICES) }, narration: { type: "STRING" }, tagline: { type: "STRING" } }, required: ["voiceKey", "narration", "tagline"] };
  const sys = `You are the NARRATION DIRECTOR for an Optiq Studio advert. The video is SILENT — you write the spoken narration read over the finished ad. Return JSON: voiceKey (default "gambian-english"), narration (main voiceover, 35-55 words, advertisement-style, only spoken words), tagline (closing line, 6-12 words).`;
  const brief = "Brand: Banjul Fresh Juice\nConcept: A vibrant Gambian juice brand made from local fruit, bringing families together with natural energy.\n\nScenes:\nScene 1: sunrise over a Gambian market, hands picking mangoes\nScene 2: family sharing juice at breakfast, smiling\nScene 3: the bottle hero shot with condensation";
  const j = await post(glob("gemini-3.5-flash"), { contents: [{ role: "user", parts: [{ text: brief }] }], systemInstruction: { parts: [{ text: sys }] }, generationConfig: { temperature: 0.85, responseMimeType: "application/json", responseSchema: schema } });
  return JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}");
}

function pcmToWav(b64, rate) {
  const pcm = Buffer.from(b64, "base64");
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return { wav: Buffer.concat([h, pcm]), durationSec: pcm.length / (rate * 2) };
}

async function tts(text, voiceName, style) {
  const j = await post(glob("gemini-3.1-flash-tts-preview"), {
    contents: [{ role: "user", parts: [{ text: `${style}:\n\n${text}` }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } } },
  });
  const raw = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!raw) throw new Error("no audio");
  const rate = parseInt((raw.mimeType || "").match(/rate=(\d+)/)?.[1] || "24000", 10);
  return pcmToWav(raw.data, rate);
}

async function main() {
  console.log("1) Writing narration (gemini-3.5-flash)…");
  const vo = await writeAdNarration();
  console.log(`   voiceKey: ${vo.voiceKey}`);
  console.log(`   narration: ${vo.narration}`);
  console.log(`   tagline: ${vo.tagline}`);
  const mapped = VOICES[vo.voiceKey] || VOICES["gambian-english"];

  console.log("\n2) Speaking narration (gemini-3.1-flash-tts-preview)…");
  const nar = await tts(vo.narration, mapped.voice, mapped.style);
  await writeFile(`${OUT}/test-narration.wav`, nar.wav);
  console.log(`   ✓ narration ${nar.durationSec.toFixed(1)}s (${(nar.wav.length / 1024).toFixed(0)}KB, RIFF=${nar.wav.slice(0, 4).toString("ascii") === "RIFF"})`);

  console.log("\n3) Speaking tagline…");
  const tag = await tts(vo.tagline, mapped.voice, mapped.style);
  await writeFile(`${OUT}/test-tagline.wav`, tag.wav);
  console.log(`   ✓ tagline ${tag.durationSec.toFixed(1)}s (${(tag.wav.length / 1024).toFixed(0)}KB, RIFF=${tag.wav.slice(0, 4).toString("ascii") === "RIFF"})`);

  console.log("\n✓ VOICEOVER PIPELINE OK");
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
