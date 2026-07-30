import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const PROJECT_ID = "davelabs-tools";
const app = initializeApp({ projectId: PROJECT_ID, storageBucket: PROJECT_ID });
const db = getFirestore(app);
const storage = getStorage(app);

const USER_EMAIL = "davelabs01@gmail.com";
const USER_UID = "0UKyj7haD1R6PA315WlraeQoszn1";

// ── 1. CLEANUP PREVIOUS SHOWCASE PROJECT ONLY ──────────────────────────────
async function cleanupPreviousShowcase() {
  console.log(`\n[CLEANUP] Searching for previous 'Optiq Studio - Ad Generation Showcase' project for UID ${USER_UID}...`);
  const projectsSnap = await db.collection("projects")
    .where("uid", "==", USER_UID)
    .where("title", "==", "Optiq Studio - Ad Generation Showcase (30s)")
    .get();

  if (!projectsSnap.empty) {
    for (const doc of projectsSnap.docs) {
      console.log(`  - Deleting old showcase project ID: ${doc.id}`);
      await doc.ref.delete();
    }
  } else {
    console.log(`[CLEANUP] No previous showcase project found.`);
  }

  try {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix: `generations/${USER_UID}/FA0aVmkWRX3Gw6V2RVj7` });
    for (const file of files) {
      console.log(`  - Deleting file: ${file.name}`);
      await file.delete().catch(() => {});
    }
  } catch (err) {
    console.warn(`[CLEANUP WARNING] Storage cleanup notice: ${err.message}`);
  }
}

