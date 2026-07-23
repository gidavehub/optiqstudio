/**
 * Optiq Studio Cloud Functions (project: davelabs-tools).
 *
 * Deploy (as davelabs01@gmail.com):
 *   firebase deploy --only functions
 *
 * modemWebhook gives ModemPay a public webhook URL that works even while the
 * Next.js app runs on localhost:
 *   https://us-east4-davelabs-tools.cloudfunctions.net/modemWebhook
 * Set the signing secret before deploying:
 *   firebase functions:secrets:set MODEM_WEBHOOK_SECRET
 */

const functions = require("firebase-functions/v1");
const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { GoogleAuth } = require("google-auth-library");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { callVertexWithRetry } = require("./vertexQuota");

admin.initializeApp();
const db = admin.firestore();

async function getPricing() {
  const fallback = {
    plans: [
      { id: "pro-monthly", name: "Optiq Pro", priceUsd: 100, monthlyCredits: 10000 },
      { id: "studio-monthly", name: "Optiq Studio", priceUsd: 250, monthlyCredits: 28000 },
      { id: "enterprise-monthly", name: "Optiq Enterprise", priceUsd: 450, monthlyCredits: 55000 },
    ],
    packs: [
      { id: "pack-1000", credits: 1000, priceUsd: 12 },
      { id: "pack-5000", credits: 5000, priceUsd: 50 },
      { id: "pack-12000", credits: 12000, priceUsd: 100 },
    ],
    costs: {
      videoPerSecond: { omni: 15, "omni-fast": 15 },
      image: 50,
      ttsPer100Chars: 10,
      ttsMinimum: 15,
      characterSheet: 150,
    }
  };
  try {
    const rtdb = admin.database();
    const snapshot = await rtdb.ref("pricing").once("value");
    const val = snapshot.val();
    if (val && val.plans && val.packs && val.costs) {
      return val;
    }
  } catch (err) {
    console.warn("Failed to load pricing from RTDB, using fallback:", err);
  }
  return fallback;
}

const MODEM_WEBHOOK_SECRET = defineSecret("MODEM_WEBHOOK_SECRET");
const MODEMPAY_API_KEY = defineSecret("MODEMPAY_API_KEY");

const PLAN_CREDITS = 10000;

// The wallet is denominated in GMD (the `credits` field holds a GMD balance).
// New accounts get this much free; top-ups are charged 1:1 in GMD.
const WELCOME_BONUS_GMD = 1000;
const MIN_TOPUP_GMD = 50;
const MAX_TOPUP_GMD = 500000;

/** ModemPay webhook: verifies x-modem-signature (HMAC-SHA512) and fulfills. */
exports.modemWebhook = onRequest(
  { region: "us-east4", secrets: [MODEM_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
    const signature = req.get("x-modem-signature");
    const secret = MODEM_WEBHOOK_SECRET.value().trim();

    if (!signature || !secret) {
      res.status(400).json({ error: "Missing signature or secret" });
      return;
    }
    const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    if (
      computed.length !== signature.length ||
      !crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
    ) {
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      const event = JSON.parse(rawBody);
      if (event.event === "charge.succeeded") {
        const charge = event.payload;
        const meta = charge.metadata || {};
        const uid = meta.uid;

        // Idempotent: each charge id fulfills exactly once.
        const ref = db.collection("payments").doc(charge.id);
        const isNew = await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (snap.exists) return false;
          tx.set(ref, {
            uid: uid || null,
            kind: meta.kind || "unknown",
            credits: Number(meta.credits) || 0,
            amount: charge.amount,
            currency: charge.currency,
            reference: charge.transaction_reference || null,
            email: charge.customer_email || null,
            receivedAt: new Date().toISOString(),
            via: "cloud-function",
          });
          return true;
        });

        if (isNew && uid) {
          const userRef = db.collection("users").doc(uid);
          if (meta.kind === "subscription") {
            const renews = new Date();
            renews.setMonth(renews.getMonth() + 1);
            const credits = Number(meta.credits) || PLAN_CREDITS;
            const planId = meta.planId || "pro-monthly";
            let planName = "Optiq Pro";
            if (planId === "studio-monthly") planName = "Optiq Studio";
            if (planId === "enterprise-monthly") planName = "Optiq Enterprise";

            await userRef.set(
              {
                plan: planId,
                planStatus: "active",
                planRenewsAt: renews.toISOString(),
                credits: admin.firestore.FieldValue.increment(credits),
              },
              { merge: true }
            );
            await userRef.collection("ledger").add({
              delta: credits,
              reason: `subscription: ${planName}`,
              at: new Date().toISOString(),
            });
          } else {
            const credits = Number(meta.credits) || 0;
            if (credits > 0) {
              await userRef.set(
                { credits: admin.firestore.FieldValue.increment(credits) },
                { merge: true }
              );
              await userRef.collection("ledger").add({
                delta: credits,
                reason: `purchase ${charge.id}`,
                at: new Date().toISOString(),
              });
            }
          }
        }
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("Webhook fulfillment error:", err);
      res.status(500).json({ error: "Fulfillment failed" });
    }
  }
);

/** Daily sweep: downgrade Pro plans whose renewal date passed without payment. */
exports.sweepExpiredPlans = onSchedule(
  { schedule: "every 24 hours", region: "us-east4" },
  async () => {
    const now = new Date().toISOString();
    const snap = await db
      .collection("users")
      .where("planStatus", "==", "active")
      .where("planRenewsAt", "<", now)
      .get();
    const batch = db.batch();
    snap.docs.forEach((doc) => {
      batch.update(doc.ref, { planStatus: "none", plan: null });
    });
    await batch.commit();
    console.log(`Downgraded ${snap.size} expired plan(s)`);
  }
);

/**
 * Housekeeping: the quota manager writes one tiny counter doc per model-family
 * per 60-second window into `rateLimits`. Those are dead the moment their window
 * passes, so sweep the stale ones a few times a day to keep the collection lean.
 */
exports.sweepRateLimits = onSchedule(
  { schedule: "every 6 hours", region: "us-east4" },
  async () => {
    const cutoff = Date.now() - 5 * 60000; // any window older than ~5 min is done
    const snap = await db
      .collection("rateLimits")
      .where("staleAfter", "<", cutoff)
      .limit(500)
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`Swept ${snap.size} expired rateLimits window doc(s)`);
  }
);

/**
 * Cloud Function to generate an image using Vertex AI gemini-3.1-flash-image with no fallbacks.
 */
