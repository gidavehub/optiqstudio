// ─── WHY A RENDER FAILED, IN WORDS ──────────────────────────────────────────
//
// Every scene that doesn't come back showed the director the same sentence, and
// the two things that actually go wrong want opposite responses:
//
//   • THE QUOTA WAS FULL. Nothing is wrong with the film. Wait and shoot it
//     again — the clip was refunded and the prepaid render handed back.
//   • THE PROMPT WAS REFUSED. Retrying is pointless; it will be refused every
//     time. The scene has to be rewritten before it can ever be shot.
//
// "Video generation failed" covers both, so a director watching a film half-fail
// cannot tell which half of it needs their attention.
//
// ════════════════════════════════════════════════════════════════════════════
// THE INTERACTIONS API DOES NOT SAY WHY
// ════════════════════════════════════════════════════════════════════════════
//
// There is no error field to read. A refused video render comes back as a
// complete, well-formed interaction whose status is "failed", and the SDK's own
// Interaction type declares nothing that would carry a reason — no error, no
// blocked_reason, no output_text. Dumping the whole object (see failureDetail in
// omniVideo.js) gets id, status, model, and a usage block. That is all.
//
// So the usage block is the evidence, and it is good evidence:
//
//   "total_thought_tokens": 575, "total_output_tokens": 0
//
// The model read the prompt, thought about it, and then produced no video. A
// quota failure cannot look like this, because a quota failure never creates an
// interaction at all — Vertex rejects the create call with 429 and vertexQuota.js
// turns that into a message that says so. An interaction that ran and produced
// nothing is the model declining, which in practice means the content filters.
//
// That reading is INFERRED rather than reported, and it still says "Policy
// violation" on the card, because that is what it means to the person reading it
// and a hedged label would be a worse lie than a confident one. The uncertainty
// is kept where it can do some good instead: the `kind` is "refused" rather than
// "policy", and scripts/drip-render.mjs gives a refused scene one more go before
// dropping it, where a scene Vertex explicitly blocked is dropped immediately.
//
// Shared by the server (runVideoGeneration, which stores the label on the
// generation and therefore on every scene) and by scripts/drip-render.mjs, which
// decides whether re-queueing a scene is worth anything.

"use strict";

/**
 * Quota — the per-minute cap, from either side of it: our own bucket giving up,
 * or Vertex answering 429/RESOURCE_EXHAUSTED. See vertexQuota.js.
 */
const QUOTA =
  /resource[_ ]?exhausted|per-minute limit|briefly at capacity|quota|rate limit|too many requests|\b429\b/i;

/**
 * Policy, said out loud. Vertex has several vocabularies for it depending on
 * which filter caught it (BlockedReason in the GenAI types: SAFETY, OTHER,
 * BLOCKLIST, PROHIBITED_CONTENT, IMAGE_SAFETY, MODEL_ARMOR, JAILBREAK), so this
 * matches the words rather than any one shape.
 */
const POLICY =
  /safety|policy|policies|blocked|block_reason|blocked_reason|prohibited|restricted|blocklist|jailbreak|model armor|responsible ai|content filter|filtered|violat|not allowed/i;

/**
 * Policy, inferred. An interaction that reached "failed" having produced zero
 * output tokens — see the header. Both halves are required: a failure with no
 * usage block at all is just a failure.
 */
const NO_OUTPUT_TOKENS = /"total_output_tokens"\s*:\s*0\b/;
const RAN_AND_FAILED = /"status"\s*:\s*"failed"/;

/** The clock ran out — ours (DEADLINE_MS) or the platform's. */
const TIMEOUT = /timed out|timeout|deadline exceeded/i;

/** Vertex was unwell. Worth another go, like quota. */
const SERVICE = /unavailable|\b503\b|\b500\b|internal error|backend error|try again later/i;

/** It finished, politely, with no film in it. */
const EMPTY = /returned no video|no video was returned|finished with no clip/i;

/**
 * Name the failure.
 *
 * ORDER MATTERS. A refusal often contains the word "failed" and a quota message
 * often contains "try again", so the decisive tests run first and the vaguer
 * patterns only get what is left.
 *
 * @param {string} raw  The error as thrown — for a video render, the whole
 *   interaction is in here, which is why the inferred tests can work at all.
 * @returns {{kind: string, label: string, retryable: boolean, message: string, detail: string}}
 *   `kind` for code to branch on, `label` and `message` for humans — `message` is
 *   a clean sentence fit for a scene card, and `detail` keeps the raw text for
 *   whoever is debugging.
 */
function classifyRenderFailure(raw) {
  const detail = String(raw || "").trim() || "Generation failed";

  // THE MESSAGE IS THE LABEL AND NOTHING ELSE. It goes on a scene card that is
  // two inches wide, and the director is reading thirty of them at once looking
  // for the ones that are their problem. An explanatory sentence pushed the
  // useful word off the card; the raw throw (which for a video render is a whole
  // interaction, JSON and all) was worse. Everything else lives in `detail`,
  // stored beside it as errorDetail for whoever is debugging.
  const of = (kind, label, retryable) => ({ kind, label, retryable, message: label, detail });

  if (QUOTA.test(detail)) return of("quota", "Quota limit", true);
  if (POLICY.test(detail)) return of("policy", "Policy violation", false);
  if (TIMEOUT.test(detail)) return of("timeout", "Timed out", true);
  if (SERVICE.test(detail)) return of("service", "Service error", true);

  // Checked AFTER the explicit ones, because an interaction that was blocked
  // outright also reports no output tokens and deserves the plainer label.
  if (RAN_AND_FAILED.test(detail) && NO_OUTPUT_TOKENS.test(detail)) return of("refused", "Policy violation", false);

  if (EMPTY.test(detail)) return of("empty", "No clip returned", true);

  return of("unknown", "Failed", true);
}

module.exports = { classifyRenderFailure };