// ── 2. NEW 6-SCENE SUITE (4 AD TYPING + 2 MINIMAL AGENT FLOWCHART) ──────────
const NEW_SCENES = [
  {
    sceneNumber: 1,
    setting: "Modern Commercial Bank Office in Lagos — Saturated warm amber and mahogany interior, a handsome Black male banker in a tailored dark blue suit sitting at a sleek desk holding a laptop.",
    action: "A liquid transparent see-through glass UI floats over the scene featuring the minimalist Optiq Studio logo (two clean concentric circles) at the top. On-screen glass keyboard keys depress as he types ad prompt text: 'Create a high-yielding wealth management commercial with warm golden sunset lighting...' Camera orbits smoothly around him as text fills the liquid glass container.",
    sound: "Soft glass-tap keyboard sounds, warm ambient office tone, subtle cheerful acoustic melody.",
    dialogue: "",
    fullPrompt: `STYLE: Vibrant African commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic, and grounded in real-world business value. Liquid transparent glass UI overlay with minimal double-concentric circle logo. Single continuous orbit camera motion. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BRANDING: Optiq Studio logo represented as two clean, minimal concentric circles atop a liquid transparent see-through glass UI container.
- ENVIRONMENT: Real-world, colorful, aesthetically pleasing banking & wealth management office in Lagos.
- CAST: Black West African banker in a tailored suit.
- NO GLITCHY BLUE TECH / NO FUTURISTIC LIGHTNING HUDs. Pure liquid transparent glass UI.

THE SETTING: A warm, sophisticated commercial banking executive office. Saturated mahogany wood panels, warm amber desk lamps, and a floor-to-ceiling window revealing a vibrant city skyline.

UI OVERLAY & ACTION:
[0.0–10.0s] A sleek, see-through liquid transparent glass UI container floats elegantly above the desk with the minimal Optiq Studio double-circle logo at the top. A Black male banker in a navy suit types on his laptop as the liquid glass keyboard depresses with subtle refraction highlights. Custom ad text fills the glass box: "Create a high-yielding wealth management commercial with warm golden sunset lighting..." The camera orbits smoothly around him, capturing his confident posture and the glowing text.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture. Warm 3200K key lighting with rich golden reflections on liquid glass.

SOUND: Subtle glass keyboard tap tones, quiet executive office ambience.`
  },
  {
    sceneNumber: 2,
    setting: "Vibrant Automotive & Precision Workshop in Abuja — Clean, colorful workshop with cobalt blue tool racks, a handsome Black male master mechanic in clean denim overalls holding a tablet.",
    action: "Liquid transparent see-through glass UI overlay with the Optiq Studio double-circle logo. Keyboard keys depress as he types on his tablet: 'Generate a 10-second high-energy commercial for premium brake service, 4K resolution...' Camera executes a smooth lateral dolly slide as text fills the liquid glass interface.",
    sound: "Gentle glass-tap sounds, soft mechanical workshop background ambience, cheerful rhythm.",
    dialogue: "",
    fullPrompt: `STYLE: Vibrant African commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic, and grounded in real-world business value. Liquid transparent glass UI overlay with minimal double-concentric circle logo. Single continuous lateral dolly camera motion. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BRANDING: Optiq Studio logo represented as two clean, minimal concentric circles atop a liquid transparent see-through glass UI container.
- ENVIRONMENT: Real-world, colorful, aesthetically pleasing automotive workshop with cobalt blue racks and polished floor.
- CAST: Black West African master mechanic in clean denim overalls.
- NO GLITCHY BLUE TECH / NO FUTURISTIC LIGHTNING HUDs. Pure liquid transparent glass UI.

THE SETTING: A spotless, high-end automotive workshop with cobalt blue tool cabinets, organized chrome tools, and warm overhead pendant lights.

UI OVERLAY & ACTION:
[0.0–10.0s] A transparent see-through liquid glass UI floats over the scene with the Optiq Studio double-circle logo at the top header. A Black male mechanic holds a ruggedized tablet, typing with his thumb as the liquid glass UI displays real-time prompt text: "Generate a 10-second high-energy commercial for premium brake service, 4K resolution..." The camera glides laterally in a smooth dolly tracking move.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture. Cobalt blue ambient lighting with warm overhead tungsten fill.

SOUND: Soft glass tap clicks, quiet shop ambience.`
  },
  {
    sceneNumber: 3,
    setting: "Sunlit Artisan Bakery in Serekunda — Warm golden flour dusting on wooden counters, trays of fresh golden-brown pastries, a cheerful Black female baker in a white apron holding a phone.",
    action: "Liquid transparent see-through glass UI overlay with the Optiq Studio double-circle logo. On-screen keyboard depresses as she types on her phone: 'Create a mouth-watering commercial for fresh sourdough loaves, morning sunlight...' Camera glides in a slow forward tracking push.",
    sound: "Soft glass keyboard clicks, faint oven hum, cheerful bakery background audio.",
    dialogue: "",
    fullPrompt: `STYLE: Vibrant African commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic, and grounded in real-world business value. Liquid transparent glass UI overlay with minimal double-concentric circle logo. Single continuous forward tracking camera push. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BRANDING: Optiq Studio logo represented as two clean, minimal concentric circles atop a liquid transparent see-through glass UI container.
- ENVIRONMENT: Real-world, colorful, aesthetically pleasing bakery with fresh golden bread and warm morning light.
- CAST: Black West African female baker in a white apron.
- NO GLITCHY BLUE TECH / NO FUTURISTIC LIGHTNING HUDs. Pure liquid transparent glass UI.

THE SETTING: A cozy, sunlit artisan bakery in Serekunda. Trays of freshly baked golden loaves of bread and croissants rest on a flour-dusted wooden counter under warm morning sunbeams.

UI OVERLAY & ACTION:
[0.0–10.0s] A see-through liquid transparent glass UI container sits over the bakery counter with the minimal Optiq Studio double-circle logo at the top. A Black female baker smiles warmly while typing on her phone. The liquid glass UI registers keyboard presses as text types out: "Create a mouth-watering commercial for fresh sourdough loaves, morning sunlight..." Camera glides smoothly forward toward her.

CAMERA & LIGHTING: 50mm portrait lens, f/1.8 aperture. Warm golden morning sunlight streaming from camera-left.

SOUND: Glass keyboard tap clicks, soft oven hum, warm morning room tone.`
  },
  {
    sceneNumber: 4,
    setting: "Colorful Fashion Boutique & Tailor Atelier in Dakar — Rich bolts of wax-print fabric in marigold yellow and royal indigo, a stylish Black female fashion designer operating a laptop.",
    action: "Liquid transparent see-through glass UI overlay with the Optiq Studio double-circle logo. Keyboard keys depress as she types on her laptop: 'Generate a luxury fashion runway commercial showcasing traditional African textiles...' Camera orbits around her workstation.",
    sound: "Soft glass keyboard clicks, fabric rustle, cheerful ambient melody.",
    dialogue: "",
    fullPrompt: `STYLE: Vibrant African commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic, and grounded in real-world business value. Liquid transparent glass UI overlay with minimal double-concentric circle logo. Single continuous orbit camera motion. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BRANDING: Optiq Studio logo represented as two clean, minimal concentric circles atop a liquid transparent see-through glass UI container.
- ENVIRONMENT: Real-world, colorful, aesthetically pleasing fashion atelier with rich indigo and marigold fabrics.
- CAST: Black West African female fashion designer in stylish attire.
- NO GLITCHY BLUE TECH / NO FUTURISTIC LIGHTNING HUDs. Pure liquid transparent glass UI.

THE SETTING: A high-fashion tailor atelier in Dakar. Walls lined with bolts of vibrant indigo, gold, and magenta wax-print fabrics, dress mannequins, and warm studio lighting.

UI OVERLAY & ACTION:
[0.0–10.0s] A see-through liquid glass UI container floats over the cutting table with the minimal Optiq Studio double-circle logo centered at the top. A Black female designer types on her laptop as the liquid glass keyboard depresses with subtle refraction highlights: "Generate a luxury fashion runway commercial showcasing traditional African textiles..." The camera orbits smoothly around her.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture. Saturated indigo, gold, and magenta color palette.

SOUND: Subtle glass tap clicks, soft fabric rustle, warm studio audio.`
  },
  {
    sceneNumber: 5,
    setting: "Minimalist White Background Multi-Agent Flowchart Interface — Pure clean white background, simple black node dots appearing in sequence with minimalist connecting arrow lines.",
    action: "On a pristine white background, 5 black dots appear sequentially, labeled: 'Director', 'Stage Builder', 'Character Designer', 'Soundscape Mixer', and 'Cinematographer'. Simple black arrow lines draw outward, connecting all 5 independent agent dots to a central black dot labeled 'Optiq Agent'. Camera zooms out smoothly to reveal the complete connected node network.",
    sound: "Clean subtle pen-draw chimes, soft minimalist acoustic pop tones, pristine room tone.",
    dialogue: "",
    fullPrompt: `STYLE: Ultra-minimalist clean flowchart animation, pristine white background, simple black vector graphics. Zero clutter, zero sci-fi glow, zero electric lines. Single continuous zoom-out motion. ABSOLUTELY NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BACKGROUND: Pristine, solid, ultra-clean white canvas.
- GRAPHICS: Simple black dots, clean black arrow connector lines, and crisp minimalist black typography labels.
- AGENT NODES: 5 independent agent dots labeled 'Director', 'Stage Builder', 'Character Designer', 'Soundscape Mixer', 'Cinematographer', connecting to a central 'Optiq Agent' dot.
- NO GLITCHY BLUE TECH, NO COMPLEX HUDs, NO SCI-FI LIGHTNING. Pure, simple, elegant agent flowchart.

THE SETTING & ACTION:
[0.0–10.0s] On a pure white background, a central black dot labeled "Optiq Agent" rests in the center. Five surrounding black dots pop up gracefully in sequence, each displaying crisp black text labels: "Director", "Stage Builder", "Character Designer", "Soundscape Mixer", and "Cinematographer". Clean black arrow lines smoothly extend from each surrounding dot to converge into the central Optiq Agent dot. The camera zooms out smoothly to show the complete, balanced multi-agent collaboration graph.

CAMERA & LIGHTING: Flat 2D orthographic perspective, crisp high-contrast black on white.

SOUND: Minimalist pen-draw pops, subtle clean chimes, pristine silence.`
  },
  {
    sceneNumber: 6,
    setting: "Optiq Central Agent Script Writing & Scene Compilation UI — Pure clean white interface transitioning into a simple, elegant scene building preview box.",
    action: "The central 'Optiq Agent' receives all 5 inputs and writes out a clean, elegant text script blueprint. The white interface smoothly opens a simple, high-definition preview box showing a colorful, fully built commercial scene coming to life step-by-step. Camera holds on the completed scene preview.",
    sound: "Soft script writing chime, cheerful completion tone, smooth audio swell.",
    dialogue: "",
    fullPrompt: `STYLE: Ultra-minimalist clean software interface, pristine white canvas transitioning to a vibrant commercial preview box. Zero clutter, zero sci-fi glow. Single continuous camera hold and gentle push. ABSOLUTELY NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BACKGROUND: Clean white canvas transitioning to a structured scene preview UI.
- ACTION: Central Optiq Agent writes out a clean text script blueprint, which then triggers a simple, colorful commercial scene preview box to render step-by-step.
- NO GLITCHY BLUE TECH, NO SCI-FI LIGHTNING. Pure, clean, satisfying scene compilation UI.

THE SETTING & ACTION:
[0.0–8.0s] Building from Scene 5 on the clean white background, the central Optiq Agent icon generates a clean text script blueprint in black typography. At [8.0–10.0s], a simple, elegant rectangular preview box expands, displaying a vibrant, fully built 4K commercial scene coming to life with rich colors and studio lighting.

CAMERA & LIGHTING: Clean high-contrast lighting, 35mm optical clarity.

SOUND: Soft script typing chime, cheerful completion tone, warm audio swell.`
  }
];

