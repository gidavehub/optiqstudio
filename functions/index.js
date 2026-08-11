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
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { GoogleAuth } = require("google-auth-library");
const admin = require("firebase-admin");
const crypto = require("crypto");
const { callVertexWithRetry, withSdkRetry } = require("./vertexQuota");

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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 60, secrets: [MODEMPAY_API_KEY] },
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
const { classifyRenderFailure } = require("./renderFailure");

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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 240 },
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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 240 },
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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 240 },
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

// Built on first use, not at module load. Constructing the SDK client costs
// every function in this file a slice of its cold start, and only the music
// paths ever touch it.
let _lyriaAi = null;
function getLyriaAi() {
  if (!_lyriaAi) {
    const { GoogleGenAI } = require("@google/genai");
    _lyriaAi = new GoogleGenAI({ vertexai: true, project: "davelabs-tools", location: "global" });
  }
  return _lyriaAi;
}

// Returns { base64, mimeType, ext }. The Interactions API has no structured
// negative-prompt field the way :predict did, so an exclusion is folded into
// the prompt text.
async function lyriaGenerateOnce(prompt, negativePrompt = null) {
  const input = negativePrompt ? `${prompt}\n\nAvoid: ${negativePrompt}.` : prompt;

  const interaction = await withSdkRetry({
    db,
    model: LYRIA_MODEL,
    fn: () => getLyriaAi().interactions.create({ model: LYRIA_MODEL, input }),
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

// ── Optiq narration (Gemini 3.1 Flash TTS) ──────────────────────────────────
// Synthesizes one line. `durationSec` is exact, computed from the PCM byte count
// rather than probed — which is what lets audio post-production measure a take
// and refit an overrunning line without touching ffmpeg. See functions/audioPost.js.
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

exports.musicGenerate = onRequest(
  // Longer timeout so a per-minute quota wait can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 240 },
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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 60 },
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

      // ── THE PAUSE THE CLIENT CANNOT UNDO ──────────────────────────────────
      //
      // Cancelling a film's queued renders does not keep them cancelled. The
      // editor's auto-render pass fires every idle scene whenever the film is in
      // `auto-merge`, and an open workspace tab autosaves its own copy of
      // `productionMode` back over the document — so a film switched to `manual`
      // to stop the bleeding is switched back a second later and enqueues the
      // whole film again. That is not a race we can win from the client side.
      //
      // `rendersPaused` is set on the project by
      // scripts/cancel-queued-renders.mjs and checked HERE, on the server, before
      // a single credit moves. The client neither writes it nor knows about it,
      // so it cannot be echoed away. Lifted with `--resume`.
      if (projectId) {
        const paused = await db
          .collection("projects")
          .doc(projectId)
          .get()
          .then((snap) => snap.exists && snap.data().rendersPaused === true)
          .catch(() => false);
        if (paused) {
          return res.status(409).json({
            error:
              "Rendering is paused for this film. Nothing was charged. Resume it when the film is ready to shoot.",
            paused: true,
          });
        }
      }

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
        // Born QUEUED. Nothing starts a render except the global gate — see
        // THE VIDEO QUEUE.
        status: "queued",
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
        // The link the cascade delete follows. prepaidProjectId cannot serve —
        // it is only set when the allowance actually covered this render, so a
        // re-render charged to the wallet would be left behind.
        projectId: projectId || null,
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

/**
 * The weekly sweep for media nothing owns any more.
 *
 * cleanupDeletedProject handles the deletions that happen from now on; this is
 * for what the fix arrives too late for, and for whatever escapes it later — a
 * cleanup that timed out halfway, a document removed straight from the console,
 * a render whose project went while it was still uploading.
 *
 * Sunday, deliberately: it reads the entire bucket listing, and that is worth
 * doing when nobody is waiting on a render. See ./orphanSweep.js for what counts
 * as orphaned and, more importantly, for the several things it will never touch.
 */
exports.sweepOrphanedMedia = onSchedule(
  {
    schedule: "0 4 * * 0",
    timeZone: "UTC",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 1,
    retryCount: 0,
  },
  async () => {
    const { findOrphans, deleteOrphans, humanBytes } = require("./orphanSweep");
    const bucket = admin.storage().bucket(STORAGE_BUCKET);

    const { orphans, kept, unknown, bytes } = await findOrphans({
      db,
      bucket,
      onProgress: (line) => console.log(`[orphanSweep] ${line}`),
    });

    if (unknown.length > 0) {
      // Not deleted — reported. A path this module does not recognise means
      // something writes somewhere it has never heard of, and the right response
      // is to teach it that prefix deliberately, not to guess.
      console.warn(
        `[orphanSweep] ${unknown.length} file(s) under unrecognised prefixes, left alone. ` +
          `First few: ${unknown.slice(0, 5).join(", ")}`
      );
    }

    if (orphans.length === 0) {
      console.log(`[orphanSweep] nothing orphaned; ${kept} file(s) all accounted for`);
      return;
    }

    console.log(`[orphanSweep] deleting ${orphans.length} orphaned file(s), ${humanBytes(bytes)}`);
    const removed = await deleteOrphans(orphans, {
      onProgress: (line) => console.log(`[orphanSweep] ${line}`),
    });
    console.log(`[orphanSweep] done: ${removed} deleted, ${kept} kept`);
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// DELETING A PROJECT DELETES EVERYTHING IT OWNS
// ═══════════════════════════════════════════════════════════════════════════
//
// Deleting the project document used to be the whole of "delete this project",
// and everything that document merely POINTED AT stayed where it was: a
// hundred-plus shot-board plates and frames, character sheets, uploaded
// materials, agent uploads, every rendered clip, and the job records. Storage is
// billed by the gigabyte and nothing was ever going to come back for those files
// — nothing even knew their names any more, because the only record of them was
// in the document that had just been removed.
//
// So the delete now cascades, and it is driven by the deletion itself rather than
// by the button: a project deleted from the workspace, from a script, or from the
// Firebase console all clean up identically.
//
// WHAT A PROJECT OWNS, and every one of these is swept:
//   Storage  users/{uid}/projects/{projectId}/…   plates, frames, character
//                                                 sheets, uploaded materials
//            projects/{projectId}/agentUploads/…  stills sent to the agent
//   Firestore  every job queued against it, in all five job collections
//              every generation it paid for
//   Storage  the media those generations produced, and their input media
//
// DELIBERATELY NOT SWEPT: users/{uid}/library/… — the media library belongs to
// the user, not to any one project, and a clip reused from it outlives the film
// it was made for.
//
// Best-effort throughout. A project that half-deletes is worse than one that
// deletes noisily, so every step is caught and logged rather than thrown: the
// document is already gone by the time this runs, and there is no undo to offer.

/** Everything under a Storage prefix. Returns how many objects went. */
async function deleteStoragePrefix(prefix) {
  try {
    const [files] = await admin.storage().bucket(STORAGE_BUCKET).getFiles({ prefix });
    if (files.length === 0) return 0;
    await Promise.all(
      files.map((file) =>
        file.delete().catch((err) => {
          // A file already gone is the outcome we wanted anyway.
          if (err.code !== 404) console.error(`[cleanup] could not delete ${file.name}:`, err.message);
        })
      )
    );
    return files.length;
  } catch (err) {
    console.error(`[cleanup] could not list ${prefix}:`, err.message);
    return 0;
  }
}

/** Every doc a query matches, in batches Firestore will accept. */
async function deleteQueryBatched(query, label) {
  let removed = 0;
  for (;;) {
    const snap = await query.limit(300).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    removed += snap.size;
    if (snap.size < 300) break;
  }
  if (removed) console.log(`[cleanup] removed ${removed} ${label}`);
  return removed;
}

/** The media one generation produced, plus whatever was uploaded into it. */
async function deleteGenerationMedia(id, gen) {
  const paths = new Set();
  for (const key of ["path", "imagePath", "videoPath", "audioPath"]) {
    if (gen[key]) paths.add(gen[key]);
  }
  for (const image of gen.images || []) {
    // `shared` marks a file that lives on the PROJECT rather than on this
    // generation — a shot-board frame attached to a render. The project sweep
    // owns those; deleting them here would take them out from under a scene that
    // is still using them.
    if (image?.path && !image.shared) paths.add(image.path);
  }
  // The output. Stored under a name derived from the doc id, in whichever
  // extension it came back as.
  for (const ext of ["mp4", "png", "jpg", "wav", "mp3"]) {
    paths.add(`generations/${gen.uid}/${id}.${ext}`);
  }

  await Promise.all(
    [...paths].map((path) =>
      admin
        .storage()
        .bucket(STORAGE_BUCKET)
        .file(path)
        .delete()
        .catch((err) => {
          if (err.code !== 404) console.error(`[cleanup] could not delete ${path}:`, err.message);
        })
    )
  );
  // Input media is written under a folder named for the doc — see
  // persistReferenceMedia.
  await deleteStoragePrefix(`generations/${gen.uid}/${id}/`);
}

exports.cleanupDeletedProject = onDocumentDeleted(
  { document: "projects/{projectId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB", maxInstances: 5 },
  async (event) => {
    const projectId = event.params.projectId;
    const project = event.data?.data() || {};
    const uid = project.uid;
    console.log(`[cleanup] project ${projectId} deleted; sweeping what it owned`);

    // ── The pictures and the uploads ──────────────────────────────────────
    if (uid) {
      const owned = await deleteStoragePrefix(`users/${uid}/projects/${projectId}/`);
      if (owned) console.log(`[cleanup] ${owned} file(s) under users/${uid}/projects/${projectId}/`);
    }
    const agentUploads = await deleteStoragePrefix(`projects/${projectId}/`);
    if (agentUploads) console.log(`[cleanup] ${agentUploads} agent upload(s)`);

    // ── The jobs queued against it ────────────────────────────────────────
    for (const collection of [
      "storyboardJobs",
      "shotBoardJobs",
      "audioPostJobs",
      "storyXBlueprintJobs",
      "agentJobs",
    ]) {
      await deleteQueryBatched(
        db.collection(collection).where("projectId", "==", projectId),
        `${collection} record(s)`
      ).catch((err) => console.error(`[cleanup] ${collection} sweep failed:`, err.message));
    }

    // ── The renders it paid for, and their media ──────────────────────────
    // Only reachable for generations that carry the link. Older ones, and any
    // this misses, are caught by sweepOrphanedMedia.
    try {
      const gens = await db.collection("generations").where("projectId", "==", projectId).get();
      for (const doc of gens.docs) {
        await deleteGenerationMedia(doc.id, doc.data());
      }
      if (gens.size > 0) {
        const batch = db.batch();
        gens.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[cleanup] removed ${gens.size} generation(s) and their media`);
      }
    } catch (err) {
      console.error(`[cleanup] generation sweep failed:`, err.message);
    }

    console.log(`[cleanup] project ${projectId} swept`);
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// THE VIDEO QUEUE
// ═══════════════════════════════════════════════════════════════════════════
//
// ONE VIDEO AT A TIME, PLUS A 90-SECOND COOLDOWN, ACROSS THE WHOLE PLATFORM.
//
// Shoot one. Wait for it to finish. Wait ninety seconds more. Shoot the next.
// The cooldown runs from the FINISH, which is what makes this strictly serial —
// spacing starts ninety seconds apart would let a five-minute render have three
// more started underneath it, all reaching for the same minute's quota.
//
// The video model's quota is a handful of requests per MINUTE, counted per GCP
// project — so it is shared by every user, every film and every Direct Studio
// clip at once. Nothing else in this file could see that:
//
//   • vertexQuota.js smooths calls INSIDE one function invocation. Thirty scenes
//     are thirty separate invocations, and thirty instances that each politely
//     wait for the next minute still arrive in the same minute.
//   • The editor's auto-render pass starts every idle scene the moment a film
//     enters auto-merge. On a thirty-scene film that is thirty video calls in a
//     few seconds. The first few land; the rest come back RESOURCE_EXHAUSTED,
//     get recorded as failures, and refunded — and the director presses retry and
//     burns the same minute again.
//
// So a render is no longer started by whoever asked for it. Every generation doc
// is born QUEUED, and starting is a privilege handed out by a single global gate:
// only when nothing is running AND nothing has finished inside the last
// VIDEO_START_GAP_MS. Oldest first, no matter which user or which film it
// belongs to.
//
// TWO THINGS TAKE FROM THE GATE, and both go through claimVideoStartSlot():
//   1. processVideoGeneration, on create — so a clip asked for on a quiet system
//      starts instantly instead of waiting for the next scheduler tick.
//   2. dispatchVideoQueue, once a minute — which drains everything that had to
//      wait, in the order it was asked for.
//
// The gate is a single Firestore doc updated in a transaction, which is what
// makes it hold across instances, across users and across regions. It is the one
// piece of state that must be globally consistent, and it is exactly one write.

/**
 * The cooldown after a render FINISHES before the next one may start.
 *
 * Measured from the finish, not from the start, and the difference is the whole
 * behaviour: spacing STARTS 90s apart lets renders pile up in flight whenever one
 * takes longer than the gap — a five-minute render would have three more started
 * underneath it, all competing for the same minute's quota, which is the pile-up
 * this queue exists to prevent. Measuring from the finish makes it strictly one
 * at a time: shoot, wait out the cooldown, shoot the next.
 */
const VIDEO_START_GAP_MS = Number(process.env.VIDEO_START_GAP_MS || 90_000);

/**
 * How long a render may sit in "processing" before it is presumed dead.
 *
 * Without this the queue is one hard kill away from stopping forever: an OOM or
 * an instance eviction never reaches the code that stamps the finish, so the doc
 * stays "processing", the gate keeps seeing a render in flight, and nothing ever
 * starts again. Past this age it no longer counts as in flight. Generous — the
 * function's own ceiling is 540s and omniVideo gives up at 8 minutes — because
 * the cost of being wrong is starting a second render alongside a live one.
 * See scripts/rescue-stuck-renders.mjs for the cleanup of what this leaves.
 */
const VIDEO_INFLIGHT_STALE_MS = Number(process.env.VIDEO_INFLIGHT_STALE_MS || 12 * 60 * 1000);

/** The gate. One document, transactional. */
const videoGateRef = () => db.collection("system").doc("videoQueue");

/**
 * Take the next start slot, or don't.
 *
 * Returns true only when NOTHING is currently rendering and the last render
 * finished at least VIDEO_START_GAP_MS ago — across every instance of every
 * function in this project. The caller may start exactly one render when it
 * returns true, and must leave the doc queued when it returns false.
 *
 * FAILS CLOSED, unlike vertexQuota's bucket. That limiter fails open because a
 * broken limiter must never block generation entirely; this one is the opposite
 * — if the gate cannot be read we do not know whether a render just started, and
 * guessing wrong reproduces the pile-up this exists to prevent. A queued doc
 * costs a minute of waiting; a wrong guess costs the director a scene.
 */
async function claimVideoStartSlot(reason = "") {
  const gapMs = VIDEO_START_GAP_MS;
  try {
    return await db.runTransaction(async (tx) => {
      const now = Date.now();
      const snap = await tx.get(videoGateRef());
      const gate = snap.exists ? snap.data() : {};

      // THE COOLDOWN, from whichever happened later. `lastFinishedAt` is the
      // rule; `lastStartedAt` is the guard that closes the window between a slot
      // being claimed here and the render actually reaching "processing" — for a
      // few seconds a started render is neither finished nor visible in flight,
      // and without this two instances can both walk through.
      const since = now - Math.max(
        Date.parse(gate.lastFinishedAt || "") || 0,
        Date.parse(gate.lastStartedAt || "") || 0
      );
      if (since < gapMs) return false;

      // AND NOTHING IS RUNNING RIGHT NOW. The cooldown alone cannot express
      // this: a render that has been going for five minutes finished nothing, so
      // the clock says yes while a clip is very much in flight. One at a time is
      // the point.
      const running = await tx.get(
        db
          .collection("generations")
          .where("type", "==", "video")
          .where("status", "==", "processing")
          .orderBy("createdAt", "asc")
          .limit(5)
      );
      const live = running.docs.filter((d) => {
        const data = d.data();
        const startedAt = Date.parse(data.startedAt || data.createdAt || "") || 0;
        return now - startedAt < VIDEO_INFLIGHT_STALE_MS;
      });
      if (live.length > 0) return false;

      tx.set(
        videoGateRef(),
        {
          lastStartedAt: new Date(now).toISOString(),
          lastReason: String(reason).slice(0, 120),
          // Purely for operators reading the doc in the console.
          gapMs,
        },
        { merge: true }
      );
      return true;
    });
  } catch (err) {
    console.error("[videoQueue] could not read the start gate; holding:", err.message);
    return false;
  }
}

/**
 * Stamp the finish. This is what the next render's cooldown counts from, so it
 * must happen on EVERY exit — succeeded, failed, refused, or thrown — or the
 * queue stops dead. Best-effort by design: a render that worked must not be
 * reported as failed because a bookkeeping write did not land.
 */
async function releaseVideoStartSlot(id) {
  await videoGateRef()
    .set({ lastFinishedAt: new Date().toISOString(), lastFinished: String(id).slice(0, 60) }, { merge: true })
    .catch((err) => console.error(`[videoQueue] could not stamp the finish for ${id}:`, err.message));
}

/**
 * Drains the queue: the oldest waiting render, if the gate allows one.
 *
 * Every minute rather than every 90 seconds because a minute is the finest
 * grain Cloud Scheduler offers. The gate is what actually enforces the spacing —
 * this only decides how often we ASK, so a tick that is refused is free and
 * common by design. Most ticks are refused: while a render is running, every one
 * of them is.
 *
 * Renders inline and waits for the result, which is why it carries the same
 * 540s/2GiB as processVideoGeneration: it is the same work. Ticks overlap in the
 * sense that a new one fires each minute while an older one is still rendering —
 * they simply find the gate closed and return, which costs nothing.
 */
exports.dispatchVideoQueue = onSchedule(
  {
    schedule: "* * * * *",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "2GiB",
    maxInstances: 10,
    retryCount: 0,
  },
  async () => {
    const waiting = await db
      .collection("generations")
      .where("type", "==", "video")
      .where("status", "==", "queued")
      // Oldest first: the queue is fair across users and films by arrival, and a
      // thirty-scene film enqueued at once drains in scene order.
      .orderBy("createdAt", "asc")
      .limit(1)
      .get();

    if (waiting.empty) return;

    const doc = waiting.docs[0];
    if (!(await claimVideoStartSlot(`queue ${doc.id}`))) {
      console.log(`[videoQueue] ${waiting.size} waiting; gate is closed, next tick`);
      return;
    }

    console.log(`[videoQueue] starting ${doc.id}`);
    await runVideoGeneration(doc.id, doc.ref, doc.data());
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
    // "queued" is the state every render is now born in (see THE VIDEO QUEUE);
    // "generating" is kept so a doc written by an older client, or by anything
    // that skips the queue, is still picked up rather than stranded forever.
    const status = dSnap.exists ? dSnap.data().status : null;
    if (status === "queued" || status === "generating") {
      tx.update(ref, { status: "processing", startedAt: new Date().toISOString() });
      return true;
    }
    return false;
  });
  if (!claimed) {
    console.log(`[video ${id}] not startable, skipping (already claimed/done)`);
    return;
  }

  const label = gen.viaApi ? "API: video" : "video";
  try {
    const duration = gen.durationSeconds || 8;
    console.log(`[video ${id}] generating server-side (requested duration: ${duration}s)`);
    // Wrapped from here so the finish is stamped whatever happens below — the
    // next render's cooldown counts from it, and a path that returns without
    // stamping stalls the whole platform's queue until the staleness cutoff.

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
    // NAME THE FAILURE BEFORE STORING IT. The scene card shows this string and
    // nothing else, and "Video generation failed" meant a director could not
    // tell a full quota (wait, then re-render) from a refused prompt (rewrite
    // the scene, or it will be refused forever). See renderFailure.js.
    const failure = classifyRenderFailure(err.message || "Generation failed");
    console.error(`[video ${id}] generation failed (${failure.kind}):`, err);
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
      // The clean sentence — this is what the scene card shows.
      error: failure.message,
      // Kept as its own field so anything deciding whether to retry can branch on
      // it without pattern-matching English back out of the message.
      failureKind: failure.kind,
      // The raw throw, kept off the UI but kept. For a video render this holds
      // the entire failed interaction, which is the only place the evidence for
      // the classification exists — see renderFailure.js.
      errorDetail: String(err.message || "").slice(0, 1500),
      completedAt: new Date().toISOString(),
    });
  } finally {
    // The cooldown starts HERE, not when this render began. A failure counts the
    // same as a success: a scene refused after thirty seconds must not let the
    // next one start thirty seconds early, because the quota does not care why
    // the last call was made.
    await releaseVideoStartSlot(id);
  }
}

// Server-side driver: fires the moment videoGenerate/apiGenerateVideo creates a
// video doc, so generation happens without any client involvement. Must run in
// us-central1 because the Firestore database is the nam5 multi-region (Eventarc
// delivers nam5 Firestore events there); the rest of the API stays in us-east4.
// MEMORY: 2GiB, raised from 512MiB, and it is not optional.
//
// This function holds every reference image for a render in memory as base64,
// at the same time as the generated video's own base64 coming back. At one or
// two character sheets that fitted in 512MiB. A PHOTOGRAPHED film attaches up to
// five board stills per scene (MAX_STILLS_PER_SCENE), which measured 572MiB and
// killed the instance.
//
// The failure mode is the expensive kind and it is why the headroom is generous:
// the Vertex interaction is created BEFORE the memory peak, so an OOM means the
// clip was paid for, the instance died, and the generation doc is left at
// "processing" — which the claim transaction above then refuses to retry. Money
// spent, no clip, and a scene that spins forever.
exports.processVideoGeneration = onDocumentCreated(
  { document: "generations/{id}", region: "us-central1", timeoutSeconds: 540, memory: "2GiB", maxInstances: 10 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const gen = snap.data();
    if (gen.type !== "video") return;
    if (gen.status !== "queued" && gen.status !== "generating") return;

    // THE FAST PATH, and the only reason this still starts renders at all. A
    // director who asks for one clip on a quiet system should not wait for the
    // next scheduler tick to find out nothing else is running. If the gate says
    // no, the doc simply stays queued and dispatchVideoQueue picks it up in
    // arrival order — which is what happens to 29 of the 30 scenes an
    // auto-merging film enqueues at once.
    if (!(await claimVideoStartSlot(`create ${event.params.id}`))) {
      console.log(`[video ${event.params.id}] queued — the platform started one too recently`);
      return;
    }
    await runVideoGeneration(event.params.id, snap.ref, gen);
  }
);

// Pure status read — the client polls this only to observe progress; it no
// longer drives generation (processVideoGeneration does). "processing" is an
// internal in-flight state surfaced to the client as "generating".
exports.videoStatus = onRequest(
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 60 },
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
        // `status` stays in the vocabulary every caller already branches on
        // (succeeded / failed / generating). `queued` rides alongside as a flag
        // so a UI that wants to say "waiting for a slot" can, and one that does
        // not keeps working unchanged. See THE VIDEO QUEUE.
        queued: gen.status === "queued",
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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 240 },
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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 60 },
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
        // Born QUEUED. Nothing starts a render except the global gate — see
        // THE VIDEO QUEUE.
        status: "queued",
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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 60 },
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
        // `status` stays in the vocabulary every caller already branches on
        // (succeeded / failed / generating). `queued` rides alongside as a flag
        // so a UI that wants to say "waiting for a slot" can, and one that does
        // not keeps working unchanged. See THE VIDEO QUEUE.
        queued: gen.status === "queued",
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
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 240 },
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

// ─── THE THREE SWARMS ───────────────────────────────────────────────────────
//
// Optiq runs three completely separate storyboard systems, in three separate
// boxes that share no code:
//
//   functions/optiqSkills/      → ADS. The short-film ad, the dialogue ad and the
//                                 narrated ad. This is the system that earns, it
//                                 is tuned, and nothing outside it may change it.
//   functions/optiqStory/       → ORIGINAL STORIES. Entertainment short films with
//                                 no brand, no product and nothing being sold.
//                                 Its own doctrine, concept room and gates.
//   functions/optiqDocumentary/ → DOCUMENTARIES. Films that observe something real
//                                 and argue something about it. Nothing is sold,
//                                 NOBODY SPEAKS on camera, and the film's words
//                                 are narration written by the swarm and recorded
//                                 over the finished cut in audio post.
//
// This file is the ONLY place they meet, and all it does is choose. Everything
// below routes on videoType and never mixes them.
const {
  runOptiqStoryPipeline,
  reviseStoryScene,
  STORY_KIND,
  STORY_VIDEO_TYPE,
} = require("./optiqStory/pipeline");
const {
  runOptiqDocumentaryPipeline,
  reviseDocumentaryScene,
  DOCUMENTARY_KIND,
  DOCUMENTARY_VIDEO_TYPE,
} = require("./optiqDocumentary/pipeline");
const {
  runOptiqStoryXBlueprint,
  reviseStoryScene: reviseStoryXScene,
  STORY_KIND: STORYX_KIND,
  STORYX_VIDEO_TYPE,
} = require("./optiqStoryX/pipeline");

/** True when a project belongs to the story sandbox rather than the ad swarm. */
const isStoryFilm = (videoType) => videoType === STORY_VIDEO_TYPE;
/** True when a project belongs to the documentary sandbox. */
const isDocumentaryFilm = (videoType) => videoType === DOCUMENTARY_VIDEO_TYPE;
/**
 * True for the EXPERIMENTAL long-form story — the only film type that is
 * photographed before it is filmed, and the only one that stops for approval
 * between its stages.
 */
const isStoryXFilm = (videoType) => videoType === STORYX_VIDEO_TYPE;

/**
 * Which box builds, revises and talks about a film. One lookup, used everywhere
 * below, so a fifth kind is a line here rather than a hunt through the file.
 */
function filmSandbox(videoType) {
  if (isStoryXFilm(videoType)) return "story-x";
  if (isDocumentaryFilm(videoType)) return "documentary";
  if (isStoryFilm(videoType)) return "story";
  return "ads";
}

exports.storyGenerate = onRequest(
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 540, memory: "512MiB" },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      await requireAuth(req);
      const {
        prompt, length, brandName, product,
        characterName, characterDesc, logo, materials, aspectRatio, videoType,
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
        videoType,
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

      // Which box builds this film. An original story goes to the story sandbox
      // and a documentary to the documentary sandbox; neither ever touches the ad
      // swarm, and everything else runs exactly the code it always has.
      //
      // The EXPERIMENTAL story never arrives here at all — it has its own staged
      // job (storyXBlueprintJobs → shotBoardJobs → render), because it stops for
      // the director's approval between each one. It is listed so that a job that
      // somehow reaches this trigger fails loudly rather than being silently built
      // by the ad swarm.
      const buildFilm =
        {
          "story-x": () => {
            throw new Error(
              "An experimental story cannot be built by storyboardGenerate — it runs as a staged blueprint job. " +
                "See exports.storyXBlueprint."
            );
          },
          documentary: runOptiqDocumentaryPipeline,
          story: runOptiqStoryPipeline,
          ads: runOptiqSkillsPipeline,
        }[filmSandbox(job.videoType)];
      const storyboard = await buildFilm({
        vertexFetch,
        prompt: job.prompt,
        length: job.length,
        // Ignored by the story pipeline, which has no brand and no product.
        brandName: job.brandName,
        product: job.product,
        aspectRatio: job.aspectRatio,
        videoType: job.videoType,
        logo,
        materials,
        // Seeds the per-film casting palette. Keyed on the project so a retry
        // re-casts the same people instead of swapping the lead's face on the
        // director halfway through a film.
        castingSeed: job.projectId,

        // ── Character reference sheets ────────────────────────────────────────
        // Injected because every Vertex media call lives here. A failure inside
        // either of these degrades the film to text-only consistency rather than
        // sinking the generation — see the note in optiqSkills/characterRefs.js.
        generateImage: async (prompt) => {
          const response = await vertexFetch(
            `/publishers/google/models/gemini-3.1-flash-image:generateContent`,
            {
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
                // Portrait: a full-length standing figure wastes most of a
                // landscape frame, and the face is what has to survive.
                imageConfig: { aspectRatio: "3:4" },
              },
            }
          );
          const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
          if (!part?.inlineData?.data) throw new Error("the image model returned no image");
          return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
        },
        storeImage: async (id, base64, mimeType) => {
          const ext = String(mimeType).includes("jpeg") ? "jpg" : "png";
          // Alongside the project's other materials, and marked shared so the
          // generation-delete sweep never removes them.
          const path = `users/${job.uid}/projects/${job.projectId}/characters/${id}.${ext}`;
          const url = await uploadBase64(base64, path, mimeType);
          return { path, url };
        },
        onStage: (stage, meta) => setStage(stage, meta ? { pipelineProgress: meta } : {}),
      });

      // Seed per-scene render status (idle) and per-scene reference images
      // (every uploaded brand image rides along on every scene by default).
      const videoStatus = {};
      storyboard.scenes.forEach((_, idx) => {
        videoStatus[idx] = { status: "idle", revisionInput: "", customPrompt: "" };
      });
      // Per-scene reference images.
      //
      // This used to attach EVERY uploaded image to EVERY scene, which put the
      // product in scenes it isn't in and invited the logo into every frame. Now
      // each scene gets only what belongs to it: the character sheets for the
      // people actually in it, plus the uploads the swarm placed there.
      //
      // `materials` is the list the swarm was given, in the same order its
      // placement indexes refer to; `job.materialPaths` is the persisted twin.
      const imageMaterials = (job.materialPaths || []).filter((m) => (m.mimeType || "").startsWith("image/"));
      const placement = storyboard.materialPlacement || {};
      const refs = storyboard.characterRefs || [];
      const sceneImages = {};

      storyboard.scenes.forEach((_, idx) => {
        const attached = [];

        // The people in this scene. `scenes` is 1-based on the ref.
        for (const ref of refs) {
          if (!ref.url || !(ref.scenes || []).includes(idx + 1)) continue;
          attached.push({
            name: `${ref.name} — character reference`,
            path: ref.path,
            url: ref.url,
            mimeType: ref.mimeType || "image/png",
          });
        }

        // The director's uploads the swarm placed on this scene.
        for (const materialIndex of placement[idx] || placement[String(idx)] || []) {
          const material = imageMaterials[Number(materialIndex)];
          if (!material) continue;
          attached.push({
            name: material.name,
            path: material.path,
            url: material.url,
            mimeType: material.mimeType,
          });
        }

        if (attached.length > 0) sceneImages[idx] = attached;
      });

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
        isDocumentary: storyboard.isDocumentary ?? null,
        // Echoed back from the pipeline so the stored project records the kind
        // the swarm actually built, not just the kind the wizard asked for.
        videoType: storyboard.videoType ?? null,
        castingShape: storyboard.castingShape ?? null,
        // The rendered character sheets. Kept on the project so the script editor
        // can show them, the agent can read them, and a re-render of one scene
        // still gets the same faces.
        characterRefs: storyboard.characterRefs ?? [],
        storyArc: storyboard.storyArc ?? null,
        // Story-sandbox extras. Absent on ads, which is why they are nullable:
        // the story agent and the script editor read them to keep a film's spine
        // in view while it is being reworked.
        whatIsAtStake: storyboard.whatIsAtStake ?? null,
        theEnding: storyboard.theEnding ?? null,
        // Documentary-sandbox extras, absent on every other kind. `thesis` and
        // `theClose` are the film's spine; `narrationScript` is the film's WORDS,
        // written by the outline skill and read back by audio post — which is why
        // it is persisted rather than left to be re-derived from the pictures.
        thesis: storyboard.thesis ?? null,
        theClose: storyboard.theClose ?? null,
        narratorNote: storyboard.narratorNote ?? null,
        narrationScript: storyboard.narrationScript ?? null,
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

// ─── STAGE 1 — THE BLUEPRINT (experimental original story only) ──────────────
//
// The other three film types run one job that ends at "ready" and then the
// director renders. This one runs THREE stages with a human gate between each,
// and this is the first: the storyline, the cast registry with its locked voice
// profiles, every scene's full script, and the plan of the world the film will be
// photographed in.
//
// It spends TEXT ONLY. No image, no clip, nothing that costs more than tokens —
// because this is the screen where the director decides whether to buy the film
// at all, and a stage that quietly renders pictures first has charged them for a
// decision they have not made yet.
//
// RESUMABLE, and it has to be. Thirty scenes of 2,000 words do not fit in one
// 540s invocation. The pass builds what it can, saves it, and enqueues a
// continuation for the rest; the continuation reuses the storyline and registry
// verbatim so the film cannot change identity halfway through being written.
// Same shape as the shot board's continuation, for the same reason.
const BLUEPRINT_MAX_PASSES = 8;

exports.storyXBlueprint = onDocumentCreated(
  { document: "storyXBlueprintJobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "512MiB", maxInstances: 10 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    if (!job || !job.projectId) return;

    const jobRef = snap.ref;
    const projectRef = db.collection("projects").doc(job.projectId);

    // Same claim transaction as storyboardGenerate: an at-least-once Eventarc
    // delivery must not run two passes over one project at the same time, which
    // would have them both writing scenes and each overwriting the other's.
    const claimed = await db.runTransaction(async (tx) => {
      const d = await tx.get(jobRef);
      if (d.exists && (d.data().status || "queued") === "queued") {
        tx.update(jobRef, { status: "running", startedAt: new Date().toISOString() });
        return true;
      }
      return false;
    });
    if (!claimed) {
      console.log(`[blueprint ${job.projectId}] job not in 'queued' state, skipping`);
      return;
    }

    const pass = Number(job.pass) || 1;
    const setStage = async (stage, extra = {}) => {
      await projectRef.update({
        pipelineStage: stage,
        pipelineError: null,
        updatedAt: new Date().toISOString(),
        ...extra,
      });
    };

    try {
      await setStage(pass === 1 ? "analyzing" : "building");

      // What earlier passes finished. Read fresh rather than carried on the job:
      // the director may have talked to the agent between passes, and the film on
      // the project doc is the one they have been reading.
      const projectSnap = await projectRef.get();
      const project = projectSnap.exists ? projectSnap.data() : {};
      const previous = pass > 1 ? project.blueprint || null : null;

      const blueprint = await runOptiqStoryXBlueprint({
        vertexFetch,
        prompt: job.prompt,
        length: job.length,
        aspectRatio: job.aspectRatio,
        castingSeed: job.projectId,
        previous: previous
          ? {
              ...previous,
              scenes: project.scenes || [],
              // Reused verbatim by a continuation, for the same reason the
              // storyline and the registry are: a pass that re-designed the
              // rooms would put scenes 16–30 somewhere other than scenes 1–15.
              locations: project.locations || null,
            }
          : null,
        onStage: (stage, meta) => setStage(stage, meta ? { pipelineProgress: meta } : {}),
      });

      // Every scene starts idle. Rebuilt from the blueprint each pass rather than
      // merged, so a scene that only just arrived gets a status too — but a scene
      // the director has already rendered keeps the one it has.
      const videoStatus = { ...(project.videoStatus || {}) };
      blueprint.scenes.forEach((_, idx) => {
        if (!videoStatus[idx]) videoStatus[idx] = { status: "idle" };
      });

      const more = !blueprint.done && pass < BLUEPRINT_MAX_PASSES;

      await projectRef.update(stripUndefined({
        title: blueprint.title,
        concept: blueprint.concept,
        scenes: blueprint.scenes,
        styleHeader: blueprint.styleHeader || "",
        characterLock: blueprint.characterLock || { name: "", description: "", wardrobe: "" },
        isStory: true,
        videoType: blueprint.videoType ?? null,
        castingShape: blueprint.castingShape ?? null,
        // ALWAYS EMPTY on this film type. It renders text-to-video and attaches
        // no picture to any clip — see the classifier note at the top of
        // optiqStoryX/pipeline.js. Written rather than omitted so a project that
        // was built under the old photographed pipeline is CLEARED of its cast
        // sheets when it is rebuilt, instead of keeping stale references to
        // images nothing will ever attach.
        characterRefs: [],
        storyArc: blueprint.storyArc ?? null,
        whatIsAtStake: blueprint.whatIsAtStake ?? null,
        theEnding: blueprint.theEnding ?? null,
        musicSpec: blueprint.musicSpec ?? null,
        ambienceSpec: blueprint.ambienceSpec ?? null,
        videoStatus,
        // NOTHING is ever attached to a render on this film type. Not a cast
        // sheet, not a plate, not a frame: the prompt is the whole film. Seeded
        // empty and never filled.
        sceneImages: {},
        /**
         * THE LOCATION BIBLE — every place in the film, written once at 500–700
         * words for every scene set there to paste verbatim. This is what
         * replaced the shot board's world plan, and it is the reason the rooms
         * hold still without being photographed. Read by the blueprint screen so
         * the director can see the rooms before approving the film.
         */
        locations: blueprint.locations ?? null,
        // The shot board is GONE from this film type. Cleared rather than left
        // alone so a project built under the old photographed pipeline stops
        // advertising a board to the client, which would otherwise hold it at a
        // gate that no longer exists and attach frames nothing will render from.
        shotBoard: null,
        shotBoardStage: null,
        shotBoardProgress: null,
        shotBoardError: null,
        /**
         * The film's spine, kept so a continuation reuses it rather than
         * re-deciding what film this is. Not read by the client.
         */
        blueprint: {
          brief: blueprint.brief ?? null,
          storyline: blueprint.storyline ?? null,
          registry: blueprint.registry ?? null,
        },
        // The gate. "blueprint-ready" is a TERMINAL stage: nothing runs after it
        // until the director presses Continue, which now starts RENDERING rather
        // than photographing — there is no board stage any more.
        pipelineStage: more ? "building" : "blueprint-ready",
        pipelineError: more
          ? null
          : blueprint.missing.length
            ? `${blueprint.missing.length} scene(s) could not be written: ${blueprint.missing.join(", ")}. ` +
              `Everything else is ready to read.`
            : null,
        pipelineProgress: more ? { scenesDone: blueprint.scenes.length, scenesTotal: blueprint.scenes.length + blueprint.missing.length } : null,
        updatedAt: new Date().toISOString(),
      }));

      await jobRef.update({ status: "done", finishedAt: new Date().toISOString() });

      if (more) {
        console.log(
          `[blueprint ${job.projectId}] pass ${pass} done, ${blueprint.missing.length} scene(s) left; continuing`
        );
        await db.collection("storyXBlueprintJobs").add({
          ...job,
          pass: pass + 1,
          status: "queued",
          createdAt: new Date().toISOString(),
        });
      } else {
        console.log(
          `[blueprint ${job.projectId}] ready to read after ${pass} pass(es) — ` +
            `${blueprint.scenes.length} scene(s), ${(blueprint.locations?.locations || []).length} location block(s)`
        );
      }
    } catch (err) {
      console.error(`[blueprint ${job.projectId}] failed:`, err);
      await projectRef
        .update({
          pipelineStage: "failed",
          pipelineError: err.message || "The blueprint could not be written",
          updatedAt: new Date().toISOString(),
        })
        .catch(() => {});
      await jobRef.update({ status: "failed", error: err.message || "failed" }).catch(() => {});
    }
  }
);

exports.storyRevise = onRequest(
  // Longer timeout so a per-minute quota wait (in vertexFetch) can finish inside the request.
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 240 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      await requireAuth(req);
      const {
        scenePrompt, revisionRequest, characterLock, styleHeader,
        previousScenePrompt, nextScenePrompt, musicSpec, videoType, narration,
      } = req.body;
      if (!scenePrompt || !revisionRequest) return res.status(400).json({ error: "Missing prompt or request" });

      // Each sandbox revises its own films. The story reviser knows there is
      // nothing to sell; the documentary reviser also knows nobody speaks and
      // refuses to write dialogue, captions or a brand back in. Every other kind
      // of film goes through the ad swarm's reviser, unchanged.
      const sandbox = filmSandbox(videoType);
      const revisedPrompt = sandbox === "documentary"
        ? await reviseDocumentaryScene({
            vertexFetch,
            scenePrompt,
            revisionRequest,
            characterLock,
            styleHeader,
            previousScenePrompt,
            nextScenePrompt,
            musicSpec,
            narration,
          })
        : sandbox === "story"
        ? await reviseStoryScene({
            vertexFetch,
            scenePrompt,
            revisionRequest,
            characterLock,
            styleHeader,
            previousScenePrompt,
            nextScenePrompt,
            musicSpec,
          })
        : sandbox === "story-x"
        ? // The experimental reviser is its own twin. It also has to survive the
          // shot-board clause: a photographed scene's prompt carries a block
          // naming its attached frames, and a reviser that has never seen one
          // deletes it — which silently unhooks the scene from its pictures. So
          // the clause is lifted out before revision and restored after.
          await (async () => {
            const brain = require("./optiqStoryX/shotBoard");
            const clause = brain.extractShotBoardClause(scenePrompt);
            const revised = await reviseStoryXScene({
              vertexFetch,
              scenePrompt: brain.stripShotBoardClause(scenePrompt),
              revisionRequest,
              characterLock,
              styleHeader,
              previousScenePrompt,
              nextScenePrompt,
              musicSpec,
            });
            return brain.restoreShotBoardClause(revised, clause);
          })()
        : await reviseScene({
            vertexFetch,
            scenePrompt,
            revisionRequest,
            characterLock,
            styleHeader,
            previousScenePrompt,
            nextScenePrompt,
            musicSpec,
            videoType,
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
// The story sandbox's own agent — same loop and the same tool names, but its
// system prompt knows the film sells nothing and its tools refuse to write a
// brand back in. Aliased on import so the three never shadow each other.
const { runStorylineAgent: runStoryAgent } = require("./optiqStory/agent");
// And the documentary sandbox's, which additionally knows nobody speaks on
// camera and can rewrite the film's narration — the one edit that changes what
// a documentary says without costing a render.
const { runDocumentaryAgent } = require("./optiqDocumentary/agent");
// The experimental story's, which knows the film runs in three approved stages
// and that a rewrite after stage 2 costs pictures as well as words.
const { runStoryXAgent } = require("./optiqStoryX/agent");

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
      //
      // Filtered to THIS conversation. A film can have several, and carrying all
      // of them in would have the agent answering as if two unrelated
      // discussions were one. Messages written before threads existed have no
      // threadId and belong to "main", which is what the client calls the
      // original conversation. Filtered in memory rather than with a `where`, so
      // no composite index is needed — hence the larger fetch.
      const threadId = job.threadId || "main";
      const historySnap = await projectRef
        .collection("agentChat")
        .orderBy("createdAt", "desc")
        .limit(AGENT_HISTORY_LIMIT * 4)
        .get();
      const history = historySnap.docs
        .filter(
          (d) =>
            d.id !== job.replyTo &&
            (d.data().threadId || "main") === threadId &&
            (d.data().text || "").trim()
        )
        .slice(0, AGENT_HISTORY_LIMIT)
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

      // Which agent is on the other end of this chat. Decided per project, so a
      // director working on a story talks to the story agent, one working on a
      // documentary talks to the documentary agent, and one working on an ad
      // talks to exactly the agent they always have.
      const runAgent = {
        "story-x": runStoryXAgent,
        documentary: runDocumentaryAgent,
        story: runStoryAgent,
        ads: runStorylineAgent,
      }[filmSandbox(project.videoType)];
      const result = await runAgent({
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

        // ── Production powers ────────────────────────────────────────────────
        // Injected rather than implemented in the tool server, because both of
        // these spend the director's money and the charging rules must live in
        // exactly one place — beside videoGenerate, which they mirror.

        /** Shoot one scene. Mirrors videoGenerate's prepaid-then-charge path. */
        renderScene: async (sceneIndex, prompt) => {
          // Every storyboard scene is a 10s clip, and "omni" is the model key
          // videoGenerate defaults to — both must match that path or the price
          // the agent quotes won't be the price that gets charged.
          const duration = 10;
          const model = "omni";
          let cost = videoCost(model, duration);

          // The ad is one price: the storyboard payment bought one render of
          // every scene, so draw on that allowance first. Decremented in a
          // transaction so only what was actually paid for can be consumed.
          const usedPrepaid = await db
            .runTransaction(async (tx) => {
              const snap = await tx.get(projectRef);
              if (!snap.exists) return false;
              const data = snap.data();
              if (data.uid !== job.uid) return false;
              const remaining = Number(data.prepaidRenders) || 0;
              if (remaining <= 0) return false;
              tx.update(projectRef, { prepaidRenders: remaining - 1 });
              return true;
            })
            .catch((err) => {
              console.error(`[agent ${job.projectId}] prepaid check failed:`, err.message);
              return false;
            });

          if (usedPrepaid) cost = 0;
          else await chargeCredits(job.uid, cost, `Video clip (${duration}s, from the agent)`);

          // The same stills the editor's render button attaches, so this path and
          // the client's cannot drift apart — they must attach the same thing or
          // the same scene comes out differently depending on which button shot
          // it.
          //
          // AN EXPERIMENTAL STORY ATTACHES NOTHING, structurally rather than by
          // happening to have an empty sceneImages. It renders text-to-video and
          // nothing may ride along — and this branch is what makes that true for
          // a project built during the photographed era as well, whose document
          // still carries a `shotBoard` full of frames that renderAttachments
          // would otherwise happily hand to the video model.
          const attachments = isStoryXFilm(project.videoType)
            ? []
            : require("./shotBoardRun")
                .renderAttachments(project, sceneIndex)
                .filter((img) => img.path);

          const genRef = db.collection("generations").doc();
          await genRef.set({
            uid: job.uid,
            type: "video",
            // Born QUEUED, like every other render — see THE VIDEO QUEUE. The
            // agent's own renders wait in the same line as the editor's.
            status: "queued",
            prompt,
            model,
            cost,
            durationSeconds: duration,
            aspectRatio: project.aspectRatio || "16:9",
            // `shared` keeps the generation-delete sweep away from files that
            // live on the project rather than on this generation.
            images: attachments.map((img) => ({
              path: img.path,
              mimeType: img.mimeType || "image/png",
              shared: true,
            })),
            // Lets processVideoGeneration hand the allowance back if the render
            // fails, so a failure never quietly costs a paid-for scene.
            prepaidProjectId: usedPrepaid ? job.projectId : null,
            // The link the cascade delete follows — see videoGenerate.
            projectId: job.projectId || null,
            createdAt: new Date().toISOString(),
          });

          // Mark the scene as rendering so the script editor and the timeline
          // show it immediately, exactly as pressing render there would.
          const videoStatus = { ...(project.videoStatus || {}) };
          videoStatus[sceneIndex] = {
            ...(videoStatus[sceneIndex] || {}),
            status: "rendering",
            id: genRef.id,
            error: null,
          };
          project.videoStatus = videoStatus;
          await projectRef.update({ videoStatus, updatedAt: new Date().toISOString() });

          return { id: genRef.id, cost, usedPrepaid };
        },

        /** Re-run audio post-production, optionally steering the new score. */
        rescoreFilm: async (vibe) => {
          await projectRef.update({
            audioStage: "queued",
            audioError: null,
            updatedAt: new Date().toISOString(),
          });
          await db.collection("audioPostJobs").add({
            uid: job.uid,
            projectId: job.projectId,
            // Threaded into the Lyria prompt so "warmer and slower" actually
            // reaches the composer.
            scoreNote: vibe || null,
            status: "queued",
            createdAt: new Date().toISOString(),
          });
        },

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


exports.projectCompile = onRequest(
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 540, memory: "1GiB" },
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

      // The output frame is the ad's own shape. This used to be a hardcoded
      // `scale=1280:720`, which forced a vertical ad into a landscape frame AND
      // distorted it doing so (a bare scale ignores the source ratio entirely).
      // Reading the project's stored orientation is what makes a 9:16 ad compile
      // as 720×1280.
      const { canvasForAspect } = require("./editorEngine");
      const projectSnap = await projectRef.get();
      const canvas = canvasForAspect(projectSnap.get("aspectRatio"));

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
            // force_original_aspect_ratio + pad, never a bare scale: a clip is
            // fitted into the frame, never stretched to fill it. When the clip
            // already matches the ad's shape (the normal case) nothing is padded.
            const trimCmd = `ffmpeg -y -ss ${trimStart} -t ${duration} -i "${srcPath}" -c:v libx264 -preset superfast -crf 23 -c:a aac -vf "scale=${canvas.width}:${canvas.height}:force_original_aspect_ratio=decrease,pad=${canvas.width}:${canvas.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30" -ar 44100 -ac 2 "${trimmedPath}"`;
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
  { region: "us-east4", cors: true, maxInstances: 2, timeoutSeconds: 540, memory: "2GiB", cpu: 2 },
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

// ─── AUDIO POST-PRODUCTION ──────────────────────────────────────────────────
//
// Scores and narrates a finished cut: measure every clip, watch each one, write
// narration to the gaps it found, speak it, refit anything that overran, compose
// the score with Lyria, cut it to the film's exact length, and lay the whole lot
// onto the project's editorDoc so it exports through the normal render path.
//
// A Firestore trigger rather than a request: the pass takes minutes (a Lyria
// composition alone is 55-75s) and it has to survive the director closing the
// tab. Streams `audioStage` to the project doc so the UI can follow it.
//
// us-central1 to match the other Firestore triggers in this project; ffmpeg and
// ffprobe come from the runtime image, not the region, so the probes work here
// exactly as they do in renderJobV2.
exports.audioPost = onDocumentCreated(
  { document: "audioPostJobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "1GiB", maxInstances: 5 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    if (!job || !job.projectId || !job.uid) return;

    const jobRef = snap.ref;
    const projectRef = db.collection("projects").doc(job.projectId);

    // Claim it, so a retried delivery cannot score the same film twice.
    const claimed = await db.runTransaction(async (tx) => {
      const d = await tx.get(jobRef);
      if (d.exists && (d.data().status || "queued") === "queued") {
        tx.update(jobRef, { status: "running", startedAt: new Date().toISOString() });
        return true;
      }
      return false;
    });
    if (!claimed) {
      console.log(`[audio ${job.projectId}] job not queued, skipping`);
      return;
    }

    const setStage = async (stage, extra = {}) => {
      await projectRef
        .update({ audioStage: stage, audioError: null, updatedAt: new Date().toISOString(), ...extra })
        .catch(() => {});
    };

    try {
      const psnap = await projectRef.get();
      if (!psnap.exists) throw new Error("Project not found");
      const project = { id: job.projectId, ...psnap.data() };
      if (project.uid !== job.uid) throw new Error("Not your project");

      const { runAudioPost } = require("./audioPost");
      const audioPlan = require("./audioPlan");
      const { canvasForAspect } = require("./editorEngine");
      const { filmKind } = require("./optiqSkills/pipeline");
      // Field names the editor owns — see lib/editor/persistence.ts.
      const EDITOR_DOC_FIELD = "editorDoc";
      const EDITOR_DOC_REV_FIELD = "editorDocRev";

      const report = await runAudioPost({
        vertexFetch,
        ttsGenerate,
        lyriaGenerate,
        uploadBase64,
        runCapture: require("./mediaProbe").runCapture,
        fetchVideoBase64: async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`Could not fetch clip (${res.status})`);
          const buf = Buffer.from(await res.arrayBuffer());
          return { base64: buf.toString("base64"), mimeType: res.headers.get("content-type") || "video/mp4" };
        },
        plan: audioPlan,
        engineApi: { canvasForAspect, EDITOR_DOC_FIELD, EDITOR_DOC_REV_FIELD },
        project,
        projectId: job.projectId,
        // Audio post reads four fields off this: the noun it calls the film in
        // the Lyria prompt, whether the footage carries speech (footage gain),
        // whether a voiceover has to be written, and — for a documentary —
        // whether that voiceover was ALREADY WRITTEN by the swarm. A story is a
        // talking film with no narration and a documentary is a silent film whose
        // words already exist; `filmKind` cannot resolve either id, because they
        // belong to the other boxes, so each sandbox supplies its own.
        filmKind: {
          "story-x": STORYX_KIND,
          documentary: DOCUMENTARY_KIND,
          story: STORY_KIND,
          ads: filmKind(project.videoType),
        }[filmSandbox(project.videoType)],
        // The pass runs for minutes. This is how it sees the project as it is by
        // the time it has something to place, instead of laying the score onto a
        // snapshot taken before any of the work happened.
        reloadProject: async () => {
          const s = await projectRef.get();
          return s.exists ? { id: job.projectId, ...s.data() } : null;
        },
        // Set when the agent's rescore_film tool started this pass, carrying the
        // director's own words about how the score should feel.
        scoreNote: job.scoreNote || null,
        onStage: (stage, meta) => setStage(stage, meta ? { audioProgress: meta } : {}),
      });

      // The document is the deliverable: written with a bumped revision so an
      // open editor's autosaver adopts it (see EditorAutosaver.onRemote) rather
      // than treating it as its own echo.
      await projectRef.update(
        stripUndefined({
          [EDITOR_DOC_FIELD]: report.editorDoc,
          [EDITOR_DOC_REV_FIELD]: report.editorDocRev,
          musicUrl: report.music?.url ?? null,
          audioStage: "ready",
          audioError: null,
          audioProgress: null,
          audioReport: {
            filmDuration: report.film?.duration ?? null,
            narrationLines: report.narration.length,
            musicSegments: report.music?.segments ?? 0,
            musicLoops: report.music?.loops ?? 0,
            voice: report.voice?.describe ?? null,
            violations: report.violations,
            notes: report.notes,
            at: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        })
      );
      await jobRef.update({ status: "done", finishedAt: new Date().toISOString() });
      console.log(
        `[audio ${job.projectId}] ready — ${report.narration.length} line(s), ` +
          `${report.music?.segments ?? 0} music segment(s), ${report.violations.length} issue(s)`
      );
    } catch (err) {
      console.error(`[audio ${job.projectId}] failed:`, err);
      await projectRef
        .update({
          audioStage: "failed",
          audioError: err.message || "Audio post-production failed",
          audioProgress: null,
          updatedAt: new Date().toISOString(),
        })
        .catch(() => {});
      await jobRef
        .update({ status: "failed", error: err.message || "failed", finishedAt: new Date().toISOString() })
        .catch(() => {});
    }
  }
);

// ─── STAGE 2 — THE SHOT BOARD (experimental original story only) ─────────────
//
// Photographs a film before it is filmed: a plate for every place, for every
// dressed arrangement inside it, for every object whose look must not change, and
// one frame per camera setup inside every scene — each tier generated FROM the
// picture of the tier above. Those frames are then the ONLY thing the video model
// is shown. See functions/shotBoardRun.js for the machinery and
// optiqStoryX/shotBoard.js for the doctrine.
//
// NEVER RUNS AUTOMATICALLY. It is enqueued by the director pressing Continue on
// the blueprint, because at ~100+ pictures it is the first stage that costs real
// money and the whole point of the gate is that they saw what they were buying.
//
// SELF-CONTINUING. A 30-scene film is well over a hundred pictures against an
// 8/minute image quota (vertexQuota DEFAULT_CAPS), which is 15–25 minutes and
// does not fit in one 540s invocation. So the run takes a soft deadline, stops
// cleanly when it reaches it, and enqueues its own continuation — which reuses
// every plate and frame already made and only builds what is missing. `attempt`
// is the loop guard: past this many passes something is wrong and looping further
// only spends money.
// The ceiling exists to stop a loop that is going nowhere from spending money
// forever. Ten was that number when a pass could be expected to photograph most
// of a film — but the real per-minute image quota on this project delivers
// roughly fourteen frames inside a seven-minute pass, and a thirty-scene film is
// about a hundred and thirty frames. Ten passes cannot finish one, so the guard
// was firing on films that were progressing perfectly well and leaving them
// half-photographed.
//
// Raised, and paired with the check below that actually expresses the intent: a
// pass that achieves NOTHING stops the loop immediately, whatever the count. A
// film that is still making pictures is allowed to carry on.
const SHOT_BOARD_MAX_ATTEMPTS = 30;

/**
 * Passes allowed to finish without a single frame before we call it stuck.
 *
 * Not zero, because the first pass or two of a long film legitimately spend all
 * their time on the world bible and the shot designs — real, stored, necessary
 * work that produces no photographs of its own.
 */
const SHOT_BOARD_BARREN_PASSES = 2;

/**
 * Which image model photographs the film.
 *
 * `gemini-3.1-flash-image` — the director's own call, and the right one for this
 * film type: at 100–160 pictures per film the pro tier's 25–40s each is 40+
 * extra minutes of waiting per generation, and the flash tier is what already
 * renders every character sheet on this platform today (see
 * storyboardGenerate's generateImage, and [[vertex-model-ids]]).
 *
 * The known trade is legibility of text INSIDE a picture — a letterhead on a
 * document plate, a phone screen. If a film turns on a readable prop, override
 * with SHOT_FRAME_MODEL=gemini-3-pro-image for that run rather than changing the
 * default for every film.
 */
const SHOT_FRAME_MODEL = process.env.SHOT_FRAME_MODEL || "gemini-3.1-flash-image";

exports.shotBoard = onDocumentCreated(
  { document: "shotBoardJobs/{jobId}", region: "us-central1", timeoutSeconds: 540, memory: "1GiB", maxInstances: 5 },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const job = snap.data();
    if (!job || !job.projectId || !job.uid) return;

    const jobRef = snap.ref;
    const projectRef = db.collection("projects").doc(job.projectId);
    const attempt = Number(job.attempt) || 1;

    const claimed = await db.runTransaction(async (tx) => {
      const d = await tx.get(jobRef);
      if (d.exists && (d.data().status || "queued") === "queued") {
        tx.update(jobRef, { status: "running", startedAt: new Date().toISOString() });
        return true;
      }
      return false;
    });
    if (!claimed) {
      console.log(`[shotboard ${job.projectId}] job not queued, skipping`);
      return;
    }

    const setStage = async (stage, extra = {}) => {
      await projectRef
        .update({ shotBoardStage: stage, shotBoardError: null, updatedAt: new Date().toISOString(), ...extra })
        .catch(() => {});
    };

    // Re-stamped on every pass, not just the first, so the client's staleness
    // ceiling only ever has to cover ONE invocation — a long film that takes
    // six passes must not look stranded three passes in.
    await setStage("designing", { shotBoardStartedAt: new Date().toISOString() });

    try {
      const psnap = await projectRef.get();
      if (!psnap.exists) throw new Error("Project not found");
      const project = { id: job.projectId, ...psnap.data() };
      if (project.uid !== job.uid) throw new Error("Not your project");
      if (!project.scenes?.length) throw new Error("This film has no scenes yet");

      // ── THE BOARD IS RETIRED. NOTHING ROUTES HERE ANY MORE. ────────────────
      //
      // The experimental original story was the only film type that was ever
      // photographed, and it is now rendered purely from text. See the header of
      // functions/optiqStoryX/pipeline.js for the three reasons; the decisive one
      // is that attaching a photorealistic face to a render of that person under
      // arrest, in a cell or in handcuffs reads to the classifier as a real
      // person defamed, and is refused silently while still being billed.
      //
      // The trigger and functions/shotBoardRun.js are LEFT IN PLACE rather than
      // deleted: this sandbox has reversed itself on photography before, and the
      // machinery plus the doctrine that argues for it is worth more on disk than
      // in the history. But nothing may enqueue a job here, so anything that
      // still does fails loudly and immediately — before it spends a hundred
      // images photographing a film that will never attach them.
      // Thrown rather than returned so the catch below does the usual thing:
      // marks the project's board stage failed with a readable reason and closes
      // the job. A silent return would leave a queued job "running" forever.
      throw new Error(
        "The shot board is retired. Films are rendered from their prompts now — nothing is photographed " +
          "and nothing is attached to a render. See functions/optiqStoryX/pipeline.js."
      );

      /* eslint-disable no-unreachable */
      // EVERYTHING BELOW THIS LINE IS UNREACHABLE, and kept deliberately — it is
      // the working board runner, intact, one deleted `throw` away from running
      // again. Read the note above before deleting it or reviving it.

      const brain = require("./optiqStoryX/shotBoard");
      const { runShotBoard } = require("./shotBoardRun");

      // Leave two minutes of the invocation for the writes below plus whatever
      // image call is in flight when the deadline lands.
      const deadlineAt = Date.now() + 7 * 60 * 1000;

      /**
       * One picture from the image model.
       *
       * The error it throws carries WHY, and that matters more than it looks:
       * the runner classifies transient failures (wait and ask again) apart from
       * refusals (rewrite the prompt, then ask again), and it can only tell them
       * apart from what is in this message. A bare "no image" would send every
       * refusal into a retry loop that asks the same forbidden question four
       * times and pays for it each time.
       */
      const generateImage = async (prompt, { aspectRatio, images } = {}) => {
        const parts = [];
        for (const image of images || []) {
          if (image?.base64) {
            parts.push({ inlineData: { mimeType: image.mimeType || "image/png", data: image.base64 } });
          }
        }
        parts.push({ text: prompt });
        const response = await vertexFetch(`/publishers/google/models/${SHOT_FRAME_MODEL}:generateContent`, {
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
            // Frames, place plates and arrangement plates are shot in the film's
            // own shape — they become video frames, and a 3:4 still handed to a
            // 16:9 render is an instruction to letterbox. Object plates ask 1:1.
            imageConfig: { aspectRatio: aspectRatio || project.aspectRatio || "16:9" },
          },
        });
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.find((p) => p.inlineData);
        if (!part?.inlineData?.data) {
          const finish = candidate?.finishReason || "none";
          const block = response.promptFeedback?.blockReason || "";
          const blockedRatings = (candidate?.safetyRatings || [])
            .filter((r) => r.blocked)
            .map((r) => r.category)
            .join(", ");
          // Any text the model returned instead of a picture is usually its own
          // account of why it declined, and it is the most useful thing there is
          // for the rewrite pass.
          const said = (candidate?.content?.parts || [])
            .map((p) => p.text || "")
            .join(" ")
            .trim()
            .slice(0, 300);
          throw new Error(
            `the image model returned no image (finishReason=${finish}` +
              `${block ? `, blockReason=${block}` : ""}` +
              `${blockedRatings ? `, blocked=${blockedRatings}` : ""})` +
              `${said ? ` — it said: ${said}` : ""}`
          );
        }
        return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType || "image/png" };
      };

      const report = await runShotBoard({
        vertexFetch,
        brain,
        project,
        projectId: job.projectId,
        uid: job.uid,
        // Set by a targeted re-roll from the board screen or the agent:
        // { scenes: [0-based], keepDesign: true } re-photographs those scenes
        // without re-cutting them.
        scope: job.scope || null,
        deadlineAt,
        onStage: (stage, meta) => setStage(stage, meta ? { shotBoardProgress: meta } : {}),

        // Every Vertex media call in this project lives in this file, so the
        // runner is handed the four it needs rather than reaching for them.
        generateImage,
        storeImage: async (path, base64, mimeType) => ({
          path,
          url: await uploadBase64(base64, path, mimeType),
        }),
        loadImage: (path) => downloadInputMedia(path),

        // Photographs a character sheet. On this film type it does DOUBLE DUTY:
        // it re-takes a sheet whose stored file has gone missing, and it takes the
        // ones that never existed — the blueprint stage deliberately writes only
        // the PLAN, so every sheet is created here, on the far side of the gate,
        // the first time a frame needs it.
        regenerateCharacterRef: async (ref) => {
          const refBrain = require("./optiqStoryX/characterRefs");
          const image = await generateImage(refBrain.characterRefPrompt(ref), { aspectRatio: "3:4" });
          const ext = String(image.mimeType).includes("jpeg") ? "jpg" : "png";
          // A fresh path, never the old one: Storage caches generated media
          // immutably, so re-using the missing file's path can serve the miss.
          const path = `users/${job.uid}/projects/${job.projectId}/characters/${
            ref.id || "char"
          }-${Date.now().toString(36)}.${ext}`;
          const url = await uploadBase64(image.base64, path, image.mimeType);
          return { path, url, base64: image.base64, mimeType: image.mimeType };
        },
      });

      // Re-read before writing. The board takes minutes, and in that time the
      // agent or the director may have rewritten a scene — so the clause is
      // appended to the prompt as it is NOW, not as it was when the run started.
      // applyShotBoardClause strips any previous block first, so this is safe to
      // run over a scene that already carries one.
      const fresh = await projectRef.get();
      const currentScenes = fresh.get("scenes") || project.scenes;
      const { sceneStills } = require("./shotBoardRun");
      const sceneImages = { ...(fresh.get("sceneImages") || {}) };

      const scenes = currentScenes.map((scene, idx) => {
        const entry = report.scenes[idx];
        const frames = (entry?.shots || [])
          .filter((s) => s.url)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        if (frames.length === 0) return scene;

        // The scene's attachments, mirrored onto `sceneImages` so that everything
        // which reads that field — the script editor's reference tray, a render
        // fired from a stale client — sees the frames rather than the character
        // sheets a different film type would have put there.
        const stills = sceneStills(entry);
        if (stills.length > 0) sceneImages[idx] = stills;

        // Both prompts carry the board block, and both need it. The long prompt
        // is the fallback whenever the short one is missing or has been cleared
        // by a revision, and a fallback that renders with frames attached and
        // nothing explaining them is worse than no frames at all.
        const next = { ...scene, fullPrompt: brain.applyShotBoardClause(scene.fullPrompt, frames) };

        // The short prompt a photographed scene actually renders from. Absent
        // when the compressor could not write one that kept every line of
        // dialogue — in which case the scene keeps rendering from the long one,
        // which is correct, just longer-winded.
        const framed = entry?.framedPrompt || "";
        next.framedPrompt = framed ? brain.applyShotBoardClause(framed, frames) : "";
        return next;
      });

      // STOP WHEN A PASS ACHIEVES NOTHING, not when a counter runs out.
      //
      // A pass that photographed a frame — or finished a scene — is making
      // progress, however slowly, and slow is the normal condition here: the
      // real image quota delivers a fraction of what the caps allow, so a long
      // film legitimately takes many passes. Counting them punished exactly the
      // films that were working.
      //
      // A pass that produced no frame at all is the thing worth stopping for,
      // and `barrenPasses` carries that count forward on the job so a run cannot
      // spin indefinitely against a wedged quota or an unphotographable scene.
      // The first passes are exempt: the world bible and the shot designs are
      // real work that produces no photographs.
      const madeProgress = report.framesRendered > 0 || report.completed.length > 0;
      const barrenPasses = madeProgress ? 0 : (Number(job.barrenPasses) || 0) + 1;
      if (!madeProgress) {
        console.warn(
          `[shotboard ${job.projectId}] pass ${attempt} photographed nothing ` +
            `(${barrenPasses}/${SHOT_BOARD_BARREN_PASSES} barren)`
        );
      }
      const more =
        !report.done && attempt < SHOT_BOARD_MAX_ATTEMPTS && barrenPasses <= SHOT_BOARD_BARREN_PASSES;

      await projectRef.update(
        stripUndefined({
          scenes,
          sceneImages,
          shotBoard: {
            // The world bible: the places, the arrangements inside them, the
            // objects, and every state each of those passes through. Usually
            // planned back in stage 1 and reused verbatim here.
            world: report.world,
            // Every photograph, flat, keyed by (tier, thing, state). The tiers
            // are ordered by dependency in shotBoardRun.js, not here.
            plates: report.plates,
            scenes: report.scenes,
            violations: report.violations,
            notes: report.notes,
            // What the run repaired on its own — a refused prompt it rewrote, a
            // stored picture it found missing and re-took. Kept because a
            // pipeline that silently heals itself is one nobody can debug.
            healed: report.healed,
            builtAt: report.builtAt,
          },
          // The character sheets, now that they exist: photographed here rather
          // than in the blueprint, so this write is what first gives them urls.
          ...(report.characterRefs ? { characterRefs: report.characterRefs } : {}),
          // "partial" means some scenes have frames and some do not. On THIS film
          // type that is not a shippable state — an unphotographed scene has
          // nothing to attach and a long prompt written not to describe how
          // anything looks — so the board screen surfaces it with a Retry rather
          // than the film rendering through it.
          shotBoardStage: report.done ? "ready" : more ? "framing" : "partial",
          shotBoardError: null,
          shotBoardProgress: report.done || !more ? null : { queuedForContinuation: report.remaining.length },
          // Server-owned counter, like scriptRevision: the client adopts the
          // rewritten scene prompts when this moves.
          scriptRevision: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        })
      );

      await jobRef.update({ status: "done", finishedAt: new Date().toISOString() });
      const plateCount = (tier) => report.plates.filter((p) => p.tier === tier).length;
      console.log(
        `[shotboard ${job.projectId}] pass ${attempt}: ${report.framesRendered} frame(s), ` +
          `${plateCount("environment") + plateCount("environment-reverse")} place plate(s), ` +
          `${plateCount("setting")} arrangement plate(s), ${plateCount("object")} object plate(s), ` +
          `${Object.keys(report.framedPrompts).length} short prompt(s), ` +
          `${report.remaining.length} scene(s) left`
      );

      if (more) {
        await db.collection("shotBoardJobs").add({
          uid: job.uid,
          projectId: job.projectId,
          attempt: attempt + 1,
          // Carried forward so consecutive barren passes are counted across the
          // chain rather than forgotten at each hand-off — the count is what
          // stops a wedged run, and it resets the moment a frame lands.
          barrenPasses,
          // keepDesign TRUE, and this is not an optimisation — it is what makes a
          // continuation continue.
          //
          // Without it every pass re-cut every scene it had not finished. A
          // 30-scene film spent five to ten minutes of a SEVEN-minute budget
          // re-designing scenes it had already designed, photographed one, ran
          // out of clock, and enqueued a pass that threw that design away and did
          // it again. Ten attempts, seventy minutes, two scenes photographed —
          // with no error anywhere, because nothing had failed.
          //
          // The runner already stores the design for any scene it reached, and
          // says so in the comment above its assemble step: a scene whose
          // pictures all failed still keeps its design, so a continuation can
          // re-shoot the frames without re-cutting the scene. This is the caller
          // finally asking for that. Scenes the earlier pass never reached have
          // no stored design and are cut normally.
          scope: report.remaining.length ? { scenes: report.remaining, keepDesign: true } : null,
          status: "queued",
          createdAt: new Date().toISOString(),
        });
      }
      /* eslint-enable no-unreachable */
    } catch (err) {
      console.error(`[shotboard ${job.projectId}] failed:`, err);
      await projectRef
        .update({
          shotBoardStage: "failed",
          shotBoardError: err.message || "Could not photograph this film",
          shotBoardProgress: null,
          updatedAt: new Date().toISOString(),
        })
        .catch(() => {});
      await jobRef
        .update({ status: "failed", error: err.message || "failed", finishedAt: new Date().toISOString() })
        .catch(() => {});
    }
  }
);

exports.mediaProbe = onRequest(
  { region: "us-east4", cors: true, maxInstances: 3, timeoutSeconds: 120, memory: "1GiB" },
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



