import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "davelabs-tools";
const app = initializeApp({ projectId: PROJECT_ID });
const db = getFirestore(app);

const USER_EMAIL = "davelabs01@gmail.com";
const USER_UID = "0UKyj7haD1R6PA315WlraeQoszn1";

// ── 10 SCENES (500 WORDS EACH, ULTRA-CLEAN 1-SHOT, NO AI ARTIFACTS) ─────────
// Guidelines followed strictly:
// 1. Prompt word count: ~500 words per scene (concise, focused, ultra-clean).
// 2. Single continuous motion vector (slow glide / dolly / tracking push) — NO CUTS.
// 3. ZERO complex object interactions (no tools, no deforming items, no splitting screens).
// 4. Natural human posture and realistic physical environment — looks completely non-AI.
// 5. Scene 10 ends with a clean fade to a solid white screen.

const SCENES = [
  {
    sceneNumber: 1,
    setting: "Tanji Fishing Beach at Dawn, The Gambia — Traditional hand-carved wooden pirogue in yellow and red resting on damp sand, soft ocean haze, distant Atlantic horizon.",
    action: "A young Gambian fisherman in an open indigo blue shirt stands calmly beside the wooden boat, looking out toward the ocean horizon as a gentle morning breeze rustles his shirt. One continuous, ultra-smooth forward camera tracking push across the wet sand.",
    sound: "Rhythmic foam-hiss of Atlantic ocean waves breaking on damp sand, gentle morning breeze blowing past, distant sea gulls overhead.",
    dialogue: "",
    fullPrompt: `STYLE: Authentic cinematic documentary register, 35mm film feel, organic and naturalistic. Photorealistic West African coastal location, completely free of artificial CGI gloss or AI distortion. Single continuous shot with ultra-smooth, slow camera tracking motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle, forward tracking camera push across wet sand.
- NO COMPLEX TOOL INTERACTIONS. No moving ropes, no deforming objects. Pure natural human presence and ocean environment.

THE SETTING — TANJI BEACH AT DAWN: An authentic coastal fishing beach in Tanji, The Gambia, at dawn. In the foreground, fine wet sand reflecting the soft morning sky. Beside the camera, a traditional hand-carved wooden pirogue painted in weathered yellow and red stripes rests quietly on the beach, its hull showing real wood grain and salt texture. In the background, the Atlantic Ocean stretches to a low horizon under a sky transitioning from indigo to golden amber.

THE SUBJECT: A tall Gambian fisherman in his late 20s wearing a sun-bleached indigo blue cotton shirt over a white tee. He stands beside the boat bow with a calm, confident posture, resting his hand gently on the wooden gunwale while looking out toward the open ocean horizon. A gentle sea breeze softly rustles his shirt.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes a single, ultra-smooth, slow tracking push forward across the damp sand toward the fisherman. He stands naturally beside the boat, taking a deep breath of crisp ocean air as morning golden light illuminates his profile. In the background, calm ocean waves break softly on the shoreline. The camera glides steadily forward without any sudden moves, maintaining crisp focus on his calm expression and the weathered wood texture of the boat.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture with soft background blur. Smooth low-angle tracking push. Low-angle golden sunrise key light coming from the ocean side, casting a warm rim glow across his shoulders and the boat hull. Naturalistic, rich saturation with organic sand beige, deep indigo, and warm gold tones.

SOUND: Diegetic ocean ambient audio — rhythmic gentle crash of waves on wet sand, morning ocean breeze, faint calls of sea gulls in the distance.`
  },
  {
    sceneNumber: 2,
    setting: "Sunlit Rural Classroom in Serekunda, The Gambia — Worn wooden student desks facing a dark green slate chalkboard with geometry diagrams, warm sunbeams filtering through window louvers.",
    action: "A 14-year-old female student in a green uniform sits at her desk, looking forward attentively toward the blackboard at the front of the classroom. One continuous, ultra-smooth lateral camera drift across the wooden desks.",
    sound: "Gentle morning breeze through window louvers, soft rustle of notebook paper, quiet classroom atmosphere.",
    dialogue: "",
    fullPrompt: `STYLE: Intimate cinematic documentary, naturalistic West African classroom environment, photorealistic and grounded. Single continuous shot with slow, smooth lateral camera motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle lateral camera drift from left to right along student desk height.
- ALL STUDENTS FACE THE FRONT BLACKBOARD. No transforming objects, no moving chalk, no deforming desks. Pure realistic classroom atmosphere.

THE SETTING — SEREKUNDA CLASSROOM: A humble, clean primary school classroom in Serekunda, The Gambia, during bright mid-morning. Worn wooden desks with smooth edges fill the room. At the front, a dark green slate chalkboard mounted on a whitewashed concrete wall displays handwritten geometry diagrams. Soft golden sunbeams filter through wooden window louvers on the left, illuminating floating dust motes.

THE SUBJECT: A 14-year-old Gambian female student in a green school uniform sits at a front-row wooden desk. She holds a pencil lightly above her open notebook, her eyes focused calmly forward toward the blackboard diagram. Other students sit quietly in rows behind her, all facing the front board attentively.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes one single, ultra-smooth lateral drift from left to right along the wooden desk surface. Golden daylight illuminates the student's face in profile as she studies the board. Sunlight reflects softly off the wooden desktop and notebook pages. The camera glides past smoothly without any sudden tilts or shakes, capturing a peaceful, authentic moment of learning.

CAMERA & LIGHTING: 50mm cinema lens, f/1.8 aperture with shallow depth of field isolating the student from background rows. Directional morning daylight from window louvers, casting soft warm shafts across desks. Natural terracotta brown, leaf green, and golden sunbeam color palette.

SOUND: Diegetic classroom ambience — gentle morning wind through louvers, soft paper rustle, quiet room tone.`
  },
  {
    sceneNumber: 3,
    setting: "Utility Solar Facility in Gunjur, The Gambia — Long parallel rows of dark silicon solar panels stretching across savanna grass under a clear sunrise sky.",
    action: "A young female electrical engineer in a white hardhat and safety vest stands steadily beside a row of solar panels, looking toward the rising sun on the horizon. One continuous, ultra-smooth low-altitude camera tracking push alongside the solar array.",
    sound: "Low smooth hum of power equipment, gentle savanna wind blowing over solar glass panels, faint morning bird calls.",
    dialogue: "",
    fullPrompt: `STYLE: Visionary industrial cinema, clean and ambitious West African infrastructure documentary register. Photorealistic, tactile, and naturalistic. Single continuous shot with smooth, low-altitude forward camera tracking motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle forward tracking push alongside solar panel rows at waist height.
- NO COMPLEX TOOL MANIPULATION. No turning wrenches, no moving panels, no deforming hardware. Pure clean infrastructure presence.

THE SETTING — GUNJUR SOLAR FACILITY: An expansive utility solar energy plant on the savanna plains of Gunjur, The Gambia, at sunrise. Parallel rows of high-efficiency dark silicon solar panels mounted on galvanized steel frames reflect the morning sky. In the background, green savanna grass and acacia trees stand under a cloudless golden horizon.

THE SUBJECT: A young Gambian female electrical engineer in a white safety hardhat, navy coveralls, and high-visibility yellow vest stands beside a solar panel row. She stands in a calm, professional posture, looking out toward the rising sun as golden light illuminates her profile.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes a single, continuous, ultra-smooth forward tracking push alongside the row of solar panels. First golden hour light glints cleanly across the silicon glass surfaces. The engineer stands steadily in frame as the camera glides past her, revealing the vast expanse of clean solar energy panels extending into the golden sunrise.

CAMERA & LIGHTING: 24mm wide-angle lens, crisp edge-to-edge optical clarity. Low-angle tracking move at waist height. Warm golden sunrise key light coming from the horizon, casting rich rim lighting on hardhats and steel frames. Deep silicon navy, galvanized silver, and savanna gold color palette.

SOUND: Diegetic clean energy ambience — low smooth transformer hum, gentle savanna wind, distant bird calls.`
  },
  {
    sceneNumber: 4,
    setting: "Home Study Desk in Banjul at Twilight, The Gambia — Dark mahogany desk with an open laptop, textbooks, and a warm desk lamp. A sleek 3D metallic purple arch sculpture rests on a desk shelf in background focus.",
    action: "A 16-year-old student sits at the desk, quietly reading from his laptop screen under a warm lamp. One continuous, ultra-smooth push-in camera move over his shoulder toward the display.",
    sound: "Soft touchpad click, quiet room tone, gentle evening rain pattering on window glass outside.",
    dialogue: "",
    fullPrompt: `STYLE: Warm inspirational tech cinema, intimate West African home study setting, photorealistic and cozy. Single continuous shot with slow push-in camera motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle camera push-in over the student's shoulder.
- BRAND EASTER EGG: A sleek 3D metallic purple arch sculpture (Amaka AI Arch) rests quietly on a wooden desk shelf in background focus.
- NO COMPLEX SCREEN TOUCHES OR TRANSFORMING GRAPHICS. Simple, realistic laptop display and quiet reading.

THE SETTING — BANJUL HOME STUDY AT TWILIGHT: A cozy study corner inside a Banjul home at dusk. A dark mahogany desk holds an open laptop, brass glasses, and textbooks. On a wooden shelf behind the laptop sits a sleek 3D metallic purple arch sculpture reflecting ambient light. In the background, a window reveals a deep blue twilight sky outside.

THE SUBJECT: A 16-year-old Gambian male student in a grey hoodie sits at the desk, leaning forward slightly with his chin resting on his hand, focused peacefully on reading his laptop screen.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes a single, slow, ultra-smooth push-in over the student's shoulder toward the laptop screen. Cool soft light from the display illuminates his face, while a warm tungsten desk lamp casts a golden glow across the mahogany wood. The metallic purple arch sculpture rests elegantly on the shelf in soft focus.

CAMERA & LIGHTING: 85mm portrait lens, f/1.4 aperture with smooth background bokeh. Slow forward push. Cool laptop screen key light blended with warm 2700K tungsten lamp fill. Royal purple, mahogany amber, and twilight blue color palette.

SOUND: Diegetic study ambience — soft touchpad click, evening rain pattering against window glass, quiet room tone.`
  },
  {
    sceneNumber: 5,
    setting: "Tailor Workshop in Serekunda Market, The Gambia — Mahogany counter draped with bolts of colorful wax-print fabrics in indigo and gold. A modern 3D dual-cylinder ring sculpture with a rainbow metallic finish rests on the counter.",
    action: "A master Gambian tailor in an indigo tunic stands gracefully beside a dress mannequin, adjusting the fabric shoulder fold with a single gentle hand movement. One continuous, ultra-smooth lateral camera dolly slide along the counter.",
    sound: "Rhythmic foot-pedal whir of a nearby sewing machine, soft fabric rustle, distant market chatter outside.",
    dialogue: "",
    fullPrompt: `STYLE: Vibrant commercial documentary, rich West African artisan workshop setting, photorealistic and colorful. Single continuous shot with smooth lateral camera motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle lateral camera dolly slide along the display counter.
- BRAND EASTER EGG: A modern 3D dual-cylinder ring sculpture (Optiq Studio concentric circles logo) with a rainbow metallic finish rests on the wooden counter.
- NO MULTI-PHONE SPLITTING OR COMPLEX TOOL MANIPULATION. Simple, elegant fabric adjustment.

THE SETTING — SEREKUNDA TAILOR SHOP: A colorful fashion workshop in Serekunda Market during bright afternoon hours. Bolts of vibrant indigo, gold, and magenta wax-print fabrics lie draped across a smooth mahogany counter. Resting on the counter is a sleek 3D rainbow metallic dual-cylinder sculpture. In the background, thread spools line wooden wall racks.

THE PEOPLE: A master Gambian tailor in his late 30s, wearing a tailored indigo brocade tunic, stands beside a dress mannequin draped in embroidered fabric.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes one continuous, ultra-smooth lateral dolly slide from left to right along counter height. Afternoon sunlight streams through the shop door, catching the rich fabric textures and reflecting off the 3D rainbow cylinder sculpture. The tailor gently adjusts the lapel of the garment on the mannequin with a calm, practiced hand posture.

CAMERA & LIGHTING: 35mm prime lens, f/2.0 aperture with rich shallow depth of field. Horizontal dolly slide. Golden afternoon daylight streaming from camera-left. Deep indigo, marigold gold, magenta, and rainbow metallic color palette.

SOUND: Diegetic artisan market audio — rhythmic sewing machine whir in background, soft cotton fabric rustle, faint market chatter.`
  },
  {
    sceneNumber: 6,
    setting: "DaveLabs Hardware & AI R&D Laboratory — Matte grey ESD workbench with circuit boards and digital oscilloscopes showing steady green signal waves under cool 5600K LED lab lights.",
    action: "A male hardware engineer in a white lab coat stands at the workbench, inspecting a prototype circuit board with calm focus. One continuous, ultra-smooth horizontal micro-dolly camera slide across the bench.",
    sound: "Low steady hum of digital oscilloscope cooling fans, quiet laboratory room tone.",
    dialogue: "",
    fullPrompt: `STYLE: Sophisticated technology documentary register, clinical and precise hardware R&D environment, photorealistic. Single continuous shot with slow horizontal micro-dolly camera motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, ultra-smooth horizontal micro-dolly camera slide along the workbench.
- NO COMPLEX SOLDERING OR DEFORMING TOOLS. Pure clean hardware engineering presence.

THE SETTING — DAVELABS HARDWARE LAB: A modern electronics laboratory inside DaveLabs. An ESD-grounded grey workbench holds custom circuit boards with microchips and fiber-optic sensors. In the background, digital oscilloscopes display steady green signal sine waves under cool 5600K LED laboratory lighting.

THE SUBJECT: A male Gambian hardware engineer in a white lab coat stands at the workbench, holding a prototype circuit board carefully by its edges, inspecting the components under clean overhead laboratory light.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes a single, slow, ultra-smooth micro-dolly slide across the surface of the workbench. A blue diagnostic status LED on the circuit board glows steadily, casting a subtle blue highlight across the silver components. The engineer holds the board steadily, examining its layout with calm focus.

CAMERA & LIGHTING: 50mm cinema macro lens, shallow depth of field isolating the circuit board. Horizontal micro-dolly slide. Cool 5600K overhead LED key lighting with cyan indicator highlights. Metallic silver, circuit green, and slate grey color palette.

SOUND: Diegetic laboratory ambience — low steady cooling fan hum from oscilloscopes, quiet lab room tone.`
  },
  {
    sceneNumber: 7,
    setting: "Coastal Astronomical Research Station at Midnight, The Gambia — Optical satellite payload in a carbon-fiber cradle inside an observatory dome open to the starlit Milky Way sky.",
    action: "A female astrophysicist stands near a telemetry monitor, looking up through the open observatory dome toward the starlit night sky. One continuous, ultra-smooth upward camera tilt toward the cosmos.",
    sound: "Gentle ocean breeze against coastal cliffs outside, low ambient hum of telemetry computers, quiet night atmosphere.",
    dialogue: "",
    fullPrompt: `STYLE: Awe-inspiring space technology cinema, vast West African astronomical observatory setting, photorealistic. Single continuous shot with slow upward camera tilt motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle upward camera tilt from the optical payload toward the open sky dome.
- NO DEFORMING TELESCOPES OR COMPLEX MECHANISMS. Pure atmospheric night sky and satellite payload.

THE SETTING — COASTAL OBSERVATORY AT MIDNIGHT: An advanced space research station on a coastal cliff overlooking the Atlantic Ocean in The Gambia at midnight. An optical satellite payload in gold foil and carbon fiber rests in a testing cradle. Overhead, the open observatory dome reveals a clear pitch-black night sky filled with stars and the dust lanes of the Milky Way.

THE SUBJECT: A Gambian female astrophysicist in dark technical clothing stands near a telemetry monitor displaying soft cyan orbital arcs, looking up toward the starry sky above.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes one single, ultra-smooth upward tilt starting from the gold-foil optical payload and gliding gently upward to frame the astrophysicist and the breathtaking Milky Way night sky through the open dome roof. Starlight reflects softly off the payload lens surfaces.

CAMERA & LIGHTING: 18mm ultra-wide lens, crisp deep focus. Smooth upward camera tilt. Midnight starlight ambient key light with cool cyan display glow illuminating the scene. Deep cosmos navy, starlight white, and gold foil color palette.

SOUND: Diegetic night observatory audio — distant ocean breeze against coastal cliffs, low laptop fan hum, quiet night atmosphere.`
  },
  {
    sceneNumber: 8,
    setting: "Outdoor Film Set in a Coastal Palm Grove at Golden Hour Sunset, The Gambia — Cinema camera setup on a tripod, wireless director's monitor, coconut palms lit by warm amber sunset light.",
    action: "A cinematographer stands steadily beside the cinema camera setup, looking toward the sunset-lit palm grove. One continuous, ultra-smooth arc camera tracking move around the setup.",
    sound: "Soft coastal breeze rustling coconut palm fronds, faint distant ocean waves, quiet outdoor environment.",
    dialogue: "",
    fullPrompt: `STYLE: High-end broadcast cinema register, professional film crew in a coastal West African grove at golden hour, photorealistic. Single continuous shot with smooth arc camera motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle arc tracking camera move around the camera setup.
- NO COMPLEX GIMBAL MANEUVERS OR MOVING REFLATORS. Pure cinematic sunset atmosphere and camera rig.

THE SETTING — COASTAL PALM GROVE AT SUNSET: An outdoor film production set inside a coastal palm grove in The Gambia during golden hour sunset. A cinema camera with a matte box sits mounted on a sturdy tripod beside a high-bright wireless monitor. Warm golden sunset light filters through tall coconut palm fronds.

THE SUBJECT: A male Gambian cinematographer in a dark cap and vest stands beside the tripod setup, looking out toward the sunlit palm grove with a confident posture.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes a single, ultra-smooth arc tracking move around the camera rig. Golden sunset light pierces through the palm leaves, creating gentle warm lens flares across the matte box and the cinematographer's profile. The scene captures a quiet, professional moment of film production excellence.

CAMERA & LIGHTING: 35mm anamorphic lens, f/2.0 aperture with soft horizontal lens flare. Slow arc camera move at chest height. Golden hour sunset key light coming through palm fronds. Golden amber, sunset copper, and palm green color palette.

SOUND: Diegetic outdoor film set audio — soft coastal wind in palm fronds, distant ocean waves, quiet atmosphere.`
  },
  {
    sceneNumber: 9,
    setting: "Modern Innovation Plaza in Banjul at Twilight, The Gambia — Architectural concrete walkway with integrated LED strip lighting, modern glass-and-solar research buildings under an orange and violet dusk sky.",
    action: "A group of young West African tech founders walk calmly and steadily together across the plaza walkway at dusk toward the research center. One continuous, ultra-smooth forward camera tracking push.",
    sound: "Smooth quiet whisper of a distant electric shuttle vehicle, soft footsteps on concrete paving, gentle evening breeze.",
    dialogue: "",
    fullPrompt: `STYLE: Epic cinematic climax, modern West African urban technology plaza at twilight, photorealistic and inspiring. Single continuous shot with smooth forward camera tracking motion. NO CUTS. NO SPOKEN DIALOGUE. No on-screen text.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE.
- NO MAIN RECURRING CHARACTER LOCK.
- SINGLE CONTINUOUS SHOT: Slow, gentle forward tracking camera push along the plaza walkway at walking speed.
- SIMPLE FORWARD WALKING MOTIONS. No complex gestures, no deforming architecture.

THE SETTING — BANJUL INNOVATION PLAZA: A modern technology plaza in Banjul at twilight. Smooth concrete walkways feature embedded LED strip lighting. Glass-and-steel research buildings with solar facades glow with warm interior light under a violet and orange dusk sky.

THE PEOPLE: A group of four young West African tech founders (male and female) walk together in professional attire, moving calmly and purposefully forward along the plaza walkway.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–10.0s] The camera executes one single, ultra-smooth forward tracking push along the plaza walkway at walking speed ahead of the group. Embedded LED lights cast clean lines across the pavement. Warm tungsten light glows through the glass building facades in the background as the twilight sky deepens into navy.

CAMERA & LIGHTING: 24mm wide-angle lens, crisp architectural perspective. Forward tracking push. Twilight sky key light blended with warm architectural interior glow and white walkway LED accents. Twilight violet, amber, and slate grey color palette.

SOUND: Diegetic urban plaza audio — faint whisper of electric shuttle in background, soft footsteps on pavement, evening breeze.`
  },
  {
    sceneNumber: 10,
    setting: "3D Isometric Studio Platform — Off-white matte grid tiles, 3D rainbow typography reading 'HORIZON ’26' with a 3D apostrophe before '26. Chrome DaveLabs wave emblem, rainbow Optiq cylinders, purple Amaka arch. The scene ends with a clean fade to a solid white screen.",
    action: "The camera drifts diagonally across the pristine studio platform as warm key lights illuminate the 3D typography and logo sculptures. At [8.0–10.0s], the entire screen smoothly and cleanly fades to a solid white screen.",
    sound: "Deep warm resonant bass chime hold note swelling softly, clean studio audio, fading smoothly into silence.",
    dialogue: "",
    fullPrompt: `STYLE: Pristine 3D studio motion graphics, ultra-clean isometric render, iconic key visual event register. Photorealistic 3D physical materials — polished chrome, rainbow metallic anodized aluminum, purple lacquer, off-white matte grid tiles. Single continuous camera drift. ABSOLUTELY NO SPOKEN DIALOGUE.

=== ABSOLUTE RULES ===
- NO SPOKEN DIALOGUE. No human characters appear.
- MANDATORY BRANDING TEXT: The 3D text MUST read "HORIZON '26" featuring a distinct, crisp 3D apostrophe before the '26 ("HORIZON '26").
- MANDATORY BRAND SYMBOLS: 3D metallic chrome DaveLabs wave emblem, 3D rainbow Optiq Studio concentric cylinders, and 3D metallic purple Amaka AI arch logo.
- MANDATORY ENDING TRANSITION: At timestamp [8.0–10.0s], the entire video frame MUST cleanly and smoothly fade to a pure, solid white screen.

THE SETTING — 3D ISOMETRIC BRAND PLATFORM: An off-white isometric studio platform with clean grid lines. In the center, bold 3D rainbow typography spells "HORIZON '26" with a crisp 3D apostrophe before '26. Positioned around the title are 3D sculptures of the chrome DaveLabs wave emblem, rainbow Optiq cylinders, and purple Amaka arch.

SHOT SEQUENCE (10 SECONDS CONTINUOUS):
[0.0–8.0s] The camera executes a slow, ultra-smooth diagonal isometric camera drift across the platform grid. Studio key lights cast soft shadows and generate specular glints on the chrome and rainbow metallic surfaces.
[8.0–10.0s] MANDATORY FADE TO WHITE: As the chime reaches its hold note, the entire visual screen smoothly, elegantly, and completely fades to a solid, pure white screen to conclude the video.

CAMERA & LIGHTING: Orthographic isometric 3D lens, edge-to-edge precision. Soft 5600K studio key lighting with clean specular highlights. Multi-color rainbow gradient, chrome silver, and off-white color palette.

SOUND: Deep warm resonant bass chime hold note swelling softly, fading smoothly into silence as the screen turns white.`
  }
];

