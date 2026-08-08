/**
 * Probes the image model the SHOT BOARD renders its frames with.
 *
 * The shot board's call shape is not the one the platform already makes for
 * character sheets: a frame is generated from SEVERAL attached references at
 * once (a set plate, one or two character sheets, a prop plate) and it must come
 * back in the FILM's aspect ratio, not a portrait plate. So both of those are
 * probed here rather than assumed.
 *
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\Projects\optiq\secrets\davelabs-tools-sa.json
 *   node scripts/probe-nano-banana-2.mjs
 *
 * Writes what it renders to scratch/ so the frames can actually be looked at —
 * "it returned 900KB of PNG" is not the same claim as "it held the face".
 */
import { GoogleAuth } from "google-auth-library";
import fs from "fs";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const OUT = path.join(process.cwd(), "scratch", "nano-banana-2");

// Nano Banana 2. `gemini-3.1-flash-image` (what the character sheets use) is the
// flash tier of the same family; the pro tier is the one that holds legible text
// on a document or a phone screen, which is half of what a prop plate is for.
const MODEL = process.env.SHOT_FRAME_MODEL || "gemini-3-pro-image";

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const tok = async () => (await (await auth.getClient()).getAccessToken()).token;
const url = (m) =>
  `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${m}:generateContent`;

async function generate(parts, aspectRatio) {
  const res = await fetch(url(MODEL), {
    method: "POST",
    headers: { Authorization: `Bearer ${await tok()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio },
      },
    }),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).replace(/\s+/g, " ").slice(0, 400)}`);
  const json = await res.json();
  const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!inline?.data) {
    throw new Error(
      `no image (finishReason=${json.candidates?.[0]?.finishReason}, block=${json.promptFeedback?.blockReason})`
    );
  }
  return { base64: inline.data, mimeType: inline.mimeType || "image/png" };
}

function save(name, image) {
  fs.mkdirSync(OUT, { recursive: true });
  const ext = image.mimeType.includes("jpeg") ? "jpg" : "png";
  const file = path.join(OUT, `${name}.${ext}`);
  fs.writeFileSync(file, Buffer.from(image.base64, "base64"));
  return `${file} (${(Buffer.from(image.base64, "base64").length / 1024).toFixed(0)}KB, ${image.mimeType})`;
}

const step = async (label, fn) => {
  const t0 = Date.now();
  try {
    const detail = await fn();
    console.log(`  OK   ${label}  [${((Date.now() - t0) / 1000).toFixed(1)}s] ${detail}`);
    return true;
  } catch (e) {
    console.log(`  FAIL ${label}  [${((Date.now() - t0) / 1000).toFixed(1)}s] ${String(e.message || e).slice(0, 300)}`);
    return false;
  }
};

console.log(`Probing ${MODEL} at global v1beta1 → ${OUT}\n`);

// 1. A character sheet, in the 3:4 plate the swarm already uses.
let character = null;
await step("character sheet, 3:4", async () => {
  character = await generate(
    [
      {
        text: `A photorealistic full-length CHARACTER REFERENCE SHEET of one person, for film production continuity.
A Black Gambian woman, 34, golden-brown complexion, close-cropped natural hair, round face, broad nose, a small scar through her right eyebrow. Wearing a TEAL cotton wrap dress and flat brown leather sandals.
One person only, full length, standing squarely facing camera, arms relaxed. Neutral expression. Plain seamless mid-grey studio backdrop, nothing else in frame. Flat even frontal studio light. Sharp focus. Natural skin texture. Photographic realism, not an illustration.`,
      },
    ],
    "3:4"
  );
  return save("1-character", character);
});

// 2. A set plate with no people in it, in the film's aspect ratio.
let setPlate = null;
await step("set plate, 16:9, no people", async () => {
  setPlate = await generate(
    [
      {
        text: `A photorealistic ESTABLISHING FRAME of an empty location, for film production continuity. No people in frame at all.
The inside of a yellow Gambian taxi, a 1990s Mercedes saloon, parked and empty in daylight. LEFT-HAND DRIVE: the steering wheel is on the LEFT. Cracked black vinyl dashboard, a faded green prayer bead hanging from the mirror, a torn grey cloth seat cover on the front passenger seat, sand in the footwells, both front doors closed with the window winders visible. Shot from the rear bench looking forward through the gap between the front seats.
Natural daylight through the windscreen. Photographic realism, shallow depth of field, no text, no watermark, no people, no reflections of people.`,
      },
    ],
    "16:9"
  );
  return save("2-set-plate", setPlate);
});

// 3. A prop plate whose whole job is legible text — the case flash-tier image
//    models get wrong and the reason the pro tier is worth the money.
let propPlate = null;
await step("prop plate with legible text, 4:3", async () => {
  propPlate = await generate(
    [
      {
        text: `A photorealistic PROP REFERENCE PLATE of one object, flat on a plain neutral grey surface, shot from directly above.
A single sheet of A4 paper, a letter from a bank. The letterhead reads "TRUST BANK GAMBIA" in navy blue capitals. Below it, a short body of printed text and, near the bottom, the figure "D 4,500.00" in bold. The paper has one horizontal fold line across the middle and a slightly creased top-right corner.
The text must be sharp and readable. Even, flat lighting. Nothing else in frame. No hands, no other objects, no watermark.`,
      },
    ],
    "4:3"
  );
  return save("3-prop-plate", propPlate);
});

// 4. THE CALL THE SHOT BOARD ACTUALLY MAKES: three references in, one frame out.
if (character && setPlate && propPlate) {
  await step("frame from 3 attached references, 16:9", async () => {
    const frame = await generate(
      [
        { inlineData: { mimeType: setPlate.mimeType, data: setPlate.base64 } },
        { inlineData: { mimeType: character.mimeType, data: character.base64 } },
        { inlineData: { mimeType: propPlate.mimeType, data: propPlate.base64 } },
        {
          text: `A photorealistic FILM FRAME — one still from a live-action film.

ATTACHED IMAGE 1 is the LOCATION. This frame is shot inside that exact car: same dashboard, same cracked vinyl, same prayer beads on the mirror, same torn seat cover, same left-hand drive. Take the place, not the camera position.
ATTACHED IMAGE 2 is BINTA. Match her face, skin tone, hair and outfit exactly. Take ONLY the person — not the grey backdrop, not the studio light, not the standing pose.
ATTACHED IMAGE 3 is THE LETTER. The document in her hands is that exact letter, same letterhead, same fold.

THE SHOT: a medium close-up from the front passenger seat, camera low at chest height, angled slightly up. Binta sits in the REAR BENCH on the right side of the frame, holding the letter in both hands, looking down at it. The driver's seat is empty. Daylight through the side window rakes across her face from frame right.

Photographic realism. No text overlay, no subtitles, no watermark, no letterboxing, no split screen, no collage.`,
        },
      ],
      "16:9"
    );
    return save("4-frame", frame);
  });
}

console.log(`\nLook at the files. The question is not whether they rendered.`);