exports.generateImage = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      const { prompt, aspect } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }

      const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
      const client = await auth.getClient();
      const accessToken = (await client.getAccessToken()).token;
      const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
      const model = "gemini-3.1-flash-image";

      console.log(`Starting image generation with model: ${model}`);
      const url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/global/publishers/google/models/${model}:generateContent`;
      
      const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: aspect || "1:1" }
        }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-goog-user-project": projectId
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Status ${response.status}: ${errText}`);
      }

      const result = await response.json();
      const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (part && part.inlineData && part.inlineData.data) {
        console.log(`Successfully generated image with model: ${model}`);
        return res.status(200).json({
          success: true,
          model: model,
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType || "image/jpeg"
        });
      } else {
        throw new Error("No inline image data in candidates response");
      }
    } catch (error) {
      console.error("generateImage error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Cloud Function to generate a video using Vertex AI gemini-omni-flash-preview with no fallbacks.
 */
exports.generateVideo = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 300 },
  async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt" });
      }

      const model = "gemini-omni-flash-preview";
      console.log(`Starting video generation with model: ${model} via Interactions API`);

      const video = await generateOmniVideo(prompt);
      console.log(`Successfully generated video with model: ${model}`);
      return res.status(200).json({
        success: true,
        model: model,
        base64: video.base64,
        mimeType: video.mimeType,
      });
    } catch (error) {
      console.error("generateVideo error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Cloud Function to create a ModemPay Payment Intent.
 * Verifies the user ID token and returns the hosted checkout link.
 */
exports.modemPayCheckout = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 60, secrets: [MODEMPAY_API_KEY] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method not allowed");
      }

      const authHeader = req.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const token = authHeader.split("Bearer ")[1];
      const decoded = await admin.auth().verifyIdToken(token);
      const uid = decoded.uid;
      const email = decoded.email || null;
      const name = decoded.name || null;

      const { kind, packId, planId, amountGmd: topupAmountGmd } = req.body;
      const appUrl = "https://optiq.studio"; // Production URL!

      const pricing = await getPricing();
      const PLANS = pricing.plans;
      const CREDIT_PACKS = pricing.packs;

      let amount;
      let title;
      let credits;
      let selectedPlanId = "pro-monthly";

      // ── Wallet top-up: the only path the new paywall uses ────────────────
      // The user names their own amount. The wallet is already GMD, so the
      // charge and the credited balance are the same number — no USD
      // conversion, no packs, no subscription.
      if (kind === "topup") {
        const requested = Math.round(Number(topupAmountGmd));
        if (!Number.isFinite(requested) || requested < MIN_TOPUP_GMD || requested > MAX_TOPUP_GMD) {
          return res.status(400).json({
            error: `Top-up must be between GMD ${MIN_TOPUP_GMD} and GMD ${MAX_TOPUP_GMD.toLocaleString()}`,
          });
        }

        const apiKeyTopup = MODEMPAY_API_KEY.value().trim();
        const topupBody = {
          data: {
            amount: requested,
            currency: "GMD",
            title: `Optiq Studio wallet top-up — GMD ${requested.toLocaleString()}`,
            description: `Adds GMD ${requested.toLocaleString()} to your Optiq Studio wallet`,
            customer_email: email,
            customer_name: name,
            metadata: {
              uid,
              kind: "credits", // the webhook already credits `credits` for this kind
              packId: "",
              planId: "",
              credits: String(requested),
            },
            return_url: `${appUrl}/dashboard/billing?status=success`,
            cancel_url: `${appUrl}/dashboard/billing?status=cancelled`,
            callback_url: `https://us-east4-davelabs-tools.cloudfunctions.net/modemWebhook`,
            from_sdk: false,
          },
        };

        const topupRes = await fetch("https://api.modempay.com/v1/payments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKeyTopup}`,
          },
          body: JSON.stringify(topupBody),
        });
        const topupJson = await topupRes.json().catch(() => ({}));
        if (!topupRes.ok) {
          console.error("ModemPay top-up error:", topupJson);
          return res.status(502).json({ error: topupJson?.message || "Payment provider error" });
        }
        const link = topupJson?.data?.payment_link || topupJson?.payment_link;
        if (!link) {
          console.error("ModemPay top-up returned no payment link:", topupJson);
          return res.status(502).json({ error: "Payment provider returned no link" });
        }
        return res.status(200).json({ paymentLink: link, amountGmd: requested });
      }

      if (kind === "subscription") {
        const plan = PLANS.find((p) => p.id === planId) || PLANS[0];
        amount = plan.priceUsd;
        title = `${plan.name} — monthly subscription`;
        credits = plan.monthlyCredits;
        selectedPlanId = plan.id;
      } else if (kind === "credits") {
        const pack = CREDIT_PACKS.find((p) => p.id === packId);
        if (!pack) {
          return res.status(400).json({ error: "Unknown pack" });
        }
        amount = pack.priceUsd;
        title = `Optiq Studio credits — ${pack.credits.toLocaleString()}`;
        credits = pack.credits;
      } else {
        return res.status(400).json({ error: "Unknown checkout kind" });
      }

      const apiKey = MODEMPAY_API_KEY.value().trim();

      // ModemPay only supports GMD (Gambian Dalasi). Convert USD price to GMD at a standard exchange rate of ~73.5 GMD per USD.
      const exchangeRate = 73.5;
      const amountGmd = Math.round(amount * exchangeRate);

      const body = {
        data: {
          amount: amountGmd,
          currency: "GMD",
          title,
          description: title,
          customer_email: email,
          customer_name: name,
          metadata: {
            uid,
            kind,
            packId: packId || "",
            planId: selectedPlanId,
            credits: String(credits),
          },
          return_url: `${appUrl}/dashboard/billing?status=success`,
          cancel_url: `${appUrl}/dashboard/billing?status=cancelled`,
          callback_url: `https://us-east4-davelabs-tools.cloudfunctions.net/modemWebhook`,
          from_sdk: false
        }
      };

      const modemRes = await fetch("https://api.modempay.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!modemRes.ok) {
        const text = await modemRes.text();
        throw new Error(`ModemPay request failed: ${text}`);
      }

      const result = await modemRes.json();
      return res.status(200).json({ paymentLink: result.data.payment_link });
    } catch (err) {
      console.error("modemPayCheckout error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// --- OPTIQ CLIENT API CLOUD FUNCTIONS REPLACING NEXT.JS API ENDPOINTS ---

const STORAGE_BUCKET = "davelabs-tools";

async function getAccessToken() {
  const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  return tokenRes.token;
}

async function vertexFetch(path, body) {
  const projectId = "davelabs-tools";
  let url;
  if (
    path.includes("gemini-3.1-flash-image") ||
    path.includes("gemini-omni-flash-preview") ||
    path.includes("gemini-3.5-flash") ||
    path.includes("gemini-3.1-flash-tts-preview") // Gemini 3.1 Flash TTS: serves at global, 404s at us-east4
  ) {
    url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/global${path}`;
  } else {
    url = `https://us-east4-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-east4${path}`;
  }

  // The quota manager smooths us under the per-minute cap (proactive) and waits
  // out any 429 that still slips through (reactive, bounded), while surfacing
  // billing/permission/permanent-quota errors straight away. The model id is
  // pulled from the path so it can charge the right per-minute bucket, and the
  // access token is fetched fresh on every attempt (a token can expire while we
  // wait out a quota window).
  const model = (path.match(/models\/([^:]+):/) || [])[1] || "text";
  const res = await callVertexWithRetry({
    db,
    model,
    doFetch: async () => {
      const token = await getAccessToken();
      return fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    },
  });
  return res.json();
}

async function requireAuth(req) {
  const authHeader = req.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split("Bearer ")[1];
  const decoded = await admin.auth().verifyIdToken(token);
  return decoded;
}

async function chargeCredits(uid, amount, reason) {
  if (amount <= 0) {
    const snap = await db.collection("users").doc(uid).get();
    return (snap.data()?.credits) || 0;
  }
  const ref = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const available = (snap.data()?.credits) || 0;
    if (available < amount) {
      throw new Error(`Insufficient credits: need ${amount}, have ${available}`);
    }
    tx.update(ref, { credits: admin.firestore.FieldValue.increment(-amount) });
    tx.set(ref.collection("ledger").doc(), {
      delta: -amount,
      reason,
      at: new Date().toISOString(),
    });
    return available - amount;
  });
}

async function refundCredits(uid, amount, reason) {
  if (amount <= 0) return;
  const ref = db.collection("users").doc(uid);
  await ref.set({ credits: admin.firestore.FieldValue.increment(amount) }, { merge: true });
  await ref.collection("ledger").add({
    delta: amount,
    reason: `refund: ${reason}`,
    at: new Date().toISOString(),
  });
}

