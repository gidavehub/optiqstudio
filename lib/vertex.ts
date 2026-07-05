import { GoogleAuth } from "google-auth-library";
import { GoogleGenAI } from "@google/genai";

/**
 * Vertex AI client for Optiq Studio.
 *
 * HARD RULE: every model call goes through Vertex AI
 * ({region}-aiplatform.googleapis.com) on project davelabs-tools. The
 * Generative Language API / AI Studio is never used — billing credits are
 * redeemed against the Vertex billing account.
 */

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const LOCATION = process.env.VERTEX_LOCATION || "us-east4";
const VERTEX_BASE = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}`;

export const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT_ID,
  location: "global"
});

export const MODELS = {
  /** "Omni" — gemini-omni-flash-preview. */
  video: "gemini-omni-flash-preview",
  /** "Omni Fast" — gemini-omni-flash-preview. */
  videoFast: "gemini-omni-flash-preview",
  /** Image generation — gemini-3.1-flash-image-preview. */
  image: "gemini-3.1-flash-image-preview",
  /** Text: prompt enhancement, titles, metadata. */
  text: process.env.TEXT_MODEL_ID || "gemini-3.5-flash",
  /** Native TTS with prebuilt voices. */
  tts: process.env.TTS_MODEL_ID || "gemini-3.1-flash-preview-tts",
};

export class VertexError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "VertexError";
    this.status = status;
  }
}

const auth = new GoogleAuth({
  scopes: "https://www.googleapis.com/auth/cloud-platform",
});

async function getAccessToken(): Promise<string> {
  try {
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("empty token");
    return token;
  } catch (err) {
    throw new VertexError(
      "Google Cloud credentials unavailable. Sign in with the davelabs-tools account: " +
        "`gcloud auth application-default login` as davelabs01@gmail.com, then " +
        "`gcloud config set project davelabs-tools`. Underlying error: " +
        (err instanceof Error ? err.message : String(err)),
      503
    );
  }
}

async function vertexFetch<T>(path: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  let url = `${VERTEX_BASE}${path}`;
  if (path.includes("gemini-3.1-flash-image-preview") || path.includes("gemini-omni-flash-preview")) {
    url = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT_ID}/locations/global${path}`;
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
    throw new VertexError(
      `Vertex AI ${path} failed (${res.status}): ${text.slice(0, 2000)}`,
      res.status
    );
  }
  return res.json() as Promise<T>;
}

// ─── Video generation (Veo long-running operations) ─────────────────────────

export interface VideoRequest {
  prompt: string;
  /** "omni" = quality model, "omni-fast" = fast model */
  model?: "omni" | "omni-fast";
  /** First-frame conditioning image for image-to-video. */
  imageBase64?: string;
  imageMimeType?: string;
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: number;
  resolution?: "720p" | "1080p";
  generateAudio?: boolean;
  negativePrompt?: string;
  seed?: number;
}

export function videoModelId(model?: "omni" | "omni-fast"): string {
  return model === "omni-fast" ? MODELS.videoFast : MODELS.video;
}

// In-memory cache for mock video operations
const mockVideoOperations = new Map<
  string,
  {
    done: boolean;
    videos: { bytesBase64Encoded?: string; gcsUri?: string; mimeType: string }[];
    error?: string;
  }
>();

