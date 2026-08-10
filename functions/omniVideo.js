/**
 * gemini-omni-flash-preview video generation via the Vertex Interactions API.
 *
 * The model can no longer be called through generateContent — Vertex rejects it
 * with 400 "only supported in the Interactions API". A plain (blocking)
 * interactions.create also used to hang past HTTP idle timeouts while the video
 * rendered, so we create the interaction with background:true and poll
 * interactions.get until it completes (verified working ~40s end-to-end by
 * scripts/probe-omni-interactions.mjs).
 */

const admin = require("firebase-admin");
const { withSdkRetry } = require("./vertexQuota");

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const MODEL = "gemini-omni-flash-preview";

// The SDK client is built on first use rather than at require time. Constructing
// it eagerly runs Google's auth discovery during module load, which is on the
// cold-start path of every function in this file's require graph — including the
// ones that never generate a video.
//
// `admin` and `withSdkRetry` above must stay at the top: both are used inside
// generateOmniVideo, and lazy-loading only the GenAI client once left them
// undefined, which threw `ReferenceError: admin is not defined` on every render.
let _ai = null;
function getAi() {
  if (!_ai) {
    const { GoogleGenAI } = require("@google/genai");
    _ai = new GoogleGenAI({ vertexai: true, project: PROJECT_ID, location: "global" });
  }
  return _ai;
}

const POLL_INTERVAL_MS = 5000;
// processVideoGeneration runs with timeoutSeconds: 540 — leave headroom to
// upload the result and update Firestore before the platform kills us.
const DEADLINE_MS = 8 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// media: { images: [{base64, mimeType}], imageBase64, imageMimeType,
//          videoBase64, videoMimeType, audioBase64, audioMimeType }
//
// Returns a STEP LIST — `[{ type: "user_input", content: [...] }]`. The
// Interactions API moved to a steps-based version and now rejects the older
// turn-list shape (`[{ role: "user", content }]`) with:
//   400 "When using the steps-based API version, use step_list input format
//        instead of turn_list."
// Per the SDK's own types, InteractionsInput accepts Array<Step>, and
// UserInputStep is `{ type: "user_input", content?: Array<Content> }`. The
// content items themselves (text/image/video/audio) are unchanged.
function buildInput(prompt, media) {
  const content = [];

  if (media && Array.isArray(media.images) && media.images.length > 0) {
    for (const img of media.images) {
      if (img.base64 && img.mimeType) {
        content.push({ type: "image", data: img.base64, mime_type: img.mimeType });
      }
    }
  } else if (media && media.imageBase64 && media.imageMimeType) {
    content.push({ type: "image", data: media.imageBase64, mime_type: media.imageMimeType });
  } else if (media && media.videoBase64 && media.videoMimeType) {
    content.push({ type: "video", data: media.videoBase64, mime_type: media.videoMimeType });
  }

  if (media && media.audioBase64 && media.audioMimeType) {
    content.push({ type: "audio", data: media.audioBase64, mime_type: media.audioMimeType });
  }

  content.push({ type: "text", text: prompt });
  return [{ type: "user_input", content }];
}

/**
 * Whatever a failed interaction says about itself, in one short string.
 *
 * Two passes, because the useful sentence is usually in a named field and only
 * sometimes buried in the steps:
 *
 *   1. the fields that plausibly carry a reason, whether or not the SDK's types
 *      admit they exist — the Interactions API is younger than its typings,
 *   2. failing that, the whole object with the heavy parts removed.
 *
 * `data` is dropped everywhere on the way out. A step can hold a base64 image we
 * sent up, and putting a megabyte of it into an Error message means the message
 * lands in a Firestore document that is capped at one.
 */
function failureDetail(interaction) {
  const named = [
    interaction.output_text,
    interaction.error,
    interaction.incomplete_details,
    interaction.status_message,
    interaction.blocked_reason,
    interaction.block_reason,
    interaction.finish_reason,
    interaction.safety_ratings,
  ].filter(Boolean);

  const render = (value) =>
    typeof value === "string" ? value : JSON.stringify(value, (key, v) => (key === "data" ? "[bytes]" : v));

  if (named.length > 0) return `: ${named.map(render).slice(0, 3).join(" | ").slice(0, 500)}`;

  try {
    const { steps, ...rest } = interaction;
    const dump = render(rest);
    // "{}" or near enough — say nothing rather than print punctuation.
    return dump && dump.length > 2 ? `: ${dump.slice(0, 500)}` : "";
  } catch {
    return "";
  }
}

/** Generates a video and returns { base64, mimeType }. */
async function generateOmniVideo(prompt, media) {
  const db = admin.firestore();

  // Creating the interaction is what consumes video quota, so it runs through
  // the quota manager: a bucket reservation smooths us under the per-minute cap,
  // and a bounded retry waits out a 429 window before giving up. Kept modest so
  // the create + the polling below still fit inside the function deadline.
  const interaction = await withSdkRetry({
    db,
    model: MODEL,
    fn: () =>
      getAi().interactions.create({
        model: MODEL,
        input: buildInput(prompt, media),
        background: true,
        store: true,
      }),
    maxAttempts: 3,
    maxTotalWaitMs: 90000,
  });
  console.log(`[omni] interaction ${interaction.id} created (status: ${interaction.status})`);

  const deadline = Date.now() + DEADLINE_MS;
  let current = interaction;
  while (current.status === "in_progress" || current.status === "queued") {
    if (Date.now() > deadline) {
      throw new Error(`Video generation timed out after ${DEADLINE_MS / 1000}s (interaction ${interaction.id})`);
    }
    await sleep(POLL_INTERVAL_MS);
    // Status polls don't consume generation quota, so no bucket reservation
    // (db omitted) — just a light retry so a blip doesn't kill an in-flight job.
    current = await withSdkRetry({
      model: MODEL,
      fn: () => getAi().interactions.get(interaction.id),
      maxAttempts: 3,
      maxTotalWaitMs: 20000,
    });
  }

  if (current.status !== "completed") {
    // EVERYTHING THE INTERACTION WILL TELL US, not just output_text.
    //
    // A refused prompt and a full quota both arrived here as the bare words
    // "Video generation failed", which is the one thing a director cannot act
    // on: one of them means wait, the other means rewrite the scene. The status
    // alone never distinguishes them — the reason is somewhere in the object,
    // and the SDK's own Interaction type does not declare a field for it, so
    // there is nothing specific to read. We serialise what came back instead and
    // let renderFailure.js name it.
    throw new Error(`Video generation ${current.status}${failureDetail(current)}`);
  }

  const video = current.output_video;
  if (video && video.data) {
    return { base64: video.data, mimeType: video.mime_type || "video/mp4" };
  }
  if (video && video.uri) {
    const res = await fetch(video.uri);
    if (!res.ok) throw new Error(`Failed to download generated video (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString("base64"), mimeType: video.mime_type || "video/mp4" };
  }
  throw new Error(
    "Interaction completed but returned no video" +
      (current.output_text ? ` (model said: ${String(current.output_text).slice(0, 300)})` : "")
  );
}

module.exports = { generateOmniVideo };
