/**
 * D-BAX THEME CLIP GENERATOR
 * Generates 11 unique video clips for our pre-built storyboard templates.
 * Authenticates directly with Google Vertex AI using Application Default Credentials (ADC).
 * Saves results directly into public/media/ as template-1.mp4 to template-11.mp4.
 *
 * Modified: Re-engineered all remaining prompts to explicitly and beautifully feature Black Gambian, Black African, or Black people.
 */

import { GoogleGenAI } from "@google/genai";
import { mkdir, writeFile, access } from "fs/promises";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const OUT = path.join(process.cwd(), "public", "media");

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: "global"
});

const VEO = "gemini-omni-flash-preview";

const TEMPLATE_PROMPTS = [
  {
    id: 1,
    file: "template-1.mp4",
    prompt: "=== STYLE === REGISTER: cinematic documentary-true, grounded and honest. OPTICS: shallow depth of field, gentle film grain, soft natural halation, warm filmic color. MOTION: camera moves with intent - smooth tracking shot slowly moving closer. NO character ever looks into the lens; eyelines are on the cooking pot. Hyper-realistic performance. SETTING: A beautiful traditional family compound in Gunjur at sunset. LIGHTING: warm late-afternoon daylight as key, soft ambient bounce off the sandy ground, warm under-glow on hands from the small cooking fire. COLOR: Warm, earthy, lightly desaturated. SOUND (diegetic only; voiceover separate): Bubble and sizzle of the pot, scrape of the wooden spoon, soft crackle of firewood. ACTION: A hardworking woman is preparing a welcoming meal, slow-cooking a rich, steaming groundnut sauce in a dark metal pot over open embers."
  },
  {
    id: 2,
    file: "template-2.mp4",
    prompt: "=== STYLE === REGISTER: warm comedic feel-good, grounded and honest. OPTICS: shallow depth of field, gentle film grain, soft natural halation, warm filmic color. MOTION: camera moves with intent - slow tracking push towards the cupboard. NO character ever looks into the lens; eyelines are on the jars. Hyper-realistic performance. SETTING: A cozy, sunlit modest kitchen in Serekunda. LIGHTING: soft daylight pouring in from a nearby window, casting real shadows across the cupboards. COLOR: warm and cozy, golden tones. SOUND (diegetic only; voiceover separate): Creak of the cupboard door, soft thud of a glass jar, quick rustle of paper. ACTION: A young Gambian boy comes home from school, opens a wooden cupboard, and happily discovers a fresh jar of nut butter, spreading it on local bread with a bright smile."
  },
  {
    id: 3,
    file: "template-3.mp4",
    prompt: "=== STYLE === REGISTER: supreme award-tier cinema, dynamic and fast-paced. OPTICS: shallow depth of field, soft natural halation, anamorphic feel. MOTION: camera moves with intent - smooth lateral pan tracking along the counter. NO character ever looks into the lens; eyelines are on the phones. Hyper-realistic performance. SETTING: A lively, bustling tailor shop in Serekunda. LIGHTING: bright natural daylight bouncing off colorful fabrics, cool soft screen glow on faces from mobile phones. COLOR: rich, saturated tones of indigo and marigold. SOUND (diegetic only; voiceover separate): Whir of a sewing machine, chatter of the market, digital ping of a successful payment. ACTION: Active market vendors and shopkeepers managing transactions and ledger entries on their mobile screens with high confidence."
  },
  {
    id: 4,
    file: "template-4.mp4",
    prompt: "=== STYLE === REGISTER: cinematic documentary-true, inspirational. OPTICS: shallow depth of field, gentle film grain, anamorphic feel. MOTION: camera moves with intent - slow, steady tracking push alongside the vehicle. NO character ever looks into the lens; eyelines are forward. Hyper-realistic performance. SETTING: A regional supply point at a quiet dawn. LIGHTING: deep pre-dawn blue-grey ambient, warming to first golden amber low on the horizon, with a single bright bulb. COLOR: muted working tones with the purple accent of a jacket standing out. SOUND (diegetic only; voiceover separate): Low rumble of a diesel engine, creak of cargo doors being shut, faint birds. ACTION: An active, young Black Gambian female entrepreneur loading crates of local goods onto a shipping truck at first light, coordinating with suppliers."
  },
  {
    id: 5,
    file: "template-5.mp4",
    prompt: "=== STYLE === REGISTER: warm comedic feel-good, exciting and electric. OPTICS: shallow depth of field, soft natural halation, anamorphic feel. MOTION: camera moves with intent - dynamic handheld drift back-and-forth capturing excitement. NO character ever looks into the lens; eyelines are on the match. Hyper-realistic performance. SETTING: A local sports parlor under neon light. LIGHTING: dark interior with a flickering green neon light, bright screen glow cast onto faces. COLOR: saturated, vibrant neon highlights against dark shadows. SOUND (diegetic only; voiceover separate): Raw roar of cheering fans, high-fives slapping, heavy thud of feet on wooden benches. ACTION: A group of active, young Black Gambian friends in a parlor erupting in sheer celebration as a goal is scored, high-fiving and hugging under stadium screen glow."
  },
  {
    id: 6,
    file: "template-6.mp4",
    prompt: "=== STYLE === REGISTER: ultra-premium food-commercial, sleek and chic. OPTICS: shallow depth of field, soft natural halation, warm filmic color. MOTION: camera moves with intent - smooth slow tracking shot keeping pace. NO character ever looks into the lens; eyelines are forward. Hyper-realistic performance. SETTING: A sun-drenched, palm-lined coastal street. LIGHTING: bright golden hour daylight with hot sun-rim on shoulders and hair. COLOR: highly saturated golden warm tones. SOUND (diegetic only; voiceover separate): Rustle of palm leaves, ocean breeze, soft clicking of cameras. ACTION: A striking, confident young Black Gambian female model with a natural afro walking gracefully along the palm-lined coastal boardwalk, showcasing a summer knitwear line."
  },
  {
    id: 7,
    file: "template-7.mp4",
    prompt: "=== STYLE === REGISTER: supreme award-tier cinema, futuristic and tech. OPTICS: shallow depth of field, gentle film grain, anamorphic feel. MOTION: camera moves with intent - smooth lateral panning. NO character ever looks into the lens; eyelines are on the tech. Hyper-realistic performance. SETTING: A pristine modern robotics studio. LIGHTING: cool ambient light, bright cyan indicator screen glow, sharp crisp rim lighting on metallic structures. COLOR: desaturated grey base with clean cyan accents. SOUND (diegetic only; voiceover separate): Soft hum of a high-tech motor, faint beep of digital sensors, click of a key. ACTION: A talented, focused young Black African robotics engineer adjusting and calibrating a precision robotic arm inside a modern tech laboratory."
  },
  {
    id: 8,
    file: "template-8.mp4",
    prompt: "=== STYLE === REGISTER: warm comedic feel-good, dreamy and playful. OPTICS: shallow depth of field, soft natural halation, warm filmic color. MOTION: camera moves with intent - slow downward boom shot. NO character ever looks into the lens. Hyper-realistic feel. SETTING: A cozy African-styled playroom. LIGHTING: soft afternoon sun pouring through a window, casting warm amber shadows across the floor. COLOR: warm amber and earthy brown tones with colorful cushions. SOUND (diegetic only; voiceover separate): Soft wooden clatter, faint giggles, birds in the background. ACTION: A series of wooden blocks and toys sitting on a detailed patterned rug, basking in a warm afternoon sunbeam."
  },
  {
    id: 9,
    file: "template-9.mp4",
    prompt: "=== STYLE === REGISTER: supreme award-tier cinema, moody and cinematic. OPTICS: shallow depth of field, anamorphic feel, soft natural halation. MOTION: camera moves with intent - steady tracking following behind. NO character ever looks into the lens; eyelines are on the street. Hyper-realistic performance. SETTING: A wet city street at night in heavy mist. LIGHTING: single-source neon signs, reflections on the wet asphalt, atmospheric backlit fog. COLOR: moody, low-key, dark blues and neon reds. SOUND (diegetic only; voiceover separate): Gentle patter of rain, distant hum of city traffic, splash of water. ACTION: A tall, contemplative Black Gambian man in his 20s wearing a dark hooded rain jacket walking down a rain-soaked, neon-lit alleyway, the backlight highlighting the rain jacket and mist."
  },
  {
    id: 10,
    file: "template-10.mp4",
    prompt: "=== STYLE === REGISTER: cinematic documentary-true, candid and warm. OPTICS: shallow depth of field, soft natural halation, gentle film grain. MOTION: camera moves with intent - slow tracking panning. NO character ever looks into the lens; eyelines are on each other. Hyper-realistic performance. SETTING: A bright beach boardwalk at midday. LIGHTING: harsh, bright direct midday sun, soft natural sand-bounce fill. COLOR: rich ocean blues and sandy golds. SOUND (diegetic only; voiceover separate): Call of seagulls, gentle roar of breaking waves, warm laughter. ACTION: A group of happy, young Black Gambian friends sharing candid laughter on a sunny boardwalk, ocean waves and palm trees in the background."
  },
  {
    id: 11,
    file: "template-11.mp4",
    prompt: "=== STYLE === REGISTER: supreme award-tier cinema, adventure and cinematic. OPTICS: shallow depth of field, anamorphic feel, cold halation. MOTION: camera moves with intent - slow push-out. NO character ever looks into the lens; eyelines are on the forest. Hyper-realistic performance. SETTING: A rustic cabin doorway overlooking a snowy forest. LIGHTING: cold blue twilight ambient, casting long crisp shadows on the snow. COLOR: cool blue-grey desaturated palette with a single warm lantern spark. SOUND (diegetic only; voiceover separate): Crunch of snow under boots, wind sighing through pine branches. ACTION: Two intrepid Black explorers equipped with rugged backpacks stepping out of a dark wood cabin into a silent, snow-covered forest."
  }
];