async function uploadBase64(base64, path, contentType) {
  const file = admin.storage().bucket(STORAGE_BUCKET).file(path);
  await file.save(Buffer.from(base64, "base64"), {
    contentType,
    resumable: false,
    metadata: {
      // Generated media is immutable — the path always carries a unique id, so
      // a new render is a new URL. Without this every scrub, replay or revisit
      // re-downloaded the whole mp4 from GCS, which is a large part of why
      // playback felt slow. Now the browser (and any CDN) keeps it for a year.
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return `https://storage.googleapis.com/${STORAGE_BUCKET}/${path}`;
}

// Reference media (image/video/audio) attached to a generation can easily be
// several MB once base64-encoded. Firestore documents are hard-capped at 1MB,
// so storing that inline makes the write throw for anything but a tiny image —
// which is why images "went all the way" but audio/video never did. Instead we
// offload each attachment to Cloud Storage and keep only the object path on the
// Firestore doc, then rehydrate it to base64 at generation time.
async function uploadInputMedia(base64, path, contentType) {
  await admin.storage().bucket(STORAGE_BUCKET).file(path).save(Buffer.from(base64, "base64"), {
    contentType,
    resumable: false,
  });
  return path;
}

async function downloadInputMedia(path) {
  const [buf] = await admin.storage().bucket(STORAGE_BUCKET).file(path).download();
  return buf.toString("base64");
}

// Persists any inline reference media from the request body to Storage and
// returns the fields (paths + mime types) to write on the generation doc.
async function persistReferenceMedia(uid, docId, body) {
  const base = `generations/${uid}/${docId}/input`;
  const out = {
    imagePath: null,
    imageMimeType: body.imageMimeType || null,
    videoPath: null,
    videoMimeType: body.videoMimeType || null,
    audioPath: null,
    audioMimeType: body.audioMimeType || null,
    images: null,
  };

  if (Array.isArray(body.imagePaths) && body.imagePaths.length > 0) {
    // References to media already sitting in Storage (e.g. project brand
    // materials attached to a storyboard scene) — no re-upload needed.
    out.images = body.imagePaths
      .filter((img) => img && img.path)
      .map((img) => ({ path: img.path, mimeType: img.mimeType || "image/png", shared: true }));
    if (out.images.length > 0) {
      out.imagePath = out.images[0].path;
      out.imageMimeType = out.images[0].mimeType;
    }
  } else if (Array.isArray(body.images) && body.images.length > 0) {
    out.images = [];
    for (let i = 0; i < body.images.length; i++) {
      const img = body.images[i];
      if (img.base64 && img.mimeType) {
        const path = await uploadInputMedia(img.base64, `${base}-image-${i}`, img.mimeType);
        out.images.push({
          path,
          mimeType: img.mimeType,
        });
      }
    }
    if (out.images.length > 0) {
      out.imagePath = out.images[0].path;
      out.imageMimeType = out.images[0].mimeType;
    }
  } else if (body.imageBase64 && body.imageMimeType) {
    out.imagePath = await uploadInputMedia(body.imageBase64, `${base}-image`, body.imageMimeType);
    out.images = [{
      path: out.imagePath,
      mimeType: out.imageMimeType,
    }];
  }

  if (body.videoBase64 && body.videoMimeType) {
    out.videoPath = await uploadInputMedia(body.videoBase64, `${base}-video`, body.videoMimeType);
  }
  if (body.audioBase64 && body.audioMimeType) {
    out.audioPath = await uploadInputMedia(body.audioBase64, `${base}-audio`, body.audioMimeType);
  }
  return out;
}

// Rehydrates reference media back to base64 for the model call. Falls back to
// any legacy inline base64 fields so in-flight docs created before this change
// still generate correctly.
async function loadReferenceMedia(gen) {
  const images = [];
  if (Array.isArray(gen.images) && gen.images.length > 0) {
    for (const img of gen.images) {
      if (img.path) {
        const base64 = await downloadInputMedia(img.path);
        images.push({
          base64,
          mimeType: img.mimeType || "image/png",
        });
      }
    }
  } else if (gen.imagePath) {
    const base64 = await downloadInputMedia(gen.imagePath);
    images.push({
      base64,
      mimeType: gen.imageMimeType || "image/png",
    });
  } else if (gen.imageBase64) {
    images.push({
      base64: gen.imageBase64,
      mimeType: gen.imageMimeType || "image/png",
    });
  }

  return {
    images,
    imageBase64: images[0]?.base64 || null,
    imageMimeType: images[0]?.mimeType || null,
    videoBase64: gen.videoPath ? await downloadInputMedia(gen.videoPath) : (gen.videoBase64 || null),
    audioBase64: gen.audioPath ? await downloadInputMedia(gen.audioPath) : (gen.audioBase64 || null),
  };
}

// Generates a video with gemini-omni-flash-preview. Vertex now only serves
// this model through the Interactions API (generateContent returns 400), so
// the implementation lives in omniVideo.js: background interaction + polling.
const { generateOmniVideo } = require("./omniVideo");

// gemini-omni-flash-preview has no structured video config, so duration/aspect/
// negative hints are woven into the prompt on a best-effort basis.
function buildVideoPrompt(gen) {
  const duration = gen.durationSeconds || 8;
  const aspectHint = gen.aspectRatio ? ` Framed for a ${gen.aspectRatio} aspect ratio.` : "";
  const negativeHint = gen.negativePrompt ? ` Avoid: ${gen.negativePrompt}.` : "";
  return `${gen.prompt} (Render an approximately ${duration}-second video.${aspectHint}${negativeHint})`;
}

function pcmToWav(pcmBase64, sampleRate) {
  const pcm = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2; // mono, 16-bit
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
}

exports.enhancePrompt = onRequest(
  // Longer timeout so a per-minute quota wait (in vertexFetch) can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 240 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      await requireAuth(req);
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const textModel = "gemini-3.5-flash";
      const response = await vertexFetch(
        `/publishers/google/models/${textModel}:generateContent`,
        {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          systemInstruction: {
            parts: [{
              text: "You are a cinematography prompt director for a text-to-video model. " +
                    "Rewrite the user's idea as one vivid generation prompt under 120 words: " +
                    "subject, action, setting, camera movement, lens, lighting, mood, and " +
                    "color grade. Output only the prompt text — no preamble, no quotes."
            }]
          },
          generationConfig: { temperature: 0.8 }
        }
      );

      const candidates = response.candidates || [];
      const text = candidates[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
      if (!text) throw new Error("Empty response from Vertex");

      return res.status(200).json({ prompt: text.trim() });
    } catch (err) {
      console.error("enhancePrompt error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

exports.imageGenerate = onRequest(
  // Longer timeout so a per-minute quota wait (in vertexFetch) can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 240 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const user = await requireAuth(req);
      const { prompt, referenceImages, aspectRatio, purpose = "image" } = req.body;
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const pricing = await getPricing();
      const cost = purpose === "character" ? (pricing.costs?.characterSheet || 150) : (pricing.costs?.image || 50);
      await chargeCredits(user.uid, cost, `${purpose} generation`);

      let image;
      try {
        const parts = [];
        for (const ref of referenceImages || []) {
          parts.push({ inlineData: { data: ref.base64, mimeType: ref.mimeType } });
        }
        parts.push({ text: prompt });

        const model = "gemini-3.1-flash-image";
        const response = await vertexFetch(
          `/publishers/google/models/${model}:generateContent`,
          {
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
            }
          }
        );

        const imgPart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (!imgPart?.inlineData) {
          throw new Error("No image data in Vertex AI response");
        }
        image = { base64: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType };
      } catch (err) {
        await refundCredits(user.uid, cost, `${purpose} generation failed`);
        throw err;
      }

      const doc = db.collection("generations").doc();
      const ext = image.mimeType.includes("jpeg") ? "jpg" : "png";
      const url = await uploadBase64(
        image.base64,
        `generations/${user.uid}/${doc.id}.${ext}`,
        image.mimeType
      );

      await doc.set({
        uid: user.uid,
        type: purpose === "character" ? "character" : "image",
        status: "succeeded",
        prompt,
        imageUrl: url,
        cost,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, url, mimeType: image.mimeType, cost });
    } catch (err) {
      console.error("imageGenerate error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

exports.voiceGenerate = onRequest(
  // Longer timeout so a per-minute quota wait (in vertexFetch) can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 240 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const user = await requireAuth(req);
      const { text, voice = "Kore", style, voiceBase64, voiceMimeType = "audio/wav" } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing text" });
      }
      if (text.length > 4000) {
        return res.status(400).json({ error: "Script too long (4000 character max per generation)" });
      }

      const pricing = await getPricing();
      const per100 = pricing.costs?.ttsPer100Chars || 10;
      const ttsMin = pricing.costs?.ttsMinimum || 15;
      const isClone = !!voiceBase64;
      const cost = Math.max(isClone ? 30 : ttsMin, Math.ceil(text.length / 100) * per100);

      if (isClone) {
        const submitUrl = process.env.MODAL_SUBMIT_URL || "https://davelabs01--optiq-avatar-submit.modal.run";
        const submitToken = process.env.OPTIQ_SUBMIT_TOKEN || "f8f3ebbc85ff9b47a686c849ab0635910a7dc9e65595e5cd";

        if (!submitUrl || !submitToken) {
          return res.status(500).json({ error: "Voice cloning service is not configured" });
        }

        try {
          await chargeCredits(user.uid, cost, `voiceover (AI Clone)`);
        } catch (e) {
          return res.status(402).json({ error: e.message || "Insufficient credits" });
        }

        const jobId = `voice_${crypto.randomUUID()}`;
        const voicePath = `inputs/${jobId}/voice.wav`;

        try {
          const bucket = admin.storage().bucket(STORAGE_BUCKET);
          await bucket.file(voicePath).save(Buffer.from(voiceBase64, "base64"), {
            contentType: voiceMimeType,
            resumable: false,
          });

          await db.collection("generations").doc(jobId).set({
            uid: user.uid,
            type: "audio",
            status: "queued",
            prompt: text.slice(0, 500),
            text,
            voice: "Custom Clone",
            style: style || null,
            voiceSamplePath: voicePath,
            audioUrl: null,
            cost,
            createdAt: new Date().toISOString(),
          });

          const r = await fetch(submitUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId, token: submitToken }),
          });
          if (!r.ok) throw new Error(`Render service rejected the job (${r.status})`);

          return res.status(200).json({ id: jobId, status: "queued", cost });
        } catch (e) {
          await refundCredits(user.uid, cost, `voice cloning failed: ${jobId}`).catch(() => {});
          await db
            .collection("generations")
            .doc(jobId)
            .set({ status: "failed", error: String(e.message || e) }, { merge: true })
            .catch(() => {});
          return res.status(500).json({ error: e.message || "Failed to start clone" });
        }
      }

      await chargeCredits(user.uid, cost, `voiceover (${voice})`);

      let audio;
      try {
        const promptText = style ? `${style}:\n\n${text}` : text;
        const model = "gemini-3.1-flash-tts-preview";
        const response = await vertexFetch(
          `/publishers/google/models/${model}:generateContent`,
          {
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice },
                },
              },
            }
          }
        );

        const rawAudio = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
        if (!rawAudio) throw new Error("TTS model returned no audio");

        const rateMatch = rawAudio.mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        audio = { base64Wav: pcmToWav(rawAudio.data, sampleRate), mimeType: "audio/wav" };
      } catch (err) {
        await refundCredits(user.uid, cost, "voiceover failed");
        throw err;
      }

      const doc = db.collection("generations").doc();
      const url = await uploadBase64(
        audio.base64Wav,
        `generations/${user.uid}/${doc.id}.wav`,
        "audio/wav"
      );

      await doc.set({
        uid: user.uid,
        type: "audio",
        status: "succeeded",
        prompt: text.slice(0, 500),
        voice,
        style: style || null,
        audioUrl: url,
        cost,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, url, cost });
    } catch (err) {
      console.error("voiceGenerate error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// ── Optiq Music (Lyria) ─────────────────────────────────────────────────────
// Lyria is served ONLY at us-central1 via :predict — not the us-east4/global
// routing vertexFetch() uses — so it gets its own call, still wrapped in the
// quota manager. Returns a base64-encoded WAV (~30s clip). Exported so the
// storyboard flow can score an ad from its musicSpec with the same engine.
const LYRIA_MODEL = "lyria-002";
async function lyriaGenerate(prompt, negativePrompt = null) {
  const projectId = "davelabs-tools";
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${LYRIA_MODEL}:predict`;
  const instance = { prompt };
  if (negativePrompt) instance.negative_prompt = negativePrompt;

  const res = await callVertexWithRetry({
    db,
    model: LYRIA_MODEL,
    doFetch: async () => {
      const token = await getAccessToken();
      return fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [instance], parameters: { sample_count: 1 } }),
      });
    },
  });
  const json = await res.json();
  const b64 = json.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error("Optiq Music returned no audio");
  return b64; // a complete WAV file
}

// Turns a storyboard's locked soundSpec into a Lyria prompt — or returns null
// when the spec deliberately locks SILENCE (in which case the ad must stay
// silent and we never score it).
function musicPromptFromSpec(spec) {
  if (!spec || typeof spec !== "string") return null;
  const s = spec.trim();
  if (!s) return null;
  if (/\b(silence|silent|no music|no score|without music)\b/i.test(s)) return null;
  // Push Lyria toward a rich, evolving, cinematic bed — never a plain looping
  // beat — while still matching the ad's locked mood.
  return (
    "A rich, dynamic, emotionally expressive instrumental score for a premium brand advert — " +
    "cinematic and vibey, with layered, evolving instrumentation, texture and movement that builds and breathes " +
    "across the piece. NOT a plain repetitive loop and NOT a bare four-on-the-floor drum beat. No vocals, no lyrics. " +
    `Match this exact mood and instrumentation: ${s}`
  );
}

// ── Optiq narration (Gemini 3.1 Flash TTS) ──────────────────────────────────
// The ad's footage is silent; the narrator is composed here. One warm voice
// reads a main narration (plays under the whole ad) plus a short closing tagline
// (placed at the very end at compile). The agent picks the voice for the vibe.
const VOICEOVER_VOICES = {
  "gambian-english": { voice: "Enceladus", style: "a warm, wise Gambian English advertisement narrator — calm, confident and emotive" },
  "nigerian-british-male": { voice: "Iapetus", style: "a polished Nigerian-British male advertisement narrator — warm, articulate and persuasive" },
  "nigerian-british-female": { voice: "Vindemiatrix", style: "a polished Nigerian-British female advertisement narrator — warm, elegant and persuasive" },
  "cinematic-deep": { voice: "Charon", style: "a deep, slow, wise cinematic narrator with rich gravitas and warmth, like a legendary documentary voice" },
};

// Speaks `text` with Gemini 3.1 Flash TTS. Returns { base64Wav, durationSec }.
async function ttsGenerate(text, voiceName, style) {
  const model = "gemini-3.1-flash-tts-preview";
  const promptText = style ? `${style}:\n\n${text}` : text;
  const response = await vertexFetch(`/publishers/google/models/${model}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });
  const raw = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!raw) throw new Error("TTS returned no audio");
  const rate = parseInt((raw.mimeType || "").match(/rate=(\d+)/)?.[1] || "24000", 10);
  const pcmBytes = Buffer.from(raw.data, "base64").length;
  return { base64Wav: pcmToWav(raw.data, rate), durationSec: pcmBytes / (rate * 2) };
}

