/**
 * Test harness for Optiq Music (Lyria) — replicates exactly what the
 * musicGenerate Cloud Function sends to Vertex, so we can confirm it returns a
 * real audio file BEFORE trusting the front end.
 *
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\Projects\optiq\secrets\davelabs-tools-sa.json
 *   node scripts/test-music.mjs
 */
import { GoogleAuth } from "google-auth-library";
import { writeFile } from "fs/promises";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const MODEL = "lyria-002";
const URL = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/publishers/google/models/${MODEL}:predict`;
const OUT = process.env.OUT || "test-music.wav";

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const token = async () => (await (await auth.getClient()).getAccessToken()).token;

const prompt = "A warm, uplifting afrobeat instrumental bed with gentle percussion for a brand advert, no vocals";

async function main() {
  const body = { instances: [{ prompt }], parameters: { sample_count: 1 } };
  console.log(`POST ${URL}`);
  console.log(`prompt: ${prompt}`);
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  console.log(`status: ${res.status}`);
  const text = await res.text();
  if (!res.ok) {
    console.error("FAIL body:", text.slice(0, 800));
    process.exit(1);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("FAIL: response not JSON:", text.slice(0, 400));
    process.exit(1);
  }
  const pred = json.predictions?.[0] || {};
  console.log("prediction keys:", Object.keys(pred));
  const b64 = pred.bytesBase64Encoded || pred.audioContent || pred.audio;
  if (!b64) {
    console.error("FAIL: no audio in prediction. Full prediction (truncated):", JSON.stringify(pred).slice(0, 400));
    process.exit(1);
  }
  const buf = Buffer.from(b64, "base64");
  await writeFile(OUT, buf);
  const isWav = buf.slice(0, 4).toString("ascii") === "RIFF";
  console.log(`\n✓ wrote ${OUT} (${(buf.length / 1024).toFixed(0)} KB, header=${buf.slice(0, 4).toString("ascii")}, isWav=${isWav})`);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