/** Kicks off a Veo generation. Returns the long-running operation name. */
export async function startVideoGeneration(req: VideoRequest): Promise<string> {
  const modelId = videoModelId(req.model);
  
  if (modelId === "gemini-omni-flash-preview") {
    const opId = `mock-omni-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const opName = `projects/${PROJECT_ID}/locations/global/publishers/google/models/${modelId}/operations/${opId}`;

    mockVideoOperations.set(opName, { done: false, videos: [] });

    // Start background generation
    (async () => {
      try {
        const interaction = await ai.interactions.create({
          model: modelId,
          input: req.prompt
        });

        if (!interaction || !interaction.output_video || !interaction.output_video.data) {
          throw new Error("Video model returned no video data");
        }

        mockVideoOperations.set(opName, {
          done: true,
          videos: [
            {
              bytesBase64Encoded: interaction.output_video.data,
              mimeType: interaction.output_video.mime_type || "video/mp4",
            },
          ],
        });
      } catch (err) {
        console.error("Background video generation failed:", err);
        mockVideoOperations.set(opName, {
          done: true,
          videos: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return opName;
  }

  // Fallback signature for compatibility if other models are requested
  const instance: Record<string, unknown> = { prompt: req.prompt };
  if (req.imageBase64) {
    instance.image = {
      bytesBase64Encoded: req.imageBase64,
      mimeType: req.imageMimeType || "image/png",
    };
  }
  const parameters: Record<string, unknown> = {
    aspectRatio: req.aspectRatio || "16:9",
    durationSeconds: req.durationSeconds || 8,
    resolution: req.resolution || "720p",
    generateAudio: req.generateAudio ?? true,
    sampleCount: 1,
  };
  if (req.negativePrompt) parameters.negativePrompt = req.negativePrompt;
  if (req.seed !== undefined) parameters.seed = req.seed;

  const data = await vertexFetch<{ name: string }>(
    `/publishers/google/models/${modelId}:predictLongRunning`,
    { instances: [instance], parameters }
  );
  if (!data.name) throw new VertexError("Veo did not return an operation name");
  return data.name;
}

export interface VideoOperationResult {
  done: boolean;
  videos: { bytesBase64Encoded?: string; gcsUri?: string; mimeType: string }[];
  error?: string;
  raiFiltered?: string;
}

/** Polls a Veo long-running operation. */
export async function pollVideoOperation(
  operationName: string
): Promise<VideoOperationResult> {
  if (operationName.includes("mock-omni-")) {
    const op = mockVideoOperations.get(operationName);
    if (!op) {
      return { done: true, videos: [], error: "Operation not found in cache" };
    }
    return op;
  }

  // Operation names look like:
  // projects/{p}/locations/{l}/publishers/google/models/{model}/operations/{id}
  const match = operationName.match(/models\/([^/]+)\/operations\//);
  if (!match) throw new VertexError(`Unparseable operation name: ${operationName}`, 400);
  const modelId = match[1];

  const data = await vertexFetch<{
    done?: boolean;
    error?: { message?: string };
    response?: {
      videos?: { bytesBase64Encoded?: string; gcsUri?: string; mimeType?: string }[];
      generatedSamples?: { video?: { uri?: string; encoding?: string } }[];
      raiMediaFilteredReasons?: string[];
    };
  }>(`/publishers/google/models/${modelId}:fetchPredictOperation`, {
    operationName,
  });

  if (!data.done) return { done: false, videos: [] };
  if (data.error) {
    return { done: true, videos: [], error: data.error.message || "Generation failed" };
  }

  const resp = data.response || {};
  const videos =
    resp.videos?.map((v) => ({
      bytesBase64Encoded: v.bytesBase64Encoded,
      gcsUri: v.gcsUri,
      mimeType: v.mimeType || "video/mp4",
    })) ??
    resp.generatedSamples?.map((s) => ({
      gcsUri: s.video?.uri,
      mimeType: s.video?.encoding || "video/mp4",
    })) ??
    [];

  if (videos.length === 0) {
    return {
      done: true,
      videos: [],
      error: resp.raiMediaFilteredReasons?.length
        ? `Blocked by safety filters: ${resp.raiMediaFilteredReasons.join("; ")}`
        : "Generation finished but returned no video",
      raiFiltered: resp.raiMediaFilteredReasons?.join("; "),
    };
  }
  return { done: true, videos };
}

// ─── Image generation (Nano Banana / Gemini image) ───────────────────────────

export interface ImageRequest {
  prompt: string;
  /** Reference images (e.g. character sheets) for consistent subjects. */
  referenceImages?: { base64: string; mimeType: string }[];
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
}

export async function generateImage(
  req: ImageRequest
): Promise<{ base64: string; mimeType: string }> {
  const parts: Record<string, unknown>[] = [];
  for (const ref of req.referenceImages || []) {
    parts.push({ inlineData: { data: ref.base64, mimeType: ref.mimeType } });
  }
  parts.push({ text: req.prompt });

  const data = await vertexFetch<{
    candidates?: {
      content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] };
      finishReason?: string;
    }[];
  }>(`/publishers/google/models/${MODELS.image}:generateContent`, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      ...(req.aspectRatio ? { imageConfig: { aspectRatio: req.aspectRatio } } : {}),
    },
  });

  const imgPart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!imgPart?.inlineData) {
    throw new VertexError(
      `Image model returned no image (finishReason: ${data.candidates?.[0]?.finishReason || "unknown"})`
    );
  }
  return { base64: imgPart.inlineData.data, mimeType: imgPart.inlineData.mimeType };
}

// ─── Text generation (prompt enhancement etc.) ───────────────────────────────

export async function generateText(opts: {
  prompt: string;
  system?: string;
  json?: boolean;
}): Promise<string> {
  const data = await vertexFetch<{
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  }>(`/publishers/google/models/${MODELS.text}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    ...(opts.system
      ? { systemInstruction: { parts: [{ text: opts.system }] } }
      : {}),
    generationConfig: {
      temperature: 0.8,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  });
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("");
  if (!text) throw new VertexError("Text model returned an empty response");
  return text.trim();
}

// ─── Speech synthesis (Gemini native TTS) ────────────────────────────────────

/** Curated prebuilt voices exposed as Optiq voice profiles. */
export const VOICE_PROFILES = [
  { id: "Kore", label: "Kore", vibe: "Warm, confident female" },
  { id: "Charon", label: "Charon", vibe: "Deep, cinematic male" },
  { id: "Puck", label: "Puck", vibe: "Upbeat, energetic" },
  { id: "Fenrir", label: "Fenrir", vibe: "Gravelly, intense" },
  { id: "Aoede", label: "Aoede", vibe: "Bright, expressive female" },
  { id: "Leda", label: "Leda", vibe: "Soft, youthful" },
  { id: "Orus", label: "Orus", vibe: "Firm, authoritative male" },
  { id: "Enceladus", label: "Enceladus", vibe: "Breathy, contemplative" },
] as const;

export async function synthesizeSpeech(opts: {
  text: string;
  voice?: string;
  /** Natural-language delivery directions, e.g. "slow, movie-trailer gravitas". */
  style?: string;
}): Promise<{ base64Wav: string; mimeType: "audio/wav" }> {
  const promptText = opts.style ? `${opts.style}:\n\n${opts.text}` : opts.text;
  const data = await vertexFetch<{
    candidates?: {
      content?: { parts?: { inlineData?: { data: string; mimeType: string } }[] };
    }[];
  }>(`/publishers/google/models/${MODELS.tts}:generateContent`, {
    contents: [{ role: "user", parts: [{ text: promptText }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: opts.voice || "Kore" },
        },
      },
    },
  });

  const audio = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
    ?.inlineData;
  if (!audio) throw new VertexError("TTS model returned no audio");

  // Gemini TTS returns raw 16-bit PCM at 24kHz — wrap it in a WAV header so
  // browsers can play it directly.
  const rateMatch = audio.mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
  return { base64Wav: pcmToWav(audio.data, sampleRate), mimeType: "audio/wav" };
}

function pcmToWav(pcmBase64: string, sampleRate: number): string {
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
