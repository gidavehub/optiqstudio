import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "davelabs-tools";
const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);

const USER_EMAIL = "davelabs01@gmail.com";
const USER_UID = "0UKyj7haD1R6PA315WlraeQoszn1";

// ── 1. CLEANUP PREVIOUS SHOWCASE PROJECT ONLY ──────────────────────────────
async function cleanupPreviousShowcase() {
  console.log(`\n[CLEANUP] Searching for previous 'Optiq Studio - Commercial Ad & Agent Flow' project...`);
  const projectsSnap = await db.collection("projects")
    .where("uid", "==", USER_UID)
    .where("title", "==", "Optiq Studio - Commercial Ad & Agent Flow (60s)")
    .get();

  if (!projectsSnap.empty) {
    for (const doc of projectsSnap.docs) {
      console.log(`  - Deleting old project ID: ${doc.id}`);
      await doc.ref.delete();
    }
  }
}

// ── 2. NEW 6-SCENE SUITE (4 MOBILE APPLE-STYLE UI + 2 AGENT TEXT NODES) ─────
const NEW_SCENES_V3 = [
  {
    sceneNumber: 1,
    setting: "Vibrant Fashion Boutique in Dakar — Marigold yellow walls, bolts of indigo fabric, a stylish Black female boutique owner holding her smartphone.",
    action: "A sleek Apple-style frosted UI window floats cleanly in the air with the Optiq Studio logo header. An input prompt text box sits at the top with a digital keyboard floating underneath. As she types on her phone, on-screen keyboard keys highlight and text fills the input box in real-time: 'Generate a 10-second high-energy fashion ad for West African luxury dresses...' Camera orbits gently around her.",
    sound: "Soft digital keyboard typing clicks, subtle UI feedback chime, cheerful ambient background music.",
    dialogue: "",
    fullPrompt: `STYLE: Modern commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic. Semi-transparent Apple-style frosted Glassmorphic UI window overlay. Single continuous orbit camera motion. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- NO SOLID 3D GLASS BRICKS OR BLOCKS.
- UI OVERLAY: A clean 2D semi-transparent Apple iOS/Vision Pro style Glassmorphic UI window displaying:
  1. Optiq Studio double-circle logo at the top header.
  2. A clear rectangular input prompt box with a glowing cursor.
  3. A floating digital keyboard below the prompt box.
- CAST: A stylish Black West African female fashion boutique owner holding her smartphone.
- ACTION: She taps her smartphone screen as on-screen keyboard keys highlight and text types into the prompt box.

THE SETTING: A colorful, high-end fashion boutique with vibrant marigold yellow walls and bolts of indigo wax-print fabrics.

UI OVERLAY & ACTION:
[0.0–10.0s] A clean, semi-transparent frosted Glassmorphic UI window floats in front of the camera. At the top header, the Optiq Studio double-circle logo sits cleanly above a rectangular text prompt box. Below the prompt box, a digital software keyboard lights up as the female business owner taps her phone screen. On-screen text types out inside the box: "Generate a 10-second high-energy fashion ad for West African luxury dresses..." The camera orbits smoothly around her.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture. Warm studio key lighting.

SOUND: Soft digital keyboard clicks, gentle UI chime, quiet shop tone.`
  },
  {
    sceneNumber: 2,
    setting: "Sunlit Artisan Cafe in Lagos — Warm terracotta brick background, espresso machine, a handsome Black male coffee shop owner holding his smartphone.",
    action: "A clean Apple-style frosted UI window floats on screen with the Optiq Studio logo header, a prompt input box, and a digital keyboard underneath. As he types on his phone, the on-screen keyboard depresses and text fills the prompt box: 'Create a morning coffee commercial with golden sunlight and rich aroma...' Camera glides in a smooth lateral dolly slide.",
    sound: "Soft digital keyboard clicks, subtle UI chime, faint cafe background ambience.",
    dialogue: "",
    fullPrompt: `STYLE: Modern commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic. Semi-transparent Apple-style frosted Glassmorphic UI window overlay. Single continuous lateral dolly tracking motion. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- NO SOLID 3D GLASS BRICKS OR BLOCKS.
- UI OVERLAY: A clean 2D semi-transparent Apple iOS/Vision Pro style Glassmorphic UI window displaying:
  1. Optiq Studio double-circle logo header.
  2. A clear rectangular input prompt box with a glowing cursor.
  3. A floating digital keyboard below the prompt box.
- CAST: Handsome Black West African male cafe owner holding his smartphone.
- ACTION: He taps his phone screen as on-screen keyboard keys highlight and text types into the prompt box.

THE SETTING: A warm, sunlit artisan coffee shop with warm terracotta brick walls, polished wood counters, and morning light.

UI OVERLAY & ACTION:
[0.0–10.0s] A semi-transparent frosted Glassmorphic UI window floats on screen with the Optiq Studio logo header. A rectangular prompt box sits above a digital keyboard. The cafe owner taps his phone screen, causing the digital keyboard keys to depress as prompt text types out: "Create a morning coffee commercial with golden sunlight and rich aroma..." The camera glides laterally in a smooth dolly tracking move.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture. Warm morning sunlight fill.

SOUND: Soft keyboard clicks, subtle UI feedback chime, quiet cafe tone.`
  },
  {
    sceneNumber: 3,
    setting: "Warm Artisan Bakery Kitchen in Serekunda — Flour-dusted wooden counters, golden sourdough loaves, a cheerful Black female baker holding a smartphone.",
    action: "A semi-transparent Apple-style frosted UI window floats on screen with the Optiq Studio logo header, an input prompt box, and a digital keyboard below. As she taps her phone, on-screen keyboard keys light up and text types into the box: 'Create a mouth-watering commercial for fresh bakery bread...' Camera glides forward smoothly.",
    sound: "Soft digital keyboard clicks, faint oven hum, cheerful background tone.",
    dialogue: "",
    fullPrompt: `STYLE: Modern commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic. Semi-transparent Apple-style frosted Glassmorphic UI window overlay. Single continuous forward tracking camera push. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- NO SOLID 3D GLASS BRICKS OR BLOCKS.
- UI OVERLAY: A clean 2D semi-transparent Apple iOS/Vision Pro style Glassmorphic UI window displaying:
  1. Optiq Studio double-circle logo header.
  2. A clear rectangular input prompt box with a glowing cursor.
  3. A floating digital keyboard below the prompt box.
- CAST: Cheerful Black West African female baker holding her smartphone.
- ACTION: She taps her phone screen as on-screen keyboard keys highlight and text types into the prompt box.

THE SETTING: A cozy artisan bakery kitchen with golden sourdough bread trays on flour-dusted wood counters.

UI OVERLAY & ACTION:
[0.0–10.0s] A frosted Glassmorphic UI window floats on screen featuring the Optiq Studio double-circle logo header, an input text box, and a floating digital keyboard. The female baker smiles as she taps her phone screen, typing out prompt text in real-time: "Create a mouth-watering commercial for fresh bakery bread..." The camera moves forward in a smooth push.

CAMERA & LIGHTING: 50mm portrait lens, f/1.8 aperture. Warm golden morning sunlight.

SOUND: Soft keyboard clicks, gentle UI chime, quiet bakery tone.`
  },
  {
    sceneNumber: 4,
    setting: "Modern Creative Media Studio in Abuja — Cobalt blue and cyan studio backdrop, a stylish Black male content creator holding a smartphone.",
    action: "A clean Apple-style frosted UI window floats on screen with the Optiq Studio logo header, a prompt text box, and a floating keyboard. As he taps his phone, on-screen keyboard keys highlight and text types into the box: 'Generate a high-energy tech launch video with crisp sound design...' Camera orbits around him.",
    sound: "Soft digital keyboard clicks, subtle UI feedback tone, cheerful studio music.",
    dialogue: "",
    fullPrompt: `STYLE: Modern commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic. Semi-transparent Apple-style frosted Glassmorphic UI window overlay. Single continuous orbit camera motion. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- NO SOLID 3D GLASS BRICKS OR BLOCKS.
- UI OVERLAY: A clean 2D semi-transparent Apple iOS/Vision Pro style Glassmorphic UI window displaying:
  1. Optiq Studio double-circle logo header.
  2. A clear rectangular input prompt box with a glowing cursor.
  3. A floating digital keyboard below the prompt box.
- CAST: Stylish Black West African male content creator holding his smartphone.
- ACTION: He taps his phone screen as on-screen keyboard keys highlight and text types into the prompt box.

THE SETTING: A sleek creative media studio with cobalt blue and cyan background accent lighting.

UI OVERLAY & ACTION:
[0.0–10.0s] A frosted Glassmorphic UI window floats on screen with the Optiq Studio double-circle logo header. As the creator taps his smartphone screen, digital keyboard keys depress in sequence while prompt text fills the text box: "Generate a high-energy tech launch video with crisp sound design..." The camera orbits smoothly around him.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture. Cobalt blue and cyan studio fill lighting.

SOUND: Soft digital keyboard clicks, subtle UI chime, quiet studio tone.`
  },
  {
    sceneNumber: 5,
    setting: "Minimalist White Background Multi-Agent Flowchart Interface — Pure clean white background, 5 black dots appearing in sequence with explicit text labels and arrow lines.",
    action: "On a pristine solid white canvas, 5 black dots appear in sequence, each displaying explicit black text labels below: 'Director', 'Stage Builder', 'Character Designer', 'Soundscape Mixer', and 'Cinematographer'. Black arrow connector lines extend from each dot, pointing directly to a central black dot labeled 'Optiq Agent'. Camera zooms out smoothly.",
    sound: "Minimalist pen-draw pops, clean UI node chimes, pristine silence.",
    dialogue: "",
    fullPrompt: `STYLE: Minimalist 2D flowchart vector interface, solid white background, high-contrast black graphics and explicit text labels. Zero 3D clutter, zero sci-fi glow. Single continuous zoom-out motion. ABSOLUTELY NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BACKGROUND: Solid, pristine, ultra-clean white canvas.
- TEXT LABELS: MANDATORY EXPLICIT TEXT WRITTEN UNDER EACH NODE DOT:
  - Node 1 text: "Director"
  - Node 2 text: "Stage Builder"
  - Node 3 text: "Character Designer"
  - Node 4 text: "Soundscape Mixer"
  - Node 5 text: "Cinematographer"
- CONNECTORS: Simple black arrow lines pointing from each node to the central "Optiq Agent" node.
- NO 3D BRICKS, NO GLITCHY LIGHTNING. Pure, clean, minimalist flowchart.

THE SETTING & ACTION:
[0.0–10.0s] On a pure white background, 5 black node dots appear gracefully in sequence. Underneath each dot, explicit black text labels draw out: "Director", "Stage Builder", "Character Designer", "Soundscape Mixer", and "Cinematographer". Clean black arrow lines smoothly extend from each node dot, connecting inward to a central black node dot labeled "Optiq Agent". The camera zooms out smoothly to display the complete 5-agent flowchart.

CAMERA & LIGHTING: 2D orthographic view, crisp black text on white canvas.

SOUND: Subtle pen-draw pops, clean node chimes, pristine quiet tone.`
  },
  {
    sceneNumber: 6,
    setting: "Optiq Central Agent & Live Video Generation Preview UI — Clean white interface transitioning into an Apple-style video rendering preview window.",
    action: "The central 'Optiq Agent' node triggers a clean, Apple-style UI preview window. A progress bar fills smoothly to 100%, and a live 4K video advertisement preview plays inside the window displaying the compiled commercial scene coming to life. Camera holds on the completed scene preview.",
    sound: "Soft UI completion chime, smooth audio swell, cheerful video soundtrack.",
    dialogue: "",
    fullPrompt: `STYLE: Clean Apple-style software interface, solid white background transitioning to an active video preview window. Single continuous camera hold and gentle push. ABSOLUTELY NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- UI OVERLAY: A clean 2D Apple-style video generation window displaying:
  1. Progress bar filling to 100% with 'RENDER COMPLETE' badge.
  2. Live 4K commercial video preview playing smoothly inside the window.
- NO SOLID 3D GLASS BRICKS, NO GLITCHY BLUE LIGHTNING. Pure clean software UI.

THE SETTING & ACTION:
[0.0–10.0s] Continuing on the clean white canvas, the central "Optiq Agent" node triggers a sleek Apple-style video generation window. A progress bar animates to 100% with a green checkmark badge, and the video preview box plays a vibrant, fully built 4K commercial ad coming to life in real-time. The camera holds on the crisp preview window.

CAMERA & LIGHTING: Crisp 2D optical clarity, high contrast.

SOUND: UI completion chime, cheerful audio swell.`
  }
];

