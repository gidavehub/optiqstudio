/**
 * Generates the Optiq Voice Engine speaker assets — a short spoken sample and a
 * square face portrait for each of the 16 profiles — using Vertex AI on
 * davelabs-tools (NEVER AI Studio).
 *
 * Samples are advertisement-style, spoken with emotion, and — for the African
 * speakers — in their actual LOCAL LANGUAGE (Gambian Wolof/Mandinka avoiding
 * French; Igbo; Hausa; Swahili). The African-language lines are best-effort
 * drafts; a native speaker should sanity-check them.
 *
 * Outputs (committed to the repo, served from /public):
 *   public/media/voice-samples/<id>.wav   ← Gemini 3.1 Flash TTS (gemini-3.1-flash-tts-preview)
 *   public/media/voice-faces/<id>.jpg      ← Gemini image (gemini-3.1-flash-image)
 *
 * The id → voice mapping MUST stay in sync with
 *   app/dashboard/audio/_components/voiceProfiles.ts
 *
 * Prereq: service-account or ADC auth for davelabs-tools, e.g.
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\Projects\optiq\secrets\davelabs-tools-sa.json
 *
 * Run:
 *   node scripts/generate-voice-assets.mjs          # both audio + faces
 *   node scripts/generate-voice-assets.mjs audio    # samples only
 *   node scripts/generate-voice-assets.mjs faces    # portraits only
 * Idempotent: existing files are skipped; delete one to regenerate it.
 */

import { GoogleAuth } from "google-auth-library";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
// Gemini 3.1 Flash TTS. Verified live on davelabs-tools (July 2026): it serves
// at us-central1 (and global) but 404s at us-east4. Image GA at the global endpoint.
const TTS_MODEL = "gemini-3.1-flash-tts-preview";
const IMAGE_MODEL = "gemini-3.1-flash-image";

