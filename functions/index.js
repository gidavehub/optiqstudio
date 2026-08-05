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
const { callVertexWithRetry, withSdkRetry } = require("./vertexQuota");
const { GoogleGenAI } = require("@google/genai");

admin.initializeApp();
const db = admin.firestore();

/**
 * Direct Studio pricing, GMD. Mirrors lib/credits.ts COSTS and the COSTS
 * constant in components/AuthProvider.tsx — the three must always agree, and
 * this one is the only one that actually moves money.
 *
 *   • Video — per generated second (a 10s clip is 150).
 *   • Image — flat per still.
 *   • Voice — per CHARACTER of script, with a floor.
 *   • Music — flat 60. musicCost() is always called with no argument, so the
 *     "per second" shape is nominal: 30 x 2 is just how 60 is spelled. That
 *     matters now that Lyria 3 Pro returns a VARIABLE length (measured 64s and
 *     114s on two runs of the same prompt) — the charge is fixed, so a longer
 *     track costs the user nothing extra and only moves our own margin.
 *
 * NOTE: costs are intentionally NOT read from the RTDB `pricing` node any more.
 * That node still carries a much older cost model (image 50, TTS per-100-chars)
 * and letting it win meant the UI quoted one number while the server charged
 * another. Plans/packs (legacy subscription paths) still come from RTDB.
 */
const COSTS = {
  videoPerSecond: { omni: 15, "omni-fast": 15 },
  image: 10,
  ttsPerCharacter: 0.05,
  ttsMinimum: 5,
  musicPerSecond: 2,
  musicDefaultSeconds: 30,
};

const imageCost = () => COSTS.image;
const videoCost = (model, seconds) =>
  (COSTS.videoPerSecond[model] ?? COSTS.videoPerSecond.omni) * seconds;
const ttsCost = (text) =>
  Math.max(COSTS.ttsMinimum, Math.ceil(String(text || "").length * COSTS.ttsPerCharacter));