async function updateHorizonIntroProjectClean() {
  console.log(`[SEED] Searching for 'DaveLabs Horizon '26 - Intro Video (100s)' for UID: ${USER_UID}...`);

  const projQuery = await db.collection("projects")
    .where("uid", "==", USER_UID)
    .where("title", "==", "DaveLabs Horizon '26 - Intro Video (100s)")
    .get();

  let projectRef;
  if (!projQuery.empty) {
    projectRef = projQuery.docs[0].ref;
    console.log(`[SEED] Found existing project doc ID: ${projectRef.id}. Overwriting with clean ~500-word prompts...`);
  } else {
    projectRef = db.collection("projects").doc();
    console.log(`[SEED] Creating NEW project doc ID: ${projectRef.id}...`);
  }

  const videoStatus = {};
  const scenes = [];

  SCENES.forEach((s) => {
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
    title: "DaveLabs Horizon '26 - Intro Video (100s)",
    concept: "Official 100-Second Intro Video for DaveLabs Horizon '26 Launch Event. Ultra-clean, non-AI-artifacting prompts (~500 words per scene). Single continuous motion vector per shot, zero complex tool manipulations, zero spoken dialogue, zero main character lock. Scene 10 ends with a clean fade to white.",
    brandName: "DaveLabs",
    product: "DaveLabs Horizon '26",
    length: "100s",
    aspectRatio: "16:9",
    pipelineStage: "ready",
    pipelineError: null,
    pipelineProgress: null,
    scenes: scenes,
    videoStatus: videoStatus,
    characterLock: {
      name: "Collective African Community",
      description: "Diverse West African citizens, students, artisans, engineers, and researchers representing DaveLabs' vision for everybody. No recurring individual main character.",
      wardrobe: "Authentic local garments, school uniforms, work coveralls, and professional attire specific to each scene environment.",
    },
    styleHeader: "Authentic cinematic documentary register, 35mm film feel, organic and naturalistic. Photorealistic West African context, completely free of artificial CGI gloss or AI distortion. ABSOLUTELY NO SPOKEN DIALOGUE. NO MAIN RECURRING CHARACTER.",
    musicSpec: "Deep, inspiring, atmospheric cinematic score blending subtle kora harmonics with warm ambient electronic pads, building steadily to an uplifting crescendo.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await projectRef.set(projectData, { merge: true });

  console.log(`\n======================================================`);
  console.log(`[SUCCESS] Project successfully updated with CLEAN ~500-word prompts!`);
  console.log(`Project ID: ${projectRef.id}`);
  console.log(`Title: ${projectData.title}`);
  console.log(`Owner UID: ${USER_UID} (${USER_EMAIL})`);
  console.log(`Scenes Count: ${scenes.length} (10 seconds each, 100s total)`);
  console.log(`Prompt Length Per Scene: ~500 words (Ultra-clean, single continuous shot)`);
  console.log(`Ending Transition: Scene 10 ends with a clean fade to a solid white screen.`);
  console.log(`======================================================\n`);
}

updateHorizonIntroProjectClean().catch((err) => {
  console.error("[ERROR] Failed to update project:", err);
  process.exit(1);
});