const TTS_URL = `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT}/locations/us-central1/publishers/google/models/${TTS_MODEL}:generateContent`;
const IMAGE_URL = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${IMAGE_MODEL}:generateContent`;

const SAMPLES_OUT = path.join(process.cwd(), "public", "media", "voice-samples");
const FACES_OUT = path.join(process.cwd(), "public", "media", "voice-faces");

const FACE_STYLE =
  "square 1:1 editorial headshot portrait, head and shoulders, soft natural studio light, " +
  "shallow depth of field, clean neutral background, warm friendly professional expression, " +
  "looking at camera, photorealistic, high detail, no text, no watermark";

// Every sample is an ad read — warm, emotive, selling. African speakers read in
// their local language; diaspora/international read in English (Wei in Mandarin).
const PROFILES = [
  {
    id: "awa-wolof",
    voice: "Kore",
    style: "Read like a warm, joyful Gambian radio advert presenter — full of energy and emotion, selling with a smile, in Gambian Wolof.",
    text: "Salaamaalekum! Ak Optiq Studio, sa brand dina rey! Video yu rafet, yu neex, ci sa loxo. Ñëwal, xool sa bopp! Optiq Studio — mooy këru xibaar bu bees!",
    face: "a warm, elegant young Senegambian Wolof woman wearing a colourful headwrap and gold earrings",
  },
  {
    id: "moussa-wolof",
    voice: "Charon",
    style: "Read like a confident, deep-voiced Gambian radio advert announcer — warm, persuasive and proud, in Gambian Wolof.",
    text: "Salaamaalekum! Optiq Studio, mooy njariñ bu mag! Sa liggéey, sa yëf, dina leen wone ci àddina bépp. Baax na torop! Ñëwal ci Optiq Studio tey!",
    face: "a distinguished middle-aged Senegambian Wolof man with a short grey beard in a smart embroidered kaftan",
  },
  {
    id: "fatou-mandinka",
    voice: "Leda",
    style: "Read like a bright, cheerful Gambian radio advert presenter — joyful and excited, in Gambian Mandinka.",
    text: "Salaamaalekum! Optiq Studio, a beteyaata baake! I la dookuwo, i la feŋo, ǹ be a yitandi duniyaa bee la. Naa, i ye a juubee! Abaraka, Optiq Studio!",
    face: "a bright, cheerful young Gambian Mandinka woman with braided hair and a patterned Ankara top",
  },
  {
    id: "lamin-mandinka",
    voice: "Fenrir",
    style: "Read like a strong, bold Gambian radio advert announcer — confident and persuasive, in Gambian Mandinka.",
    text: "Salaamaalekum! Optiq Studio le mu! I la kúwo bee, ǹ si a ke video ñiimaa ti. Naa saayiŋ, i ye a je! Optiq Studio — a beteyaata baake!",
    face: "a strong, confident young Gambian Mandinka man with a close beard in a simple modern shirt",
  },
  {
    id: "chioma-igbo",
    voice: "Aoede",
    style: "Read like a warm, expressive Nigerian radio advert presenter — full of joy and emotion, in Igbo.",
    text: "Ndeewo! Optiq Studio ka mma nke ukwuu! Anyị ga-eme ka akụkọ brand gị maa mma n'ihu ọha. Bịa hụ ya! Optiq Studio — ebe akụkọ gị na-adị ndụ!",
    face: "a graceful young Nigerian Igbo woman with elegant coral beads and neatly styled natural hair",
  },
  {
    id: "chinedu-igbo",
    voice: "Orus",
    style: "Read like a confident, authoritative Nigerian radio advert announcer — warm and persuasive, in Igbo.",
    text: "Kedu! Optiq Studio bụ ihe ọma! Were prọjekt gị nye anyị, anyị ga-eme ya ka ọ maa mma. Bịa taa! Optiq Studio, ọ dịịrị gị mma!",
    face: "a composed, authoritative Nigerian Igbo man, clean-shaven, in a crisp white shirt",
  },
  {
    id: "efe-naija",
    voice: "Puck",
    style: "Read like an energetic, lively Nigerian radio advert presenter — warm and full of excitement, in Nigerian English and light pidgin.",
    text: "Hello, my people! You wan make your brand shine? Optiq Studio na the answer! We go turn your idea into sharp, correct video wey people go stop to watch. Abeg, no waste time — try Optiq Studio today!",
    face: "an energetic, stylish young Nigerian woman with bold hoop earrings and a modern afro",
  },
  {
    id: "zainab-hausa",
    voice: "Callirrhoe",
    style: "Read like a graceful, warm Northern Nigerian radio advert presenter — poised and inviting, in Hausa.",
    text: "Sannu da zuwa! Optiq Studio yana da kyau ƙwarai! Za mu mai da labarin kamfaninka ya zama mai daɗi ga kowa. Zo ka gani! Optiq Studio — inda labarinka yake rayuwa!",
    face: "a poised young Northern Nigerian Hausa woman in an elegant patterned hijab",
  },
  {
    id: "amara-swahili",
    voice: "Autonoe",
    style: "Read like a warm, friendly Kenyan radio advert presenter — gentle and inviting, in Swahili.",
    text: "Habari yako! Optiq Studio ni nzuri sana! Tutaigeuza hadithi ya brand yako kuwa video nzuri ambayo watu watapenda. Karibu ujionee! Optiq Studio — hapa hadithi yako inakuwa hai!",
    face: "a warm young Kenyan East African woman with a beaded necklace and short natural hair",
  },
  {
    id: "jabari-swahili",
    voice: "Iapetus",
    style: "Read like a calm, confident Tanzanian radio advert announcer — warm and persuasive, in Swahili.",
    text: "Habari! Optiq Studio ni suluhisho lako! Tutatengeneza tangazo zuri la biashara yako kwa muda mfupi. Karibu leo! Optiq Studio — ubora wa hali ya juu!",
    face: "a calm young Tanzanian East African man with a gentle smile in a light linen shirt",
  },
  {
    id: "thabo-southafrican",
    voice: "Algenib",
    style: "Read like an upbeat, friendly South African radio advert presenter — energetic and warm.",
    text: "Sawubona! Howzit! Wanna make your brand stand out? Optiq Studio is the way! We turn your vision into a sharp, cinematic ad that people will love. Come through — try Optiq Studio today, boet!",
    face: "an upbeat young South African man with a fade haircut in a bright casual shirt",
  },
  {
    id: "kofi-afrobrit",
    voice: "Enceladus",
    style: "Read like a smooth, warm British advert voiceover artist — calm, confident and emotive.",
    text: "Hello there. Every great brand has a story worth telling. At Optiq Studio, we bring that story to life — cinematic, production-quality ads, made in minutes. Your brand deserves to be seen. Try Optiq Studio today.",
    face: "a thoughtful young Black British-African man with short locs in a tailored charcoal jacket",
  },
  {
    id: "marcus-american",
    voice: "Algieba",
    style: "Read like a smooth, charismatic American advert voiceover — deep, warm and full of excitement.",
    text: "Hey — let's talk about your brand. At Optiq Studio, we turn your ideas into scroll-stopping, production-quality video ads people actually remember. No crew, no studio, no stress. Let's make your brand unforgettable — Optiq Studio.",
    face: "a smooth, charismatic young African-American man with a neat beard in a dark turtleneck",
  },
  {
    id: "grace-american",
    voice: "Achernar",
    style: "Read like a confident, polished American commercial voiceover — warm, bright and upbeat.",
    text: "Meet Optiq Studio — where your brand's story becomes a beautiful, production-quality video ad in minutes. Pick your look, tell your story, and watch it come to life. It's your brand, made cinematic. Try Optiq Studio today.",
    face: "a confident young American woman with wavy shoulder-length hair in a modern blazer",
  },
  {
    id: "eleanor-british",
    voice: "Vindemiatrix",
    style: "Read like a refined, elegant British commercial voiceover — articulate, warm and inviting.",
    text: "Allow us to introduce Optiq Studio — the effortless way to create production-quality advertisements for your brand. Cinematic, polished, and ready in minutes. Your story, beautifully told. Do try Optiq Studio.",
    face: "a refined young British woman with a sleek bob and minimal jewellery",
  },
  {
    id: "wei-chinese",
    voice: "Umbriel",
    style: "Read like a warm, professional Mandarin Chinese radio advert presenter — clear, bright and inviting, in Mandarin.",
    text: "大家好！欢迎来到 Optiq Studio！我们可以把您的品牌故事变成精美的广告视频，几分钟就能完成。快来体验吧！Optiq Studio，让您的品牌闪耀起来！",
    face: "a measured, professional young Chinese man with tidy hair in a modern grey shirt",
  },
];

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
async function token() {
  const client = await auth.getClient();
  const t = await client.getAccessToken();
  if (!t.token) throw new Error("No access token — set GOOGLE_APPLICATION_CREDENTIALS or run gcloud auth application-default login");
  return t.token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

// PCM (audio/L16) → WAV container, mirroring functions/index.js pcmToWav().
function pcmToWav(pcmBuffer, sampleRate) {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * 2; // mono, 16-bit
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

// POST with bounded retry on 429/503. Never loops forever.
async function postJson(url, body, label) {
  const maxAttempts = 4;
  for (let attempt = 1; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (netErr) {
      if (attempt >= maxAttempts) throw netErr;
      console.log(`    · network hiccup (${netErr.message}); retry ${attempt}/${maxAttempts} in 5s`);
      await sleep(5000);
      continue;
    }
    if (res.ok) return res.json();

    const errText = await res.text();
    const retryable = res.status === 429 || res.status === 503;
    if (!retryable || attempt >= maxAttempts) {
      throw new Error(`${label} → ${res.status}: ${errText.slice(0, 240)}`);
    }
    const wait = res.status === 429 ? 35000 : 6000;
    console.log(`    · ${res.status} on ${label}; waiting ${wait / 1000}s then retry ${attempt}/${maxAttempts}`);
    await sleep(wait);
  }
}

async function genSample(p) {
  const out = path.join(SAMPLES_OUT, `${p.id}.wav`);
  if (await fileExists(out)) return console.log(`  skip sample ${p.id} (exists)`);

  console.log(`  … sample ${p.id} (${p.voice})`);
  const data = await postJson(
    TTS_URL,
    {
      contents: [{ role: "user", parts: [{ text: `${p.style}:\n\n${p.text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: p.voice } } },
      },
    },
    `sample ${p.id}`
  );

  const inline = data.candidates?.[0]?.content?.parts?.find((x) => x.inlineData)?.inlineData;
  if (!inline?.data) throw new Error(`no audio returned for ${p.id}`);
  const rate = parseInt((inline.mimeType || "").match(/rate=(\d+)/)?.[1] || "24000", 10);
  await writeFile(out, pcmToWav(Buffer.from(inline.data, "base64"), rate));
  console.log(`  ✓ sample ${p.id}.wav`);
}