const musicCost = (seconds = COSTS.musicDefaultSeconds) => Math.ceil(seconds * COSTS.musicPerSecond);

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
    costs: COSTS,
  };
  try {
    const rtdb = admin.database();
    const snapshot = await rtdb.ref("pricing").once("value");
    const val = snapshot.val();
    if (val && val.plans && val.packs) {
      return { ...val, costs: COSTS };
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
// Top-ups are charged 1:1 in GMD.
//
// There is NO signup bonus. New accounts start at zero and buy what they make;
// they can still sign in and explore the whole platform (the paywall is
// skippable), they just can't generate until the wallet has something in it.
const WELCOME_BONUS_GMD = 0;
const MIN_TOPUP_GMD = 50;
const MAX_TOPUP_GMD = 500000;
// ModemPay card payments require a minimum of ~GMD 74.43 (~$1). Below that only
// the wallet (mobile money) method is offered so checkout doesn't dead-end.
// Tokens: "card" and "wallet" (mobile money; ModemPay rejects "mobile_money").
const CARD_MIN_GMD = 75;
// Mobile money (wallet) listed first so it shows before card at checkout.
const paymentMethodsFor = (amountGmd) => (amountGmd >= CARD_MIN_GMD ? ["wallet", "card"] : ["wallet"]);

/**
 * Verifies an x-modem-signature header (hex HMAC-SHA512 of the raw body).
 *
 * ModemPay signs with a DIFFERENT key depending on how the event was routed:
 *   - global webhook registered in the dashboard → the webhook signing secret
 *   - per-intent `callback_url` (what our checkout sets) → the MERCHANT SECRET
 *     KEY, i.e. the same sk_live_… we authenticate the REST API with.
 * (https://docs.modempay.com/documentation/payment-intents/callback_url)
 *
 * We set callback_url on every payment, so the merchant key is the one that
 * actually matches. Trying both keeps the dashboard webhook working too.
 */
function verifyModemSignature(rawBody, signature, candidateSecrets) {
  if (!signature) return null;
  for (const [label, secret] of candidateSecrets) {
    if (!secret) continue;
    const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
    if (
      computed.length === signature.length &&
      crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
    ) {
      return label;
    }
  }
  return null;
}

const SUCCESS_STATUSES = new Set(["completed", "successful", "success", "succeeded", "paid"]);

/** Pulls a transaction from ModemPay — the authority on amount/metadata. */
async function fetchModemTransaction(id, apiKey) {
  if (!id || !apiKey) return null;
  try {
    const r = await fetch(`https://api.modempay.com/v1/transactions/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j?.data || j || null;
  } catch (err) {
    console.warn("ModemPay transaction lookup failed:", err.message);
    return null;
  }
}

/**
 * Works out WHICH account to credit and HOW MUCH, from a succeeded charge.
 * Metadata is the intended path; the other two are safety nets so a paid
 * charge is never silently dropped.
 */
async function resolveFulfillment(charge, apiKey) {
  let meta = charge.metadata || {};
  let resolvedBy = "metadata";

  // 1. Metadata missing/stripped on the callback? Ask ModemPay directly.
  if (!meta.uid) {
    const txn = await fetchModemTransaction(charge.id, apiKey);
    if (txn?.metadata?.uid) {
      meta = { ...txn.metadata, ...meta, uid: txn.metadata.uid };
      resolvedBy = "transaction-lookup";
    }
  }

  // 2. Still nothing — fall back to the email the checkout was created with.
  let uid = meta.uid || null;
  const email = charge.customer_email || null;
  if (!uid && email) {
    const snap = await db.collection("users").where("email", "==", email).limit(2).get();
    if (snap.size === 1) {
      uid = snap.docs[0].id;
      resolvedBy = "email-match";
      console.warn(`Charge ${charge.id}: no uid in metadata, matched by email ${email}`);
    } else if (snap.size > 1) {
      console.error(`Charge ${charge.id}: email ${email} matches multiple users — not crediting`);
    }
  }

  // Amount: metadata wins; otherwise the charge itself. The wallet IS GMD, so
  // a GMD charge credits 1:1 — never infer an amount from another currency.
  let credits = Number(meta.credits);
  if (!Number.isFinite(credits) || credits <= 0) {
    credits =
      String(charge.currency).toUpperCase() === "GMD" ? Math.round(Number(charge.amount)) : 0;
    if (credits > 0) resolvedBy += "+amount-fallback";
  }

  return { uid, meta, credits: Number.isFinite(credits) && credits > 0 ? credits : 0, resolvedBy };
}

/**
 * Credits a successful charge exactly once.
 *
 * The record-and-credit happen in ONE transaction. (The previous version wrote
 * the payments doc first and credited afterwards — if the credit step failed,
 * the retry saw the doc, assumed "already fulfilled" and skipped it, so the
 * money stayed on the ModemPay dashboard and never reached the wallet.)
 */
async function fulfillCharge(charge, apiKey, via) {
  const { uid, meta, credits, resolvedBy } = await resolveFulfillment(charge, apiKey);
  const paymentRef = db.collection("payments").doc(String(charge.id));

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(paymentRef);
    // Skip anything already handled. A doc written by the OLD code path has no
    // `fulfilled` field but only ever existed because it was credited, so treat
    // "field absent" as fulfilled too — only an explicit `fulfilled === false`
    // (our uncredited/needs-review marker) is eligible for a retry.
    if (snap.exists && snap.data()?.fulfilled !== false) return { status: "already-fulfilled" };

    const record = {
      uid: uid || null,
      kind: meta.kind || "unknown",
      credits,
      amount: charge.amount,
      currency: charge.currency,
      reference: charge.transaction_reference || null,
      email: charge.customer_email || null,
      receivedAt: new Date().toISOString(),
      resolvedBy,
      via,
    };

    // Nothing to credit against — keep the record so it can be reconciled.
    if (!uid || credits <= 0) {
      tx.set(paymentRef, { ...record, fulfilled: false, needsReview: true }, { merge: true });
      return { status: !uid ? "no-uid" : "no-amount" };
    }

    const userRef = db.collection("users").doc(uid);
    const userUpdate = { credits: admin.firestore.FieldValue.increment(credits) };

    // Legacy subscription checkouts (the model is pay-as-you-go now).
    if (meta.kind === "subscription") {
      const renews = new Date();
      renews.setMonth(renews.getMonth() + 1);
      userUpdate.plan = meta.planId || "pro-monthly";
      userUpdate.planStatus = "active";
      userUpdate.planRenewsAt = renews.toISOString();
    }

    tx.set(userRef, userUpdate, { merge: true });
    tx.set(userRef.collection("ledger").doc(), {
      delta: credits,
      reason: meta.kind === "subscription" ? `subscription: ${meta.planId}` : `top-up ${charge.id}`,
      at: new Date().toISOString(),
    });
    tx.set(paymentRef, { ...record, fulfilled: true, needsReview: false }, { merge: true });
    return { status: "credited", uid, credits };
  });

  if (outcome.status === "credited") {
    console.log(`Credited GMD ${credits} to ${uid} for charge ${charge.id} (${resolvedBy}, ${via})`);
  } else if (outcome.status !== "already-fulfilled") {
    console.error(`Charge ${charge.id} NOT credited (${outcome.status}) — flagged for review`);
  }
  return outcome;
}

/** ModemPay webhook: verifies x-modem-signature (HMAC-SHA512) and fulfills. */
exports.modemWebhook = onRequest(
  { region: "us-east4", secrets: [MODEM_WEBHOOK_SECRET, MODEMPAY_API_KEY] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method not allowed");
      return;
    }

    const rawBody = req.rawBody ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
    const signature = req.get("x-modem-signature");
    const apiKey = MODEMPAY_API_KEY.value().trim();

    const signedWith = verifyModemSignature(rawBody, signature, [
      ["merchant-key", apiKey],
      ["webhook-secret", MODEM_WEBHOOK_SECRET.value().trim()],
    ]);
    if (!signedWith) {
      console.error("ModemPay webhook rejected: signature matched neither the merchant key nor the webhook secret");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    try {
      const event = JSON.parse(rawBody);
      // Shape tolerance: event/type and payload/data both appear in the wild.
      const name = event.event || event.type || "";
      const charge = event.payload || event.data || {};

      if (name === "charge.succeeded" && charge.id) {
        const status = String(charge.status || "").toLowerCase();
        if (status && !SUCCESS_STATUSES.has(status)) {
          console.warn(`Ignoring ${name} for ${charge.id}: status "${charge.status}" is not a success`);
        } else {
          await fulfillCharge(charge, apiKey, `webhook:${signedWith}`);
        }
      }
      // Everything else is acknowledged so ModemPay stops retrying.
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("Webhook fulfillment error:", err);
      res.status(500).json({ error: "Fulfillment failed" });
    }
  }
);

/**
 * Recovers payments that were taken but never credited.
 *
 * Scans the caller's recent ModemPay transactions and fulfills any successful
 * one that belongs to them and has not been credited yet. Safe to call
 * repeatedly — fulfillCharge is idempotent on the charge id, so an already
 * credited payment is a no-op.
 */
exports.modemPayReconcile = onRequest(
  { region: "us-east4", cors: true, maxInstances: 5, timeoutSeconds: 120, secrets: [MODEMPAY_API_KEY] },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");

      const authHeader = req.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
      const decoded = await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]);
      const uid = decoded.uid;
      const email = (decoded.email || "").toLowerCase();

      const apiKey = MODEMPAY_API_KEY.value().trim();
      const listRes = await fetch("https://api.modempay.com/v1/transactions?limit=100", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const listJson = await listRes.json().catch(() => ({}));
      if (!listRes.ok) {
        console.error("ModemPay transaction list failed:", listJson);
        return res.status(502).json({ error: "Could not reach the payment provider" });
      }

      const transactions = Array.isArray(listJson?.data)
        ? listJson.data
        : Array.isArray(listJson?.data?.transactions)
          ? listJson.data.transactions
          : Array.isArray(listJson)
            ? listJson
            : [];

      // Only the caller's own successful charges.
      const mine = transactions.filter((t) => {
        const status = String(t?.status || "").toLowerCase();
        if (!SUCCESS_STATUSES.has(status)) return false;
        if (t?.metadata?.uid) return t.metadata.uid === uid;
        return !!email && String(t?.customer_email || "").toLowerCase() === email;
      });

      let credited = 0;
      let totalGmd = 0;
      for (const txn of mine) {
        const charge = {
          id: txn.id,
          amount: txn.amount,
          currency: txn.currency,
          status: txn.status,
          metadata: { ...(txn.metadata || {}), uid: txn?.metadata?.uid || uid },
          customer_email: txn.customer_email || null,
          transaction_reference: txn.reference || txn.transaction_reference || null,
        };
        const outcome = await fulfillCharge(charge, apiKey, "reconcile");
        if (outcome.status === "credited") {
          credited += 1;
          totalGmd += outcome.credits;
        }
      }

      return res.status(200).json({
        scanned: mine.length,
        credited,
        creditedGmd: totalGmd,
      });
    } catch (err) {
      console.error("modemPayReconcile error:", err);
      return res.status(500).json({ error: err.message });
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
// NOTE: exports.generateImage and exports.generateVideo used to live here.
// They were superseded by imageGenerate/videoGenerate (which the app calls)
// and apiGenerateImage/apiGenerateVideo (which the developer docs publish),
// and nothing referenced them any more. They were deleted on 2026-08-05 to
// free Cloud Run CPU quota in us-east4, which had run out and was blocking
// every other function from deploying. Do not re-add them without checking
// that quota first: each one reserved maxInstances(10) x 1 CPU.


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
            // Card + mobile money (card only above its minimum).
            payment_methods: paymentMethodsFor(requested),
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
          // Card + mobile money (card only above its minimum).
          payment_methods: paymentMethodsFor(amountGmd),
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

/**
 * Writes the user-visible billing row for a wallet movement.
 *
 * The client used to do this (and the deduction) itself in
 * ConfirmGenerationModal, which double-charged: the modal decremented the
 * balance AND the function below decremented it again. The modal is now a pure
 * confirmation, so the server owns both the money and the receipt.
 * Best-effort — a missing receipt must never fail a paid-for generation.
 */
async function recordTransaction(uid, { description, amountGmd, method = "Wallet Balance" }) {
  try {
    await db.collection("transactions").add({
      uid,
      invoiceId: `INV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      description,
      method,
      status: "Succeeded",
      amount: `${amountGmd < 0 ? "-" : ""}GMD ${Math.abs(amountGmd).toFixed(2)}`,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`Could not write transaction row for ${uid}:`, err.message);
  }
}

async function chargeCredits(uid, amount, reason) {
  if (amount <= 0) {
    const snap = await db.collection("users").doc(uid).get();
    return (snap.data()?.credits) || 0;
  }
  const ref = db.collection("users").doc(uid);
  const remaining = await db.runTransaction(async (tx) => {
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
  await recordTransaction(uid, { description: reason, amountGmd: -amount });
  return remaining;
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

/**
 * Turns the storage refs on an agent job into the { base64, mimeType } pairs
 * runStorylineAgent expects.
 *
 * The client writes paths, not bytes: an agent message is a plain Firestore
 * write, and Firestore caps a document at 1MB, which a single still blows
 * through. One unreadable image must not cost the director their whole turn, so
 * a failed read is logged and dropped rather than thrown.
 */
async function rehydrateAgentMedia(refs) {
  if (!Array.isArray(refs) || refs.length === 0) return [];
  const out = [];
  for (const ref of refs) {
    if (!ref?.path) continue;
    try {
      out.push({
        base64: await downloadInputMedia(ref.path),
        mimeType: ref.mimeType || "image/png",
      });
    } catch (e) {
      console.error(`[agent] could not read attachment ${ref.path}: ${e.message}`);
    }
  }
  return out;
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

// ── Transcription ───────────────────────────────────────────────────────────
// The storyline agent's mic records a real audio packet and sends it here,
// rather than using the browser's Web Speech API. Web Speech is a different
// engine per browser, needs a network round trip to whoever the vendor uses,
// and mangles exactly the words that matter here — brand names and Gambian /
// Nigerian proper nouns. gemini-3.5-flash takes the audio as an inlineData part
// and transcribes it directly (verified by scripts/probe-transcribe.mjs).
//
// `hints` is the fix for the one weakness the probe found: a round-trip of
// "land the Banjul tub before Amaka turns to camera" came back with "banjo" and
// "Omaka". Feeding the model the brand and character names it should expect
// turns those from guesses into matches. Free, like enhancePrompt — it's one
// short text call and charging for the mic would discourage using it.
exports.transcribeAudio = onRequest(
  // maxInstances is deliberately low. A 2nd-gen function is a Cloud Run service
  // and reserves maxInstances x cpu against the project's per-region CPU quota,
  // which us-east4 is already close to — adding this at the usual 10 pushed the
  // project over and failed five other functions' rollouts. Transcription is a
  // short call on a mic press, so 3 concurrent is plenty.
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      await requireAuth(req);
      const { audioBase64, mimeType, hints } = req.body;
      if (!audioBase64) return res.status(400).json({ error: "Missing audio" });

      const names = Array.isArray(hints) ? hints.filter(Boolean).slice(0, 40) : [];
      const spellings = names.length
        ? `\n\nThese names may appear — spell them exactly this way if you hear them: ${names.join(", ")}.`
        : "";

      const response = await vertexFetch(
        `/publishers/google/models/gemini-3.5-flash:generateContent`,
        {
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: mimeType || "audio/webm", data: audioBase64 } },
                {
                  text:
                    "Transcribe this audio verbatim. Return ONLY the transcript — no preamble, " +
                    "no quotation marks, no commentary, no apology. If there is no speech at all, " +
                    "return an empty string." +
                    spellings,
                },
              ],
            },
          ],
          // Transcription is not a creative task; keep it from embellishing.
          generationConfig: { temperature: 0 },
        }
      );

      const text = (response.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || "")
        .join("")
        .trim();

      return res.status(200).json({ text });
    } catch (err) {
      console.error("transcribeAudio error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

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

      const cost = imageCost();
      await chargeCredits(user.uid, cost, "Image Studio still");

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
        // Stored so the wall and the detail view can draw a box the shape of
        // the still. Video has always recorded this; image never did, so
        // every portrait or square image was displayed letterboxed in 16:9.
        aspectRatio: aspectRatio || "1:1",
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

      // Voice is billed per character of script (see COSTS). A cloned voice
      // carries the extra render on top of the same per-character base.
      const isClone = !!voiceBase64;
      const cost = isClone ? Math.max(30, ttsCost(text)) : ttsCost(text);

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

// ── Optiq Music (Lyria 3 Pro) ───────────────────────────────────────────────
// Lyria 3 is NOT on the :predict surface. Its ids appear in the us-central1
// publisher catalog, but :predict 404s there and in every other region, on both
// v1 and v1beta1 — the catalog entry lists `openGenerationAiStudio` as its only
// action, which reads like "AI Studio only" and is what sent us down the wrong
// path first. It isn't. The SDK's own types are the ground truth: both Lyria 3
// ids sit in the model union for the INTERACTIONS API (`Model_2` in
// @google/genai dist/node/node.d.ts, right beside the gemini-3 ids), and
// Interaction carries `output_audio`. Same move Google made with omni video.
//
// Two differences from lyria-002 that matter downstream:
//   • it returns MP3 (audio/mpeg), not WAV — so callers must not hardcode .wav
//   • it returns ~64s, not ~30s (see musicCost / COSTS.musicDefaultSeconds)
// Unlike omni video it rejects background:true ("does not support background
// interactions"), so this is a blocking create — fine at ~55s against the
// 240s function timeout.
//
// Re-verify with `node scripts/probe-lyria3.mjs`.
const LYRIA_MODEL = "lyria-3-pro-preview";
const lyriaAi = new GoogleGenAI({ vertexai: true, project: "davelabs-tools", location: "global" });
// Rich, vibey default when a project has no usable music spec — genre-appropriate
// for the brand ads and specific enough to avoid a bland, plain loop.
const DEFAULT_AD_MUSIC =
  "An upbeat, vibey, cinematic brand-advert instrumental with rich layered percussion, a memorable melodic hook on kora or guitar, warm bass, uplifting brass and evolving dynamics — energetic, emotional and modern. NOT a plain repetitive loop or a bare drum beat. No vocals, no lyrics.";
// Returns { base64, mimeType, ext }. The Interactions API has no structured
// negative-prompt field the way :predict did, so an exclusion is folded into
// the prompt text.
async function lyriaGenerateOnce(prompt, negativePrompt = null) {
  const input = negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}.` : prompt;

  const interaction = await withSdkRetry({
    db,
    model: LYRIA_MODEL,
    fn: () => lyriaAi.interactions.create({ model: LYRIA_MODEL, input }),
  });

  if (interaction.status !== "completed") {
    const said = interaction.output_text ? `: ${String(interaction.output_text).slice(0, 200)}` : "";
    throw new Error(`Optiq Music ${interaction.status}${said}`);
  }

  const audio = interaction.output_audio;
  if (!audio?.data) throw new Error("Optiq Music returned no audio");

  // Lyria 3 answers audio/mpeg today. Derive the extension rather than assuming,
  // so a format change shows up as the right file rather than a broken one.
  const mimeType = audio.mime_type || "audio/mpeg";
  const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mpeg") ? "mp3" : "bin";
  return { base64: audio.data, mimeType, ext };
}

// Lyria's safety filter intermittently blocks a prompt ("All responses were
// blocked", HTTP 400) even for perfectly benign music. Retry the same prompt
// once, then fall back to a plain, always-safe prompt so an ad is never left
// without a score.
async function lyriaGenerate(prompt, negativePrompt = null) {
  const tries = [
    prompt,
    prompt,
    "An uplifting, warm, cinematic instrumental background track for a brand advert, gentle percussion and melody, no vocals, no lyrics",
  ];
  let lastErr;
  for (const p of tries) {
    try {
      return await lyriaGenerateOnce(p, negativePrompt);
    } catch (e) {
      lastErr = e;
      const blocked = e?.httpStatus === 400 || /block|safety/i.test(String(e?.message || e));
      if (!blocked) throw e;
      console.warn(`[lyria] prompt blocked, retrying: ${String(e?.message || e).slice(0, 80)}`);
    }
  }
  throw lastErr;
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

      // Lyria returns a single ~30s clip; billed per generated second.
      const cost = musicCost();

      try {
        await chargeCredits(user.uid, cost, "Optiq Music track");
      } catch (e) {
        return res.status(402).json({ error: e.message || "Insufficient credits" });
      }

      let track;
      try {
        track = await lyriaGenerate(prompt, negativePrompt);
      } catch (err) {
        await refundCredits(user.uid, cost, "optiq music failed").catch(() => {});
        throw err;
      }

      const doc = db.collection("generations").doc();
      const url = await uploadBase64(
        track.base64,
        `generations/${user.uid}/${doc.id}.${track.ext}`,
        track.mimeType
      );

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
      let cost = videoCost(model, duration);

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
        // Nothing prepaid left (a re-render, or a plain Direct Studio clip):
        // charge for it. The client shows the same confirm-price modal first.
        await chargeCredits(user.uid, cost, `Video clip (${duration}s)`);
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

      const cost = imageCost();
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
        // Same reason as the first-party path above — see imageGenerate.
        aspectRatio: aspectRatio || "1:1",
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
      const cost = videoCost(model, duration);

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

      const cost = ttsCost(text);
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

      // NOTE: the ad's audio (Optiq Music score + the two TTS narration tracks)
      // is NO LONGER baked here. Generating it on the storyboard's critical path
      // delayed "ready" and risked timing the job out (leaving it stuck at a
      // working stage). projectCompile now self-heals the audio at compile time,
      // so the storyboard goes straight to "ready" the moment the scenes exist.

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

// ─── THE STORYLINE AGENT ─────────────────────────────────────────────────────
// The chat at /dashboard/project/[id]/agent. Same shape as the storyboard job:
// the client writes its message plus an empty assistant bubble into
// projects/{id}/agentChat, drops a job in `agentJobs`, and this trigger fills the
// bubble in — streaming the work log and the prose into it as they happen. So a
// three-minute film-wide rewrite survives a closed tab, and reopening the chat
// shows exactly where the agent is.
//
// Must run in us-central1 (nam5 Firestore Eventarc), like storyboardGenerate.
// Idempotent: the job is claimed queued -> running in a transaction so an
// at-least-once duplicate delivery can't run the same turn twice.

const { runStorylineAgent } = require("./optiqSkills/agent");

// How much of the thread the agent carries into a turn. Reads of the film go
// through tools, so this only has to hold the conversation.
const AGENT_HISTORY_LIMIT = 20;

exports.storylineAgent = onDocumentCreated(
  { document: "agentJobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "1GiB", maxInstances: 10 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    if (!job || !job.projectId || !job.replyTo) return;

    const jobRef = snap.ref;
    const projectRef = db.collection("projects").doc(job.projectId);
    const replyRef = projectRef.collection("agentChat").doc(job.replyTo);

    const claimed = await db.runTransaction(async (tx) => {
      const d = await tx.get(jobRef);
      if (d.exists && (d.data().status || "queued") === "queued") {
        tx.update(jobRef, { status: "running", startedAt: new Date().toISOString() });
        return true;
      }
      return false;
    });
    if (!claimed) {
      console.log(`[agent ${job.projectId}] job not in 'queued' state, skipping`);
      return;
    }

    const fail = async (message) => {
      await replyRef
        .set({ status: "failed", error: message, updatedAt: new Date().toISOString() }, { merge: true })
        .catch(() => {});
      await projectRef.update({ agentStatus: null }).catch(() => {});
      await jobRef.update({ status: "failed", error: message }).catch(() => {});
    };

    try {
      const projectSnap = await projectRef.get();
      if (!projectSnap.exists) return fail("That project no longer exists.");
      const project = { id: projectSnap.id, ...projectSnap.data() };
      if (project.uid !== job.uid) return fail("You don't have access to that project.");
      if (!project.scenes || project.scenes.length === 0) {
        return fail("This project has no script yet — generate the storyboard first, then come back and we'll work on it.");
      }

      // The thread so far, oldest first, minus the bubble we're about to fill.
      const historySnap = await projectRef.collection("agentChat").orderBy("createdAt", "desc").limit(AGENT_HISTORY_LIMIT).get();
      const history = historySnap.docs
        .filter((d) => d.id !== job.replyTo && (d.data().text || "").trim())
        .map((d) => ({ role: d.data().role === "assistant" ? "assistant" : "user", text: d.data().text }))
        .reverse();
      // The message being answered is passed separately, so drop its echo.
      if (history[history.length - 1]?.text === job.text) history.pop();

      // Tells the client to suspend its debounced project autosave. Without
      // this, a save queued before the turn started could land after the agent
      // wrote a scene and quietly restore the old prompt.
      // agentStartedAt is the client's escape hatch: a turn that dies without
      // running its catch (an OOM, the 540s ceiling) would otherwise leave
      // agentStatus pinned to "running" forever, and the editor would never
      // autosave again. The client ignores a "running" flag older than the
      // function's own ceiling.
      await projectRef.update({
        agentStatus: "running",
        agentStartedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await replyRef.set({ status: "working", updatedAt: new Date().toISOString() }, { merge: true });

      // Firestore writes are cheap but not free, and the work log can tick
      // several times a second during a film-wide pass. Coalesce to ~1/s — but
      // on a TRAILING timer, not by dropping the update. A plain throttle would
      // discard the write that flips a step to "done", and if the next model
      // call then ran for a minute the chat would sit there spinning on work
      // that had already finished.
      let lastPublish = 0;
      let pending = null;
      let flushTimer = null;
      const flush = async () => {
        flushTimer = null;
        if (!pending) return;
        lastPublish = Date.now();
        const body = pending;
        pending = null;
        await replyRef.set({ ...body, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
      };
      const publish = async (patch) => {
        pending = { ...(pending || {}), ...patch };
        if (flushTimer) return;
        const wait = Math.max(0, 900 - (Date.now() - lastPublish));
        if (wait === 0) return flush();
        flushTimer = setTimeout(() => void flush(), wait);
      };

      const result = await runStorylineAgent({
        vertexFetch,
        project,
        saveProject: async (patch) => {
          // stripUndefined rebuilds plain objects, so the increment sentinel is
          // added AFTER it — running it through would flatten the transform
          // into a meaningless `{}`.
          await projectRef.update({
            ...stripUndefined(patch),
            // Server-owned counter. The client adopts the project's scenes
            // whenever this moves, which is how an agent edit shows up live in
            // the script editor without the client polling for it.
            scriptRevision: admin.firestore.FieldValue.increment(1),
            updatedAt: new Date().toISOString(),
          });
        },
        history,
        message: job.text,
        // Stills the director attached to THIS message. They ride to Storage
        // from the client (a Firestore doc can't carry base64 past 1MB) and are
        // rehydrated here, the same offload the video path uses. A failed read
        // must not sink the turn — the words still stand on their own.
        images: await rehydrateAgentMedia(job.images),
        onSteps: (steps) => publish({ steps }),
        onText: (text) => publish({ text }),
      });

      // Drop any scheduled partial write — the full turn is about to land, and
      // a timer that fired after the handler returned would never run anyway.
      if (flushTimer) clearTimeout(flushTimer);
      pending = null;

      await replyRef.set(
        {
          role: "assistant",
          text: result.text,
          steps: result.steps,
          touchedFilm: result.touchedFilm,
          status: "done",
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      await projectRef.update({ agentStatus: null, updatedAt: new Date().toISOString() });
      await jobRef.update({ status: "done", finishedAt: new Date().toISOString() });
      console.log(`[agent ${job.projectId}] turn done (${result.steps.length} tool calls, touchedFilm=${result.touchedFilm})`);
    } catch (err) {
      console.error(`[agent ${job.projectId}] turn failed:`, err);
      await fail(err.message || "The agent hit an error mid-turn.");
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

// ── Shared ad-audio composition ─────────────────────────────────────────────
// Both exports (the storyboard projectCompile and the editor's renderJobV2) need
// the SAME three audio files under a SILENT video: the Optiq Music bed + the two
// TTS narration tracks. These helpers keep the two paths identical.

// Returns the project's { musicUrl, voiceoverUrl, taglineUrl, taglineDuration },
// generating + persisting any that are missing so every export has full audio.
async function ensureProjectAudio(projectRef, projectId) {
  let musicUrl = null, voiceoverUrl = null, taglineUrl = null, taglineDuration = null;
  const psnap = await projectRef.get();
  const pd = psnap.exists ? psnap.data() : {};
  musicUrl = pd.musicUrl || null;
  voiceoverUrl = pd.voiceoverUrl || null;
  taglineUrl = pd.taglineUrl || null;
  taglineDuration = Number(pd.taglineDuration) || null;

  const patch = {};
  if (!musicUrl) {
    try {
      const prompt = musicPromptFromSpec(pd.musicSpec) || DEFAULT_AD_MUSIC;
      const track = await lyriaGenerate(prompt);
      musicUrl = await uploadBase64(
        track.base64,
        `projects/${projectId}/score.${track.ext}`,
        track.mimeType
      );
      patch.musicUrl = musicUrl;
      console.log(`[audio ${projectId}] generated Optiq Music`);
    } catch (e) {
      console.error(`[audio ${projectId}] music generation failed:`, e.message);
    }
  }
  if (!voiceoverUrl && !taglineUrl) {
    try {
      const vo = await writeAdNarration({ concept: pd.concept, brandName: pd.brandName, scenes: pd.scenes });
      const mapped = VOICEOVER_VOICES[vo.voiceKey] || VOICEOVER_VOICES["gambian-english"];
      if (vo.narration) {
        const nar = await ttsGenerate(vo.narration, mapped.voice, mapped.style);
        voiceoverUrl = await uploadBase64(nar.base64Wav, `projects/${projectId}/voiceover.wav`, "audio/wav");
        patch.voiceoverUrl = voiceoverUrl;
      }
      if (vo.tagline) {
        const tag = await ttsGenerate(vo.tagline, mapped.voice, mapped.style);
        taglineUrl = await uploadBase64(tag.base64Wav, `projects/${projectId}/tagline.wav`, "audio/wav");
        taglineDuration = tag.durationSec;
        patch.taglineUrl = taglineUrl;
        patch.taglineDuration = taglineDuration;
      }
      console.log(`[audio ${projectId}] generated narration (${vo.voiceKey})`);
    } catch (e) {
      console.error(`[audio ${projectId}] narration generation failed:`, e.message);
    }
  }
  if (Object.keys(patch).length) await projectRef.set(patch, { merge: true }).catch(() => {});
  return { musicUrl, voiceoverUrl, taglineUrl, taglineDuration };
}

// Lays the ad soundtrack over `inPath`, writing `outPath`: DROPS the video's own
// audio ([0:a] at volume 0, also the duration anchor) and mixes the looped music
// bed + narration (from the top) + tagline (delayed to the end) through a limiter.
// Returns true if it composed, false if there was nothing to add.
async function composeAdAudio({ inPath, outPath, workDir, audio, musicVolume = 0.6, totalDuration, tag, download, run }) {
  const path = require("path");
  const assets = [];
  // The score is .mp3 since Lyria 3 Pro, but projects scored before that still
  // hold a .wav — so the local name follows the URL rather than assuming either.
  if (audio.musicUrl) {
    const ext = /\.mp3(\?|$)/i.test(audio.musicUrl) ? "mp3" : "wav";
    const p = path.join(workDir, `cmp_bgm.${ext}`);
    await download(audio.musicUrl, p);
    assets.push({ kind: "music", path: p });
  }
  if (audio.voiceoverUrl) { const p = path.join(workDir, "cmp_vo.wav"); await download(audio.voiceoverUrl, p); assets.push({ kind: "voiceover", path: p }); }
  if (audio.taglineUrl) { const p = path.join(workDir, "cmp_tag.wav"); await download(audio.taglineUrl, p); assets.push({ kind: "tagline", path: p }); }
  if (assets.length === 0) return false;

  const inputArgs = [`-i "${inPath}"`];
  const filters = [`[0:a]volume=0[base]`];
  const mixLabels = ["[base]"];
  let idx = 0;
  for (const a of assets) {
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
      const delayMs = Math.max(0, Math.round((totalDuration - (audio.taglineDuration || 4) - 0.3) * 1000));
      filters.push(`[${idx}:a]adelay=${delayMs}|${delayMs},volume=1.6[tag]`);
      mixLabels.push("[tag]");
    }
  }
  const filterGraph =
    `${filters.join(";")};${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0[mixed];` +
    `[mixed]alimiter=limit=0.95[aout]`;
  console.log(`[${tag}] Composing ad audio: music@${musicVolume}${audio.voiceoverUrl ? " + narration" : ""}${audio.taglineUrl ? " + tagline" : ""}`);
  const cmd = `ffmpeg -y ${inputArgs.join(" ")} -filter_complex "${filterGraph}" -map 0:v -map "[aout]" -c:v copy -c:a aac "${outPath}"`;
  await run(cmd);
  return true;
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

      // Clips keep their OWN (natively generated) audio — the ad is NOT scored or
      // narrated by the platform anymore. Background music is only mixed in when
      // the client explicitly passes a musicUrl (e.g. a track the user chose).
      const musicUrl = bodyMusicUrl;

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

          for (let i = 0; i < timeline.length; i++) {
            const clip = timeline[i];
            const srcPath = path.join(workDir, `src_${i}.mp4`);
            const trimmedPath = path.join(workDir, `trimmed_${i}.mp4`);

            console.log(`[compile ${projectId}] Downloading segment ${i}: ${clip.videoUrl}`);
            await compileDownloadFile(clip.videoUrl, srcPath);

            const trimStart = clip.trimStart || 0;
            const trimEnd = clip.trimEnd || 10;
            const duration = Math.max(trimEnd - trimStart, 0.5);

            // Keep the clip's OWN (natively generated) audio.
            console.log(`[compile ${projectId}] Trimming segment ${i} (${trimStart}s→${trimEnd}s, ${duration}s)`);
            const trimCmd = `ffmpeg -y -ss ${trimStart} -t ${duration} -i "${srcPath}" -c:v libx264 -preset superfast -crf 23 -c:a aac -vf "scale=1280:720,setsar=1,fps=30" -ar 44100 -ac 2 "${trimmedPath}"`;
            await compileRunCommand(trimCmd);

            filelistContent.push(`file '${trimmedPath}'`);
          }

          await fs.promises.writeFile(filelistPath, filelistContent.join("\n"));

          console.log(`[compile ${projectId}] Merging ${timeline.length} segments`);
          const mergedPath = path.join(workDir, "merged.mp4");
          const concatCmd = `ffmpeg -y -f concat -safe 0 -i "${filelistPath}" -c copy "${mergedPath}"`;
          await compileRunCommand(concatCmd);

          // The clips keep their own native audio. Only if the client explicitly
          // passed a background track do we lay it under that audio; otherwise the
          // merged video ships as-is. Best-effort — on failure keep native audio.
          let finalPath = mergedPath;
          if (musicUrl) {
            try {
              const bgmPath = path.join(workDir, "bgm.wav");
              await compileDownloadFile(musicUrl, bgmPath);
              finalPath = path.join(workDir, "final.mp4");
              console.log(`[compile ${projectId}] Mixing background music (volume: ${musicVolume})`);
              const mixCmd = `ffmpeg -y -i "${mergedPath}" -stream_loop -1 -i "${bgmPath}" -filter_complex "[0:a]volume=1.0[a1];[1:a]volume=${musicVolume}[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac "${finalPath}"`;
              await compileRunCommand(mixCmd);
            } catch (mixErr) {
              console.error(`[compile ${projectId}] music mix failed, shipping native audio:`, mixErr.message);
              finalPath = mergedPath;
            }
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
      // No free credits. An account starts empty and the user tops up when they
      // want to generate something. `welcomeBonus: 0` also stops the paywall's
      // celebration sheet from firing (it keys off a non-zero bonus).
      credits: WELCOME_BONUS_GMD,
      welcomeBonus: 0,
      welcomeBonusSeen: true,
      plan: null,
      planStatus: "none",
      planRenewsAt: null,
      email: email,
      name: name,
      createdAt: new Date().toISOString()
    }, { merge: true });

    console.log(`Initialized user doc for UID: ${uid} with a zero balance (no signup bonus).`);
  } catch (error) {
    console.error(`Failed to initialize user doc for UID: ${uid}:`, error);
  }
});



