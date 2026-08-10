/**
 * Vertex AI quota manager for davelabs-tools.
 *
 * The project runs on a young GCP billing account with low per-minute Vertex
 * quotas that are easy to exhaust. When a quota is hit Vertex replies with
 * HTTP 429 / status RESOURCE_EXHAUSTED. This module makes those errors soft:
 *
 *   1. PROACTIVE — reserveSlot() spreads generation across a Firestore-backed
 *      token bucket (one counter doc per model-family per 60s window). If this
 *      minute's budget is already spent, the request waits for the next window
 *      instead of firing a call that we know would 429. Cross-instance, so it
 *      answers "how many of us are calling right now" even though Cloud
 *      Functions are stateless. Best-effort: any bucket error FAILS OPEN so the
 *      limiter can never itself block generation.
 *
 *   2. REACTIVE — callVertexWithRetry()/withSdkRetry() catch a 429 that slips
 *      through, wait out the rest of the minute (honouring the server's
 *      RetryInfo/Retry-After when present) and try again. BOUNDED by attempts
 *      AND total wall-time — it never loops forever, so a stuck quota can't hang
 *      or crash the function.
 *
 *   3. CLASSIFICATION — only genuine "try again in a moment" conditions are
 *      retried (per-minute quota, 503/UNAVAILABLE). Billing/permission problems,
 *      daily/lifetime quota caps, and every other error (400/401/404/…) are
 *      surfaced to the caller immediately and untouched, because waiting would
 *      never fix them.
 *
 * Never AI Studio — this is Vertex-only, matching the rest of the project.
 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Per-minute caps ─────────────────────────────────────────────────────────
// Deliberately conservative — tune to whatever the GCP console shows for each
// model's "requests per minute". Override any of them without a redeploy via an
// env var, e.g. VERTEX_CAP_IMAGE=12. A cap of 0 disables proactive limiting for
// that family (reactive retry still protects it).
// Sized from what this project actually gets back, not from documentation: a
// text pass paced at 10/min took a RESOURCE_EXHAUSTED inside a minute, and video
// is a stated 3/min. Every one of these is deliberately UNDER the believed limit,
// because the cost of being 20% too slow is waiting and the cost of being 20% too
// fast is a paid attempt that returns nothing.
//
// Override any of them without a redeploy: VERTEX_CAP_IMAGE=10, and so on.
const DEFAULT_CAPS = {
  image: 6,
  tts: 6,
  text: 6,
  // Video is paced by the queue in index.js — one at a time, with a cooldown
  // measured from the finish — so this is a backstop rather than the control.
  video: 1,
  music: 3,
  default: 6,
};

function capFor(family) {
  const envKey = `VERTEX_CAP_${family.toUpperCase()}`;
  const raw = process.env[envKey];
  if (raw !== undefined && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_CAPS[family] ?? DEFAULT_CAPS.default;
}

// Collapses a concrete model id to the quota family it draws from. Vertex meters
// per base model, but grouping by family is close enough to smooth our load and
// keeps the bucket doc count tiny.
function modelFamily(model) {
  const m = String(model || "").toLowerCase();
  if (m.includes("lyria") || m.includes("music")) return "music";
  if (m.includes("image") || m.includes("banana")) return "image";
  if (m.includes("tts")) return "tts";
  if (m.includes("omni") || m.includes("veo") || m.includes("video")) return "video";
  return "text";
}

// ── Error classification ─────────────────────────────────────────────────────

function msToNextMinute() {
  return 60000 - (Date.now() % 60000);
}

// Vertex returns a RetryInfo detail ("retryDelay": "17s") and sometimes a
// Retry-After header. Prefer the server's own hint when we have it.
function parseRetryDelay(bodyObj, retryAfterHeader) {
  // google.rpc.RetryInfo inside error.details
  const details = bodyObj?.error?.details;
  if (Array.isArray(details)) {
    for (const d of details) {
      const type = d?.["@type"] || "";
      if (type.includes("RetryInfo") && d.retryDelay) {
        const secs = parseFloat(String(d.retryDelay).replace(/s$/, ""));
        if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
      }
    }
  }
  if (retryAfterHeader) {
    const secs = Number(retryAfterHeader);
    if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
    const asDate = Date.parse(retryAfterHeader);
    if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now());
  }
  return null;
}

/**
 * Classifies a failed Vertex call.
 * @returns {{ retryable: boolean, kind: string, message: string, waitMs?: number }}
 *   kind ∈ billing_permission | quota_rate | quota_daily | unavailable | other
 */
