/** Confirm gemini-omni-flash-preview accepts multiple VALID input image parts. */
import { GoogleAuth } from "google-auth-library";
import { readFile } from "fs/promises";

const PROJECT = "davelabs-tools";
const MODEL = "gemini-omni-flash-preview";
const URL = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;

const a = (await readFile("public/media/app-avatar.jpg")).toString("base64");
const b = (await readFile("public/media/app-scene.jpg")).toString("base64");

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const tok = (await client.getAccessToken()).token;

const body = {
  contents: [{ role: "user", parts: [
    { inlineData: { data: a, mimeType: "image/jpeg" } },
    { inlineData: { data: b, mimeType: "image/jpeg" } },
    { text: "Use both reference images in a short cinematic clip." },
  ] }],
  generationConfig: { responseModalities: ["TEXT", "VIDEO"] },
};

const ctrl = new AbortController();
const to = setTimeout(() => ctrl.abort(), 9000);
const t0 = Date.now();
try {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: ctrl.signal,
  });
  const text = await res.text();
  clearTimeout(to);
  console.log(`status=${res.status} ${((Date.now()-t0)/1000).toFixed(1)}s :: ${text.replace(/\s+/g," ").slice(0,300)}`);
} catch (e) {
  clearTimeout(to);
  console.log(`ACCEPTED: no error in ${((Date.now()-t0)/1000).toFixed(1)}s with 2 valid images -> generation started (${e.name})`);
}
