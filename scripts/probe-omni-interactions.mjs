/**
 * Probe: gemini-omni-flash-preview via the Interactions API (@google/genai),
 * background mode + polling — the pattern the generateContent 400 now demands.
 */
import { GoogleGenAI } from "@google/genai";
import { writeFile } from "fs/promises";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const MODEL = "gemini-omni-flash-preview";

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "global" });

const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

let interaction;
try {
  interaction = await ai.interactions.create({
    model: MODEL,
    input: "A calm ocean wave rolling at sunset, cinematic. Render an approximately 4-second video.",
    background: true,
    store: true,
  });
} catch (err) {
  console.log(`create FAILED at ${elapsed()}:`, err?.message || err);
  process.exit(1);
}

console.log(`created id=${interaction.id} status=${interaction.status} at ${elapsed()}`);

let current = interaction;
while (current.status === "in_progress" || current.status === "queued") {
  await new Promise((r) => setTimeout(r, 5000));
  current = await ai.interactions.get(interaction.id);
  console.log(`poll status=${current.status} at ${elapsed()}`);
}

console.log(`final status=${current.status} at ${elapsed()}`);
if (current.status !== "completed") {
  console.log("full object:", JSON.stringify(current, null, 2).slice(0, 3000));
  process.exit(1);
}

const v = current.output_video;
if (v?.data) {
  const bytes = Buffer.from(v.data, "base64");
  console.log(`output_video inline: ${v.mime_type}, ${(bytes.length / 1e6).toFixed(2)} MB`);
  await writeFile("scratch/probe-interactions.mp4", bytes);
  console.log("saved -> scratch/probe-interactions.mp4");
} else if (v?.uri) {
  console.log(`output_video uri: ${v.uri} (${v.mime_type})`);
} else {
  console.log("no output_video; text:", current.output_text?.slice(0, 300));
  console.log("keys:", Object.keys(current));
}
