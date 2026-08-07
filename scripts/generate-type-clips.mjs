/**
 * VIDEO-TYPE COVER CLIPS
 *
 * Generates the looping cover clips for the wizard's two picker screens.
 *
 * "What are we making?" — the three format cards:
 *   public/media/type-short-film.mp4
 *   public/media/type-dialogue-ad.mp4
 *   public/media/type-voiceover-ad.mp4
 *
 * "What is this film for?" — the two short-film modes, shown only after Short
 * film is picked. These two have ONE job: make the difference between an advert
 * and an original story legible in about six seconds, muted, on a small card.
 * So they are deliberately a matched pair — same room-quality, same light, same
 * kind of people — differing in the one thing that actually differs: the advert
 * has a product in the frame and a transaction happening, the story has neither
 * and carries a private moment between two people instead.
 *   public/media/mode-short-film-ad.mp4
 *   public/media/mode-short-film-story.mp4
 *
 * Run: node scripts/generate-type-clips.mjs [--force] [only-id ...]
 *   --force        regenerate even if the file already exists
 *   only-id        generate just these ids, e.g. `short-film voiceover-ad`
 *
 * Style brief: the bright, high-key, daylight-flooded look the portal and voice
 * assets use — the FINISHED FILM, never the equipment that made it. Gambian
 * people, warm honest daylight, photorealistic. Each clip has to answer "what do
 * I get if I pick this?" in about six seconds, muted, on a small card.
 *
 * Two things worth knowing before you run it:
 *  - Omni gives no duration control (see the omni-video notes), so clip length
 *    is whatever the model returns — usually 6-8s. That is fine: the card loops.
 *  - This spends real Vertex video quota. It skips files that already exist, so
 *    a re-run is cheap; pass --force only when you actually want new footage.
 *
 * The wizard falls back to the aurora wash when a clip is missing, so the picker
 * is never broken by an absent asset — nothing here is load-bearing for the UI.
 */

import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

// Vertex AI on davelabs-tools only, via secrets/davelabs-tools-sa.json — same as
// the other asset scripts. Never AI Studio.
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(process.cwd(), "secrets", "davelabs-tools-sa.json");
}

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const OUT = path.join(process.cwd(), "public", "media");
const MODEL = "gemini-omni-flash-preview";

const POLL_INTERVAL_MS = 5000;
const DEADLINE_MS = 6 * 60 * 1000;

const ai = new GoogleGenAI({ vertexai: true, project: PROJECT, location: "global" });

// Shared style spine, so the three cards read as one set on the picker.
//
// Derived from the existing dashboard assets rather than invented: portal-voice
// (a performer mid-line in a sunlit white room — the PERFORMANCE is the subject,
// the gear is barely in frame) and portal-image (a flat-lay on clean white with
// bright coral/teal/yellow accents). Both are high-key, daylight-flooded and
// colourful. Note this is the OPPOSITE of the older dash-*.mp4 clips, which are
// dark and moody — those are not the house style any more.
const STYLE =
  "=== STYLE === REGISTER: premium finished film, bright and high-key — the film itself, never the equipment that made it. " +
  "OPTICS: crisp modern cinema lens, shallow depth of field, gentle natural halation. " +
  "LIGHTING: bright daylight flooding the frame through a large window, clean white walls bouncing light, airy and open, no moody shadows anywhere. " +
  "COLOR: clean whites and bright warm colour — coral, teal and yellow accents welcome; no heavy grade, no darkness. " +
  "PEOPLE: Black Gambian people with a range of complexions, natural everyday clothing, nobody looks at the lens. " +
  // The picker crops these to a square, so anything important has to sit in the
  // middle of the frame or it will be cut off.
  "FRAMING: the subject is CENTRED in the frame and fills the middle, safe for a square crop — nothing important near the left or right edge. " +
  "SOUND (diegetic only): NO MUSIC of any kind — no soundtrack, no melody, no instrumental bed. Only the real sound of the events in frame. ";

