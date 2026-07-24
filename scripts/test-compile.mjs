/**
 * End-to-end test of projectCompile: signs up a throwaway user, POSTs a 2-clip
 * timeline to the deployed compile (which self-heals music + narration), then
 * downloads the output and asks Gemini to analyse its AUDIO — verifying:
 *   • clips are MUTED (no scene/footage audio)
 *   • continuous background music
 *   • a spoken voiceover (transcribed) + closing tagline
 *
 *   node scripts/test-compile.mjs
 */
import { GoogleAuth } from "google-auth-library";

const WEB_API_KEY = "AIzaSyBP89Y8cwi8NiCLB7CmjnkQTlJ3pn2aDdI";
const COMPILE_URL = "https://us-east4-davelabs-tools.cloudfunctions.net/projectCompile";
const BUCKET = "davelabs-tools";
const CLIP = "https://storage.googleapis.com/davelabs-tools/generations/0UKyj7haD1R6PA315WlraeQoszn1/xSIzw52NdoUjVDhuzAvu.mp4";
const EMAIL = `harness-compile-${Date.now()}@optiqtest.dev`;
const PROJECT_ID = `test-compile-${Date.now()}`;

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const tok = async () => (await (await auth.getClient()).getAccessToken()).token;

async function signUp() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: "Test123456!", returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error("signup failed: " + JSON.stringify(j).slice(0, 200));
  return { idToken: j.idToken, uid: j.localId };
}

async function main() {
  const { idToken, uid } = await signUp();
  console.log(`✓ user ${uid}`);

  const timeline = [
    { videoUrl: CLIP, trimStart: 0, trimEnd: 6 },
    { videoUrl: CLIP, trimStart: 0, trimEnd: 6 },
  ];
  console.log(`compiling ${PROJECT_ID} (2×6s) — self-heals music + narration…`);
  const t0 = Date.now();
  const r = await fetch(COMPILE_URL, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ projectId: PROJECT_ID, timeline, musicVolume: 0.6 }),
  });
  console.log(`compile status: ${r.status} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  console.log("compile response:", (await r.text()).slice(0, 300));

  const outUrl = `https://storage.googleapis.com/${BUCKET}/projects/${uid}/${PROJECT_ID}/final_video.mp4`;
  const vr = await fetch(outUrl);
  if (!vr.ok) { console.log(`✗ output not found (${vr.status}) at ${outUrl}`); process.exit(1); }
  const buf = Buffer.from(await vr.arrayBuffer());
  console.log(`✓ output video: ${(buf.length / 1024).toFixed(0)}KB`);

  console.log("\nAnalysing audio with Gemini…");
  const url = `https://aiplatform.googleapis.com/v1beta1/projects/${BUCKET}/locations/global/publishers/google/models/gemini-3.5-flash:generateContent`;
  const g = await fetch(url, {
    method: "POST", headers: { Authorization: `Bearer ${await tok()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: "Analyse ONLY the audio of this video. Answer each on its own line:\n1) BACKGROUND MUSIC: is there continuous instrumental music? (yes/no + does it play the whole time or cut out)\n2) VOICEOVER: is there a spoken narrator? Transcribe everything spoken.\n3) FOOTAGE AUDIO: is there any other audio that sounds like it came from the video scenes themselves (people talking on-camera, ambient scene sound)? (yes/no)" },
        { inlineData: { mimeType: "video/mp4", data: buf.toString("base64") } },
      ] }],
    }),
  });
  if (!g.ok) { console.log("Gemini analysis failed:", (await g.text()).slice(0, 300)); process.exit(1); }
  const gj = await g.json();
  console.log("\n=== AUDIO ANALYSIS ===\n" + (gj.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "(none)"));
}
main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