// Writes the ad's narration + closing tagline and picks the narrator voice.
async function writeAdNarration({ concept, brandName, scenes }) {
  const scenesText = (scenes || [])
    .map((s, i) => `Scene ${i + 1}: ${String(s.beat || s.summary || s.fullPrompt || "").slice(0, 220)}`)
    .join("\n")
    .slice(0, 3000);
  const schema = {
    type: "OBJECT",
    properties: {
      voiceKey: { type: "STRING", enum: Object.keys(VOICEOVER_VOICES) },
      narration: { type: "STRING" },
      tagline: { type: "STRING" },
    },
    required: ["voiceKey", "narration", "tagline"],
  };
  const sys = `You are the NARRATION DIRECTOR for an Optiq Studio advert. The video is SILENT — you write the spoken narration a professional voice actor reads over the finished ad.
Return JSON:
- voiceKey: pick the narrator voice that best fits this ad's vibe. Default "gambian-english" (warm Gambian English) unless the ad clearly calls for another: "nigerian-british-male", "nigerian-british-female", or "cinematic-deep" (a slow, deep, wise cinematic voice).
- narration: the main voiceover that plays across the ad — warm, advertisement-style, emotive, telling the brand's story and building desire. Concise and punchy, about 35-55 words. ONLY the words to be spoken; no stage directions, no scene numbers.
- tagline: a short, memorable closing line (6-12 words) that lands at the very end — the brand's closing statement or call to action.
Natural spoken English (light Gambian English welcome for local brands). No emojis, no markdown, no quotes.`;
  const brief = `Brand: ${brandName || "the brand"}\nConcept: ${concept || ""}\n\nScenes:\n${scenesText}`;
  const response = await vertexFetch(`/publishers/google/models/gemini-3.5-flash:generateContent`, {
    contents: [{ role: "user", parts: [{ text: brief }] }],
    systemInstruction: { parts: [{ text: sys }] },
    generationConfig: { temperature: 0.85, responseMimeType: "application/json", responseSchema: schema },
  });
  const text = response.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
  return JSON.parse(text);
}

