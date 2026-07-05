/**
 * One-off cleanup: video generations left stuck in "generating"/"processing"
 * by the old interactions.create hang never resolve, so the UI polls them
 * forever. Mark them failed and refund the charged credits.
 *
 * Usage:
 *   node scripts/reset-stuck-videos.mjs           # dry run (prints only)
 *   node scripts/reset-stuck-videos.mjs --apply   # actually refund + fail
 */
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT_ID = "davelabs-tools";
const APPLY = process.argv.includes("--apply");
const MIN_AGE_MS = 2 * 60 * 1000; // don't touch generations younger than 2 min

const app = initializeApp({ projectId: PROJECT_ID, storageBucket: PROJECT_ID });
const db = getFirestore(app);

async function main() {
  const snap = await db
    .collection("generations")
    .where("type", "==", "video")
    .where("status", "in", ["generating", "processing"])
    .get();

  console.log(`Found ${snap.size} video doc(s) in generating/processing.`);
  const now = Date.now();
  let acted = 0;

  for (const doc of snap.docs) {
    const gen = doc.data();
    const created = Date.parse(gen.createdAt || 0) || 0;
    const ageMin = ((now - created) / 60000).toFixed(1);
    if (now - created < MIN_AGE_MS) {
      console.log(`  SKIP ${doc.id} (age ${ageMin}m < 2m, may be in progress)`);
      continue;
    }

    console.log(`  ${APPLY ? "RESET" : "would reset"} ${doc.id} uid=${gen.uid} cost=${gen.cost || 0} age=${ageMin}m prompt="${(gen.prompt || "").slice(0, 50)}"`);
    if (!APPLY) { acted++; continue; }

    // Refund the charge for a generation that never produced a video.
    if (gen.uid && gen.cost > 0) {
      const userRef = db.collection("users").doc(gen.uid);
      await userRef.set({ credits: FieldValue.increment(gen.cost) }, { merge: true });
      await userRef.collection("ledger").doc().set({
        delta: gen.cost,
        reason: `refund: stuck video ${doc.id} reset`,
        at: new Date().toISOString(),
      });
    }
    await doc.ref.update({
      status: "failed",
      error: "Generation was reset after a backend fix; please try again.",
      completedAt: new Date().toISOString(),
    });
    acted++;
  }

  console.log(`\nDone. ${APPLY ? "Reset+refunded" : "Would reset"} ${acted} doc(s).${APPLY ? "" : "  Re-run with --apply to execute."}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
