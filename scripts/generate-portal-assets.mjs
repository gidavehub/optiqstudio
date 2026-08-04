/**
 * DASHBOARD PORTAL ASSET GENERATOR
 *
 * Media for the two portal cards on /dashboard. The old dash-* clips sold the
 * *tool* (a camera, a mixing desk, a microphone) — this set sells the *output*:
 * a finished juice ad, a brand identity kit, a voice artist working, a producer
 * building a beat. Everything is high-key on white so it sits on the light app
 * canvas without a tint.
 *
 * Video  → gemini-omni-flash-preview, Interactions API, background + poll.
 * Images → gemini-3.1-flash-image at the global endpoint, 4:3.
 * Vertex AI on davelabs-tools only, via secrets/davelabs-tools-sa.json.
 *
 *   node scripts/generate-portal-assets.mjs            # skips what exists
 *   node scripts/generate-portal-assets.mjs --force    # regenerates everything
 *   node scripts/generate-portal-assets.mjs voice music
 */

import { GoogleGenAI } from "@google/genai";
import { GoogleAuth } from "google-auth-library";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";
import sharp from "sharp";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const OUT = path.join(process.cwd(), "public", "media");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), "secrets", "davelabs-tools-sa.json");
}

const VIDEO_MODEL = "gemini-omni-flash-preview";
const IMAGE_MODEL = "gemini-3.1-flash-image";
const IMAGE_URL = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${IMAGE_MODEL}:generateContent`;

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "global" });
const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const token = async () => (await (await auth.getClient()).getAccessToken()).token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── What we're making ──────────────────────────────────────────────────── */

const VIDEOS = [
  {
    id: "storyboard",
    file: "portal-storyboard.mp4",
    prompt:
      "=== STYLE === REGISTER: premium brand commercial, the finished ad — not the equipment that made it. " +
      "OPTICS: shallow depth of field, crisp modern lens, gentle halation. " +
      "MOTION: one confident slow push-in. " +
      "LIGHTING: bright high-key daylight, large soft sources, clean and airy. " +
      "COLOR: warm neutrals with one vivid accent, light and colourful, never murky. " +
      "DURATION: exactly 6 seconds, a single continuous shot. " +
      "SOUND (diegetic only): none. " +
      "ACTION: A polished lifestyle commercial moment — a stylish young Nigerian woman in a bright modern " +
      "apartment turning to camera and smiling as she lifts a beautifully packaged product, sunlight " +
      "flooding the white room behind her. Looks like a finished television ad, not a behind-the-scenes shot. " +
      "No text, no captions, no logos, no watermark.",
  },
  {
    id: "video",
    file: "portal-video.mp4",
    prompt:
      "=== STYLE === REGISTER: high-end beverage commercial, bright and appetising. " +
      "OPTICS: macro product photography, tack sharp, high key. " +
      "MOTION: slow orbital push around the bottle as juice arcs through frame in slow motion. " +
      "LIGHTING: bright studio key on a clean white seamless backdrop, soft shadows only. " +
      "COLOR: vivid orange and fresh green on pure white — saturated, colourful, high brightness. " +
      "DURATION: exactly 6 seconds, one continuous shot. " +
      "SOUND (diegetic only): none. " +
      "ACTION: A chilled glass bottle of fresh orange juice on a white studio backdrop, condensation " +
      "beading down the glass, halved oranges and mint beside it, a ribbon of juice splashing through " +
      "the air in slow motion. Pure white background throughout. " +
      "No text, no captions, no logos, no watermark, no brand names.",
  },
];

const IMAGE_STYLE =
  "editorial commercial photography, photorealistic, bright high-key lighting, clean pure white background, " +
  "vivid saturated colour, crisp and airy, shallow depth of field, no text, no captions, no watermark, no logos";

const IMAGES = [
  {
    id: "image",
    file: "portal-image.jpg",
    prompt:
      "A brand identity kit laid out on a clean white surface, shot from above: a bold abstract logo mark " +
      "printed large on a card, a row of bright colour swatch chips in coral, teal and yellow, elegant " +
      "business cards, a branded pouch and a branded cup arranged neatly — the kind of polished brand " +
      "presentation an agency delivers to a client",
  },
  {
    id: "voice",
    file: "portal-voice.jpg",
    prompt:
      "A confident young Nigerian woman voice artist mid-performance in a bright white modern recording " +
      "room, headphones on, hand raised expressively, eyes closed, clearly delivering a line with feeling — " +
      "the performance is the subject, the equipment is barely in frame, sunlit and colourful",
  },
  {
    id: "music",
    file: "portal-music.jpg",
    prompt:
      "A young Nigerian music producer building a beat in a bright white studio, hands on a colourful " +
      "backlit drum-pad controller and keys, leaning into the groove, a singer softly out of focus behind " +
      "him performing into a booth, daylight flooding the room, energetic and colourful",
  },
];

/* ── Plumbing ───────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));
const wanted = (id) => only.length === 0 || only.includes(id);

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** interactions.create hangs past HTTP timeouts if it isn't backgrounded, so
 *  we create with background:true and poll — same shape as functions/omniVideo.js. */
async function generateVideo(item) {
  const interaction = await ai.interactions.create({
    model: VIDEO_MODEL,
    input: [{ type: "user_input", content: [{ type: "text", text: item.prompt }] }],
    background: true,
    store: true,
  });
  console.log(`    · interaction ${interaction.id} (${interaction.status})`);

  const deadline = Date.now() + 10 * 60 * 1000;
  let current = interaction;
  while (current.status === "in_progress" || current.status === "queued") {
    if (Date.now() > deadline) throw new Error(`timed out (interaction ${interaction.id})`);
    await sleep(5000);
    current = await ai.interactions.get(interaction.id);
  }
  if (current.status !== "completed") {
    throw new Error(`${current.status}${current.output_text ? `: ${String(current.output_text).slice(0, 200)}` : ""}`);
  }

  const video = current.output_video;
  if (video?.data) return Buffer.from(video.data, "base64");
  if (video?.uri) {
    const res = await fetch(video.uri);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("completed but returned no video");
}

async function generateImage(item) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(IMAGE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${item.prompt}. ${IMAGE_STYLE}` }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "4:3" } },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const inline = data.candidates?.[0]?.content?.parts?.find((x) => x.inlineData)?.inlineData;
      if (!inline?.data) throw new Error("no image returned");
      // Vertex hands back a 1200px PNG (~1.4 MB). These render as ~240px tiles,
      // so re-encode to JPEG at 2× the display size — same picture, a tenth of
      // the bytes on a screen the user sees immediately after login.
      return sharp(Buffer.from(inline.data, "base64"))
        .resize({ width: 900, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
    }
    const body = await res.text();
    if ((res.status === 429 || res.status === 503) && attempt < 4) {
      const wait = res.status === 429 ? 35000 : 6000;
      console.log(`    · ${res.status}; waiting ${wait / 1000}s then retry ${attempt}/4`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
}

async function run(item, make, gapMs) {
  if (!wanted(item.id)) return;
  const dest = path.join(OUT, item.file);
  if (!force && (await fileExists(dest))) {
    console.log(`  skip ${item.file} (exists — pass --force to redo)`);
    return;
  }
  console.log(`  … ${item.file}`);
  try {
    const buf = await make(item);
    await writeFile(dest, buf);
    console.log(`  ✓ ${item.file} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  } catch (e) {
    console.error(`  ✗ ${item.file}: ${e.message}`);
  }
  await sleep(gapMs);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`Portal assets → ${OUT}\n`);

  console.log("Images:");
  for (const item of IMAGES) await run(item, generateImage, 12000);

  console.log("\nVideos:");
  for (const item of VIDEOS) await run(item, generateVideo, 10000);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
