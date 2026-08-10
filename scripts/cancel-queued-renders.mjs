#!/usr/bin/env node
/**
 * CANCEL QUEUED RENDERS
 *
 *   node scripts/cancel-queued-renders.mjs <projectId>            # dry run
 *   node scripts/cancel-queued-renders.mjs <projectId> --apply
 *   node scripts/cancel-queued-renders.mjs --all --apply          # every project
 *
 * Stops renders that have not started yet, and puts back what asking for them
 * took: the project's prepaid allowance, and any credits that were charged.
 *
 * WHY THIS KEEPS BEING NEEDED. The editor's auto-render pass fires every idle
 * scene the moment a film is in `auto-merge`, so a thirty-scene film enqueues
 * thirty renders on open. Cancelling them is not enough on its own — an open
 * workspace tab autosaves its own `productionMode` back over the document, so a
 * film flipped to `manual` here flips back to `auto-merge` a second later and
 * enqueues the lot again. That is why this also sets `rendersPaused`, which the
 * SERVER checks in videoGenerate: a flag the client does not know about and
 * therefore cannot overwrite.
 *
 * A render already in `processing` is left alone. It is running inside a Cloud
 * Function that cannot be interrupted, and its money has already been spent —
 * killing the record would only lose the clip it is about to produce.
 */

import fs from "fs";
import path from "path";
import { Firestore, FieldValue } from "@google-cloud/firestore";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ALL = argv.includes("--all");
const PROJECT_ARG = argv.find((a) => !a.startsWith("--")) || null;
const RESUME = argv.includes("--resume");

if (!PROJECT_ARG && !ALL) {
  console.error(`\nUsage: node scripts/cancel-queued-renders.mjs <projectId> [--apply]\n` +
    `       node scripts/cancel-queued-renders.mjs --all --apply\n` +
    `       node scripts/cancel-queued-renders.mjs <projectId> --resume --apply   (lift the pause)\n`);
  process.exit(1);
}

function credentials() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) return JSON.parse(inline.startsWith("{") ? inline : Buffer.from(inline, "base64").toString("utf-8"));
  const cliConfig = path.join(process.env.USERPROFILE || process.env.HOME || "", ".config", "configstore", "firebase-tools.json");
  if (fs.existsSync(cliConfig)) {
    const cfg = JSON.parse(fs.readFileSync(cliConfig, "utf-8"));
    if (cfg?.tokens?.refresh_token) {
      return {
        type: "authorized_user",
        client_id: process.env.FIREBASE_CLIENT_ID || "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
        client_secret: process.env.FIREBASE_CLIENT_SECRET || "j9iVZfS8kkCEFUPaAeJV0sAi",
        refresh_token: cfg.tokens.refresh_token,
      };
    }
  }
  return undefined;
}

const creds = credentials();
const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools", ...(creds ? { credentials: creds } : {}) });

async function resume(projectId) {
  if (!APPLY) { console.log(`would clear rendersPaused on ${projectId}`); return; }
  await db.collection("projects").doc(projectId).update({ rendersPaused: false, updatedAt: new Date().toISOString() });
  console.log(`rendersPaused cleared on ${projectId} — renders may be started again.`);
}

async function cancel(projectId) {
  const projectRef = db.collection("projects").doc(projectId);
  const snap = await projectRef.get();
  if (!snap.exists) { console.error(`no project ${projectId}`); return; }
  const p = snap.data();

  const g = await db.collection("generations").where("type", "==", "video").where("projectId", "==", projectId).get();
  const queued = g.docs.filter((d) => d.data().status === "queued");
  const running = g.docs.filter((d) => ["processing", "generating"].includes(d.data().status));

  let prepaidBack = 0;
  let refund = 0;
  for (const d of queued) {
    const v = d.data();
    if (v.prepaidProjectId) prepaidBack++;
    if (Number(v.cost) > 0) refund += Number(v.cost);
  }

  console.log(`\n${p.title || projectId}`);
  console.log(`  queued to cancel  : ${queued.length}`);
  console.log(`  already running   : ${running.length} (left alone)`);
  console.log(`  prepaid to restore: ${prepaidBack}`);
  console.log(`  credits to refund : GMD ${refund}`);
  if (!APPLY) return;
  if (queued.length === 0) {
    // Still worth pausing: the tab may be about to enqueue more.
    await projectRef.update({ rendersPaused: true, productionMode: "manual", updatedAt: new Date().toISOString() });
    console.log(`  nothing queued — renders paused anyway`);
    return;
  }

  // MONEY FIRST. A crash between the refund and the delete must never be the
  // thing that eats an allowance.
  if (prepaidBack > 0) await projectRef.update({ prepaidRenders: FieldValue.increment(prepaidBack) });
  if (refund > 0) {
    const userRef = db.collection("users").doc(p.uid);
    await userRef.set({ credits: FieldValue.increment(refund) }, { merge: true });
    await userRef.collection("ledger").add({
      delta: refund,
      reason: `refund: ${queued.length} cancelled render(s)`,
      at: new Date().toISOString(),
    });
  }

  const cancelledIds = new Set(queued.map((d) => d.id));
  const videoStatus = { ...(p.videoStatus || {}) };
  for (const key of Object.keys(videoStatus)) {
    if (videoStatus[key]?.id && cancelledIds.has(videoStatus[key].id)) {
      // Back to never-rendered rather than a red card pointing at a generation
      // that no longer exists.
      videoStatus[key] = { ...videoStatus[key], status: "idle", id: null, error: null };
    }
  }

  await projectRef.update({
    videoStatus,
    productionMode: "manual",
    // The one the client cannot undo.
    rendersPaused: true,
    updatedAt: new Date().toISOString(),
  });

  for (let i = 0; i < queued.length; i += 300) {
    const batch = db.batch();
    queued.slice(i, i + 300).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  console.log(`  CANCELLED ${queued.length}, restored ${prepaidBack} prepaid, refunded GMD ${refund}, renders paused`);
}

const ids = ALL
  ? (await db.collection("projects").get()).docs.map((d) => d.id)
  : [PROJECT_ARG];

for (const id of ids) {
  if (RESUME) await resume(id);
  else await cancel(id);
}
process.exit(0);
