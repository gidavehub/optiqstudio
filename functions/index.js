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
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { GoogleAuth } = require("google-auth-library");
const { GoogleGenAI } = require("@google/genai");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();
const rtdb = admin.database();

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
      videoPerSecond: { omni: 30, "omni-fast": 15 },
      image: 50,
      ttsPer100Chars: 10,
      ttsMinimum: 15,
      characterSheet: 150,
    }
  };
  try {
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

      const { kind, packId, planId } = req.body;
      const appUrl = "https://optiq.studio"; // Production URL!

      const pricing = await getPricing();
      const PLANS = pricing.plans;
      const CREDIT_PACKS = pricing.packs;

      let amount;
      let title;
      let credits;
      let selectedPlanId = "pro-monthly";

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
  const token = await getAccessToken();
  const projectId = "davelabs-tools";
  let url;
  if (path.includes("gemini-3.1-flash-image-preview") || path.includes("gemini-omni-flash-preview") || path.includes("gemini-2.5-flash")) {
    url = `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/global${path}`;
  } else {
    url = `https://us-east4-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-east4${path}`;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vertex AI ${path} failed (${res.status}): ${text}`);
  }
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
  });
  return `https://storage.googleapis.com/${STORAGE_BUCKET}/${path}`;
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
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 60 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      await requireAuth(req);
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const textModel = "gemini-2.5-flash";
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
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 120 },
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

        const model = "gemini-3.1-flash-image-preview";
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
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 120 },
  async (req, res) => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method not allowed");
      const user = await requireAuth(req);
      const { text, voice = "Kore", style } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing text" });
      }
      if (text.length > 4000) {
        return res.status(400).json({ error: "Script too long (4000 character max per generation)" });
      }

      const pricing = await getPricing();
      const per100 = pricing.costs?.ttsPer100Chars || 10;
      const ttsMin = pricing.costs?.ttsMinimum || 15;
      const cost = Math.max(ttsMin, Math.ceil(text.length / 100) * per100);
      await chargeCredits(user.uid, cost, `voiceover (${voice})`);

      let audio;
      try {
        const promptText = style ? `${style}:\n\n${text}` : text;
        const model = "gemini-2.5-flash-preview-tts";
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
        imageBase64,
        imageMimeType,
        videoBase64,
        videoMimeType,
      } = req.body;

      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const duration = Math.min(Math.max(Number(durationSeconds) || 8, 4), 8);
      const pricing = await getPricing();
      const perSecCost = (pricing.costs?.videoPerSecond?.[model]) ?? (model === "omni-fast" ? 15 : 30);
      const cost = perSecCost * duration;

      await chargeCredits(user.uid, cost, `video (${model}, ${duration}s)`);

      const doc = db.collection("generations").doc();
      await doc.set({
        uid: user.uid,
        type: "video",
        status: "generating",
        prompt,
        model,
        cost,
        imageBase64: imageBase64 || null,
        imageMimeType: imageMimeType || null,
        videoBase64: videoBase64 || null,
        videoMimeType: videoMimeType || null,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, status: "generating", cost });
    } catch (err) {
      console.error("videoGenerate error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

exports.videoStatus = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 300 },
  async (req, res) => {
    try {
      const user = await requireAuth(req);
      const id = req.query.id || req.body.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const ref = db.collection("generations").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: "Not found" });

      const gen = snap.data();
      if (gen.uid !== user.uid) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (gen.status === "succeeded" || gen.status === "failed") {
        return res.status(200).json({
          id,
          status: gen.status,
          videoUrl: gen.videoUrl || null,
          error: gen.error || null,
          prompt: gen.prompt,
          completedAt: gen.completedAt || null,
        });
      }

      if (gen.status === "processing") {
        return res.status(200).json({ id, status: "generating" });
      }

      // If status is generating, transition to processing to prevent parallel overlapping polls
      const hasStarted = await db.runTransaction(async (tx) => {
        const dSnap = await tx.get(ref);
        if (dSnap.data().status === "generating") {
          tx.update(ref, { status: "processing" });
          return true;
        }
        return false;
      });

      if (!hasStarted) {
        return res.status(200).json({ id, status: "generating" });
      }

      try {
        const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
        const modelId = "gemini-omni-flash-preview";

        console.log(`Polling/Generating video for doc: ${id} with prompt: ${gen.prompt}`);
        const ai = new GoogleGenAI({
          vertexai: true,
          project: projectId,
          location: "global"
        });

        let inputPayload;
        if (gen.imageBase64 && gen.imageMimeType) {
          console.log(`Integrating reference image with base64 length: ${gen.imageBase64.length}`);
          inputPayload = [
            {
              type: "user_input",
              content: [
                {
                  type: "image",
                  data: gen.imageBase64,
                  mime_type: gen.imageMimeType
                },
                {
                  type: "text",
                  text: gen.prompt
                }
              ]
            }
          ];
        } else if (gen.videoBase64 && gen.videoMimeType) {
          console.log(`Integrating reference video with base64 length: ${gen.videoBase64.length}`);
          inputPayload = [
            {
              type: "user_input",
              content: [
                {
                  type: "video",
                  data: gen.videoBase64,
                  mime_type: gen.videoMimeType
                },
                {
                  type: "text",
                  text: gen.prompt
                }
              ]
            }
          ];
        } else {
          inputPayload = gen.prompt;
        }

        const interaction = await ai.interactions.create({
          model: modelId,
          input: inputPayload
        });

        if (interaction && interaction.output_video && interaction.output_video.data) {
          const videoUrl = await uploadBase64(
            interaction.output_video.data,
            `generations/${gen.uid}/${id}.mp4`,
            interaction.output_video.mime_type || "video/mp4"
          );

          const update = {
            status: "succeeded",
            videoUrl,
            mimeType: interaction.output_video.mime_type || "video/mp4",
            completedAt: new Date().toISOString(),
          };

          await ref.update(update);
          return res.status(200).json({ id, ...update });
        } else {
          throw new Error("No video data in interaction response");
        }
      } catch (err) {
        console.error("Video generation background process failed:", err);
        await refundCredits(gen.uid, gen.cost || 0, `video ${id} failed`);
        const update = {
          status: "failed",
          error: err.message || "Generation failed",
          completedAt: new Date().toISOString(),
        };
        await ref.update(update);
        return res.status(200).json({ id, ...update });
      }
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
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 120 },
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

        const model = "gemini-3.1-flash-image-preview";
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
        imageBase64,
        imageMimeType,
        videoBase64,
        videoMimeType,
      } = req.body;

      if (!prompt) return res.status(400).json({ error: "Missing prompt" });

      const duration = Math.min(Math.max(Number(durationSeconds) || 8, 4), 8);
      const perSecCost = model === "omni-fast" ? 15 : 30;
      const cost = perSecCost * duration;

      await chargeCredits(developer.uid, cost, `API: video (${model}, ${duration}s)`);

      const doc = db.collection("generations").doc();
      await doc.set({
        uid: developer.uid,
        type: "video",
        status: "generating",
        prompt,
        model,
        cost,
        viaApi: true,
        imageBase64: imageBase64 || null,
        imageMimeType: imageMimeType || null,
        videoBase64: videoBase64 || null,
        videoMimeType: videoMimeType || null,
        createdAt: new Date().toISOString(),
      });

      return res.status(200).json({ id: doc.id, status: "generating", cost });
    } catch (err) {
      console.error("apiGenerateVideo error:", err);
      return res.status(err.message.includes("Unauthorized") ? 401 : 500).json({ error: err.message });
    }
  }
);