async function genFace(p) {
  const out = path.join(FACES_OUT, `${p.id}.jpg`);
  if (await fileExists(out)) return console.log(`  skip face ${p.id} (exists)`);

  console.log(`  … face ${p.id}`);
  const data = await postJson(
    IMAGE_URL,
    {
      contents: [{ role: "user", parts: [{ text: `${p.face}. ${FACE_STYLE}` }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "1:1" } },
    },
    `face ${p.id}`
  );

  const inline = data.candidates?.[0]?.content?.parts?.find((x) => x.inlineData)?.inlineData;
  if (!inline?.data) throw new Error(`no image returned for ${p.id}`);
  await writeFile(out, Buffer.from(inline.data, "base64"));
  console.log(`  ✓ face ${p.id}.jpg`);
}

async function main() {
  const mode = (process.argv[2] || "all").toLowerCase();
  await mkdir(SAMPLES_OUT, { recursive: true });
  await mkdir(FACES_OUT, { recursive: true });

  if (mode === "all" || mode === "audio") {
    console.log(`\nVoice samples → ${SAMPLES_OUT}`);
    for (const p of PROFILES) {
      try {
        await genSample(p);
      } catch (err) {
        console.error(`  ✗ sample ${p.id}: ${err.message}`);
      }
      await sleep(7000); // stay under the per-minute TTS cap
    }
  }

  if (mode === "all" || mode === "faces") {
    console.log(`\nFace portraits → ${FACES_OUT}`);
    for (const p of PROFILES) {
      try {
        await genFace(p);
      } catch (err) {
        console.error(`  ✗ face ${p.id}: ${err.message}`);
      }
      await sleep(12000); // stay under the per-minute image cap
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
