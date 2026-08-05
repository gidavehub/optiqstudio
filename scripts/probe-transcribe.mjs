/**
 * Checks whether gemini-3.5-flash can transcribe an audio packet, which is what
 * the storyline agent's mic needs to do instead of using the browser's Web
 * Speech API.
 *
 * Round-trip test, so there's a known-correct answer to compare against: speak
 * a fixed sentence with the TTS model, hand the resulting audio straight back
 * to 3.5-flash, and see whether the transcript matches what we asked it to say.
 * The sentence deliberately carries Gambian/Nigerian proper nouns — the exact
 * words browser dictation mangles, and the whole reason for moving off it.
 *
 *   node scripts/probe-transcribe.mjs
 */

import { GoogleAuth } from "google-auth-library";
import { writeFile } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), "secrets", "davelabs-tools-sa.json");
}

const TTS_MODEL = "gemini-3.1-flash-tts-preview";
const TEXT_MODEL = "gemini-3.5-flash";
const SPOKEN =
  "Scene four drags. Give it a real event, and land the Banjul tub in shot before Amaka turns to camera.";

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const token = async () => (await (await auth.getClient()).getAccessToken()).token;

const url = (model) =>
  `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global` +
  `/publishers/google/models/${model}:generateContent`;

async function post(model, body) {
  const res = await fetch(url(model), {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${model} → ${res.status}: ${text.replace(/\s+/g, " ").slice(0, 300)}`);
  return JSON.parse(text);
}

/** Raw PCM out of the TTS model needs a RIFF header before anything will read it. */
function pcmToWav(pcmBase64, sampleRate = 24000) {
  const pcm = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function main() {
  console.log(`Speaking with ${TTS_MODEL}:\n  "${SPOKEN}"\n`);
  const spoken = await post(TTS_MODEL, {
    contents: [{ role: "user", parts: [{ text: SPOKEN }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    },
  });
  const audioPart = spoken.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!audioPart) throw new Error("TTS returned no audio");

  const rate = Number((audioPart.inlineData.mimeType.match(/rate=(\d+)/) || [])[1]) || 24000;
  const wav = pcmToWav(audioPart.inlineData.data, rate);
  await writeFile("probe-speech.wav", wav);
  console.log(`  ✓ got ${(wav.length / 1024).toFixed(0)} KB of audio (${audioPart.inlineData.mimeType}) → probe-speech.wav\n`);

  // Now hand it back. Same inlineData shape the image/video attachments use.
  console.log(`Transcribing with ${TEXT_MODEL} (inlineData audio/wav)…`);
  const heard = await post(TEXT_MODEL, {
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/wav", data: wav.toString("base64") } },
          {
            text:
              "Transcribe this audio verbatim. Return only the transcript — no preamble, " +
              "no quotes, no commentary. If there is no speech, return nothing.",
          },
        ],
      },
    ],
  });
  const transcript = (heard.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();

  console.log(`  ✓ transcript: "${transcript}"\n`);

  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const said = norm(SPOKEN).split(" ");
  const got = new Set(norm(transcript).split(" "));
  const hits = said.filter((w) => got.has(w)).length;
  console.log(`  word recall: ${hits}/${said.length} (${Math.round((hits / said.length) * 100)}%)`);
  console.log(hits / said.length > 0.8 ? "  ✓ VIABLE for the agent mic" : "  ✗ too lossy — do not ship");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
