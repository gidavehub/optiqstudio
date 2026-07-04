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

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { GoogleAuth } = require("google-auth-library");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const MODEM_WEBHOOK_SECRET = defineSecret("MODEM_WEBHOOK_SECRET");

const PLAN_CREDITS = 10000;

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
    const secret = MODEM_WEBHOOK_SECRET.value();

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
 * Cloud Function to generate an image using Vertex AI gemini-3.1-flash-image-preview with no fallbacks.
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
      const model = "gemini-3.1-flash-image-preview";

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

      const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
      const model = "gemini-omni-flash-preview";

      console.log(`Starting video generation with model: ${model} using unified GenAI SDK`);
      const ai = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: "global"
      });

      const interaction = await ai.interactions.create({
        model: model,
        input: prompt
      });

      if (interaction && interaction.output_video && interaction.output_video.data) {
        console.log(`Successfully generated video with model: ${model}`);
        return res.status(200).json({
          success: true,
          model: model,
          base64: interaction.output_video.data,
          mimeType: interaction.output_video.mime_type || "video/mp4"
        });
      } else {
        throw new Error("No video data in interaction response");
      }
    } catch (error) {
      console.error("generateVideo error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
);

