/**
 * End-to-end test of the EDITOR export (renderJobV2): sends a real RenderJob
 * (2 clips that carry their own audio), then asks Gemini to analyse the output's
 * audio — verifying the clips' footage audio is DROPPED and replaced with music
 * + narration + closing tagline.
 *
 *   node scripts/test-render.mjs
 */
import { GoogleAuth } from "google-auth-library";

const WEB_API_KEY = "AIzaSyBP89Y8cwi8NiCLB7CmjnkQTlJ3pn2aDdI";
const RENDER_URL = "https://us-east4-davelabs-tools.cloudfunctions.net/renderJobV2";
const CLIP = "https://storage.googleapis.com/davelabs-tools/generations/0UKyj7haD1R6PA315WlraeQoszn1/xSIzw52NdoUjVDhuzAvu.mp4";
const EMAIL = `harness-render-${Date.now()}@optiqtest.dev`;
const PROJECT_ID = `test-render-${Date.now()}`;

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const tok = async () => (await (await auth.getClient()).getAccessToken()).token;

async function signUp() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: "Test123456!", returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error("signup failed: " + JSON.stringify(j).slice(0, 200));
  return j.idToken;
}

async function main() {
  const idToken = await signUp();
  console.log(`✓ user for ${PROJECT_ID}`);

  const job = {
    version: 1, fps: 30, width: 1280, height: 720, duration: 12,
    base: [
      { type: "media", url: CLIP, srcIn: 0, srcOut: 6, duration: 6, speed: 1 },
      { type: "media", url: CLIP, srcIn: 0, srcOut: 6, duration: 6, speed: 1 },
    ],
    overlays: [],
    audio: [],
  };

  console.log("rendering via editor renderJobV2 (self-heals + composes ad audio)…");
  const t0 = Date.now();
  const r = await fetch(RENDER_URL, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ projectId: PROJECT_ID, job }),
  });
  const text = await r.text();
  console.log(`render status: ${r.status} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  console.log("response:", text.slice(0, 300));
  if (!r.ok) process.exit(1);
  const videoUrl = JSON.parse(text).videoUrl;

  const vr = await fetch(videoUrl);
  const buf = Buffer.from(await vr.arrayBuffer());
  console.log(`✓ output ${(buf.length / 1024).toFixed(0)}KB`);

  console.log("\nAnalysing audio with Gemini…");
  const url = `https://aiplatform.googleapis.com/v1beta1/projects/davelabs-tools/locations/global/publishers/google/models/gemini-3.5-flash:generateContent`;
  const g = await fetch(url, {
    method: "POST", headers: { Authorization: `Bearer ${await tok()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: "Analyse ONLY the audio of this video. On separate lines:\n1) BACKGROUND MUSIC: continuous instrumental? (yes/no)\n2) VOICEOVER: is there a spoken narrator? Transcribe it.\n3) FOOTAGE AUDIO: any audio that came from the video scenes themselves (people talking on-camera, scene ambience)? (yes/no)" },
        { inlineData: { mimeType: "video/mp4", data: buf.toString("base64") } },
      ] }],
    }),
  });
  if (!g.ok) { console.log("Gemini failed:", (await g.text()).slice(0, 300)); process.exit(1); }
  const gj = await g.json();
  console.log("\n=== EDITOR EXPORT AUDIO ANALYSIS ===\n" + (gj.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "(none)"));
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
