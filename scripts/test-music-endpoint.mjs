/**
 * End-to-end test of Optiq Music EXACTLY as the front end calls it. Signs up a
 * fresh throwaway user through the normal Identity Toolkit flow (which fires
 * onUserCreated → welcome-bonus credits), then POSTs to the deployed
 * musicGenerate Cloud Function — same URL + Authorization header apiFetch() uses.
 *
 *   node scripts/test-music-endpoint.mjs
 */
const WEB_API_KEY = "AIzaSyBP89Y8cwi8NiCLB7CmjnkQTlJ3pn2aDdI";
const FN_URL = "https://us-east4-davelabs-tools.cloudfunctions.net/musicGenerate";
const EMAIL = `harness-music-${Date.now()}@optiqtest.dev`;
const PASSWORD = "Test123456!";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signUp() {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error("signUp failed: " + JSON.stringify(j).slice(0, 300));
  return j.idToken;
}

async function callMusic(token) {
  const body = { prompt: "A warm, uplifting afrobeat instrumental bed with gentle percussion for a brand advert" };
  const t0 = Date.now();
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  return { status: res.status, secs, text: await res.text() };
}

async function main() {
  const token = await signUp();
  console.log(`✓ signed up ${EMAIL}`);
  console.log("waiting 15s for onUserCreated welcome bonus…");
  await sleep(15000);

  let out;
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(`\n[attempt ${attempt}] POST ${FN_URL}`);
    out = await callMusic(token);
    console.log(`status: ${out.status}  (${out.secs}s)`);
    console.log("response:", out.text.slice(0, 900));
    if (out.status !== 402) break;
    console.log("(bonus not landed yet, waiting 12s…)");
    await sleep(12000);
  }

  if (out.status >= 200 && out.status < 300) {
    const j = JSON.parse(out.text);
    console.log(`\n✓ MUSIC OK — id=${j.id} cost=${j.cost}\n  url=${j.url}`);
    process.exit(0);
  }
  console.log("\n✗ MUSIC FAILED — see response above");
  process.exit(1);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
