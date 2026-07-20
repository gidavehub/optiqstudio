/**
 * Clears projects stranded mid-export.
 *
 * Before the fix, renderJobV2/projectCompile responded 202 and then did the
 * ffmpeg work in an unawaited IIFE. Cloud Run throttles CPU once a request is
 * answered, so those renders were frozen and the project doc sat on
 * renderV2Status:"rendering" / compileStatus:"compiling" forever — which
 * permanently disabled the Export button.
 *
 * Marks any such stranded job as "failed" so the UI unlocks and the user can
 * export again. Only touches docs older than STALE_MINUTES so a genuinely
 * in-flight render is never killed.
 *
 * Dry run (default):  node scripts/reset-stuck-renders.mjs
 * Apply:              node scripts/reset-stuck-renders.mjs --apply
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "davelabs-tools";
const APPLY = process.argv.includes("--apply");
const STALE_MINUTES = 12;

// Uses Application Default Credentials, same as reset-stuck-videos.mjs
// (gcloud auth application-default login as davelabs01@gmail.com).
const db = getFirestore(initializeApp({ projectId: PROJECT_ID }));

const staleBefore = Date.now() - STALE_MINUTES * 60 * 1000;

// NOTE: deliberately does NOT fall back to updatedAt. The client autosaves the
// project doc every 1.5s while it is open, so updatedAt is always "recent" and
// would mask a genuinely stranded render. A missing *StartedAt means the job
// predates the fix that started recording it — i.e. it is stranded by
// definition.
const isStale = (startedAt) => {
  if (!startedAt) return true;
  const t = Date.parse(startedAt);
  return !Number.isFinite(t) || t < staleBefore;
};

const snap = await db.collection("projects").get();
let stuckRender = 0;
let stuckCompile = 0;

for (const doc of snap.docs) {
  const p = doc.data();
  const updates = {};

  if (p.renderV2Status === "rendering" && isStale(p.renderV2StartedAt)) {
    updates.renderV2Status = "failed";
    updates.renderV2Error =
      "Render was interrupted server-side and did not finish. Please export again.";
    stuckRender++;
  }
  if (p.compileStatus === "compiling" && isStale(p.compileStartedAt)) {
    updates.compileStatus = "failed";
    updates.compileError =
      "Compilation was interrupted server-side and did not finish. Please try again.";
    stuckCompile++;
  }

  if (Object.keys(updates).length > 0) {
    console.log(
      `${APPLY ? "RESET" : "would reset"}  ${doc.id}  "${(p.title || "untitled").slice(0, 45)}"  ` +
        `[${Object.keys(updates).filter((k) => k.endsWith("Status")).join(", ")}]`
    );
    if (APPLY) {
      updates.updatedAt = new Date().toISOString();
      await doc.ref.set(updates, { merge: true });
    }
  }
}

console.log(
  `\nScanned ${snap.size} projects — ${stuckRender} stuck render(s), ${stuckCompile} stuck compile(s).`
);
if (!APPLY && stuckRender + stuckCompile > 0) {
  console.log("Dry run. Re-run with --apply to clear them.");
}