function classifyVertexError(status, bodyText, retryAfterHeader) {
  let bodyObj = null;
  try {
    bodyObj = typeof bodyText === "object" ? bodyText : JSON.parse(bodyText);
  } catch {
    bodyObj = null;
  }
  const err = bodyObj?.error || {};
  const statusName = String(err.status || "");
  const message = String(err.message || bodyText || "").slice(0, 600);
  const lower = message.toLowerCase();

  // Billing / permission — waiting never helps. Surface immediately.
  const billingSignals = [
    "billing account",
    "billing is disabled",
    "billing has not been enabled",
    "billing_disabled",
    "has not been used in project",
    "is disabled",
    "account is disabled",
    "permission_denied",
    "permission denied",
    "does not have permission",
    "consumer",
  ];
  if (
    status === 401 ||
    status === 403 ||
    statusName === "PERMISSION_DENIED" ||
    statusName === "UNAUTHENTICATED" ||
    billingSignals.some((s) => lower.includes(s))
  ) {
    return { retryable: false, kind: "billing_permission", message };
  }

  // Quota exhaustion.
  if (status === 429 || statusName === "RESOURCE_EXHAUSTED") {
    // A daily / lifetime cap won't refresh within any wait worth doing — treat
    // it as terminal and hand it back so we don't spin uselessly.
    const isLongWindow =
      /per day|per-day|daily|per week|per month|quota limit '.*per day/.test(lower) &&
      !/per minute|per-minute|60 second/.test(lower);
    if (isLongWindow) {
      return { retryable: false, kind: "quota_daily", message };
    }
    const serverWait = parseRetryDelay(bodyObj, retryAfterHeader);
    // Per-minute quota → wait out the rest of the window plus a small buffer.
    const waitMs = serverWait != null ? serverWait + 500 : msToNextMinute() + 1500;
    return { retryable: true, kind: "quota_rate", message, waitMs };
  }

  // Transient upstream (model overloaded, brief unavailability).
  if (status === 500 || status === 503 || statusName === "UNAVAILABLE") {
    const serverWait = parseRetryDelay(bodyObj, retryAfterHeader);
    return { retryable: true, kind: "unavailable", message, waitMs: serverWait ?? 4000 };
  }

  // 400 / 404 / anything else — a real problem with the request. Surface it.
  return { retryable: false, kind: "other", message };
}

// A friendlier sentence for the client once we've given up retrying.
function friendlyMessage(kind, model, rawMessage) {
  switch (kind) {
    case "quota_rate":
      return "Our generation service is briefly at capacity (per-minute limit reached). Please try again in a minute.";
    case "quota_daily":
      return "The daily generation quota for this service has been reached. Please try again later.";
    case "billing_permission":
      return `Generation is unavailable due to a billing/permission issue on the AI service. (${rawMessage})`;
    case "unavailable":
      return "The generation service is temporarily unavailable. Please try again shortly.";
    default:
      return rawMessage;
  }
}

function makeError(kind, model, status, rawMessage) {
  const e = new Error(friendlyMessage(kind, model, rawMessage));
  e.vertexKind = kind;
  e.httpStatus = status;
  e.retryable = kind === "quota_rate" || kind === "unavailable";
  e.rawMessage = rawMessage;
  return e;
}

// ── Proactive limiter (Firestore token bucket) ──────────────────────────────
//
// FAILS OPEN on an ERROR — a broken limiter must never be the reason a
// generation doesn't run. But it no longer fails open on being BUSY, and that
// distinction is the whole fix.
//
// WHAT WAS WRONG. The wait was capped at ~one window and then the call went
// through anyway: "give up smoothing; let the reactive retry guard it." With
// thirty scenes enqueued at once that is thirty callers who wait one minute in
// perfect lockstep and then fire together — a bigger spike than the one the
// limiter was added to prevent, and every one of them a paid attempt. It is why
// nineteen of thirty scenes failed on a film, and the same shape of failure hits
// a hundred-image shot board.
//
// Now it waits across as many windows as it takes, up to a bound generous enough
// that a correctly-sized cap always gets a slot. Callers still cannot be held
// forever: the bound is well inside the 540s function ceiling, and past it the
// reactive layer takes over exactly as before.
const RESERVE_MAX_WAIT_MS = Number(process.env.VERTEX_RESERVE_MAX_WAIT_MS || 5 * 60 * 1000);

