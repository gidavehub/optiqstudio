/**
 * Transcribes a generated voice sample with Gemini (audio understanding) so we
 * can VERIFY what is actually being spoken — language + exact words — without
 * having to listen. Used to confirm the local-language samples speak the local
 * language and NOT the English style instruction.
 *
 *   node scripts/verify-audio.mjs public/media/voice-samples/awa-wolof.wav
 */
import { GoogleAuth } from "google-auth-library";
import { readFile } from "fs/promises";

const PROJECT = "davelabs-tools";
const MODEL = "gemini-3.5-flash";
const URL = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${MODEL}:generateContent`;
const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const token = async () => (await (await auth.getClient()).getAccessToken()).token;

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/verify-audio.mjs <path.wav>"); process.exit(1); }

async function main() {
  const b64 = (await readFile(file)).toString("base64");
  const body = {
    contents: [{ role: "user", parts: [
      { text: "Transcribe this audio EXACTLY, word for word. Then on a new line state: LANGUAGE(S) SPOKEN. Then on a new line state whether any English instruction/style-direction text (like 'read like a warm presenter') is spoken aloud (YES/NO)." },
      { inlineData: { mimeType: "audio/wav", data: b64 } },
    ] }],
  };
  const res = await fetch(URL, { method: "POST", headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) { console.error(`FAIL ${res.status}:`, (await res.text()).slice(0, 300)); process.exit(1); }
  const j = await res.json();
  const out = j.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") || "(no text)";
  console.log(`--- ${file} ---\n${out}`);
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
