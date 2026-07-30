import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "davelabs-tools";
const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);

const USER_EMAIL = "davelabs01@gmail.com";
const USER_UID = "0UKyj7haD1R6PA315WlraeQoszn1";

const SHOWCASE_SCENES = [
  {
    sceneNumber: 1,
    setting: "Vibrant Stage-Built Studio Backdrop in Warm Yellow & Amber — Young West African female entrepreneur in modern yellow linen shirt working on a sleek laptop.",
    action: "A mobile/web UI overlay is rendered on screen with the Optiq Studio logo prominently at the top. On-screen keyboard keys depress as custom ad description text is typed into the prompt box: 'Create a high-energy cinematic commercial for a West African fashion brand, warm studio lighting, 4K film register...' Camera executes a smooth forward push toward the display.",
    sound: "Soft rhythmic keyboard typing clicks, subtle UI chime, warm ambient background studio music.",
    dialogue: "",
    fullPrompt: `STYLE: Vibrant colorful stage-built commercial studio register, 35mm cinema film feel, photorealistic and modern. High-impact color blocking with rich yellow and warm amber backdrop. Single continuous shot with smooth forward camera push. NO CUTS. NO SPOKEN DIALOGUE. No filler text.

=== ABSOLUTE RULES ===
- BRANDING: Optiq Studio logo displayed prominently at the top of the UI prompt box.
- SCENE TYPE: Ad description typing interface overlay over a colorful stage-built setting.
- ALL PEOPLE MUST BE BLACK / WEST AFRICAN.
- NO SPOKEN DIALOGUE.

THE SETTING: A stylish stage-built creative studio with a bold, saturated yellow wall backdrop and soft golden key lighting. In the foreground, a young West African female entrepreneur sits at a minimal wooden desk with a open laptop.

UI OVERLAY & ACTION:
[0.0–10.0s] A clean digital UI prompt box with the official Optiq Studio logo centered at the top floats elegantly over the scene. An on-screen mobile keyboard depresses with glowing key highlights as ad description text types out in real-time inside the prompt box: "Create a high-energy cinematic commercial for a West African fashion brand, warm studio lighting, 4K film register..." The camera moves in a smooth, continuous forward push toward the laptop display as a soft swish transition builds at [9.5s].

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture. Warm 3200K tungsten studio key light with vibrant yellow background saturation.

SOUND: Rhythmic mechanical keyboard clicks, gentle UI chime, warm studio room tone.`
  },
  {
    sceneNumber: 2,
    setting: "Swish Transition to Cobalt Blue & Turquoise Stage-Built Set — Young West African male creator at a walnut desk in a vibrant blue ambient studio.",
    action: "Following a smooth swish transition, a second colorful setting is revealed. The Optiq Studio UI prompt box remains active with the Optiq Studio logo at the top. On-screen keyboard types out: 'Generate a 10-second documentary teaser for eco-friendly solar infrastructure in The Gambia, golden hour sunrise...' Camera glides in a smooth lateral dolly slide.",
    sound: "Gentle swish transition sound effect, soft keyboard typing clicks, subtle UI feedback tone.",
    dialogue: "",
    fullPrompt: `STYLE: Vibrant colorful stage-built commercial studio register, 35mm cinema film feel, photorealistic and modern. High-impact color blocking with deep cobalt blue and cyan backdrop. Single continuous shot with smooth lateral dolly tracking. NO CUTS. NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BRANDING: Optiq Studio logo displayed prominently at the top of the UI prompt box.
- SCENE TYPE: Ad description typing interface overlay over a colorful stage-built setting.
- ALL PEOPLE MUST BE BLACK / WEST AFRICAN.
- NO SPOKEN DIALOGUE.

THE SETTING: A second stage-built creative studio featuring a rich cobalt blue wall with cyan accent LED strips. A young West African male digital creator wearing a black hoodie sits at a workstation.

UI OVERLAY & ACTION:
[0.0–10.0s] Opening with a smooth swish transition from Scene 1, the Optiq Studio UI prompt box remains centered on screen with the Optiq Studio logo at the top. Custom ad description text types out inside the prompt box: "Generate a 10-second documentary teaser for eco-friendly solar infrastructure in The Gambia, golden hour sunrise..." The camera glides horizontally in a smooth lateral dolly tracking slide across the workstation as the prompt text completes.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture. Cool cobalt blue and cyan studio lighting with soft specular highlights.

SOUND: Smooth swish transition effect, rhythmic keyboard typing clicks, soft ambient audio.`
  },
  {
    sceneNumber: 3,
    setting: "Optiq Multi-Agent Orchestration Suite — Dark glass HUD interface with active AI agent nodes, skill routing graphs, and real-time scene synthesis telemetry.",
    action: "The Optiq Studio logo sits at the top of a futuristic dark glass HUD interface. Active AI subagents light up across a dynamic network graph, routing specialized skills including Storyboarding, Cinematography Composition, Script Reasoning, Soundscape Balance, and Scene Compilation to construct the ultimate ad experience. Camera drifts diagonally across the workflow graph.",
    sound: "High-tech electronic data pulse tones, smooth agent routing chimes, quiet cooling fan hum.",
    dialogue: "",
    fullPrompt: `STYLE: Sophisticated multi-agent AI orchestration interface, 35mm film feel, clinical high-tech software register. Dark glass HUD design with glowing cyan, emerald, and violet telemetry nodes. Single continuous camera motion with diagonal drift. ABSOLUTELY NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- BRANDING: Optiq Studio logo displayed prominently at the top of the multi-agent UI header.
- SCENE TYPE: Optiq AI Agent skills navigation & multi-agent workflow graph.
- NO SPOKEN DIALOGUE.

THE SETTING: A high-tech digital HUD interface representing Optiq Studio's multi-agent architecture. Dark translucent glass panels display glowing node graphs representing specialized AI subagents.

UI OVERLAY & ACTION:
[0.0–10.0s] With the Optiq Studio logo centered at the top of the interface header, active AI agent nodes light up in sequence along glowing signal paths. Icons and labels highlight active skills being orchestrated in real-time: 'STORYBOARDING' -> 'CINEMATOGRAPHY' -> 'SCRIPT REASONING' -> 'SOUNDSCAPE BALANCE' -> 'SCENE COMPILATION'. Status indicators turn green as the system compiles the optimal advertising experience. The camera executes a smooth diagonal drift across the glass HUD.

CAMERA & LIGHTING: 50mm macro lens, shallow depth of field isolating active agent nodes. Deep navy, cyan, emerald green, and violet LED colors.

SOUND: High-tech data routing pulses, soft agent activity chimes, low ambient electronic hum.`
  }
];

