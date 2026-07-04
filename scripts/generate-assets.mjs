/**
 * Generates every media asset the Optiq Studio landing page and dashboard
 * reference, using Vertex AI on davelabs-tools (NEVER AI Studio).
 *
 * Prereq: ADC for davelabs01@gmail.com —
 *   gcloud auth application-default login
 *   gcloud config set project davelabs-tools
 *
 * Run:  node scripts/generate-assets.mjs
 * Idempotent: existing files in public/media are skipped; delete one to regenerate.
 */

import { GoogleAuth } from "google-auth-library";
import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const LOCATION = process.env.VERTEX_LOCATION || "us-east4";
const BASE = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/${LOCATION}`;

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: "global"
});
const VEO = "gemini-omni-flash-preview";
const IMAGE = "gemini-3.1-flash-image-preview";
const OUT = path.join(process.cwd(), "public", "media");

const IMAGES = [
  {
    file: "hero.jpg",
    aspect: "16:9",
    prompt:
      "Premium photograph of a happy young Gambian man and woman walking along the gorgeous sandy beach of Sanyang in The Gambia at sunset. Majestic palm trees swaying in the gentle ocean breeze, brilliant golden-orange sun reflecting off the gentle waves of the Atlantic, vibrant traditional cotton clothing, warm glowing natural light, photorealistic, serene and breathtaking beauty",
  },
  {
    file: "card-omni.jpg",
    aspect: "1:1",
    prompt:
      "Film still: three West African dwarf goats standing in a bright Sahel desert landscape, harsh sunlight, minimal composition, photorealistic cinematography",
  },
  {
    file: "card-robotics.jpg",
    aspect: "1:1",
    prompt:
      "Studio photograph of a precision robotic gripper arm being programmed by a young Black African robotics engineer in a tech lab, shallow depth of field, bright natural light",
  },
  {
    file: "card-worlds.jpg",
    aspect: "1:1",
    prompt:
      "Soft-focus interior scene of a cozy African-styled playroom with warm wooden furniture, vibrant Ankara-patterned cushions and toys, warm amber tones, dreamlike",
  },
  {
    file: "card-avatars.jpg",
    aspect: "1:1",
    prompt:
      "Portrait photograph of a smiling young Black African woman with elegant braided hair in a charcoal button-up shirt, bright blue sky background, natural daylight, editorial photography",
  },
  {
    file: "research-bg.jpg",
    aspect: "16:9",
    prompt:
      "Extremely soft-focus abstract background, olive green and warm amber tones blurred together like an out-of-focus meadow, no subjects, dreamy gradient",
  },
  {
    file: "app-video.jpg",
    aspect: "4:5",
    prompt:
      "Film still: a young Black African man in a flowing trench coat walking through a rain-soaked neon-lit market street in Nairobi at night, cinematic backlight, atmospheric haze",
  },
  {
    file: "app-multishot.jpg",
    aspect: "4:5",
    prompt:
      "Film still: a cheerful young Black African woman laughing, with a seagull flying close to her face on a bright beach boardwalk in Dakar, sunny, candid documentary photography",
  },
  {
    file: "app-scene.jpg",
    aspect: "4:5",
    prompt:
      "Film still: two Black African explorers in winter gear stepping through a doorway into a snowy pine forest, cold blue light, adventure film cinematography",
  },
  {
    file: "app-character.jpg",
    aspect: "4:5",
    prompt:
      "Studio portrait of a young Black African man with a confident expression, neutral gray background, soft key light, photorealistic, character reference sheet style",
  },
  {
    file: "app-avatar.jpg",
    aspect: "4:5",
    prompt:
      "Profile portrait of an elegant Black African woman with short hair wearing modern wireless earbuds, warm bronze lighting, dark background, editorial photography",
  },
  {
    file: "app-voice.jpg",
    aspect: "4:5",
    prompt:
      "Moody photograph of a vintage studio microphone in a dark recording booth, warm tungsten rim light, shallow depth of field",
  },
];

const VIDEOS = [
  {
    file: "hero.mp4",
    aspect: "16:9",
    prompt:
      "Slow cinematic horizontal panning shot of a happy young Gambian man and woman walking hand-in-hand along the gorgeous sandy beach of Sanyang in The Gambia at sunset. Majestic tall palm trees sway in the gentle breeze, brilliant warm golden sun reflecting off the gentle Atlantic ocean waves, wearing colorful modern Gambian clothing, photorealistic, serene, breathtakingly beautiful",
  },
  {
    file: "news-omni.mp4",
    aspect: "16:9",
    prompt:
      "Cinematic aerial shot slowly rising over a fog-covered mountain valley in the Drakensberg, South Africa at golden hour, birds crossing frame, warm sunlight breaking through clouds, epic scale, photorealistic film footage",
  },
  {
    file: "card-omni.mp4",
    aspect: "16:9",
    prompt:
      "Film still in motion: three West African dwarf goats standing in a bright savannah, heat shimmer, one goat turns its head toward camera, locked-off wide shot, photorealistic",
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
  console.log(`POSTING to URL: ${url}`);
  console.log(`BODY: ${JSON.stringify(body, null, 2)}`);
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

  // Rate-limiting delay before starting
  await new Promise(r => setTimeout(r, 12000));

  console.log(`  … generating ${file} using ${model} (global)`);
  
  let attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const data = await post(url, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: aspect } },
      });

      const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!part) throw new Error("No image data in response");

      await writeFile(path.join(OUT, file), Buffer.from(part.inlineData.data, "base64"));
      console.log(`  ✓ ${file} using ${model}`);
      return;
    } catch (err) {
      console.warn(`  ⚠ Attempt ${i}/${attempts} for ${file} failed: ${err.message.slice(0, 150)}`);
      if (i < attempts && err.message.includes("429")) {
        console.log(`  … 429 rate limit hit. Sleeping for 25s before retry…`);
        await new Promise(r => setTimeout(r, 25000));
      } else if (i === attempts) {
        throw err;
      }
    }
  }
}

async function genVideo({ file, prompt, aspect }) {
  if (await exists(file)) return console.log(`  skip ${file} (exists)`);
  
  const model = "gemini-omni-flash-preview";

  // Rate-limiting delay before starting
  await new Promise(r => setTimeout(r, 45000));

  console.log(`  … generating ${file} using ${model} (global)`);

  let attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const interaction = await ai.interactions.create({
        model: model,
        input: prompt
      });

      if (!interaction || !interaction.output_video || !interaction.output_video.data) {
        throw new Error("No video data in response");
      }

      await writeFile(path.join(OUT, file), Buffer.from(interaction.output_video.data, "base64"));
      console.log(`  ✓ ${file} using ${model}`);
      return;
    } catch (err) {
      console.warn(`  ⚠ Attempt ${i}/${attempts} for ${file} failed: ${err.message}`);
      if (i < attempts && err.message.includes("429")) {
        console.log(`  … 429 rate limit hit. Sleeping for 65s before retry…`);
        await new Promise(r => setTimeout(r, 65000));
      } else if (i === attempts) {
        throw err;
      }
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`Generating assets → ${OUT}\n\nImages (gemini-3.1-flash-image-preview):`);
  for (const img of IMAGES) {
    try {
      await genImage(img);
    } catch (err) {
      console.error(`  ✗ ${img.file}: ${err.message}`);
    }
  }
  console.log(`\nVideos (gemini-omni-flash-preview):`);
  for (const vid of VIDEOS) {
    try {
      await genVideo(vid);
    } catch (err) {
      console.error(`  ✗ ${vid.file}: ${err.message}`);
    }
  }
  console.log("\nDone. Missing files render as animated gradients until regenerated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
