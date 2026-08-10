// ─── MEDIA NOTHING OWNS ANY MORE ────────────────────────────────────────────
//
// Storage is billed by the gigabyte and this platform generates a great deal of
// it: a single photographed film is a hundred-plus plates and frames before a
// second of video exists. Every one of those files is reachable only through a
// Firestore document — a project, or a generation — and when that document goes
// away the file does not. It just sits there, costing money, with nothing left
// that knows its name.
//
// Two ways that happened, and both are now fixed at the source (see
// cleanupDeletedProject in index.js). This module is for the years of debris the
// fix arrives too late for, and for whatever slips through it later.
//
// ════════════════════════════════════════════════════════════════════════════
// WHAT "ORPHANED" MEANS HERE, EXACTLY
// ════════════════════════════════════════════════════════════════════════════
//
// Every generated file in this bucket lives under a path that NAMES ITS OWNER.
// That is what makes this sweep possible at all, and it is the only reason it can
// be done safely — there is no guessing about whether a file is in use:
//
//   users/{uid}/projects/{projectId}/…   owned by project {projectId}
//   projects/{projectId}/agentUploads/…  owned by project {projectId}
//   generations/{uid}/{genId}.{ext}      owned by generation {genId}
//   generations/{uid}/{genId}/input-…    owned by generation {genId}
//
// A file is orphaned when the document named in its own path does not exist.
// Nothing else counts as evidence, and in particular NOTHING IS DELETED FOR
// BEING OLD or for being large or for looking unused.
//
// ════════════════════════════════════════════════════════════════════════════
// WHAT IS NEVER TOUCHED
// ════════════════════════════════════════════════════════════════════════════
//
//   users/{uid}/library/…   The user's own media library. It belongs to the
//                           user rather than to any one project, and a clip
//                           reused from it deliberately outlives the film it was
//                           made for.
//   Any prefix this module does not recognise. An unknown path is not evidence
//   of an orphan, it is evidence that something writes somewhere this sweep has
//   never heard of — and the safe response to that is to leave it alone and say
//   so, not to delete it. New prefixes get added here deliberately.
//
// A RECENTLY WRITTEN FILE IS ALSO SPARED, regardless. A render in flight writes
// its plates minutes before the document that will point at them, so a sweep
// running in that window would see a perfectly live file with no owner yet and
// delete work that is still being made.

"use strict";

/** Nothing younger than this is ever deleted, whatever its owner looks like. */
const MIN_AGE_MS = 6 * 60 * 60 * 1000;

/** Prefixes that belong to a user rather than to any project. Never swept. */
const PROTECTED = [/^users\/[^/]+\/library\//];

/**
 * Who owns this file, if anyone this sweep understands.
 *
 * @returns {{kind: "project"|"generation", id: string} | null}
 *   null means "not a path this module recognises", which is treated as KEEP.
 */
function ownerOf(name) {
  for (const pattern of PROTECTED) {
    if (pattern.test(name)) return { kind: "protected", id: "" };
  }

  let m = name.match(/^users\/[^/]+\/projects\/([^/]+)\//);
  if (m) return { kind: "project", id: m[1] };

  m = name.match(/^projects\/([^/]+)\//);
  if (m) return { kind: "project", id: m[1] };

  // generations/{uid}/{genId}.{ext}  or  generations/{uid}/{genId}/input-…
  m = name.match(/^generations\/[^/]+\/([^/.]+)(?:\.[a-z0-9]+)?(?:\/|$)/i);
  if (m) return { kind: "generation", id: m[1] };

  return null;
}

/**
 * Find every file whose owning document is gone.
 *
 * Reads the whole bucket listing and the two collections, then decides. Existence
 * is checked in bulk (`getAll`) rather than per file: a bucket with fifty
 * thousand objects would otherwise be fifty thousand document reads.
 *
 * @param {object}   deps.db        Firestore
 * @param {object}   deps.bucket    a @google-cloud/storage Bucket
 * @param {Function} [deps.onProgress]
 * @returns {Promise<{orphans: Array, kept: number, unknown: Array, bytes: number}>}
 */
async function findOrphans({ db, bucket, onProgress = () => {} }) {
  const [files] = await bucket.getFiles();
  onProgress(`listed ${files.length} object(s)`);

  const now = Date.now();
  const wanted = { project: new Set(), generation: new Set() };
  const considered = [];
  const unknown = [];
  let kept = 0;

  for (const file of files) {
    const owner = ownerOf(file.name);
    if (!owner) {
      unknown.push(file.name);
      kept++;
      continue;
    }
    if (owner.kind === "protected") {
      kept++;
      continue;
    }
    const created = Date.parse(file.metadata?.timeCreated || "") || 0;
    if (now - created < MIN_AGE_MS) {
      kept++;
      continue;
    }
    wanted[owner.kind].add(owner.id);
    considered.push({ file, owner, size: Number(file.metadata?.size || 0) });
  }

  onProgress(
    `${considered.length} file(s) belong to ${wanted.project.size} project(s) and ` +
      `${wanted.generation.size} generation(s); checking which still exist`
  );

  const alive = { project: new Set(), generation: new Set() };
  const collectionFor = { project: "projects", generation: "generations" };

  for (const kind of ["project", "generation"]) {
    const ids = [...wanted[kind]];
    for (let i = 0; i < ids.length; i += 300) {
      const refs = ids.slice(i, i + 300).map((id) => db.collection(collectionFor[kind]).doc(id));
      const snaps = await db.getAll(...refs);
      snaps.forEach((snap) => {
        if (snap.exists) alive[kind].add(snap.id);
      });
    }
  }

  const orphans = [];
  let bytes = 0;
  for (const entry of considered) {
    if (alive[entry.owner.kind].has(entry.owner.id)) {
      kept++;
      continue;
    }
    orphans.push(entry);
    bytes += entry.size;
  }

  return { orphans, kept, unknown, bytes };
}

/** Delete what findOrphans found. Returns how many objects actually went. */
async function deleteOrphans(orphans, { onProgress = () => {} } = {}) {
  let done = 0;
  const BATCH = 50;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const slice = orphans.slice(i, i + BATCH);
    await Promise.all(
      slice.map((entry) =>
        entry.file.delete().catch((err) => {
          if (err.code !== 404) console.error(`[orphanSweep] ${entry.file.name}: ${err.message}`);
        })
      )
    );
    done += slice.length;
    onProgress(`deleted ${done}/${orphans.length}`);
  }
  return done;
}

const humanBytes = (n) => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Number(n) || 0;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
};

module.exports = { findOrphans, deleteOrphans, ownerOf, humanBytes, MIN_AGE_MS };
