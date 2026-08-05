/**
 * Proves out Lyria 3 Pro on Vertex.
 *
 * The catalog lists lyria-3-{pro,clip}-preview under us-central1, but every
 * combination of {us-central1, us-east4, europe-west4, us-west1} x {v1,
 * v1beta1} x {predict, predictLongRunning} 404s. That is not an access
 * problem — Lyria 3 simply is not on the :predict surface at all.
 *
 * The SDK's own types are the giveaway: both Lyria 3 ids appear in the model
 * union used by the INTERACTIONS API (`Model_2` in dist/node/node.d.ts, right
 * beside the gemini-3 ids), and Interaction carries an `output_audio?:
 * AudioContent` field. Same move Google made with omni video — see
 * functions/omniVideo.js. So Lyria 3 is background + poll at `global`, not
 * :predict at us-central1.
 *
 *   node scripts/probe-lyria3.mjs
 */

import { GoogleGenAI } from "@google/genai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), "secrets", "davelabs-tools-sa.json");
}

const OUT = path.join(process.cwd(), "tmp-lyria3");
const PROMPT =
  "An upbeat, vibey, cinematic brand-advert instrumental with rich layered percussion, a memorable " +
  "melodic hook on kora or guitar, warm bass, uplifting brass and evolving dynamics — energetic, " +
  "emotional and modern. Not a plain repetitive loop. No vocals, no lyrics.";

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "global" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reads a RIFF/WAVE header. Walks chunks rather than trusting the first size
 *  field, and falls back to the real byte count when the declared data size
 *  overruns the buffer (lyria-002 declares one that does). */
function describeAudio(buf) {
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WAVE") {
    let pos = 12;
    let fmt = null;
    while (pos + 8 <= buf.length) {
      const id = buf.slice(pos, pos + 4).toString();
      const size = buf.readUInt32LE(pos + 4);
      if (id === "fmt ") {
        fmt = {
          channels: buf.readUInt16LE(pos + 10),
          sampleRate: buf.readUInt32LE(pos + 12),
          bitsPerSample: buf.readUInt16LE(pos + 22),
        };
      } else if (id === "data" && fmt) {
        const bytesPerSec = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
        const actual = Math.min(size, buf.length - pos - 8);
        return { format: "WAV", ...fmt, seconds: +(actual / bytesPerSec).toFixed(2) };
      }
      pos += 8 + size + (size % 2);
    }
    return { format: "WAV", ...fmt, seconds: null };
  }
  if (buf.slice(4, 8).toString() === "ftyp") return { format: "MP4/M4A container" };
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { format: "MP3" };
  return { format: `unknown (starts ${JSON.stringify(buf.slice(0, 4).toString("hex"))})` };
}

async function probe(model) {
  console.log(`\n═══ ${model} — interactions.create @ global ═══`);
  const started = Date.now();

  let interaction = await ai.interactions.create({
    model,
    input: PROMPT,
    background: true,
    store: true,
  });
  console.log(`  interaction ${interaction.id} (${interaction.status})`);

  const deadline = Date.now() + 8 * 60 * 1000;
  while (interaction.status === "in_progress" || interaction.status === "queued") {
    if (Date.now() > deadline) throw new Error("timed out");
    await sleep(5000);
    interaction = await ai.interactions.get(interaction.id);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  if (interaction.status !== "completed") {
    console.log(`  ✗ ${interaction.status} after ${elapsed}s`);
    if (interaction.output_text) console.log(`    said: ${String(interaction.output_text).slice(0, 300)}`);
    return;
  }

  const audio = interaction.output_audio;
  if (!audio?.data) {
    console.log(`  ⚠ completed in ${elapsed}s but no output_audio.data`);
    console.log(`    keys: ${JSON.stringify(Object.keys(interaction)).slice(0, 300)}`);
    return;
  }

  const buf = Buffer.from(audio.data, "base64");
  const info = describeAudio(buf);
  await mkdir(OUT, { recursive: true });
  const ext = info.format === "WAV" ? "wav" : info.format === "MP3" ? "mp3" : "bin";
  const dest = path.join(OUT, `${model}.${ext}`);
  await writeFile(dest, buf);

  console.log(`  ✓ completed in ${elapsed}s`);
  console.log(`    mime: ${audio.mime_type || "(none)"} · ${(buf.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    ${JSON.stringify(info)}`);
  console.log(`    saved → ${dest}`);
}

for (const model of ["lyria-3-pro-preview", "lyria-3-clip-preview"]) {
  try {
    await probe(model);
  } catch (e) {
    console.log(`  ✗ ${model} threw: ${e.message.replace(/\s+/g, " ").slice(0, 400)}`);
  }
}
