/**
 * Generates the Optiq Studio Enterprise imagery (cinematic, production-quality,
 * Nigerian / Black subjects per brand rule) into public/media/enterprise/.
 * Vertex AI on davelabs-tools only. Mirrors generate-voice-assets.mjs.
 *
 *   node scripts/generate-enterprise-assets.mjs
 */

import { GoogleAuth } from "google-auth-library";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const IMAGE_MODEL = "gemini-3.1-flash-image"; // GA, served at the global endpoint
const IMAGE_URL = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${IMAGE_MODEL}:generateContent`;
const OUT = path.join(process.cwd(), "public", "media", "enterprise");

const STYLE =
  "cinematic, photorealistic, premium advertising production quality, natural warm lighting, " +
  "shallow depth of field, editorial color grade, 16:9, no text, no watermark, no logos";

const SHOTS = [
  {
    id: "enterprise-hero",
    prompt:
      "A behind-the-scenes commercial film set: a confident Nigerian creative director in stylish " +
      "modern attire reviewing a shot on a professional cinema-camera monitor, film crew softly out " +
      "of focus behind, warm production lighting",
  },
  {
    id: "enterprise-collab",
    prompt:
      "Two Nigerian brand strategists and a creative collaborating in a bright modern studio, reviewing " +
      "storyboard frames on a large wall screen, engaged and professional, editorial photography",
  },
  {
    id: "enterprise-campaign",
    prompt:
      "A polished commercial ad still: a confident Nigerian entrepreneur presenting a product in a " +
      "beautifully lit contemporary set, cinematic color grade, high-end brand campaign look",
  },
  {
    id: "enterprise-craft",
    prompt:
      "Close-up of hands colour-grading a video on a professional editing suite with calibrated cinema " +
      "monitors glowing, moody high-end post-production studio",
  },
];

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const token = async () => (await (await auth.getClient()).getAccessToken()).token;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function postJson(url, body, label) {
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      if (attempt >= 4) throw e;
      await sleep(5000);
      continue;
    }
    if (res.ok) return res.json();
    const t = await res.text();
    if ((res.status === 429 || res.status === 503) && attempt < 4) {
      const wait = res.status === 429 ? 35000 : 6000;
      console.log(`    · ${res.status} on ${label}; waiting ${wait / 1000}s then retry ${attempt}/4`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${label} → ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`Enterprise imagery → ${OUT}`);
  for (const shot of SHOTS) {
    const out = path.join(OUT, `${shot.id}.jpg`);
    if (await fileExists(out)) {
      console.log(`  skip ${shot.id} (exists)`);
      continue;
    }
    console.log(`  … ${shot.id}`);
    try {
      const data = await postJson(
        IMAGE_URL,
        {
          contents: [{ role: "user", parts: [{ text: `${shot.prompt}. ${STYLE}` }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9" } },
        },
        shot.id
      );
      const inline = data.candidates?.[0]?.content?.parts?.find((x) => x.inlineData)?.inlineData;
      if (!inline?.data) throw new Error("no image returned");
      await writeFile(out, Buffer.from(inline.data, "base64"));
      console.log(`  ✓ ${shot.id}.jpg`);
    } catch (e) {
      console.error(`  ✗ ${shot.id}: ${e.message}`);
    }
    await sleep(12000); // stay under the per-minute image cap
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
