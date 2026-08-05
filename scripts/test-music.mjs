/**
 * Test harness for Optiq Music (Lyria 3 Pro) — replicates exactly what the
 * musicGenerate Cloud Function now sends to Vertex, so we can confirm it
 * returns a real audio file BEFORE trusting the front end.
 *
 * Lyria 3 is on the INTERACTIONS API, not :predict — see the comment above
 * LYRIA_MODEL in functions/index.js for why, and scripts/probe-lyria3.mjs for
 * the evidence. It also rejects background:true, so this is a blocking create.
 *
 *   node scripts/test-music.mjs
 *   node scripts/test-music.mjs "your own prompt here"
 */
import { GoogleGenAI } from "@google/genai";
import { writeFile } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const MODEL = "lyria-3-pro-preview";
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), "secrets", "davelabs-tools-sa.json");
}

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "global" });

const prompt =
  process.argv[2] ||
  "A warm, uplifting afrobeat instrumental bed with gentle percussion for a brand advert, no vocals";

/** Duration without ffmpeg: WAV from its header, MP3 by walking frame headers. */
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
        const bps = fmt.sampleRate * fmt.channels * (fmt.bitsPerSample / 8);
        // Trust the buffer over the declared size — lyria-002 overstates it.
        return { format: "WAV", ...fmt, seconds: +(Math.min(size, buf.length - pos - 8) / bps).toFixed(2) };
      }
      pos += 8 + size + (size % 2);
    }
    return { format: "WAV", ...fmt, seconds: null };
  }

  const MPEG_RATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const SAMPLE_RATES = [44100, 48000, 32000, 0];
  // Skip an ID3v2 tag if present; its size is a syncsafe 28-bit integer.
  let i =
    buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33
      ? 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f))
      : 0;
  let frames = 0;
  let sampleRate = 0;
  let totalBitrate = 0;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) break;
    const bitrate = MPEG_RATES[(buf[i + 2] & 0xf0) >> 4];
    sampleRate = SAMPLE_RATES[(buf[i + 2] & 0x0c) >> 2];
    if (!bitrate || !sampleRate) break;
    const padding = (buf[i + 2] & 0x02) >> 1;
    const len = Math.floor((144 * bitrate * 1000) / sampleRate) + padding;
    if (len <= 0) break;
    frames++;
    totalBitrate += bitrate;
    i += len;
  }
  if (frames > 0) {
    return {
      format: "MP3",
      sampleRate,
      frames,
      avgKbps: Math.round(totalBitrate / frames),
      seconds: +((frames * 1152) / sampleRate).toFixed(2),
    };
  }
  return { format: `unknown (starts 0x${buf.slice(0, 4).toString("hex")})` };
}

async function main() {
  console.log(`model:  ${MODEL} (interactions.create @ global)`);
  console.log(`prompt: ${prompt}\n`);

  const started = Date.now();
  const interaction = await ai.interactions.create({ model: MODEL, input: prompt });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`status: ${interaction.status} in ${elapsed}s`);
  if (interaction.status !== "completed") {
    console.error("FAIL:", String(interaction.output_text || "").slice(0, 400));
    process.exit(1);
  }

  const audio = interaction.output_audio;
  if (!audio?.data) {
    console.error("FAIL: no output_audio. keys:", Object.keys(interaction).join(", "));
    process.exit(1);
  }

  const buf = Buffer.from(audio.data, "base64");
  const info = describeAudio(buf);
  const out = process.env.OUT || `test-music.${info.format === "WAV" ? "wav" : "mp3"}`;
  await writeFile(out, buf);

  console.log(`mime:   ${audio.mime_type || "(none)"}`);
  console.log(`audio:  ${JSON.stringify(info)}`);
  console.log(`\n✓ wrote ${out} (${(buf.length / 1024).toFixed(0)} KB)`);

  // Lyria 3 Pro's length varies run to run (64s and 114s observed on the same
  // prompt). The charge is flat, so that is fine — but flag anything outside
  // the observed band, since a track much shorter than an ad is a real problem.
  if (info.seconds && (info.seconds < 45 || info.seconds > 150)) {
    console.log(`\n⚠ ${info.seconds}s is outside the 45-150s band seen so far — worth a look.`);
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