async function seedOptiqShowcase() {
  console.log(`[SEED] Creating/updating 'Optiq Studio - Ad Generation & Agent Showcase (30s)' for UID: ${USER_UID}...`);

  const projRef = db.collection("projects").doc();
  const videoStatus = {};
  const scenes = [];

  SHOWCASE_SCENES.forEach((s) => {
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
    title: "Optiq Studio - Ad Generation Showcase (30s)",
    concept: "Official 30-Second Showcase for Optiq Studio Ad Generation & Multi-Agent Activity. 3 scenes: Clip 1 (Ad Description Typing A), Clip 2 (Ad Description Typing B with Swish Transition), Clip 3 (Optiq Multi-Agent Orchestration & Skills Navigation).",
    brandName: "Optiq Studio",
    product: "Optiq Studio",
    length: "30s",
    aspectRatio: "16:9",
    pipelineStage: "ready",
    pipelineError: null,
    pipelineProgress: null,
    scenes: scenes,
    videoStatus: videoStatus,
    characterLock: {
      name: "African Creators & Optiq AI Agents",
      description: "Young African creators typing ad prompts, and Optiq Studio multi-agent network graph.",
      wardrobe: "Modern creative studio attire and dark tech hoodies.",
    },
    styleHeader: "Vibrant colorful stage-built commercial studio register, 35mm film feel, photorealistic and modern. Multi-agent AI software HUD.",
    musicSpec: "Upbeat, modern, rhythmic electronic soundscape with crisp UI audio feedback.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await projRef.set(projectData);

  console.log(`\n======================================================`);
  console.log(`[SUCCESS] Optiq Studio Showcase Project successfully created in Firestore!`);
  console.log(`Project ID: ${projRef.id}`);
  console.log(`Title: ${projectData.title}`);
  console.log(`Owner UID: ${USER_UID} (${USER_EMAIL})`);
  console.log(`Scenes Count: ${scenes.length} (10s each, 30s total)`);
  console.log(`======================================================\n`);
}

seedOptiqShowcase().catch((err) => {
  console.error("[ERROR] Failed to seed showcase project:", err);
  process.exit(1);
});