async function seedOptiqV3() {
  console.log(`[SEED] Cleaning previous project and seeding NEW Optiq Studio V3 project for UID: ${USER_UID}...`);

  await cleanupPreviousShowcase();

  const projRef = db.collection("projects").doc();
  const videoStatus = {};
  const scenes = [];

  NEW_SCENES_V3.forEach((s) => {
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
    title: "Optiq Studio - Mobile Ad UI & Agent Flow (60s)",
    concept: "Official 60-Second Optiq Studio Showcase. Scenes 1-4 feature young African business owners using their mobile phones with a clean Apple-style frosted Glassmorphic UI window (prompt box + floating keyboard + double circle logo header). Scenes 5-6 feature a pristine white background agent flowchart with explicit text labels (Director, Stage Builder, Character Designer, Soundscape Mixer, Cinematographer) connecting to Optiq Agent.",
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
      name: "African Entrepreneurs & Optiq Agent Flow",
      description: "Boutique owners, cafe owners, bakers, and creators using smartphones with Apple-style frosted UI overlay.",
      wardrobe: "Stylish everyday business attire and aprons.",
    },
    styleHeader: "Modern commercial advertisement register, 35mm film feel, highly aesthetic, photorealistic. Semi-transparent Apple-style frosted Glassmorphic UI window overlay.",
    musicSpec: "Upbeat, cheerful, modern commercial soundtrack with crisp digital UI feedback.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await projRef.set(projectData);

  console.log(`\n======================================================`);
  console.log(`[SUCCESS] New Optiq Studio V3 Project successfully created in Firestore!`);
  console.log(`Project ID: ${projRef.id}`);
  console.log(`Title: ${projectData.title}`);
  console.log(`Owner UID: ${USER_UID} (${USER_EMAIL})`);
  console.log(`Scenes Count: ${scenes.length} (10s each, 60s total)`);
  console.log(`======================================================\n`);
}

seedOptiqV3().catch((err) => {
  console.error("[ERROR] Failed to seed V3 project:", err);
  process.exit(1);
});
