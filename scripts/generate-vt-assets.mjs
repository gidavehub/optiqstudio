/**
 * Generates media assets for the Virtual Teacher Project
 * using Vertex AI on davelabs-tools.
 *
 * Prereq: ADC login for davelabs01@gmail.com
 * Run: node scripts/generate-vt-assets.mjs
 */

import { GoogleAuth } from "google-auth-library";
import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const LOCATION = process.env.VERTEX_LOCATION || "us-east4";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: "global"
});

const VEO = "gemini-omni-flash-preview";
const IMAGE = "gemini-3.1-flash-image-preview";
const OUT = path.join(process.cwd(), "..", "virtualteacher", "public", "media");

const IMAGES = [
  {
    file: "giga-gambia-map.jpg",
    aspect: "16:9",
    prompt: "An elegant, premium vector mapping interface of The Gambia, showing glowing connected dots and lines representing schools across the map with soft green, blue, and gold neon nodes. Minimalistic, light theme, high-tech cartography dashboard.",
  },
  {
    file: "darlene-coding.jpg",
    aspect: "1:1",
    prompt: "A beautiful, close-up photograph of a young African girl named Darlene smiling, leaning over her laptop, learning to code in a modern refugee camp school classroom in Kakuma, warm natural sun rays, high detail, editorial photography.",
  }
];

const VIDEOS = [
  {
    file: "rohey-hello.mp4",
    aspect: "16:9",
    prompt: "Slow, warm cinematic shot of Rohey, a friendly young Gambian female teacher wearing a colorful traditional patterned dress and headwrap, waving hello at the camera and smiling in a bare West African classroom, photorealistic, elegant animated video.",
  },
  {
    file: "connected-classroom.mp4",
    aspect: "16:9",
    prompt: "An active, bright, modern school classroom in The Gambia filled with tablets on every desk and children laughing, working together, and coding. Rohey stands at the front, beaming with quiet pride, animated premium cinematic footage.",
  }
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
  console.log(`Generating VT assets → ${OUT}\n\nImages (gemini-3.1-flash-image-preview):`);
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
  console.log("\nDone asset generation.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
