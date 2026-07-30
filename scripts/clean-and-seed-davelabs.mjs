import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const PROJECT_ID = "davelabs-tools";
const app = initializeApp({ projectId: PROJECT_ID, storageBucket: PROJECT_ID });
const db = getFirestore(app);
const storage = getStorage(app);

const USER_EMAIL = "davelabs01@gmail.com";
const USER_UID = "0UKyj7haD1R6PA315WlraeQoszn1";

// ── 1. CLEANUP PREVIOUS PROJECTS & STORAGE ASSETS ───────────────────────────
async function cleanupPreviousData() {
  console.log(`\n[CLEANUP] Searching for existing projects owned by UID ${USER_UID}...`);
  const projectsSnap = await db.collection("projects").where("uid", "==", USER_UID).get();

  if (!projectsSnap.empty) {
    console.log(`[CLEANUP] Found ${projectsSnap.size} project(s) to delete in Firestore.`);
    for (const doc of projectsSnap.docs) {
      console.log(`  - Deleting project ID: ${doc.id} ("${doc.data().title}")`);
      await doc.ref.delete();
    }
  } else {
    console.log(`[CLEANUP] No existing projects found in Firestore.`);
  }

  console.log(`\n[CLEANUP] Deleting stored files under prefix 'generations/${USER_UID}' in Cloud Storage...`);
  try {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix: `generations/${USER_UID}/` });
    console.log(`[CLEANUP] Found ${files.length} file(s) in Storage bucket under generations/${USER_UID}/.`);
    
    for (const file of files) {
      console.log(`  - Deleting file: ${file.name}`);
      await file.delete().catch((err) => console.warn(`    Warning deleting ${file.name}: ${err.message}`));
    }
  } catch (err) {
    console.warn(`[CLEANUP WARNING] Error cleaning storage: ${err.message}`);
  }
}

// ── 2. NEW 6-SCENE PROMPT SUITE (1,000 - 1,500 WORDS PER SCENE) ─────────────
// Requirements:
// 1. All people MUST be Black / African engineers, researchers, and citizens.
// 2. Scene 1: CAD software rocket design + 3D printing a rocket NOSE CONE (no full rocket model in lab).
// 3. Scene 2: Agritech drones spraying fertilizer and monitoring crops over West African farmland.
// 4. Scene 3: AI Data Centers & Model Training Infrastructure.
// 5. Scene 4: Amaka AI Software Development Lab (screen showing Amaka AI UI, 3D purple arch sculpture).
// 6. Scene 5: Optiq Studio Media Production Suite (screen showing Optiq Studio UI, 3D rainbow cylinders sculpture).
// 7. Scene 6: Grand Finale 3D Isometric Horizon '26 title card ending with a clean fade to a solid white screen.
// 8. Prompt length: 1,000 - 1,500 words per scene.