async function reserveSlot(db, model) {
  const family = modelFamily(model);
  const cap = capFor(family);
  if (!db || !cap || cap <= 0) return; // limiting disabled for this family

  const maxWaitMs = RESERVE_MAX_WAIT_MS;
  const start = Date.now();

  for (;;) {
    const windowId = Math.floor(Date.now() / 60000);
    const ref = db.collection("rateLimits").doc(`${family}_${windowId}`);
    let granted;
    try {
      granted = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const count = (snap.exists && snap.data().count) || 0;
        if (count >= cap) return false;
        tx.set(
          ref,
          {
            family,
            windowId,
            count: count + 1,
            // for the sweeper — safe to delete once this window is well past
            staleAfter: (windowId + 3) * 60000,
          },
          { merge: true }
        );
        return true;
      });
    } catch (e) {
      console.warn(`[vertexQuota ${family}] bucket reservation failed, failing open:`, e.message);
      return;
    }

    if (granted) return;

    const remaining = maxWaitMs - (Date.now() - start);
    if (remaining <= 0) {
      // Only after minutes of waiting, not after one window. By here either the
      // cap is set too low for the load or something upstream is wedged, and
      // holding the caller past the function's own ceiling helps nobody — the
      // reactive layer takes it from here, exactly as it always did.
      console.warn(
        `[vertexQuota ${family}] still saturated (${cap}/min) after ${Math.round(maxWaitMs / 1000)}s; proceeding, reactive retry will guard.`
      );
      return;
    }
    // Sleep to the top of the next window, where the counter resets. The jitter
    // matters: without it every caller that piled up behind this cap wakes on
    // the same millisecond and they race for the new window in lockstep, which
    // is the stampede in miniature.
    const jitter = Math.floor(Math.random() * 750);
    const waitMs = Math.min(msToNextMinute() + 300 + jitter, remaining);
    console.log(`[vertexQuota ${family}] window ${windowId} full (${cap}/min) — waiting ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
}

// ── Reactive retry: REST (fetch → Response) ─────────────────────────────────
/**
 * Runs doFetch() (which must issue a fresh request each call and resolve to a
 * Response) and retries a retryable quota/unavailable failure with bounded
 * waits. Returns the ok Response. Throws a classified Error otherwise.
 */
async function callVertexWithRetry({ db, model, doFetch, maxAttempts = 4, maxTotalWaitMs = 90000 }) {
  if (db) {
    try {
      await reserveSlot(db, model);
    } catch {
      /* fail open */
    }
  }

  let attempt = 0;
  let waited = 0;
  for (;;) {
    attempt++;
    let res;
    try {
      res = await doFetch();
    } catch (netErr) {
      // Network/DNS/socket hiccup — treat like a transient unavailability.
      if (attempt >= maxAttempts || waited + 4000 > maxTotalWaitMs) {
        throw makeError("unavailable", model, 0, netErr.message || String(netErr));
      }
      await sleep(4000);
      waited += 4000;
      continue;
    }

    if (res.ok) return res;

    const bodyText = await res.text();
    const info = classifyVertexError(res.status, bodyText, res.headers.get("retry-after"));

    const canRetry =
      info.retryable && attempt < maxAttempts && waited + (info.waitMs || 0) <= maxTotalWaitMs;

    if (!canRetry) {
      throw makeError(info.kind, model, res.status, info.message);
    }

    const wait = Math.min(info.waitMs || 1000, maxTotalWaitMs - waited);
    console.warn(
      `[vertexQuota ${modelFamily(model)}] ${info.kind} on attempt ${attempt}/${maxAttempts} — waiting ${Math.round(
        wait / 1000
      )}s then retrying`
    );
    await sleep(wait);
    waited += wait;
  }
}

// ── Reactive retry: SDK (throwing promise) ──────────────────────────────────
// Pulls an HTTP status + body out of whatever the @google/genai SDK throws so
// interactions.create/get errors classify the same way as REST ones.
function extractSdkError(err) {
  const status =
    err?.status || err?.code || err?.response?.status || err?.cause?.status || 0;
  let body = err?.message || "";
  // Some SDK errors embed a JSON string in .message; classifyVertexError parses it.
  if (err?.response?.data) {
    try {
      body = typeof err.response.data === "string" ? err.response.data : JSON.stringify(err.response.data);
    } catch {
      /* keep message */
    }
  }
  return { status: Number(status) || 0, body };
}

async function withSdkRetry({ db, model, fn, maxAttempts = 5, maxTotalWaitMs = 240000 }) {
  if (db) {
    try {
      await reserveSlot(db, model);
    } catch {
      /* fail open */
    }
  }

  let attempt = 0;
  let waited = 0;
  for (;;) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      const { status, body } = extractSdkError(err);
      const info = classifyVertexError(status, body, null);

      const canRetry =
        info.retryable && attempt < maxAttempts && waited + (info.waitMs || 0) <= maxTotalWaitMs;

      if (!canRetry) {
        // Preserve the original error when we couldn't classify it as ours.
        if (info.kind === "other") throw err;
        throw makeError(info.kind, model, status, info.message);
      }

      const wait = Math.min(info.waitMs || 1000, maxTotalWaitMs - waited);
      console.warn(
        `[vertexQuota ${modelFamily(model)}] SDK ${info.kind} on attempt ${attempt}/${maxAttempts} — waiting ${Math.round(
          wait / 1000
        )}s then retrying`
      );
      await sleep(wait);
      waited += wait;
    }
  }
}

module.exports = {
  reserveSlot,
  callVertexWithRetry,
  withSdkRetry,
  classifyVertexError,
  modelFamily,
  capFor,
  makeError,
  friendlyMessage,
  DEFAULT_CAPS,
};