exports.musicGenerate = onRequest(
  // Longer timeout so a per-minute quota wait can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 240 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const user = await requireAuth(req);
      const { prompt, negativePrompt = null } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Missing prompt" });
      }
      if (prompt.length > 2000) {
        return res.status(400).json({ error: "Prompt too long (2000 character max)" });
      }

      const pricing = await getPricing();
      const cost = pricing.costs?.music ?? 100;

      try {
        await chargeCredits(user.uid, cost, "optiq music");
      } catch (e) {
        return res.status(402).json({ error: e.message || "Insufficient credits" });
      }

      let base64Wav;
      try {
        base64Wav = await lyriaGenerate(prompt, negativePrompt);
      } catch (err) {
        await refundCredits(user.uid, cost, "optiq music failed").catch(() => {});
        throw err;
      }

      const doc = db.collection("generations").doc();
      const url = await uploadBase64(base64Wav, `generations/${user.uid}/${doc.id}.wav`, "audio/wav");

      await doc.set({
        uid: user.uid,
        type: "music",
        status: "succeeded",
        prompt: prompt.slice(0, 500),
        audioUrl: url,
        cost,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, url, cost });
    } catch (err) {
      console.error("musicGenerate error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

exports.videoGenerate = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 60 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const user = await requireAuth(req);
      const {
        prompt,
        model = "omni",
        durationSeconds = 8,
        aspectRatio = "16:9",
        resolution = "720p",
        generateAudio = true,
        negativePrompt = null,
        projectId = null,
      } = req.body;

      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const duration = Math.min(Math.max(Number(durationSeconds) || 8, 4), 10);
      const pricing = await getPricing();
      const perSecCost = (pricing.costs?.videoPerSecond?.[model]) ?? 15;
      let cost = perSecCost * duration;

      // An ad is ONE price. Paying for the storyboard buys its scene renders up
      // front, so a storyboard project carries a `prepaidRenders` allowance and
      // those scenes cost nothing again. The allowance is decremented inside a
      // transaction, so a client can only ever consume what was actually paid
      // for — extra re-renders fall through and are charged normally.
      let usedPrepaid = false;
      if (projectId) {
        const projectRef = db.collection("projects").doc(projectId);
        usedPrepaid = await db.runTransaction(async (tx) => {
          const snap = await tx.get(projectRef);
          if (!snap.exists) return false;
          const data = snap.data();
          if (data.uid !== user.uid) return false;
          const remaining = Number(data.prepaidRenders) || 0;
          if (remaining <= 0) return false;
          tx.update(projectRef, { prepaidRenders: remaining - 1 });
          return true;
        }).catch((err) => {
          console.error(`prepaidRenders check failed for project ${projectId}:`, err);
          return false;
        });
      }

      if (usedPrepaid) {
        cost = 0;
        console.log(`[video] scene render covered by prepaid allowance (project ${projectId})`);
      } else {
        await chargeCredits(user.uid, cost, `video (${model}, ${duration}s)`);
      }

      const doc = db.collection("generations").doc();
      const media = await persistReferenceMedia(user.uid, doc.id, req.body);
      await doc.set({
        uid: user.uid,
        type: "video",
        status: "generating",
        prompt,
        model,
        cost,
        durationSeconds: duration,
        aspectRatio,
        resolution,
        generateAudio,
        negativePrompt: negativePrompt || null,
        // Recorded so a failed render hands the paid scene back.
        prepaidProjectId: usedPrepaid ? projectId : null,
        ...media,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, status: "generating", cost });
    } catch (err) {
      console.error("videoGenerate error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// Runs the actual video generation for a generation doc, entirely server-side.
// Invoked by the Firestore onCreate trigger below so generation no longer
// depends on the client polling (a backgrounded/closed tab previously left docs
// stuck at "generating" forever). Idempotent: claims the doc
// (generating -> processing) in a transaction so an at-least-once duplicate
// event delivery can't double-generate, and errors are caught (never thrown) so
// the platform doesn't retry a charge-refunded job.
async function runVideoGeneration(id, ref, gen) {
  const claimed = await db.runTransaction(async (tx) => {
    const dSnap = await tx.get(ref);
    if (dSnap.exists && dSnap.data().status === "generating") {
      tx.update(ref, { status: "processing" });
      return true;
    }
    return false;
  });
  if (!claimed) {
    console.log(`[video ${id}] not in 'generating' state, skipping (already claimed/done)`);
    return;
  }

  const label = gen.viaApi ? "API: video" : "video";
  try {
    const duration = gen.durationSeconds || 8;
    console.log(`[video ${id}] generating server-side (requested duration: ${duration}s)`);

    const { images, imageBase64, videoBase64, audioBase64 } = await loadReferenceMedia(gen);
    if (images.length) console.log(`[video ${id}] integrating ${images.length} reference image(s)`);
    if (videoBase64) console.log(`[video ${id}] integrating reference video`);
    if (audioBase64) console.log(`[video ${id}] integrating reference audio`);

    const video = await generateOmniVideo(buildVideoPrompt(gen), {
      images,
      imageBase64,
      imageMimeType: gen.imageMimeType,
      videoBase64,
      videoMimeType: gen.videoMimeType,
      audioBase64,
      audioMimeType: gen.audioMimeType,
    });

    const videoUrl = await uploadBase64(
      video.base64,
      `generations/${gen.uid}/${id}.mp4`,
      video.mimeType
    );

    await ref.update({
      status: "succeeded",
      videoUrl,
      mimeType: video.mimeType,
      completedAt: new Date().toISOString(),
    });
    console.log(`[video ${id}] succeeded`);
  } catch (err) {
    console.error(`[video ${id}] generation failed:`, err);
    if (gen.prepaidProjectId) {
      // The scene was covered by the ad's prepaid allowance — give it back so a
      // failure doesn't quietly consume something the user already paid for.
      await db
        .collection("projects")
        .doc(gen.prepaidProjectId)
        .update({ prepaidRenders: admin.firestore.FieldValue.increment(1) })
        .catch((e) => console.error(`[video ${id}] could not restore prepaid render:`, e.message));
    }
    await refundCredits(gen.uid, gen.cost || 0, `${label} ${id} failed`);
    await ref.update({
      status: "failed",
      error: err.message || "Generation failed",
      completedAt: new Date().toISOString(),
    });
  }
}

// Server-side driver: fires the moment videoGenerate/apiGenerateVideo creates a
// video doc, so generation happens without any client involvement. Must run in
// us-central1 because the Firestore database is the nam5 multi-region (Eventarc
// delivers nam5 Firestore events there); the rest of the API stays in us-east4.
exports.processVideoGeneration = onDocumentCreated(
  { document: "generations/{id}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB", maxInstances: 10 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const gen = snap.data();
    if (gen.type !== "video" || gen.status !== "generating") return;
    await runVideoGeneration(event.params.id, snap.ref, gen);
  }
);

// Pure status read — the client polls this only to observe progress; it no
// longer drives generation (processVideoGeneration does). "processing" is an
// internal in-flight state surfaced to the client as "generating".
exports.videoStatus = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 60 },
  async (req, res) => {
    try {
      const user = await requireAuth(req);
      const id = req.query.id || req.body.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const snap = await db.collection("generations").doc(id).get();
      if (!snap.exists) return res.status(404).json({ error: "Not found" });

      const gen = snap.data();
      if (gen.uid !== user.uid) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const done = gen.status === "succeeded" || gen.status === "failed";
      return res.status(200).json({
        id,
        status: done ? gen.status : "generating",
        videoUrl: gen.videoUrl || null,
        audioUrl: gen.audioUrl || null,
        error: gen.error || null,
        prompt: gen.prompt,
        completedAt: gen.completedAt || null,
      });
    } catch (err) {
      console.error("videoStatus error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

async function requireApiKey(req) {
  const authHeader = req.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized: Missing or invalid Authorization header");
  }
  const apiKey = authHeader.split("Bearer ")[1].trim();
  if (!apiKey.startsWith("optiq_live_")) {
    throw new Error("Unauthorized: Invalid API key format");
  }
  
  const keysSnap = await db.collection("api_keys")
    .where("apiKey", "==", apiKey)
    .where("active", "==", true)
    .limit(1)
    .get();
    
  if (keysSnap.empty) {
    throw new Error("Unauthorized: API key is invalid or has been revoked");
  }
  
  const keyDoc = keysSnap.docs[0];
  const data = keyDoc.data();
  
  keyDoc.ref.update({ lastUsedAt: new Date().toISOString() }).catch(() => {});
  
  return { uid: data.uid };
}

exports.apiGenerateImage = onRequest(
  // Longer timeout so a per-minute quota wait (in vertexFetch) can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 240 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const developer = await requireApiKey(req);
      const { prompt, referenceImages, aspectRatio, purpose = "image" } = req.body;
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const cost = purpose === "character" ? 150 : 50;
      await chargeCredits(developer.uid, cost, `API: ${purpose} generation`);

      let image;
      try {
        const parts = [];
        for (const ref of referenceImages || []) {
          parts.push({ inlineData: { data: ref.base64, mimeType: ref.mimeType } });
        }
        parts.push({ text: prompt });

        const model = "gemini-3.1-flash-image";
        const response = await vertexFetch(
          `/publishers/google/models/${model}:generateContent`,
          {
            contents: [{ role: "user", parts }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              ...(aspectRatio ? { imageConfig: { aspectRatio } } : {}),
            }
          }
        );

        const imgPart = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (!imgPart?.inlineData) {
          throw new Error("No image data in Vertex AI response");
        }
        image = { base64: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType };
      } catch (err) {
        await refundCredits(developer.uid, cost, `API: ${purpose} generation failed`);
        throw err;
      }

      const doc = db.collection("generations").doc();
      const ext = image.mimeType.includes("jpeg") ? "jpg" : "png";
      const url = await uploadBase64(
        image.base64,
        `generations/${developer.uid}/${doc.id}.${ext}`,
        image.mimeType
      );

      await doc.set({
        uid: developer.uid,
        type: purpose === "character" ? "character" : "image",
        status: "succeeded",
        prompt,
        imageUrl: url,
        cost,
        viaApi: true,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, url, mimeType: image.mimeType, cost });
    } catch (err) {
      console.error("apiGenerateImage error:", err);
      return res.status(err.message.includes("Unauthorized") ? 401 : 500).json({ error: err.message });
    }
  }
);

exports.apiGenerateVideo = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 60 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const developer = await requireApiKey(req);
      const {
        prompt,
        model = "omni",
        durationSeconds = 8,
        aspectRatio = "16:9",
        resolution = "720p",
        generateAudio = true,
        negativePrompt = null,
      } = req.body;

      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const duration = Math.min(Math.max(Number(durationSeconds) || 8, 4), 10);
      const perSecCost = model === "omni-fast" ? 15 : 30;
      const cost = perSecCost * duration;

      await chargeCredits(developer.uid, cost, `API: video (${model}, ${duration}s)`);

      const doc = db.collection("generations").doc();
      const media = await persistReferenceMedia(developer.uid, doc.id, req.body);
      await doc.set({
        uid: developer.uid,
        type: "video",
        status: "generating",
        prompt,
        model,
        cost,
        viaApi: true,
        durationSeconds: duration,
        aspectRatio,
        resolution,
        generateAudio,
        negativePrompt: negativePrompt || null,
        ...media,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, status: "generating", cost });
    } catch (err) {
      console.error("apiGenerateVideo error:", err);
      return res.status(err.message.includes("Unauthorized") ? 401 : 500).json({ error: err.message });
    }
  }
);

// Pure status read for API consumers. Generation is driven server-side by the
// processVideoGeneration Firestore trigger, so this only reports progress.
exports.apiGetVideoStatus = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 60 },
  async (req, res) => {
    try {
      const developer = await requireApiKey(req);
      const id = req.query.id || req.body.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const snap = await db.collection("generations").doc(id).get();
      if (!snap.exists) return res.status(404).json({ error: "Not found" });

      const gen = snap.data();
      if (gen.uid !== developer.uid) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const done = gen.status === "succeeded" || gen.status === "failed";
      return res.status(200).json({
        id,
        status: done ? gen.status : "generating",
        videoUrl: gen.videoUrl || null,
        error: gen.error || null,
        prompt: gen.prompt,
        completedAt: gen.completedAt || null,
      });
    } catch (err) {
      console.error("apiGetVideoStatus error:", err);
      return res.status(err.message.includes("Unauthorized") ? 401 : 500).json({ error: err.message });
    }
  }
);

exports.apiGenerateTTS = onRequest(
  // Longer timeout so a per-minute quota wait (in vertexFetch) can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 240 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const developer = await requireApiKey(req);
      const { text, voice = "Kore", style } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing text" });
      }
      if (text.length > 4000) {
        return res.status(400).json({ error: "Script too long (4000 character max per generation)" });
      }

      const cost = Math.max(15, Math.ceil(text.length / 100) * 10);
      await chargeCredits(developer.uid, cost, `API: voiceover (${voice})`);

      let audio;
      try {
        const promptText = style ? `${style}:\n\n${text}` : text;
        const model = "gemini-3.1-flash-tts-preview";
        const response = await vertexFetch(
          `/publishers/google/models/${model}:generateContent`,
          {
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice },
                },
              },
            }
          }
        );

        const rawAudio = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
        if (!rawAudio) throw new Error("TTS model returned no audio");

        const rateMatch = rawAudio.mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        audio = { base64Wav: pcmToWav(rawAudio.data, sampleRate), mimeType: "audio/wav" };
      } catch (err) {
        await refundCredits(developer.uid, cost, "API: voiceover failed");
        throw err;
      }

      const doc = db.collection("generations").doc();
      const url = await uploadBase64(
        audio.base64Wav,
        `generations/${developer.uid}/${doc.id}.wav`,
        "audio/wav"
      );

      await doc.set({
        uid: developer.uid,
        type: "audio",
        status: "succeeded",
        prompt: text.slice(0, 500),
        voice,
        style: style || null,
        audioUrl: url,
        cost,
        viaApi: true,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, url, cost });
    } catch (err) {
      console.error("apiGenerateTTS error:", err);
      return res.status(err.message.includes("Unauthorized") ? 401 : 500).json({ error: err.message });
    }
  }
);

// Avatar pipelines completely retired. Voice Studio retains local Gemini synthesis and high-performance custom voice cloning on Modal.

// ─── OPTIQ SKILLS — AGENTIC STORYBOARD SWARM ────────────────────────────────
// The storyboard brain. The swarm lives in ./optiqSkills/pipeline.js and its
// knowledge base in ./optiqSkills/knowledge — a chain of specialist agents
// (brief-analyst → storyline → casting-registry → parallel scene-builders →
// JS quality gates + scene-verifier repairs) that turns a wizard brief into a
// full film of copy-ready 1,500–2,000-word scene prompts. The STORYLINE skill
// is the heart of it: the whole ad is one story and the product is the hero.