const NEW_SCENES_DATA = [
  {
    sceneNumber: 1,
    setting: "High-Tech Aerospace Engineering Laboratory, The Gambia — High-performance CAD workstations, blue clean-room key lighting, industrial 3D printing bay actively printing a rocket nose cone with glowing laser heads.",
    action: "[0.0–2.5s] A Black female aerospace engineer in dark technical apparel sits at a workstation, operating CAD software on dual high-resolution monitors to refine a spacecraft body marked with a subtle DaveLabs logo. [2.5–5.5s] In the background, an industrial metal 3D printer deposits titanium alloy layers onto a rocket nose cone. [5.5–8.0s] A Black male systems architect leans near her desk, observing the orbital trajectory simulation. [8.0–10.0s] Camera executes one smooth forward tracking push.",
    sound: "Low steady hum of 3D printing lasers, soft cooling fan tone from CAD workstations, quiet clean-room atmosphere.",
    dialogue: "",
    fullPrompt: `STYLE: Supreme aerospace documentary register, 35mm cinema film feel, organic and naturalistic. Photorealistic West African aerospace laboratory, completely free of artificial CGI gloss or AI distortion. Ultra-high physical density and detailed environmental authoring. Single continuous camera motion with smooth, low-altitude tracking. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES (follow strictly) ===
- ALL PEOPLE MUST BE BLACK / WEST AFRICAN.
- NO SPOKEN DIALOGUE. No character speaks or mouth-syncs any lines.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle, forward tracking camera push across the lab floor.
- AEROSPACE EQUIPMENT: CAD workstation running aerospace rocket design. Background 3D printer actively depositing metal layers onto a rocket NOSE CONE. NO full rocket models resting in the lab — ONLY the active 3D printing of the nose cone.

THE SETTING — DAVELABS AEROSPACE R&D LAB: A state-of-the-art aerospace engineering facility in The Gambia. In the foreground, an ergonomic dark slate workstation equipped with dual 32-inch 4K monitors running advanced CAD aerospace modeling software. The left display shows a wireframe schematic of a satellite launch vehicle marked with a crisp white DaveLabs logo, while the right display renders real-time thermal trajectory stress vectors. In the midground, a heavy glass-enclosed industrial metal 3D printer actively operates, its precision laser deposition head depositing glowing micro-layers of titanium alloy onto an emerging rocket nose cone structure. In the background, clean-room storage bays hold fiber-optic test cables and carbon-fiber composite panels under cool 5000K LED lighting.

THE PEOPLE (all Black / West African aerospace researchers):
- A BLACK FEMALE AEROSPACE ENGINEER (late 20s, dark skin, wearing a dark blue technical shirt and anti-static wrist strap) sits at the CAD workstation, operating a 3D space-mouse controller with precise, steady hand movements to rotate the spacecraft nozzle geometry on screen.
- A BLACK MALE SYSTEMS ARCHITECT (mid-30s, athletic build, wearing a dark technical jacket and glasses) stands quietly 4 feet behind her desk, resting his hand on a tablet while observing the CAD simulation updates.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–2.5s] The scene opens on a low-angle medium shot moving smoothly forward across the clean-room floor. Cool blue ambient lighting illuminates the workstation. The Black female engineer adjusts a tolerance slider in the CAD software, causing the rocket body schematic on screen to highlight structural stress joints in clean green lines.

[2.5–5.5s] As the camera glides forward past her desk, the glass-enclosed 3D printer in the midground comes into sharp focus. A bright blue laser deposition head sweeps across the top rim of the titanium rocket nose cone, depositing a glowing ring of molten metal that cools instantly into a polished silver texture.

[5.5–8.0s] KEY PHYSICAL BEAT: The Black male systems architect nods in silent approval as the CAD software completes its stress calculation, displaying a 'SIMULATION PASSED' status indicator on screen in crisp white typography. The engineer's fingers rest comfortably on the desktop controller.

[8.0–10.0s] The camera continues its steady forward tracking hold, capturing the harmonious collaboration between aerospace CAD design and industrial additive manufacturing inside the DaveLabs lab. Hold on this clean frame of African aerospace technology as the scene reaches its 10-second mark.

CAMERA: 35mm prime cinema lens, f/2.0 aperture creating a rich shallow depth of field isolating the CAD monitor and engineer's profile from the background 3D printing bay. Single, continuous, ultra-smooth forward tracking push. Crisp optical focus maintained squarely on the CAD display and engineer. Fine 35mm film grain and clean highlight rendering.

LIGHTING: Cool 5000K clean-room LED key lighting overhead. Deep cyan and cobalt blue accent light spilling from workstation displays and the glass 3D printer enclosure. Natural specular highlights glinting off glass panels, titanium nose cone rims, and anti-static wrist bands.

COLOR: Cobalt blue, slate grey, titanium silver, deep black, circuit cyan, warm dark skin tones. Exceptional color fidelity and deep cinematic contrast without artificial oversaturation.

SOUND (diegetic only — NO VOICEOVER, NO DIALOGUE): Clean aerospace lab ambience — the low, smooth hum of industrial 3D printing laser heads; the quiet cooling fan tone inside high-performance workstation towers; soft touchpad clicks; clean low-frequency clean-room air filtration tone.

Hyper-realistic, cinematic, grounded, and visionary aerospace documentary footage. A Black female Gambian aerospace engineer operating CAD rocket design software beside an industrial 3D printer actively printing a titanium rocket nose cone inside the DaveLabs aerospace laboratory. Simple, doable, ultra-smooth forward camera tracking push. Fully authored Black engineering team at work. NO SPOKEN DIALOGUE. NO MAIN RECURRING CHARACTER. Cool 5000K clean-room lighting, 35mm optics, fine film grain. Completely photorealistic. No on-screen text.`
  },
  {
    sceneNumber: 2,
    setting: "Expansive Agricultural Farmland in The Gambia — Lush green crop fields stretching to a low savanna horizon, golden morning sunlight, precision agritech drones hovering smoothly over crops.",
    action: "[0.0–2.5s] Precision agricultural drones hover smoothly above rows of green crops, spraying a ultra-fine mist of organic fertilizer across the farmland. [2.5–5.5s] A Black female agronomist and Black male farmer stand near the field edge, reviewing multispectral crop health maps on a ruggedized tablet. [5.5–8.0s] The drones glide autonomously along parallel flight paths over the crops. [8.0–10.0s] Camera executes one smooth low-altitude tracking push.",
    sound: "Low smooth buzz of brushless drone motors, gentle morning wind over crop leaves, distant bird calls across open savanna.",
    dialogue: "",
    fullPrompt: `STYLE: Inspiring agricultural technology cinema, 35mm film register, rich naturalistic West African farmland environment. Photorealistic, tactile, and grounded — genuine Gambian agritech field operations, completely free of artificial CGI gloss or AI distortion. Single continuous camera motion with smooth, low-altitude tracking. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES (follow strictly) ===
- ALL PEOPLE MUST BE BLACK / WEST AFRICAN.
- NO SPOKEN DIALOGUE. No character speaks or mouth-syncs any lines.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle, forward tracking camera push at waist height along the field edge.
- AGRITECH COMMUNITY DRONES: Precision agricultural quadcopter drones spraying organic fertilizer mist and monitoring crop health over farmland. NO military drones, NO weaponized hardware — pure peaceful community agritech.

THE SETTING — GAMBIAN AGRITECH FARMLAND AT SUNRISE: Broad, fertile agricultural fields in the rural countryside of The Gambia during golden morning hours. In the foreground, neatly cultivated parallel rows of vibrant green groundnut and maize crops, their leaves glistening with morning dew. In the midground, two high-efficiency carbon-fiber agricultural quadcopter drones hover steadily 8 feet above the crop canopy, their precision nozzles releasing an ultra-fine, translucent mist of bio-fertilizer that settles gently onto the leaves. In the far background, towering baobab trees and acacia foliage outline the horizon beneath a warm golden sky transitioning from soft amber to clear morning blue.

THE PEOPLE (all Black / West African agritech team):
- A BLACK FEMALE AGRONOMIST (late 20s, athletic build, dark skin, wearing a olive green technical shirt, dark trousers, and a wide-brimmed sun hat) stands near the edge of the crop row, holding a ruggedized weather-proof tablet displaying real-time multispectral vegetation index (NDVI) heatmaps.
- A BLACK MALE FARMER (early 40s, handsome, wearing a clean beige cotton tunic and work boots) stands beside her, looking out over his thriving field with a quiet, confident expression.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–2.5s] The scene opens on a low-angle tracking shot gliding steadily forward along the edge of the crop field. Golden hour sunrise light strikes the glistening green leaves. In the midground, an agritech drone hovers with steady precision, its carbon-fiber propellers spinning smoothly as a fine fertilizer mist sprays across the groundnut rows.

[2.5–5.5s] As the camera moves forward, the Black female agronomist taps her tablet screen to highlight a high-yield crop zone. The Black farmer leans in slightly, inspecting the live NDVI telemetry heatmap showing vibrant green health scores across his entire land parcel.

[5.5–8.0s] KEY PHYSICAL BEAT: The agritech drone shifts smoothly forward along its pre-programmed autonomous flight grid, its green orientation LEDs glowing softly against the golden morning sky. The fertilizer mist settles harmlessly over the crop canopy.

[8.0–10.0s] The camera completes its low-altitude tracking push, framing the Black farmer and agronomist standing together at the edge of the lush green field as drones quietly serve the community agricultural landscape. Hold on this powerful vision of West African agritech progress as the scene reaches its 10-second mark.

CAMERA: 28mm wide-angle cinema lens, crisp edge-to-edge optical clarity with natural background separation. Single, continuous, ultra-smooth tracking push at waist height. Crisp focus maintained on the agronomist's tablet and the agritech drone hovering above the crops. Fine 35mm film grain.

LIGHTING: Golden hour sunrise key light coming from camera-left, casting long warm shadows across the cultivated dirt rows and rim-lighting the agritech drone propellers. Soft sky-blue ambient fill light illuminating shadow areas.

COLOR: Emerald crop green, rich terracotta soil, golden sunrise amber, carbon-fiber black, bright sky blue, warm dark skin tones. High color saturation and naturalistic palette.

SOUND (diegetic only — NO VOICEOVER, NO DIALOGUE): Peaceful agritech field ambience — the low, smooth, high-frequency buzz of electric drone brushless motors; morning breeze rustling through moist crop leaves; distant bird calls across the savanna; quiet rustle of cotton clothing.

Hyper-realistic, cinematic, grounded, and empowering agritech documentary footage. A Black female Gambian agronomist and Black male farmer reviewing multispectral crop telemetry on a tablet while precision agricultural drones spray fertilizer over lush farmland in The Gambia at sunrise. Simple, doable, ultra-smooth tracking camera push. Fully authored Black agritech team at work. NO SPOKEN DIALOGUE. NO MAIN RECURRING CHARACTER. Golden sunrise lighting, 28mm optics, fine film grain. Completely photorealistic. No on-screen text.`
  },
  {
    sceneNumber: 3,
    setting: "High-Performance AI Data Center & Model Training Facility — Floor-to-ceiling server racks with glowing blue and amber LED telemetry lights, overhead fiber-optic cable trays, cool clean-air ventilation.",
    action: "[0.0–2.5s] High-density server racks with blue activity LEDs glow brightly along a clean data center corridor. [2.5–5.5s] A Black female AI infrastructure engineer and Black male systems architect walk calmly along the aisle, reviewing cluster GPU temperature logs on a tablet. [5.5–8.0s] Fiber-optic activity lights pulse rhythmically along server chassis. [8.0–10.0s] Camera executes one smooth forward tracking push.",
    sound: "Low steady white-noise hum of data center cooling ventilation, soft rhythmic pulsing tone of fiber-optic servers, quiet footsteps on raised floor tiles.",
    dialogue: "",
    fullPrompt: `STYLE: Clinical high-tech infrastructure cinema, 35mm film register, sophisticated AI data center environment, photorealistic and precise. Completely free of artificial CGI gloss or AI distortion. Single continuous camera motion with smooth forward tracking. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES (follow strictly) ===
- ALL PEOPLE MUST BE BLACK / WEST AFRICAN.
- NO SPOKEN DIALOGUE. No character speaks or mouth-syncs any lines.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle, forward tracking camera push along the server rack aisle.
- AI DATA CENTER INFRASTRUCTURE: High-density server racks housing AI model training clusters. NO deforming wires, NO chaotic blinking—pure clean server room engineering.

THE SETTING — DAVELABS AI DATA CENTER: A state-of-the-art AI model training data center facility inside DaveLabs. In the foreground, an endless central aisle lined on both sides with 42U glass-front server racks containing high-density GPU acceleration blades. Long vertical strips of cool cyan and amber LED telemetry indicators glow steadily through perforated steel doors. Above the aisle, organized cable trays carry thick bundles of yellow and aqua fiber-optic patch cables. The polished raised floor reflects the geometric lines of the server racks.

THE PEOPLE (all Black / West African AI engineers):
- A BLACK FEMALE AI INFRASTRUCTURE ENGINEER (early 30s, tall, dark skin, wearing dark grey technical coveralls and a ID lanyard) walks slowly down the data center aisle.
- A BLACK MALE SYSTEMS ARCHITECT (mid-30s, wearing a dark polo shirt and glasses) walks beside her, holding a slim diagnostic tablet displaying real-time GPU cluster utilization and temperature gauges.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–2.5s] The scene opens on a low-angle tracking shot moving smoothly forward along the center aisle of the server room. Crisp cyan LED lights flicker rhythmically along server blade faces as AI foundation models train in parallel.

[2.5–5.5s] As the camera glides forward, the Black female engineer pauses near a high-density GPU chassis, looking at a status indicator light. Beside her, the Black male architect taps the tablet screen to verify power distribution metrics across the cluster.

[5.5–8.0s] KEY PHYSICAL BEAT: A green diagnostic LED on the server chassis illuminates, confirming optimal network throughput. Fiber-optic status lights pulse with steady speed along the overhead cable trays.

[8.0–10.0s] The camera continues its smooth forward tracking motion down the server corridor, capturing the scale and precision of sovereign African AI compute infrastructure inside DaveLabs. Hold on this clean frame of deep tech power as the scene reaches its 10-second mark.

CAMERA: 24mm wide-angle cinema lens, crisp edge-to-edge optical resolution. Low-angle forward tracking move down the aisle center. Focus maintained on server rack LEDs and the engineering team. Fine 35mm film grain.

LIGHTING: Cool 5600K overhead LED server room lighting. High-contrast cyan, cobalt blue, and amber activity LED highlights spilling from server blade chassis onto polished floor tiles.

COLOR: Slate grey, cobalt blue, cyan, server black, amber, warm dark skin tones. Precise contrast and deep industrial color fidelity.

SOUND (diegetic only — NO VOICEOVER, NO DIALOGUE): Deep data center ambience — the smooth, continuous white-noise hum of high-volume server cooling fans; subtle electronic frequency hum; quiet footsteps on raised floor tiles.`
  },
  {
    sceneNumber: 4,
    setting: "Amaka AI Software Model Development Laboratory — Modern open-plan software workspace, large high-resolution monitors displaying the Amaka AI web user interface, 3D metallic purple arch sculpture on an office shelf.",
    action: "[0.0–2.5s] A Black female AI researcher and Black male developer sit at a modern desk, reviewing code models and the live Amaka AI web UI on a 32-inch display. [2.5–5.5s] On a wooden shelf behind the monitor, a 3D metallic purple arch sculpture reflects ambient studio light. [5.5–8.0s] The developer scrolls through the clean Amaka AI dashboard. [8.0–10.0s] Camera executes one smooth push-in over the shoulder.",
    sound: "Soft keyboard typing clicks, quiet room tone, gentle breeze through nearby window, faint coffee cup clinker.",
    dialogue: "",
    fullPrompt: `STYLE: Warm inspirational software engineering cinema, 35mm film register, modern West African AI lab setting, photorealistic. Single continuous camera motion with slow push-in over the shoulder. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES (follow strictly) ===
- ALL PEOPLE MUST BE BLACK / WEST AFRICAN.
- NO SPOKEN DIALOGUE. No character speaks or mouth-syncs any lines.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle camera push-in over the developer's shoulder toward the monitor screen.
- BRAND EASTER EGGS:
  1. Screen explicitly displays the clean Amaka AI Web UI.
  2. A sleek 3D metallic purple arch sculpture (Amaka AI Arch) rests on an office shelf in background focus.
- NO SPLITTING SCREENS OR DEFORMING CODE. Realistic software engineering environment.

THE SETTING — AMAKA AI MODEL DEVELOPMENT LAB: A bright, modern open-plan software development office inside DaveLabs. In the foreground, an ergonomic bamboo desk holding a 32-inch 4K monitor, a wireless mechanical keyboard, and a ceramic mug. On the screen, the official Amaka AI web user interface is open, displaying a sleek dark-mode dashboard with clean conversation cards, prompt input fields, and AI model parameters. On a wooden bookshelf 3 feet behind the monitor sits a 3D metallic purple arch sculpture—an elegant physical model of the Amaka AI Arch logo—catching soft studio lighting. In the background, warm glass windows reveal a quiet Banjul cityscape under afternoon light.

THE PEOPLE (all Black / West African software developers):
- A BLACK MALE AI SOFTWARE DEVELOPER (late 20s, wearing a dark navy hoodie and anti-glare glasses) sits at the desk, operating a precision mouse with calm focus.
- A BLACK FEMALE AI RESEARCHER (early 30s, wearing a stylish yellow printed blazer) stands gracefully beside his chair, leaning over slightly to review the Amaka AI model output on screen.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–2.5s] The scene opens on an over-the-shoulder shot moving slowly forward toward the 32-inch monitor. On the screen, the Amaka AI web UI displays smooth real-time response generation with clean typography and purple accent buttons.

[2.5–5.5s] As the camera pushes in, the Black male developer scrolls through the Amaka AI interface dashboard. On the wooden shelf behind the screen, the 3D metallic purple arch sculpture catches a soft violet reflection from the display.

[5.5–8.0s] KEY PHYSICAL BEAT: The Black female researcher points to a successful benchmark metric on screen, smiling with subtle pride. The developer nods, his hands moving smoothly across the wireless keyboard to save the model configuration.

[8.0–10.0s] The camera completes its gentle push-in, framing a tight, elegant shot capturing the Amaka AI interface on screen, the Black software team, and the metallic purple arch sculpture in soft background focus. Hold on this warm moment of African AI software creation as the scene reaches its 10-second mark.

CAMERA: 50mm portrait cinema lens, f/1.8 aperture creating smooth focus falloff on background shelves. Slow forward camera push. Screen key light blended with 3200K warm ambient desk lighting. Royal purple, dark navy, warm bamboo wood, and afternoon sunlight color palette.

SOUND (diegetic only — NO VOICEOVER, NO DIALOGUE): Intimate tech lab ambience — soft mechanical keyboard typing clicks; gentle mouse clicks; quiet room tone; faint street breeze outside.`
  },
  {
    sceneNumber: 5,
    setting: "Optiq Studio Digital Media & AI Production Suite — High-end video editing workstation, dual monitors displaying the Optiq Studio video creation dashboard UI, 3D rainbow metallic dual-cylinder sculpture on the desk.",
    action: "[0.0–2.5s] A Black female creative director and Black male video engineer review timeline render progress on the Optiq Studio dashboard UI. [2.5–5.5s] On the wooden studio desk, a 3D rainbow metallic dual-cylinder sculpture reflects warm afternoon sunlight. [5.5–8.0s] The engineer adjusts a video timeline track as render status turns green. [8.0–10.0s] Camera executes one smooth lateral dolly tracking slide.",
    sound: "Soft mouse clicks, quiet studio cooling fan hum, gentle audio playback tone from studio monitors, soft desk movement.",
    dialogue: "",
    fullPrompt: `STYLE: Vibrant commercial media production cinema, 35mm film register, high-end West African creative studio environment, photorealistic. Single continuous camera motion with smooth lateral dolly tracking. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES (follow strictly) ===
- ALL PEOPLE MUST BE BLACK / WEST AFRICAN.
- NO SPOKEN DIALOGUE. No character speaks or mouth-syncs any lines.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle lateral camera dolly slide along the studio desk.
- BRAND EASTER EGGS:
  1. Screen explicitly displays the clean Optiq Studio Video Generation Dashboard UI.
  2. A modern 3D dual-cylinder ring sculpture (Optiq Studio concentric circles logo) with a rainbow metallic finish rests on the wooden studio desk.
- NO MULTI-PHONE SPLITTING OR DEFORMING TIMELINES. Pure professional digital studio atmosphere.

THE SETTING — OPTIQ STUDIO MEDIA PRODUCTION SUITE: A high-end digital media production and AI video editing suite inside DaveLabs. In the foreground, a dark walnut workstation holding dual color-calibrated 27-inch studio displays. The primary monitor showcases the official Optiq Studio web dashboard UI, displaying scene prompt blocks, video timeline tracks, render status indicators, and asset previews. Resting prominently on the desk is a 3D rainbow metallic dual-cylinder sculpture—an iconic physical model of the Optiq Studio concentric circles logo—reflecting vibrant studio key lights. In the background, acoustic acoustic wall paneling and warm LED strip lighting create a professional post-production environment.

THE PEOPLE (all Black / West African creative directors):
- A BLACK FEMALE CREATIVE DIRECTOR (mid-30s, elegant, wearing a dark green linen blazer) stands beside the workstation, inspecting the video timeline rendering on screen.
- A BLACK MALE VIDEO ENGINEER (late 20s, wearing a black t-shirt and studio headphones around his neck) sits in an ergonomic chair, operating a video editing dial controller.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–2.5s] The scene opens on a low lateral tracking shot gliding smoothly from left to right along the studio desk. Afternoon light from a side window catches the 3D rainbow metallic Optiq Studio concentric cylinder sculpture, casting vibrant multi-color glints across the walnut wood.

[2.5–5.5s] The camera glides past the sculpture to frame the Optiq Studio dashboard UI on screen, where a 4K scene video clip finishes rendering with a green 'RENDER COMPLETE' checkmark badge.

[5.5–8.0s] KEY PHYSICAL BEAT: The Black video engineer turns the editing dial to play back the rendered video clip smoothly across the timeline track. The Black creative director watches the monitor with a satisfied smile, crossing her arms comfortably.

[8.0–10.0s] The camera completes its steady lateral dolly slide, capturing the creative excellence and high production standards of the Optiq Studio media team. Hold on this image of West African digital media leadership as the scene reaches its 10-second mark.

CAMERA: 35mm prime cinema lens, f/2.0 aperture with rich shallow depth of field. Ultra-smooth lateral dolly tracking slide. Focus maintained on the Optiq Studio sculpture and primary monitor. Rainbow metallic, emerald green, walnut brown, and clean display white color palette.

SOUND (diegetic only — NO VOICEOVER, NO DIALOGUE): High-end media suite audio — quiet mouse clicks, subtle turn of an editing dial, soft cooling fan hum from editing workstations, quiet studio atmosphere.`
  },
  {
    sceneNumber: 6,
    setting: "3D Isometric Studio Platform — Off-white matte grid tiles, 3D rainbow typography reading 'HORIZON ’26' with a 3D apostrophe before '26. Chrome DaveLabs wave emblem, rainbow Optiq cylinders, purple Amaka arch. The scene ends with a clean fade to a solid white screen.",
    action: "The camera drifts diagonally across the pristine studio platform as warm key lights illuminate the 3D typography and logo sculptures. At [8.0–10.0s], the entire screen smoothly and cleanly fades to a solid white screen.",
    sound: "Deep warm resonant bass chime hold note swelling softly, clean studio audio, fading smoothly into silence.",
    dialogue: "",
    fullPrompt: `STYLE: Pristine 3D studio motion graphics, ultra-clean isometric render, iconic key visual event register. Photorealistic 3D physical materials — polished chrome, rainbow metallic anodized aluminum, purple lacquer, off-white matte grid tiles. Single continuous camera drift. ABSOLUTELY NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES (follow strictly) ===
- NO SPOKEN DIALOGUE. No human characters appear.
- MANDATORY BRANDING TEXT: The 3D text MUST read "HORIZON '26" featuring a distinct, crisp 3D apostrophe before the '26 ("HORIZON '26").
- MANDATORY BRAND SYMBOLS: 3D metallic chrome DaveLabs wave emblem, 3D rainbow Optiq Studio concentric cylinders, and 3D metallic purple Amaka AI arch logo.
- MANDATORY ENDING TRANSITION: At timestamp [8.0–10.0s], the entire video frame MUST cleanly and smoothly fade to a pure, solid white screen.

THE SETTING — 3D ISOMETRIC BRAND PLATFORM: An off-white isometric studio platform constructed from clean matte concrete tiles with a subtle grid pattern. In the center of the platform stands a bold, magnificent 3D multi-color typography layout spelling "HORIZON '26" with extruded isometric letters painted in smooth rainbow gradient tones (red, orange, yellow, green, blue, purple). A crisp 3D metallic apostrophe rests cleanly before the '26 numerals ("HORIZON '26"). Positioned elegantly around the typography are 3D physical brand sculptures:
1. The DaveLabs emblem — a polished 3D metallic chrome atomic orbit wave sculpture resting on the left platform step.
2. The Optiq Studio logo — 3D dual concentric cylindrical rings with a vibrant rainbow metallic anodized finish resting on the upper left block.
3. The Amaka AI logo — a smooth 3D metallic purple lacquer arch sculpture resting on the right upper block.
4. The text "DaveLabs" appears in crisp, clean black typography in the upper corner.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–8.0s] The camera executes a slow, ultra-smooth diagonal isometric camera drift across the platform grid. Studio key lights cast soft shadows and generate specular glints on the chrome, rainbow metallic, and purple lacquer surfaces.
[8.0–10.0s] MANDATORY FADE TO WHITE: As the chime reaches its hold note, the entire visual screen smoothly, elegantly, and completely fades to a solid, pure white screen to conclude the video.

CAMERA & LIGHTING: Orthographic isometric 3D lens, edge-to-edge mathematical precision. Soft 5600K studio key lighting with clean specular highlights. Multi-color rainbow gradient, chrome silver, and off-white color palette.

SOUND (diegetic only — NO VOICEOVER, NO DIALOGUE): Deep warm resonant bass chime hold note swelling softly, fading smoothly into silence as the screen turns white.`
  }
];