exports.apiGetVideoStatus = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 300 },
  async (req, res) => {
    try {
      const developer = await requireApiKey(req);
      const id = req.query.id || req.body.id;
      if (!id) return res.status(400).json({ error: "Missing id" });

      const ref = db.collection("generations").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: "Not found" });

      const gen = snap.data();
      if (gen.uid !== developer.uid) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (gen.status === "succeeded" || gen.status === "failed") {
        return res.status(200).json({
          id,
          status: gen.status,
          videoUrl: gen.videoUrl || null,
          error: gen.error || null,
          prompt: gen.prompt,
          completedAt: gen.completedAt || null,
        });
      }

      if (gen.status === "processing") {
        return res.status(200).json({ id, status: "generating" });
      }

      const hasStarted = await db.runTransaction(async (tx) => {
        const dSnap = await tx.get(ref);
        if (dSnap.data().status === "generating") {
          tx.update(ref, { status: "processing" });
          return true;
        }
        return false;
      });

      if (!hasStarted) {
        return res.status(200).json({ id, status: "generating" });
      }

      try {
        const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
        const modelId = "gemini-omni-flash-preview";

        console.log(`Polling/Generating video (API) for doc: ${id} with prompt: ${gen.prompt}`);
        const ai = new GoogleGenAI({
          vertexai: true,
          project: projectId,
          location: "global"
        });

        let inputPayload;
        if (gen.imageBase64 && gen.imageMimeType) {
          console.log(`Integrating API reference image with base64 length: ${gen.imageBase64.length}`);
          inputPayload = [
            {
              type: "user_input",
              content: [
                {
                  type: "image",
                  data: gen.imageBase64,
                  mime_type: gen.imageMimeType
                },
                {
                  type: "text",
                  text: gen.prompt
                }
              ]
            }
          ];
        } else if (gen.videoBase64 && gen.videoMimeType) {
          console.log(`Integrating API reference video with base64 length: ${gen.videoBase64.length}`);
          inputPayload = [
            {
              type: "user_input",
              content: [
                {
                  type: "video",
                  data: gen.videoBase64,
                  mime_type: gen.videoMimeType
                },
                {
                  type: "text",
                  text: gen.prompt
                }
              ]
            }
          ];
        } else {
          inputPayload = gen.prompt;
        }

        const interaction = await ai.interactions.create({
          model: modelId,
          input: inputPayload
        });

        if (interaction && interaction.output_video && interaction.output_video.data) {
          const videoUrl = await uploadBase64(
            interaction.output_video.data,
            `generations/${gen.uid}/${id}.mp4`,
            interaction.output_video.mime_type || "video/mp4"
          );

          const update = {
            status: "succeeded",
            videoUrl,
            mimeType: interaction.output_video.mime_type || "video/mp4",
            completedAt: new Date().toISOString(),
          };

          await ref.update(update);
          return res.status(200).json({ id, ...update });
        } else {
          throw new Error("No video data in interaction response");
        }
      } catch (err) {
        console.error("Video generation background process (API) failed:", err);
        await refundCredits(gen.uid, gen.cost || 0, `API: video ${id} failed`);
        const update = {
          status: "failed",
          error: err.message || "Generation failed",
          completedAt: new Date().toISOString(),
        };
        await ref.update(update);
        return res.status(200).json({ id, ...update });
      }
    } catch (err) {
      console.error("apiGetVideoStatus error:", err);
      return res.status(err.message.includes("Unauthorized") ? 401 : 500).json({ error: err.message });
    }
  }
);

exports.apiGenerateTTS = onRequest(
  { region: "us-east4", cors: true, maxInstances: 10, timeoutSeconds: 120 },
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
        const model = "gemini-2.5-flash-preview-tts";
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
      credits: 0,
      plan: null,
      planStatus: "none",
      planRenewsAt: null,
      email: email,
      name: name,
      createdAt: new Date().toISOString()
    }, { merge: true });

    console.log(`Successfully initialized user doc for UID: ${uid} with 0 signup credits.`);
  } catch (error) {
    console.error(`Failed to initialize user doc for UID: ${uid}:`, error);
  }
});



