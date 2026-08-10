#!/usr/bin/env node
/**
 * SWEEP ORPHANED MEDIA
 *
 *   node scripts/sweep-orphan-media.mjs            # dry run — lists, deletes nothing
 *   node scripts/sweep-orphan-media.mjs --apply    # actually deletes
 *   node scripts/sweep-orphan-media.mjs --limit 40 # show more of the list
 *
 * The manual twin of the weekly `sweepOrphanedMedia` function, for the one-off
 * clear-out of everything that accumulated before the cascade delete existed.
 * Both run the same logic out of functions/orphanSweep.js — which is where the
 * rules live, including the several things this will never touch.
 *
 * A file is orphaned when the document NAMED IN ITS OWN PATH no longer exists.
 * Nothing is deleted for being old, or big, or unfamiliar: an unrecognised prefix
 * is reported and kept, because not recognising a path is a fact about this
 * script rather than about the file.
 *
 * ALWAYS DRY RUN FIRST AND READ THE SUMMARY. Deleting from Cloud Storage is not
 * reversible and there is no undo to offer afterwards.
 */

import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { Firestore } from "@google-cloud/firestore";
import { Storage } from "@google-cloud/storage";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { findOrphans, deleteOrphans, humanBytes, MIN_AGE_MS } = require(
  path.join(ROOT, "functions", "orphanSweep.js")
);

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const LIMIT = (() => {
  const i = argv.indexOf("--limit");
  return i === -1 ? 15 : Number(argv[i + 1]) || 15;
})();

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const BUCKET = process.env.STORAGE_BUCKET || "davelabs-tools";

// Same two-identity arrangement as the rest of this project's scripts: the
// Firebase CLI's logged-in user for Firestore and Storage, because the service
// account in secrets/ is Vertex-only and has no IAM for either.
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
const db = new Firestore({ projectId: PROJECT_ID, ...(creds ? { credentials: creds } : {}) });
const bucket = new Storage({ projectId: PROJECT_ID, ...(creds ? { credentials: creds } : {}) }).bucket(BUCKET);

const log = (...a) => console.log(...a);

async function main() {
  log(`\nSweeping gs://${BUCKET} — ${APPLY ? "APPLY (files will be deleted)" : "dry run"}\n`);

  const { orphans, kept, unknown, bytes } = await findOrphans({
    db,
    bucket,
    onProgress: (line) => log(`  ${line}`),
  });

  // Grouped by owner, because "1,340 files" means nothing and "12 deleted
  // projects" is the thing a person can actually sanity-check.
  const byOwner = new Map();
  for (const entry of orphans) {
    const key = `${entry.owner.kind}:${entry.owner.id}`;
    const row = byOwner.get(key) || { kind: entry.owner.kind, id: entry.owner.id, files: 0, size: 0 };
    row.files += 1;
    row.size += entry.size;
    byOwner.set(key, row);
  }
  const owners = [...byOwner.values()].sort((a, b) => b.size - a.size);

  log(`\n${"─".repeat(72)}`);
  log(`ORPHANED : ${orphans.length} file(s), ${humanBytes(bytes)}, from ${owners.length} deleted owner(s)`);
  log(`KEPT     : ${kept} file(s) — live owners, the media library, and anything newer than ${Math.round(MIN_AGE_MS / 3600000)}h`);
  if (unknown.length > 0) {
    log(`UNKNOWN  : ${unknown.length} file(s) under prefixes this sweep does not recognise — KEPT, not deleted`);
    for (const name of unknown.slice(0, 5)) log(`             ${name}`);
  }
  log(`${"─".repeat(72)}\n`);

  for (const row of owners.slice(0, LIMIT)) {
    log(`  ${row.kind.padEnd(10)} ${row.id.padEnd(24)} ${String(row.files).padStart(5)} file(s)  ${humanBytes(row.size).padStart(9)}`);
  }
  if (owners.length > LIMIT) log(`  … and ${owners.length - LIMIT} more (--limit ${owners.length} to see them all)`);

  if (orphans.length === 0) {
    log(`\nNothing to delete.\n`);
    return;
  }

  if (!APPLY) {
    log(`\nDRY RUN — nothing was deleted. Re-run with --apply to remove the ${orphans.length} file(s) above.\n`);
    return;
  }

  log(`\nDeleting ${orphans.length} file(s)…`);
  const removed = await deleteOrphans(orphans, {
    onProgress: (line) => process.stdout.write(`\r  ${line}   `),
  });
  log(`\n\nDone. ${removed} file(s) deleted, ${humanBytes(bytes)} reclaimed.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