async function exists(file) {
  try {
    await access(path.join(OUT, file));
    return true;
  } catch {
    return false;
  }
}

async function generateSingleTemplateVideoDirect(item) {
  const destPath = path.join(OUT, item.file);
  if (await exists(item.file)) {
    console.log(`  ✓ Template ${item.id} (${item.file}) already exists. Skipping.`);
    return;
  }

  console.log(`\n[Template ${item.id}] Generating ${item.file} via direct Vertex AI (${VEO})...`);
  
  let attempts = 3;
  for (let i = 1; i <= attempts; i++) {
    try {
      const interaction = await ai.interactions.create({
        model: VEO,
        input: item.prompt
      });

      if (!interaction || !interaction.output_video || !interaction.output_video.data) {
        throw new Error("No video data in response");
      }

      await writeFile(destPath, Buffer.from(interaction.output_video.data, "base64"));
      console.log(`  ✓ Template ${item.id} video successfully saved to: ${destPath}`);
      return;
    } catch (err) {
      console.warn(`  ⚠ Attempt ${i}/${attempts} for Template ${item.id} failed: ${err.message}`);
      if (i < attempts && err.message.includes("429")) {
        console.log(`  … 429 rate limit hit. Sleeping for 45s before retry…`);
        await new Promise(r => setTimeout(r, 45000));
      } else if (i === attempts) {
        throw err;
      }
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("Initializing direct Vertex AI generation for the 11 Pre-Built Cinematic Vibe Templates...");

  // We process them sequentially with a rate-limiting gap of 5-10s to avoid overloading Vertex AI quota
  for (const item of TEMPLATE_PROMPTS) {
    try {
      await generateSingleTemplateVideoDirect(item);
      // Wait a tiny bit between tasks
      await new Promise(r => setTimeout(r, 10000));
    } catch (err) {
      console.error(`✗ Failed to generate Template ${item.id}: ${err.message}`);
    }
  }
  console.log("\n★ Vertex AI generation sequence completed.");
}

main().catch(console.error);
