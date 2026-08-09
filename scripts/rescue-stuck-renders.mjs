/**
 * RESCUE STUCK RENDERS
 *
 *   node scripts/rescue-stuck-renders.mjs            # dry run, shows what it would do
 *   node scripts/rescue-stuck-renders.mjs --apply    # actually fixes them
 *   node scripts/rescue-stuck-renders.mjs --apply --minutes 20
 *
 * WHAT GOES WRONG, AND WHY NOTHING ELSE CATCHES IT
 *
 * runVideoGeneration claims a generation doc by flipping it "generating" →
 * "processing", then renders, then writes the result. If it throws, the catch
 * marks the doc "failed", refunds the credits and hands back the project's
 * prepaid render.
 *
 * A HARD KILL NEVER REACHES THAT CATCH. An out-of-memory kill, a function
 * timeout, an instance eviction — the process just stops. So the doc is left at
 * "processing" forever:
 *
 *   • the UI polls a scene that will never finish, and shows it rendering,
 *   • the credits are not refunded,
 *   • the project's prepaidRenders is not given back, so the director has paid
 *     for a clip that does not exist,
 *   • and processVideoGeneration is an onDocumentCreated trigger, so nothing
 *     will ever fire for that doc again — the claim check would refuse anyway.
 *
 * This script is the manual sweep for that. It finds generations that have sat
 * in "processing" longer than any real render could take, marks them failed, and
 * puts back what the catch would have.
 *
 * The trigger for writing it: processVideoGeneration ran at 512MiB while a
 * photographed film attaches five board stills per scene, which measured 572MiB.
 * That is fixed (it runs at 2GiB now), but the docs it already stranded need
 * this.
 */

import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";

let credential;
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (saJson) {
  try {
    const parsed = JSON.parse(saJson.startsWith("{") ? saJson : Buffer.from(saJson, "base64").toString("utf-8"));
    credential = cert(parsed);
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env:", e);
  }
}

const app =
  getApps().length === 0
    ? initializeApp({ projectId: PROJECT_ID, ...(credential ? { credential } : {}) })
    : getApp();
const db = getFirestore(app);

const APPLY = process.argv.includes("--apply");
const minutesArg = process.argv.indexOf("--minutes");
/**
 * How long a doc must have sat in "processing" before it counts as stranded.
 *
 * processVideoGeneration's own ceiling is 540s and omniVideo gives up at 480s,
 * so anything past ~15 minutes cannot still be working. Deliberately generous:
 * marking a LIVE render failed would refund a clip that then lands anyway.
 */
const STALE_MINUTES = minutesArg !== -1 ? Number(process.argv[minutesArg + 1]) || 15 : 15;

const cutoff = Date.now() - STALE_MINUTES * 60 * 1000;

console.log(
  `\nLooking for video generations stuck in "processing" for more than ${STALE_MINUTES} minutes` +
    `${APPLY ? "" : "  (DRY RUN — pass --apply to fix)"}\n`
);

const snap = await db.collection("generations").where("status", "==", "processing").get();

if (snap.empty) {
  console.log("Nothing is stuck. Every generation is either running, done or already marked failed.\n");
  process.exit(0);
}

/** Credits go back to the user; a prepaid scene goes back to its project. */
const refundsByUid = new Map();
const prepaidByProject = new Map();
const toFail = [];
let tooRecent = 0;

for (const doc of snap.docs) {
  const gen = doc.data();
  const startedAt = Date.parse(gen.createdAt || "") || 0;
  if (startedAt > cutoff) {
    tooRecent++;
    continue;
  }
  toFail.push({ id: doc.id, ref: doc.ref, gen, startedAt });
  const cost = Number(gen.cost) || 0;
  if (cost > 0 && gen.uid) refundsByUid.set(gen.uid, (refundsByUid.get(gen.uid) || 0) + cost);
  if (gen.prepaidProjectId) {
    prepaidByProject.set(gen.prepaidProjectId, (prepaidByProject.get(gen.prepaidProjectId) || 0) + 1);
  }
}

if (tooRecent > 0) {
  console.log(`${tooRecent} generation(s) are still inside the window and were left alone — they may yet finish.\n`);
}
if (toFail.length === 0) {
  console.log("Nothing old enough to rescue.\n");
  process.exit(0);
}

for (const { id, gen, startedAt } of toFail) {
  const age = Math.round((Date.now() - startedAt) / 60000);
  console.log(
    `  ${id}  stuck ${age} min  ` +
      `${gen.prepaidProjectId ? `prepaid → project ${gen.prepaidProjectId}` : `GMD ${Number(gen.cost) || 0} → ${gen.uid}`}`
  );
}

console.log(`\n  ${toFail.length} generation(s) to mark failed`);
for (const [uid, amount] of refundsByUid) console.log(`  refund GMD ${amount} to ${uid}`);
for (const [projectId, n] of prepaidByProject) console.log(`  restore ${n} prepaid render(s) to project ${projectId}`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to make these changes.\n");
  process.exit(0);
}

console.log("\nApplying…");

const { FieldValue } = await import("firebase-admin/firestore");

for (const { id, ref } of toFail) {
  await ref.update({
    status: "failed",
    error:
      "The render was interrupted before it finished (the function ran out of memory or time). " +
      "Your credit for it has been returned — render the scene again.",
    completedAt: new Date().toISOString(),
  });
  console.log(`  marked ${id} failed`);
}

for (const [uid, amount] of refundsByUid) {
  await db.collection("users").doc(uid).update({ credits: FieldValue.increment(amount) });
  console.log(`  refunded GMD ${amount} to ${uid}`);
}

for (const [projectId, n] of prepaidByProject) {
  await db.collection("projects").doc(projectId).update({ prepaidRenders: FieldValue.increment(n) });
  console.log(`  restored ${n} prepaid render(s) to ${projectId}`);
}

console.log("\nDone. Those scenes will now show as failed in the editor, and re-rendering them is free again.\n");
process.exit(0);
