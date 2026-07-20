/**
 * Generates the supporting images for the Storyboard Wizard "Brand Profile &
 * Subject Look" step (main-character-lock vs multiple-people/product-focus
 * option cards), using Vertex AI on davelabs-tools (NEVER AI Studio).
 *
 * Prereq: ADC for davelabs01@gmail.com —
 *   gcloud auth application-default login
 *   gcloud config set project davelabs-tools
 *
 * Run:  node scripts/generate-wizard-assets.mjs
 * Idempotent: existing files in public/media are skipped; delete one to regenerate.
 */

import { GoogleAuth } from "google-auth-library";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const OUT = path.join(process.cwd(), "public", "media");

const IMAGES = [
  {
    file: "wizard-character-lock.jpg",
    aspect: "16:9",
    prompt:
      "Cinematic triptych contact sheet, three film frames side by side: the EXACT same young Gambian woman with deep dark skin, neat thin cornrow braids and a solid mustard-yellow blouse appears in all three frames — frame one she bargains at a wooden-and-zinc market stall, frame two she cooks over a charcoal stove in a family compound kitchen, frame three she walks down a palm-lined Serrekunda street. Identical face, hair and outfit in every frame, warm honest daylight, photorealistic advertising photography",
  },
  {
    file: "wizard-product-focus.jpg",
    aspect: "16:9",
    prompt:
      "Cinematic triptych contact sheet, three film frames side by side, each featuring a DIFFERENT Gambian person with deep dark skin holding the exact same glass jar of golden groundnut paste with a red label — frame one an elderly market woman in a colorful headwrap, frame two a young man in a football jersey at a bitik kiosk, frame three a schoolgirl at a breakfast table spreading it on tapalapa bread. Same identical product jar in every frame, warm honest daylight, photorealistic advertising photography",
  },
];

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });

async function token() {
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error("No access token — run: gcloud auth application-default login");
  return t.token;
}

async function post(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${url.split("/models/")[1] ?? url} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function exists(file) {
  try {
    await access(path.join(OUT, file));
    return true;
  } catch {
    return false;
  }
}

async function genImage({ file, prompt, aspect }) {
  if (await exists(file)) return console.log(`  skip ${file} (exists)`);

  const model = "gemini-3.1-flash-image-preview";
  const url = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;

  await new Promise((r) => setTimeout(r, 12000));
  console.log(`  … generating ${file} using ${model} (global)`);

  const attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const data = await post(url, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: aspect } },
      });

      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part) throw new Error("No image data in response");

      await writeFile(path.join(OUT, file), Buffer.from(part.inlineData.data, "base64"));
      console.log(`  ✓ ${file}`);
      return;
    } catch (err) {
      console.warn(`  ⚠ Attempt ${i}/${attempts} for ${file} failed: ${err.message.slice(0, 150)}`);
      if (i < attempts && err.message.includes("429")) {
        console.log("  … 429 rate limit hit. Sleeping for 25s before retry…");
        await new Promise((r) => setTimeout(r, 25000));
      } else if (i === attempts) {
        throw err;
      }
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`Generating wizard assets → ${OUT}\n`);
  for (const img of IMAGES) {
    try {
      await genImage(img);
    } catch (err) {
      console.error(`  ✗ ${img.file}: ${err.message}`);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