const CLIPS = [
  {
    id: "short-film",
    file: "type-short-film.mp4",
    prompt:
      STYLE +
      "MOTION: one slow confident push-in that settles. " +
      "ACTION: A quiet story moment in a bright sunlit Gambian family courtyard — a grandmother in a " +
      "vivid coral-and-yellow patterned wrapper sits on a low stool shelling groundnuts into a metal " +
      "bowl, while her young granddaughter in a teal school dress leans on her knee, listening to her " +
      "talk. The grandmother's hands keep working as she speaks. Both are centred in frame, close " +
      "together. Bright open daylight, whitewashed wall behind them, pale laundry moving on a line. It " +
      "reads as a scene from a real film, mid-story — two people and a moment between them.",
  },
  {
    id: "dialogue-ad",
    file: "type-dialogue-ad.mp4",
    prompt:
      STYLE +
      "MOTION: a steady handheld two-shot, slight natural float. " +
      "ACTION: Two Gambian traders mid-conversation across a bright fabric stall, both centred in " +
      "frame — a woman in her fifties with a tall teal printed headwrap and light copper-brown skin " +
      "is talking animatedly, gesturing with an open hand, while a younger man with very deep dark " +
      "skin and a clean-shaven head laughs and answers her back. Both are clearly SPEAKING, mouths " +
      "moving, alive in the middle of a real exchange. Bolts of coral and yellow cloth stacked around " +
      "them, daylight bouncing off a white awning above.",
  },
  {
    id: "voiceover-ad",
    file: "type-voiceover-ad.mp4",
    prompt:
      STYLE +
      "MOTION: a slow elegant orbit around the hands. " +
      "ACTION: Nobody speaks — NO ONE IN FRAME TALKS AT ALL, no mouths moving, no lips moving in " +
      "speech. Purely pictorial and illustrative: a close, beautiful centred shot of a Gambian " +
      "woman's hands on a clean white table, unhurriedly spreading golden groundnut paste onto fresh " +
      "tapalapa bread with a butter knife, then setting the knife down and turning the plate slightly " +
      "toward camera. Her face is out of frame throughout — the hands and the food are the whole " +
      "subject, dead centre. Bright white daylight, a glass jar with a coral label just behind her " +
      "hands, everything tactile and appetising. The picture tells the whole thing on its own, with " +
      "no words at all.",
  },

  // ── THE SHORT-FILM MODE PAIR ──────────────────────────────────────────────
  // Matched on purpose: same bright room-quality, same daylight, same kind of
  // people. The ONLY difference is the one the director is being asked about.
  {
    id: "mode-short-film-ad",
    file: "mode-short-film-ad.mp4",
    prompt:
      STYLE +
      "MOTION: a smooth push-in that settles on the two of them across the counter. " +
      "ACTION: A bright, sunlit Gambian shop interior with white-painted walls and daylight pouring through a wide " +
      "doorway. A shopkeeper in her forties with warm golden-brown skin and a bright coral headwrap slides a clean " +
      "glass jar of golden paste across a pale wooden counter toward a younger customer with deep dark-brown skin " +
      "in a teal shirt. He picks the jar up, turns it once in his hand to look at it properly, and nods; she is " +
      "already reaching for a second one. Both are centred in frame, the jar clearly between them. Neat stacked " +
      "shelves of colourful goods behind her, everything bright, clean and appetising. It reads unmistakably as a " +
      "polished advert: there is a PRODUCT in the frame and it is changing hands.",
  },
  {
    id: "mode-short-film-story",
    file: "mode-short-film-story.mp4",
    prompt:
      STYLE +
      "MOTION: a slow, steady handheld hold — no push, no orbit. The camera simply watches. " +
      "ACTION: A bright whitewashed Gambian living room flooded with late-morning daylight from a big window. A " +
      "teenage girl with very deep dark skin and long twists, in a faded yellow dress, stands still in the doorway " +
      "holding a dented old tin with both hands, looking straight at her mother. The mother, in her forties with " +
      "light caramel-brown skin and a teal patterned wrapper, stops halfway through folding a cloth, and her hands " +
      "go still. Neither of them speaks. The girl sets the tin down on the table between them and does not let go " +
      "of it. Both are centred in frame, the tin dead centre between them. NO product, NO packaging, NO label, NO " +
      "logo anywhere in the shot — just two people and something unsaid. It reads unmistakably as a scene from a " +
      "real film, caught mid-story at the moment something changes.",
  },
];

async function exists(file) {
  try {
    await access(path.join(OUT, file));
    return true;
  } catch {
    return false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Create the interaction with background:true and poll until it completes.
 * The blocking form of interactions.create hangs past HTTP idle timeouts while
 * the video renders — see functions/omniVideo.js, which this mirrors.
 */
async function renderClip(prompt) {
  const interaction = await ai.interactions.create({
    model: MODEL,
    input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
    background: true,
    store: true,
  });
  console.log(`    interaction ${interaction.id} created (${interaction.status})`);

  const deadline = Date.now() + DEADLINE_MS;
  let current = interaction;
  while (current.status === "in_progress" || current.status === "queued") {
    if (Date.now() > deadline) {
      throw new Error(`timed out after ${DEADLINE_MS / 1000}s (interaction ${interaction.id})`);
    }
    await sleep(POLL_INTERVAL_MS);
    current = await ai.interactions.get(interaction.id);
  }
  if (current.status !== "completed") {
    throw new Error(
      `${current.status}${current.output_text ? `: ${String(current.output_text).slice(0, 200)}` : ""}`
    );
  }

  const video = current.output_video;
  if (video?.data) return Buffer.from(video.data, "base64");
  if (video?.uri) {
    const res = await fetch(video.uri);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("completed but returned no video");
}

async function generate(item, force) {
  const destPath = path.join(OUT, item.file);
  if (!force && (await exists(item.file))) {
    console.log(`  ✓ ${item.id} — ${item.file} already exists, skipping (use --force to replace)`);
    return "skipped";
  }

  console.log(`\n[${item.id}] generating ${item.file} …`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const buf = await renderClip(item.prompt);
      await writeFile(destPath, buf);
      console.log(`  ✓ ${item.id} saved (${(buf.length / 1024 / 1024).toFixed(1)}MB) → ${destPath}`);
      return "ok";
    } catch (err) {
      const msg = String(err?.message || err);
      console.warn(`  ⚠ attempt ${attempt}/3 failed: ${msg.slice(0, 200)}`);
      if (attempt === 3) throw err;
      const wait = /429|RESOURCE_EXHAUSTED/i.test(msg) ? 45000 : 15000;
      console.log(`  … retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.filter((a) => !a.startsWith("--"));
  const wanted = only.length > 0 ? CLIPS.filter((c) => only.includes(c.id)) : CLIPS;

  if (wanted.length === 0) {
    console.error(`No matching clip ids. Available: ${CLIPS.map((c) => c.id).join(", ")}`);
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });
  console.log(`Generating ${wanted.length} video-type cover clip(s) on ${PROJECT} via ${MODEL}`);

  const failed = [];
  for (const item of wanted) {
    try {
      await generate(item, force);
    } catch (err) {
      failed.push(item.id);
      console.error(`  ✗ ${item.id} failed: ${String(err?.message || err).slice(0, 200)}`);
    }
    await sleep(5000);
  }

  if (failed.length > 0) {
    console.error(`\n✗ Failed: ${failed.join(", ")}. The wizard falls back to the aurora wash for these.`);
    process.exit(1);
  }
  console.log("\n★ Video-type cover clips done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