async function seedOptiqV2() {
  console.log(`[SEED] Cleaning previous showcase and seeding NEW 6-scene Optiq Studio project for UID: ${USER_UID}...`);

  await cleanupPreviousShowcase();

  const projRef = db.collection("projects").doc();
  const videoStatus = {};
  const scenes = [];

  NEW_SCENES.forEach((s) => {
    const idx = s.sceneNumber - 1;
    videoStatus[idx] = { status: "idle", revisionInput: "", customPrompt: "" };
    scenes.push({
      sceneNumber: s.sceneNumber,
      setting: s.setting,
      action: s.action,
      sound: s.sound,
      dialogue: s.dialogue,
      fullPrompt: s.fullPrompt,
      duration: 10,
    });
  });

  const projectData = {
    id: projRef.id,
    uid: USER_UID,
    title: "Optiq Studio - Commercial Ad & Agent Flow (60s)",
    concept: "Official 60-Second Commercial Ad & Multi-Agent Flow Project. Scenes 1-4 feature real-world African business environments (Bankers, Mechanics, Bakery, Fashion Atelier) with liquid transparent see-through glass UI and Optiq Studio double-circle logo. Scenes 5-6 feature a pristine white background agent flowchart and scene compilation UI.",
    brandName: "Optiq Studio",
    product: "Optiq Studio",
    length: "60s",
    aspectRatio: "16:9",
    pipelineStage: "ready",
    pipelineError: null,
    pipelineProgress: null,
    scenes: scenes,
    videoStatus: videoStatus,
    characterLock: {
      name: "African Business Owners & Optiq Agents",
      description: "Bankers, mechanics, bakers, and fashion designers using liquid glass UI, plus minimalist agent flowcharts.",
      wardrobe: "Tailored suits, denim overalls, baker aprons, and fashion atelier attire.",
    },
    styleHeader: "Vibrant African commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic, and grounded in real-world business value. Liquid transparent glass UI overlay with minimal double-concentric circle logo.",
    musicSpec: "Upbeat, cheerful, modern commercial acoustic melody with clean UI feedback tones.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await projRef.set(projectData);

  console.log(`\n======================================================`);
  console.log(`[SUCCESS] New Optiq Studio Commercial Project successfully created in Firestore!`);
  console.log(`Project ID: ${projRef.id}`);
  console.log(`Title: ${projectData.title}`);
  console.log(`Owner UID: ${USER_UID} (${USER_EMAIL})`);
  console.log(`Scenes Count: ${scenes.length} (10s each, 60s total)`);
  console.log(`======================================================\n`);
}

seedOptiqV2().catch((err) => {
  console.error("[ERROR] Failed to seed project:", err);
  process.exit(1);
});
