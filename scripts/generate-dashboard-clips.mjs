/**
 * D-BAX DASHBOARD CLIP GENERATOR
 * Generates 3 brand-new custom video clips specifically for the dashboard portal and direct studio buttons:
 * - dash-storyboard.mp4
 * - dash-video-studio.mp4
 * - dash-audio-studio.mp4
 *
 * Authenticates directly with Google Vertex AI using Application Default Credentials (ADC).
 * Saves results directly into public/media/.
 */

import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const OUT = path.join(process.cwd(), "public", "media");

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: "global"
});

const VEO = "gemini-omni-flash-preview";

const DASHBOARD_PROMPTS = [
  {
    id: "storyboard",
    file: "dash-storyboard.mp4",
    prompt: "=== STYLE === REGISTER: supreme award-tier cinema, director showcase. OPTICS: shallow depth of field, anamorphic feel, soft natural halation. MOTION: camera moves with intent - extremely slow cinematic panning across a retro camera lens and director deck. LIGHTING: soft, moody warm key backlight, highlighting details of the lens glass. COLOR: desaturated dark palette with amber highlights. SOUND (diegetic only; voiceover separate): None. ACTION: An ultra-premium close-up of a high-end cinematic camera lens gently catching soft light, highlighting the premium glass optics."
  },
  {
    id: "video-studio",
    file: "dash-video-studio.mp4",
    prompt: "=== STYLE === REGISTER: supreme award-tier cinema, editorial motion. OPTICS: shallow depth of field, gentle film grain. MOTION: camera moves with intent - steady tracking. LIGHTING: cool cyber blue rim light with warm glowing accent from a monitor screen. COLOR: moody desaturated indigo with vivid teal accents. ACTION: A sleek, modern video production console and color grading keyboard with glowing control keys in a dark premium studio."
  },
  {
    id: "audio-studio",
    file: "dash-audio-studio.mp4",
    prompt: "=== STYLE === REGISTER: supreme award-tier cinema, acoustic masterpiece. OPTICS: shallow depth of field, anamorphic lens. MOTION: camera moves with intent - slow orbital push. LIGHTING: warm gold lighting, single bulb, soft glowing audio level bars in the background. COLOR: rich dark amber and gold. ACTION: A professional classic vintage condenser microphone standing in a premium recording studio, catching a soft amber keylight."
  }
];

async function exists(file) {
  try {
    await access(path.join(OUT, file));
    return true;
  } catch {
    return false;
  }
}

async function generateDashboardVideo(item) {
  const destPath = path.join(OUT, item.file);
  if (await exists(item.file)) {
    console.log(`  ✓ Dashboard ${item.id} (${item.file}) already exists. Skipping.`);
    return;
  }

  console.log(`\n[Dashboard ${item.id}] Generating ${item.file} via direct Vertex AI (${VEO})...`);
  
  let attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const interaction = await ai.interactions.create({
        model: VEO,
        input: item.prompt
      });

      if (!interaction || !interaction.output_video || !interaction.output_video.data) {
        throw new Error("No video data in response");
      }

      await writeFile(destPath, Buffer.from(interaction.output_video.data, "base64"));
      console.log(`  ✓ Dashboard ${item.id} video successfully saved to: ${destPath}`);
      return;
    } catch (err) {
      console.warn(`  ⚠ Attempt ${i}/${attempts} for Dashboard ${item.id} failed: ${err.message}`);
      if (i < attempts && err.message.includes("429")) {
        console.log(`  … 429 rate limit hit. Sleeping for 45s before retry…`);
        await new Promise(r => setTimeout(r, 45000));
      } else if (i === attempts) {
        throw err;
      }
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("Initializing direct Vertex AI generation for Dashboard Portal and Studio Videos...");

  for (const item of DASHBOARD_PROMPTS) {
    try {
      await generateDashboardVideo(item);
      // Wait a tiny bit between tasks
      await new Promise(r => setTimeout(r, 10000));
    } catch (err) {
      console.error(`✗ Failed to generate Dashboard Video ${item.id}: ${err.message}`);
    }
  }
  console.log("\n★ Dashboard Video generation completed.");
}

main().catch(console.error);
