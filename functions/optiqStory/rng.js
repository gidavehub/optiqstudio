// ─── OPTIQ SKILLS — SEEDED DRAWS ────────────────────────────────────────────
//
// The swarm's one reliable defence against convergence: hand the model a
// DIFFERENT INPUT per film. Identical inputs land a sampler in the same basin
// every run, so "be more varied" produces the same answer with more adjectives —
// see the long note at the top of ./casting.js, where that was learned the
// expensive way.
//
// Seeded rather than random, because a retried generation must re-draw the SAME
// palette. A film that re-casts itself halfway through a resume is worse than a
// film that converges.
//
// Extracted so the casting palette and the creative provocation share one
// implementation. The algorithm must not change: a stored film's seed has to
// keep reproducing the cast it shipped with.

"use strict";

/** Tiny deterministic PRNG (mulberry32) so a seed reproduces a draw exactly. */
function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap string→int hash (FNV-1a), so a project id can seed the draw. */
function hashSeed(value) {
  const str = String(value ?? "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * An rng for `seed`, or a fresh random one when the seed is absent.
 *
 * `salt` lets two independent palettes draw from the same film id without
 * marching in lockstep — without it, the creative provocation and the casting
 * palette would pick the same index from every list.
 */
function rngFor(seed, salt = "") {
  if (seed === undefined) return makeRng((Math.random() * 0xffffffff) >>> 0);
  return makeRng(hashSeed(`${salt}${seed}`));
}

/** Draw `count` distinct items from `list`. */
function sample(list, count, rng) {
  const pool = [...list];
  const out = [];
  const n = Math.min(count, pool.length);
  for (let i = 0; i < n; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

/** Draw one item. */
function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

module.exports = { makeRng, hashSeed, rngFor, sample, pick };