const { runOptiqSkillsPipeline, reviseScene } = require("./optiqSkills/pipeline");

exports.storyGenerate = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 540, memory: "512MiB" },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      await requireAuth(req);
      const {
        prompt, length, brandName, product,
        characterName, characterDesc, logo, materials, aspectRatio,
      } = req.body;
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const storyboard = await runOptiqSkillsPipeline({
        vertexFetch,
        prompt,
        length,
        brandName,
        product,
        characterName,
        characterDesc,
        logo,
        materials,
        aspectRatio,
      });
      return res.status(200).json(storyboard);
    } catch (err) {
      console.error("storyGenerate error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// Firestore rejects `undefined`; deep-strip it before writing a storyboard.
function stripUndefined(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  const out = {};
  for (const k of Object.keys(obj)) {
    if (obj[k] !== undefined) out[k] = stripUndefined(obj[k]);
  }
  return out;
}

// ─── CLOUD STORYBOARD JOB ────────────────────────────────────────────────────
// The wizard no longer waits on an HTTP response to build a storyboard. Instead
// the client drops a job doc in `storyboardJobs/{projectId}` and this trigger
// runs the whole Optiq Skills swarm SERVER-SIDE, streaming its stage to the
// project doc and writing the finished scenes there. So generation survives a
// closed tab / dead laptop, and reopening the project resumes at the exact
// stage. Must run in us-central1 (nam5 Firestore Eventarc), like
// processVideoGeneration. Idempotent: claims the job (queued -> running) in a
// transaction so an at-least-once duplicate event can't double-run.
exports.storyboardGenerate = onDocumentCreated(
  { document: "storyboardJobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB", maxInstances: 10 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    if (!job || !job.projectId) return;

    const jobRef = snap.ref;
    const projectRef = db.collection("projects").doc(job.projectId);

    const claimed = await db.runTransaction(async (tx) => {
      const d = await tx.get(jobRef);
      if (d.exists && (d.data().status || "queued") === "queued") {
        tx.update(jobRef, { status: "running", startedAt: new Date().toISOString() });
        return true;
      }
      return false;
    });
    if (!claimed) {
      console.log(`[storyboard ${job.projectId}] job not in 'queued' state, skipping`);
      return;
    }

    const setStage = async (stage, extra = {}) => {
      await projectRef.update({
        pipelineStage: stage,
        pipelineError: null,
        updatedAt: new Date().toISOString(),
        ...extra,
      });
    };

    try {
      await setStage("analyzing");

      // Rebuild brand-material data URLs from Storage so the swarm can see them.
      const materials = [];
      for (const mat of (job.materialPaths || [])) {
        if (!mat?.path) continue;
        try {
          const base64 = await downloadInputMedia(mat.path);
          materials.push({ name: mat.name || "material", data: `data:${mat.mimeType || "image/png"};base64,${base64}` });
        } catch (e) {
          console.error(`[storyboard ${job.projectId}] material download failed for ${mat.path}:`, e.message);
        }
      }
      const logo = materials[0]?.data || null;

      const storyboard = await runOptiqSkillsPipeline({
        vertexFetch,
        prompt: job.prompt,
        length: job.length,
        brandName: job.brandName,
        product: job.product,
        aspectRatio: job.aspectRatio,
        logo,
        materials,
        onStage: (stage, meta) => setStage(stage, meta ? { pipelineProgress: meta } : {}),
      });

      // Seed per-scene render status (idle) and per-scene reference images
      // (every uploaded brand image rides along on every scene by default).
      const videoStatus = {};
      storyboard.scenes.forEach((_, idx) => {
        videoStatus[idx] = { status: "idle", revisionInput: "", customPrompt: "" };
      });
      const imageMaterials = (job.materialPaths || []).filter((m) => (m.mimeType || "").startsWith("image/"));
      const sceneImages = {};
      if (imageMaterials.length > 0) {
        storyboard.scenes.forEach((_, idx) => {
          sceneImages[idx] = imageMaterials.map((m) => ({
            name: m.name, path: m.path, url: m.url, mimeType: m.mimeType,
          }));
        });
      }

      // Score the ad: turn the locked soundSpec into a real background track
      // with Optiq Music (Lyria), baked into the (prepaid) storyboard so it
      // mixes under the nine clips at compile with no extra cost. Best-effort —
      // a scoring failure never fails the storyboard — and skips locked silence.
      // Deliberately keeps the current working stage (no setStage) so the client
      // keeps showing the loading UI until scenes + score land together.
      // Every ad gets a score — the footage is silent, so music is essential.
      // Use the swarm's soundSpec for the vibe, or a cinematic default when it
      // locked silence (which rule 11's silent footage now tends to produce).
      let musicUrl = null;
      const musicPrompt =
        musicPromptFromSpec(storyboard.musicSpec) ||
        "A rich, dynamic, cinematic instrumental score for a premium brand advert — warm, emotive and evolving, with layered instrumentation that builds and breathes. NOT a plain repetitive loop or a bare drum beat. No vocals, no lyrics.";
      try {
        const wavB64 = await lyriaGenerate(musicPrompt);
        musicUrl = await uploadBase64(wavB64, `projects/${job.projectId}/score.wav`, "audio/wav");
        console.log(`[storyboard ${job.projectId}] scored with Optiq Music`);
      } catch (e) {
        console.error(`[storyboard ${job.projectId}] scoring failed (continuing without a score):`, e.message);
      }

      // Narrate the ad with Optiq TTS (Gemini 3.1 Flash TTS): a main narration
      // that plays under the whole ad + a closing tagline placed at the very end
      // at compile. Baked into the (prepaid) storyboard. Best-effort — a failure
      // never blocks the storyboard; the ad just ships with music only.
      let voiceoverUrl = null, taglineUrl = null, taglineDuration = null, voiceoverVoice = null;
      try {
        const vo = await writeAdNarration({
          concept: storyboard.concept,
          brandName: job.brandName,
          scenes: storyboard.scenes,
        });
        const mapped = VOICEOVER_VOICES[vo.voiceKey] || VOICEOVER_VOICES["gambian-english"];
        voiceoverVoice = vo.voiceKey || "gambian-english";
        if (vo.narration) {
          const nar = await ttsGenerate(vo.narration, mapped.voice, mapped.style);
          voiceoverUrl = await uploadBase64(nar.base64Wav, `projects/${job.projectId}/voiceover.wav`, "audio/wav");
        }
        if (vo.tagline) {
          const tag = await ttsGenerate(vo.tagline, mapped.voice, mapped.style);
          taglineUrl = await uploadBase64(tag.base64Wav, `projects/${job.projectId}/tagline.wav`, "audio/wav");
          taglineDuration = tag.durationSec;
        }
        console.log(`[storyboard ${job.projectId}] narrated (${voiceoverVoice})`);
      } catch (e) {
        console.error(`[storyboard ${job.projectId}] narration failed (continuing without a voiceover):`, e.message);
      }

      await projectRef.update(stripUndefined({
        title: storyboard.title,
        concept: storyboard.concept,
        scenes: storyboard.scenes,
        styleHeader: storyboard.styleHeader || "",
        characterLock: storyboard.characterLock || { name: "", description: "", wardrobe: "" },
        isStory: storyboard.isStory ?? null,
        storyArc: storyboard.storyArc ?? null,
        musicSpec: storyboard.musicSpec ?? null,
        ambienceSpec: storyboard.ambienceSpec ?? null,
        musicUrl,
        voiceoverUrl,
        taglineUrl,
        taglineDuration,
        voiceoverVoice,
        videoStatus,
        sceneImages,
        pipelineStage: "ready",
        pipelineError: null,
        pipelineProgress: null,
        updatedAt: new Date().toISOString(),
      }));

      await jobRef.update({ status: "done", finishedAt: new Date().toISOString() });
      console.log(`[storyboard ${job.projectId}] ready (${storyboard.scenes.length} scenes)`);
    } catch (err) {
      console.error(`[storyboard ${job.projectId}] generation failed:`, err);
      await projectRef
        .update({
          pipelineStage: "failed",
          pipelineError: err.message || "Generation failed",
          updatedAt: new Date().toISOString(),
        })
        .catch(() => {});
      await jobRef.update({ status: "failed", error: err.message || "failed" }).catch(() => {});
    }
  }
);

exports.storyRevise = onRequest(
  // Longer timeout so a per-minute quota wait (in vertexFetch) can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 240 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      await requireAuth(req);
      const {
        scenePrompt, revisionRequest, characterLock, styleHeader,
        previousScenePrompt, nextScenePrompt, musicSpec,
      } = req.body;
      if (!scenePrompt || !revisionRequest) return res.status(400).json({ error: "Missing prompt or request" });

      const revisedPrompt = await reviseScene({
        vertexFetch,
        scenePrompt,
        revisionRequest,
        characterLock,
        styleHeader,
        previousScenePrompt,
        nextScenePrompt,
        musicSpec,
      });
      return res.status(200).json({ revisedPrompt });
    } catch (err) {
      console.error("storyRevise error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

// Helper for projectCompile to download files using native fetch
async function compileDownloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.statusText}`);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fs = require("fs");
  await fs.promises.writeFile(destPath, buffer);
}

// Helper for projectCompile to run a CLI command as a Promise
function compileRunCommand(cmd) {
  const { exec } = require("child_process");
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error.message}. stderr: ${stderr}`);
        reject(new Error(`Command failed: ${cmd}. Error: ${error.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

exports.projectCompile = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 540, memory: "1GiB" },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const user = await requireAuth(req);
      const { projectId, timeline = [], musicUrl: bodyMusicUrl = null, musicVolume = 0.6 } = req.body;

      if (!projectId) return res.status(400).json({ error: "Missing projectId" });
      if (!timeline.length) return res.status(400).json({ error: "Timeline is empty" });

      const projectRef = db.collection("projects").doc(projectId);

      // Ads carry NO baked-in audio (clips are silent). The final soundtrack is
      // composed here from the storyboard's baked Optiq Music score + the two
      // Optiq narration tracks. Fall back to those baked assets when the client
      // didn't pass its own, so every ad is scored + narrated by default.
      let musicUrl = bodyMusicUrl;
      let voiceoverUrl = null, taglineUrl = null, taglineDuration = null;
      try {
        const psnap = await projectRef.get();
        if (psnap.exists) {
          const pd = psnap.data();
          if (!musicUrl) musicUrl = pd.musicUrl || null;
          voiceoverUrl = pd.voiceoverUrl || null;
          taglineUrl = pd.taglineUrl || null;
          taglineDuration = Number(pd.taglineDuration) || null;
        }
      } catch (e) {
        console.error(`[compile ${projectId}] could not read baked audio:`, e.message);
      }

      // Set compileStatus: "compiling" in Firestore
      await projectRef.set({
        compileStatus: "compiling",
        compileError: null,
        // Lets a stranded compile be detected and cleared (see renderV2StartedAt).
        compileStartedAt: new Date().toISOString(),
        timeline,
        musicUrl,
        musicVolume,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Must be awaited — see the note in renderJobV2. Responding first lets
      // Cloud Run throttle CPU and reclaim the container, freezing ffmpeg
      // mid-compile and stranding compileStatus on "compiling" forever.
      const result = await (async () => {
        const os = require("os");
        const fs = require("fs");
        const path = require("path");

        const workDir = path.join(os.tmpdir(), `compile_${projectId}_${Date.now()}`);
        
        try {
          await fs.promises.mkdir(workDir, { recursive: true });

          const filelistPath = path.join(workDir, "filelist.txt");
          const filelistContent = [];

          let totalDuration = 0;
          for (let i = 0; i < timeline.length; i++) {
            const clip = timeline[i];
            const srcPath = path.join(workDir, `src_${i}.mp4`);
            const trimmedPath = path.join(workDir, `trimmed_${i}.mp4`);

            console.log(`[compile ${projectId}] Downloading segment ${i}: ${clip.videoUrl}`);
            await compileDownloadFile(clip.videoUrl, srcPath);

            const trimStart = clip.trimStart || 0;
            const trimEnd = clip.trimEnd || 10;
            const duration = Math.max(trimEnd - trimStart, 0.5);
            totalDuration += duration;

            // Ads are SILENT footage: keep the video only and attach a fresh
            // silent stereo track (anullsrc), discarding whatever audio the clip
            // may carry. Every segment then has an identical audio stream, so the
            // concat is clean and the post-mix has a duration anchor to sit on.
            console.log(`[compile ${projectId}] Trimming + muting segment ${i} (${trimStart}s→${trimEnd}s, ${duration}s)`);
            const trimCmd = `ffmpeg -y -ss ${trimStart} -t ${duration} -i "${srcPath}" -f lavfi -t ${duration} -i anullsrc=channel_layout=stereo:sample_rate=44100 -map 0:v -map 1:a -c:v libx264 -preset superfast -crf 23 -c:a aac -vf "scale=1280:720,setsar=1,fps=30" -ar 44100 -ac 2 -shortest "${trimmedPath}"`;
            await compileRunCommand(trimCmd);

            filelistContent.push(`file '${trimmedPath}'`);
          }

          await fs.promises.writeFile(filelistPath, filelistContent.join("\n"));

          console.log(`[compile ${projectId}] Merging ${timeline.length} segments`);
          const mergedPath = path.join(workDir, "merged.mp4");
          const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${filelistPath}" -c copy "${mergedPath}"`;
          await compileRunCommand(concatCmd);

          // Compose the soundtrack: looped Optiq Music bed + narration from the
          // top + the closing tagline delayed to the very end. The silent clip
          // audio ([0:a], volume 0) anchors the mix to the video's length; a
          // limiter tames peaks. Best-effort — if the mix fails for any reason we
          // ship the (silent) video rather than failing the whole compile.
          let finalPath = mergedPath;
          try {
            const audioAssets = [];
            if (musicUrl) {
              const bgmPath = path.join(workDir, "bgm.wav");
              await compileDownloadFile(musicUrl, bgmPath);
              audioAssets.push({ kind: "music", path: bgmPath });
            }
            if (voiceoverUrl) {
              const voPath = path.join(workDir, "vo.wav");
              await compileDownloadFile(voiceoverUrl, voPath);
              audioAssets.push({ kind: "voiceover", path: voPath });
            }
            if (taglineUrl) {
              const tagPath = path.join(workDir, "tag.wav");
              await compileDownloadFile(taglineUrl, tagPath);
              audioAssets.push({ kind: "tagline", path: tagPath });
            }

            if (audioAssets.length > 0) {
              finalPath = path.join(workDir, "final.mp4");
              const inputArgs = [`-i "${mergedPath}"`];
              const filters = [`[0:a]volume=0[base]`];
              const mixLabels = ["[base]"];
              let idx = 0;
              for (const a of audioAssets) {
                idx++;
                if (a.kind === "music") {
                  inputArgs.push(`-stream_loop -1 -i "${a.path}"`);
                  filters.push(`[${idx}:a]volume=${musicVolume}[music]`);
                  mixLabels.push("[music]");
                } else if (a.kind === "voiceover") {
                  inputArgs.push(`-i "${a.path}"`);
                  filters.push(`[${idx}:a]volume=1.5[vo]`);
                  mixLabels.push("[vo]");
                } else if (a.kind === "tagline") {
                  inputArgs.push(`-i "${a.path}"`);
                  const delayMs = Math.max(0, Math.round((totalDuration - (taglineDuration || 4) - 0.3) * 1000));
                  filters.push(`[${idx}:a]adelay=${delayMs}|${delayMs},volume=1.6[tag]`);
                  mixLabels.push("[tag]");
                }
              }
              const filterGraph =
                `${filters.join(";")};${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0[mixed];` +
                `[mixed]alimiter=limit=0.95[aout]`;
              console.log(`[compile ${projectId}] Composing audio: music@${musicVolume}${voiceoverUrl ? " + narration" : ""}${taglineUrl ? " + tagline" : ""}`);
              const mixCmd = `ffmpeg -y ${inputArgs.join(" ")} -filter_complex "${filterGraph}" -map 0:v -map "[aout]" -c:v copy -c:a aac "${finalPath}"`;
              await compileRunCommand(mixCmd);
            }
          } catch (mixErr) {
            console.error(`[compile ${projectId}] audio mix failed, shipping silent video:`, mixErr.message);
            finalPath = mergedPath;
          }

          const remotePath = `projects/${user.uid}/${projectId}/final_video.mp4`;
          console.log(`[compile ${projectId}] Uploading output to Firebase Storage: ${remotePath}`);
          
          await admin.storage().bucket(STORAGE_BUCKET).upload(finalPath, {
            destination: remotePath,
            metadata: {
              contentType: "video/mp4",
              cacheControl: "public, max-age=31536000",
            }
          });

          const finalUrl = `https://storage.googleapis.com/${STORAGE_BUCKET}/${remotePath}`;
          
          console.log(`[compile ${projectId}] Compilation succeeded. URL: ${finalUrl}`);
          await projectRef.set({
            compileStatus: "succeeded",
            compileVideoUrl: finalUrl,
            compileCompletedAt: new Date().toISOString(),
            compileError: null,
          }, { merge: true });
          return { ok: true, url: finalUrl };
        } catch (err) {
          console.error(`[compile ${projectId}] Compilation failed:`, err);
          await projectRef.set({
            compileStatus: "failed",
            compileError: err.message || "Compilation failed",
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          return { ok: false, error: err.message || "Compilation failed" };
        } finally {
          // Clean up /tmp
          try {
            await fs.promises.rm(workDir, { recursive: true, force: true });
          } catch (cleanupErr) {
            console.warn(`[compile ${projectId}] Failed to clean up ${workDir}:`, cleanupErr);
          }
        }
      })();

      return result.ok
        ? res.status(200).json({ status: "succeeded", videoUrl: result.url })
        : res.status(500).json({ status: "failed", error: result.error });
    } catch (err) {
      console.error("projectCompile error:", err);
      // Never leave the project stuck on "compiling" — the UI keys off this.
      try {
        await db.collection("projects").doc(req.body?.projectId || "_").set({
          compileStatus: "failed",
          compileError: err.message || "Compilation failed",
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch { /* best effort */ }
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── EDITOR ENGINE v2 RENDERER ──────────────────────────────────────────────
// Executes a RenderJob produced by lib/editor's compileRenderJob(). The client
// sends DATA only; the filtergraph is validated and built server-side in
// editorEngine.js. Status streams to the project doc as renderV2Status /
// renderV2Url / renderV2Error. Leaves projectCompile untouched (legacy path).

const { validateRenderJob, buildFfmpegPlan } = require("./editorEngine");

function renderRunFfmpeg(args, logTag) {
  const { spawn } = require("child_process");
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderrTail = "";
    proc.stderr.on("data", (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-4000);
    });
    proc.on("error", (err) => reject(new Error(`ffmpeg spawn failed: ${err.message}`)));
    proc.on("close", (code) => {
      if (code === 0) return resolve();
      console.error(`[${logTag}] ffmpeg exited ${code}. stderr tail:\n${stderrTail}`);
      reject(new Error(`ffmpeg exited with code ${code}: ${stderrTail.slice(-600)}`));
    });
  });
}

function renderLocalName(url, index) {
  try {
    const ext = require("path").extname(new URL(url).pathname).toLowerCase();
    if (/^\.(mp4|mov|webm|mkv|mp3|wav|aac|m4a|ogg|png|jpg|jpeg|webp)$/.test(ext)) {
      return `in_${index}${ext}`;
    }
  } catch { /* fall through */ }
  return `in_${index}.mp4`;
}

exports.renderJobV2 = onRequest(
  { region: "us-east4", cors: true, maxInstances: 5, timeoutSeconds: 540, memory: "2GiB", cpu: 2 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const user = await requireAuth(req);
      const { projectId, job } = req.body;
      if (!projectId) return res.status(400).json({ error: "Missing projectId" });

      try {
        validateRenderJob(job);
      } catch (validationErr) {
        return res.status(400).json({ error: `Invalid render job: ${validationErr.message}` });
      }

      const projectRef = db.collection("projects").doc(projectId);
      const snap = await projectRef.get();
      if (snap.exists && snap.data().uid && snap.data().uid !== user.uid) {
        return res.status(403).json({ error: "Not your project" });
      }

      await projectRef.set({
        renderV2Status: "rendering",
        renderV2Error: null,
        renderV2Job: job,
        // Lets the UI detect an abandoned render (instance reclaimed, timeout)
        // and re-enable Export instead of disabling it forever.
        renderV2StartedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // The render MUST be awaited. Cloud Run only guarantees CPU while a
      // request is in flight — work kicked off after res.send() gets throttled
      // to ~0 and the container can be reclaimed, which left the ffmpeg child
      // frozen mid-render. The project doc then sat on "rendering" forever and
      // the Export button spun indefinitely. Holding the request open keeps CPU
      // allocated; if the client disconnects the handler still runs to
      // completion server-side and Firestore is updated either way.
      const result = await (async () => {
        const os = require("os");
        const fs = require("fs");
        const path = require("path");
        const workDir = path.join(os.tmpdir(), `render_${projectId}_${Date.now()}`);
        const tag = `renderV2 ${projectId}`;

        try {
          await fs.promises.mkdir(workDir, { recursive: true });

          const plan = buildFfmpegPlan(job);

          const localInputs = [];
          for (let i = 0; i < plan.inputs.length; i++) {
            const localPath = path.join(workDir, renderLocalName(plan.inputs[i], i));
            console.log(`[${tag}] Downloading input ${i + 1}/${plan.inputs.length}: ${plan.inputs[i]}`);
            await compileDownloadFile(plan.inputs[i], localPath);
            localInputs.push(localPath);
          }

          const outPath = path.join(workDir, "out.mp4");
          const args = ["-y"];
          for (const input of localInputs) args.push("-i", input);
          args.push(
            "-filter_complex", plan.filterComplex,
            "-map", `[${plan.videoLabel}]`,
            "-map", `[${plan.audioLabel}]`,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "21",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-ar", "44100",
            "-ac", "2",
            "-t", String(job.duration),
            "-movflags", "+faststart",
            outPath
          );

          console.log(`[${tag}] Rendering ${job.duration}s @ ${job.width}x${job.height}/${job.fps}fps ` +
            `(${job.base.length} base segs, ${job.overlays.length} overlays, ${job.audio.length} audio)`);
          await renderRunFfmpeg(args, tag);

          const remotePath = `projects/${user.uid}/${projectId}/editor_render_${Date.now()}.mp4`;
          console.log(`[${tag}] Uploading to ${remotePath}`);
          await admin.storage().bucket(STORAGE_BUCKET).upload(outPath, {
            destination: remotePath,
            metadata: {
              contentType: "video/mp4",
              cacheControl: "public, max-age=31536000",
            },
          });

          const finalUrl = `https://storage.googleapis.com/${STORAGE_BUCKET}/${remotePath}`;
          console.log(`[${tag}] Render succeeded: ${finalUrl}`);
          await projectRef.set({
            renderV2Status: "succeeded",
            renderV2Url: finalUrl,
            renderV2CompletedAt: new Date().toISOString(),
            renderV2Error: null,
          }, { merge: true });
          return { ok: true, url: finalUrl };
        } catch (err) {
          console.error(`[${tag}] Render failed:`, err);
          await projectRef.set({
            renderV2Status: "failed",
            renderV2Error: err.message || "Render failed",
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          return { ok: false, error: err.message || "Render failed" };
        } finally {
          try {
            await fs.promises.rm(workDir, { recursive: true, force: true });
          } catch (cleanupErr) {
            console.warn(`[${tag}] Failed to clean up ${workDir}:`, cleanupErr);
          }
        }
      })();

      return result.ok
        ? res.status(200).json({ status: "succeeded", videoUrl: result.url })
        : res.status(500).json({ status: "failed", error: result.error });
    } catch (err) {
      console.error("renderJobV2 error:", err);
      // Never leave the project stuck on "rendering" — the UI keys off this.
      try {
        await db.collection("projects").doc(req.body?.projectId || "_").set({
          renderV2Status: "failed",
          renderV2Error: err.message || "Render failed",
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch { /* best effort */ }
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── EDITOR ENGINE — MEDIA INTELLIGENCE ─────────────────────────────────────
// Probes a media URL (ffprobe) and builds the timeline artifacts: a filmstrip
// sprite JPEG (video) and a normalized waveform peak array (audio). Uploads the
// sprite to Storage and returns metadata + waveform inline. Synchronous within
// the 120s window — assets are single clips, not full films.

const { probeMedia, DEFAULT_WAVEFORM_BUCKETS } = require("./mediaProbe");

exports.mediaProbe = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 120, memory: "1GiB" },
  async (req, res) => {
    const os = require("os");
    const fs = require("fs");
    const path = require("path");
    let workDir = null;
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const user = await requireAuth(req);
      const { url, assetId = null, kind = null } = req.body || {};

      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        return res.status(400).json({ error: "Missing or invalid url" });
      }
      if (parsed.protocol !== "https:") {
        return res.status(400).json({ error: "Only https URLs are allowed" });
      }
      if (kind && !["video", "audio", "image"].includes(kind)) {
        return res.status(400).json({ error: "Invalid kind" });
      }

      workDir = path.join(os.tmpdir(), `probe_${user.uid}_${Date.now()}`);
      await fs.promises.mkdir(workDir, { recursive: true });

      const ext = (() => {
        const e = path.extname(parsed.pathname).toLowerCase();
        return /^\.[a-z0-9]{2,5}$/.test(e) ? e : ".bin";
      })();
      const localPath = path.join(workDir, `src${ext}`);
      await compileDownloadFile(url, localPath);

      const result = await probeMedia(localPath, {
        hint: kind || undefined,
        waveform: { buckets: DEFAULT_WAVEFORM_BUCKETS },
      });

      const response = { meta: result.meta };

      if (result.filmstrip) {
        const remotePath = `media/${user.uid}/${assetId || Date.now()}/filmstrip.jpg`;
        await admin.storage().bucket(STORAGE_BUCKET).upload(
          path.join(workDir, "filmstrip.jpg"),
          {
            destination: remotePath,
            metadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" },
          }
        );
        response.filmstrip = {
          url: `https://storage.googleapis.com/${STORAGE_BUCKET}/${remotePath}`,
          ...result.filmstrip.plan,
        };
      }

      if (result.waveform) {
        response.waveform = result.waveform;
      }

      // Persist a reusable index entry keyed by asset id (best-effort).
      if (assetId) {
        try {
          await db.collection("mediaIndex").doc(assetId).set({
            uid: user.uid,
            url,
            ...response,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        } catch (indexErr) {
          console.warn(`[mediaProbe] index write failed for ${assetId}:`, indexErr.message);
        }
      }

      return res.status(200).json(response);
    } catch (err) {
      console.error("mediaProbe error:", err);
      return res.status(500).json({ error: err.message });
    } finally {
      if (workDir) {
        try {
          await fs.promises.rm(workDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.warn(`[mediaProbe] cleanup failed:`, cleanupErr.message);
        }
      }
    }
  }
);

/**
 * Auth trigger: Automatically initializes newly registered users in Firestore.
 */
exports.onUserCreated = functions.region("us-east4").auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const email = user.email || null;
  const name = user.displayName || null;
  const ref = db.collection("users").doc(uid);

  try {
    await ref.set({
      // Every new account starts with GMD 1,000 on the house — enough to feel
      // the product before paying. `welcomeBonus` is what the paywall
      // celebrates once; `welcomeBonusSeen` is set by the client afterwards.
      credits: WELCOME_BONUS_GMD,
      welcomeBonus: WELCOME_BONUS_GMD,
      welcomeBonusGrantedAt: new Date().toISOString(),
      welcomeBonusSeen: false,
      plan: null,
      planStatus: "none",
      planRenewsAt: null,
      email: email,
      name: name,
      createdAt: new Date().toISOString()
    }, { merge: true });

    console.log(`Initialized user doc for UID: ${uid} with GMD ${WELCOME_BONUS_GMD} welcome bonus.`);
  } catch (error) {
    console.error(`Failed to initialize user doc for UID: ${uid}:`, error);
  }
});