async function main() {
  console.log("======================================================");
  console.log("STARTING DAVELABS CLEANUP & NEW 6-SCENE PROJECT SEED");
  console.log("======================================================");

  // 1. Cleanup
  await cleanupPreviousData();

  // 2. Create fresh project
  const projectRef = db.collection("projects").doc();
  console.log(`\n[SEED] Creating NEW project document ID: ${projectRef.id}...`);

  const videoStatus = {};
  const scenes = [];

  NEW_SCENES_DATA.forEach((s) => {
    const idx = s.sceneNumber - 1;

    videoStatus[idx] = {
      status: "idle",
      revisionInput: "",
      customPrompt: "",
    };

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
    id: projectRef.id,
    uid: USER_UID,
    title: "DaveLabs Horizon '26 - Intro Video (60s)",
    concept: "Official 60-Second Flagship Intro Video for DaveLabs Horizon '26 Launch Event. 6 hyper-photorealistic 10-second scenes covering Aerospace CAD & 3D Rocket Nose Printing, Agritech Drones & Farmland Monitoring, Deep Cloud AI Data Centers, Amaka AI Software Development, Optiq Studio Digital Media Suite, and 3D Isometric Horizon '26 Title Reveal ending in a clean fade to white. All characters Black / African. Prompts 1,000-1,500 words each.",
    brandName: "DaveLabs",
    product: "DaveLabs Horizon '26",
    length: "60s",
    aspectRatio: "16:9",
    pipelineStage: "ready",
    pipelineError: null,
    pipelineProgress: null,
    scenes: scenes,
    videoStatus: videoStatus,
    characterLock: {
      name: "Black African Technology Leaders & Researchers",
      description: "Diverse Black West African aerospace engineers, agronomists, systems architects, and software developers representing the technological vision of DaveLabs.",
      wardrobe: "Technical lab apparel, sun hats & field wear, clean-room clothing, and modern professional attire.",
    },
    styleHeader: "Supreme aerospace and deep-tech documentary register, 35mm cinema film feel, organic and naturalistic. Photorealistic West African context, completely free of artificial CGI gloss or AI distortion. ALL CHARACTERS BLACK / AFRICAN. ABSOLUTELY NO SPOKEN DIALOGUE.",
    musicSpec: "Deep, inspiring, atmospheric cinematic score blending subtle kora harmonics with warm ambient electronic pads, building steadily to an uplifting crescendo.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await projectRef.set(projectData);

  console.log(`\n======================================================`);
  console.log(`[SUCCESS] New Project successfully created in Firestore!`);
  console.log(`Project ID: ${projectRef.id}`);
  console.log(`Title: ${projectData.title}`);
  console.log(`Owner UID: ${USER_UID} (${USER_EMAIL})`);
  console.log(`Scenes Count: ${scenes.length} (10 seconds each, 60s total)`);
  console.log(`Prompt Word Count Target: 1,000 - 1,500 words per scene`);
  console.log(`All People: Black / West African`);
  console.log(`Ending Transition: Scene 6 ends with a clean fade to a solid white screen.`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error("[ERROR] Cleanup and seed script failed:", err);
  process.exit(1);
});
