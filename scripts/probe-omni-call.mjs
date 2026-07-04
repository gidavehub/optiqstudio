/** Single detailed probe of gemini-omni-flash-preview (v1beta1, global). */
import { GoogleAuth } from "google-auth-library";
import { writeFile } from "fs/promises";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const MODEL = "gemini-omni-flash-preview";
const URL = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/us-central1/publishers/google/models/${MODEL}:generateContent`;

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const tok = (await client.getAccessToken()).token;

const body = {
  contents: [
    { role: "user", parts: [{ text: "A calm ocean wave rolling at sunset, cinematic" }] },
  ],
  generationConfig: {
    responseModalities: ["VIDEO"],
    videoConfig: { aspect_ratio: "16:9", duration_seconds: 4 },
  },
};

const t0 = Date.now();
let res = await fetch(URL, {
  method: "POST",
  headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
let text = await res.text();

// If videoConfig is rejected, retry without it to isolate the schema issue.
if (res.status === 400) {
  console.log(`400 with videoConfig: ${text.slice(0, 400)}\nRetrying without videoConfig…`);
  delete body.generationConfig.videoConfig;
  res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  text = await res.text();
}

console.log(`status=${res.status} elapsed=${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (res.status !== 200) {
  console.log(text.slice(0, 1500));
  process.exit(1);
}

const data = JSON.parse(text);
const cand = data.candidates?.[0];
console.log("finishReason:", cand?.finishReason);
console.log("usage:", JSON.stringify(data.usageMetadata || {}));
for (const part of cand?.content?.parts || []) {
  if (part.inlineData) {
    const bytes = Buffer.from(part.inlineData.data, "base64");
    console.log(`inlineData: ${part.inlineData.mimeType}, ${(bytes.length / 1e6).toFixed(2)} MB`);
    if (part.inlineData.mimeType.startsWith("video")) {
      await writeFile("public/media/probe.mp4", bytes);
      console.log("saved → public/media/probe.mp4");
    }
  } else if (part.fileData) {
    console.log(`fileData: ${part.fileData.mimeType} → ${part.fileData.fileUri}`);
  } else if (part.text) {
    console.log(`text: ${part.text.slice(0, 200)}`);
  } else {
    console.log("part keys:", Object.keys(part));
  }
}
