// ─── OPTIQ SKILLS — THE SHOT BOARD ──────────────────────────────────────────
//
// Scene consistency by picture, the way character consistency already works.
//
// WHAT PROBLEM THIS SOLVES
//
// A film is a pile of separately generated 10-second clips. Character references
// (./characterRefs.js) fixed the faces: the same person now survives nine clips
// because every clip carries their picture. Nothing fixed the WORLD around them.
//
// So the failure moved. The face is right and the room is wrong: the kitchen has
// a different window in scene 4, the shop counter changes sides, and the car —
// always the car — swaps who is driving, moves the steering wheel to the other
// side, loses a door, and puts the passenger behind the wheel. Two thousand words
// of prose per scene cannot hold a room still, because a paragraph is a
// specification the model approximates and a picture is a target it matches.
// That is the exact argument §14.1 made about faces. It is just as true of places.
//
// THE ANSWER: SHOOT THE STILLS FIRST
//
// Before a single clip is rendered, the film is photographed as a storyboard —
// the real kind, the kind a production hangs on a wall:
//
//   SET PLATES    one photoreal still of every location, empty of people. The
//                 room itself, locked. Every frame shot in that location is
//                 generated with the plate attached, so the room cannot drift.
//   PROP PLATES   one still of every object whose exact appearance matters and
//                 recurs — a document, a phone screen, a chat thread, a vehicle,
//                 the packaging. The things that used to change between cuts.
//   FRAMES        one still per CAMERA SETUP inside every scene. A 10s scene with
//                 three cuts is three angles, so it gets three frames, each built
//                 from the set plate + the character sheets + the prop plates.
//
// Then the frames ride along with the scene's video render, in time order, and
// the prompt tells the model they are its own frames: start on this one, cut to
// that one at 3.5s. The clip is no longer an interpretation of 2,000 words. It is
// an interpolation between pictures the director has already seen and approved.
//
// WHY THIS IS THE HIGHER-LEVERAGE FIX
//
// A wrong frame costs one image. A wrong clip costs a video render, and the
// director finds out about it three minutes later. Every failure this catches is
// caught at roughly a fortieth of the price, and caught somewhere the director
// can actually look at it before spending anything.
//
// WHAT THIS MODULE IS AND IS NOT
//
// Nothing here calls Vertex, exactly like ./characterRefs.js. This module decides
// WHAT gets photographed, WHAT each image prompt says, and WHAT the clause in the
// video prompt tells the model to do with the results. The orchestration — the
// image calls, storage, quota, the job that survives a closed tab — lives in
// ../shotBoardRun.js, which is shared with the story sandbox.

"use strict";

// ── The numbers, and why they are these numbers ─────────────────────────────

/**
 * How many camera setups one 10-second scene may carry.
 *
 * Doctrine §6.3's house patterns are 2-cut and 3-cut; §6.1 sends a scene whose
 * content IS physical continuity to a single locked shot. Four is therefore the
 * generous ceiling, not the target — at five setups a ten-second clip is giving
 * each angle two seconds, which is a music video, not a scene.
 *
 * It is also the ceiling on how many stills ride along with one video render,
 * and that ceiling is real: doctrine §3.8's fusion warning does not stop applying
 * because the images are frames instead of faces.
 */
const MAX_SHOTS_PER_SCENE = 4;

/** No film needs more distinct locations photographed than this. */
const MAX_SET_PLATES = 8;

/** Nor more objects. Past this, the film is asking the plates to do the writing. */
const MAX_PROP_PLATES = 8;

/**
 * How many reference images one FRAME generation may carry.
 *
 * Higher than the video model's two-face cap because a still is a far easier
 * reconciliation than ten seconds of motion, and because the set plate is doing
 * most of the work here. The order they are attached in is the order of
 * importance — see `frameInputPlan()`, which is what truncates.
 */
const MAX_INPUTS_PER_FRAME = 5;

/** An object earns a plate once it has to look the same twice. Same rule as §14.3. */
const MIN_SCENES_FOR_PROP_PLATE = 2;

// ── Schemas ─────────────────────────────────────────────────────────────────

/**
 * The continuity pass: ONE call for the whole film.
 *
 * It has to be one call because its entire job is agreement. Asked per scene, two
 * parallel builders describe the same kitchen two different ways and there is
 * nothing to compare them against — which is precisely the bug this feature
 * exists to kill. One pass sees every scene at once, decides that scenes 2, 5 and
 * 9 are the same room, and writes that room down ONCE.
 */
const CONTINUITY_SCHEMA = {
  type: "OBJECT",
  properties: {
    locations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          /** Stable slug the scenes refer to. "taxi-interior-day". */
          key: { type: "STRING" },
          name: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
          /** The room itself, 120–200 words. Pasted verbatim into every frame. */
          lock: { type: "STRING" },
          /**
           * Where things ARE, stated as fixed facts of the place: which wall the
           * door is in, which side the counter runs down, which side the steering
           * wheel is on, who sits where. This field is the car fix.
           */
          geometry: { type: "STRING" },
          light: { type: "STRING" },
          /** True for car/van/taxi interiors, boats, anything with fixed seating. */
          vehicle: { type: "BOOLEAN" },
        },
        required: ["key", "name", "scenes", "lock", "geometry", "light", "vehicle"],
      },
    },
    props: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING" },
          name: { type: "STRING" },
          kind: {
            type: "STRING",
            enum: ["document", "screen", "vehicle", "packaging", "garment", "object"],
          },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
          /** The object, 60–120 words: shape, colour, material, wear, markings. */
          anchor: { type: "STRING" },
          /**
           * What has to be LEGIBLE and identical every time — the letterhead, the
           * three messages in the thread, the number on the plate. Empty when the
           * object carries no readable detail.
           */
          detail: { type: "STRING" },
          plateWorthy: { type: "BOOLEAN" },
          reasoning: { type: "STRING" },
        },
        required: ["key", "name", "kind", "scenes", "anchor", "detail", "plateWorthy", "reasoning"],
      },
    },
    sceneLocations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sceneNumber: { type: "INTEGER" },
          locationKey: { type: "STRING" },
          propKeys: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["sceneNumber", "locationKey", "propKeys"],
      },
    },
  },
  required: ["locations", "props", "sceneLocations"],
};

/**
 * The per-scene shot designer. One call per scene, in parallel — safe to
 * parallelise because the continuity pass has already decided everything the
 * scenes must agree ON.
 */
const SHOT_SCHEMA = {
  type: "OBJECT",
  properties: {
    sceneNumber: { type: "INTEGER" },
    coverage: { type: "STRING" },
    shots: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          order: { type: "INTEGER" },
          /** "0.0–3.5s". Tiles the ten seconds with no gap and no overlap. */
          time: { type: "STRING" },
          /** Six words for the UI. "Low wide from the passenger footwell". */
          label: { type: "STRING" },
          /** Lens, height, distance, angle, and what is in frame. */
          camera: { type: "STRING" },
          /** Who and what is where IN THIS FRAME, left to right, near to far. */
          blocking: { type: "STRING" },
          /**
           * The still itself: the single frozen instant this image shows. Present
           * tense, one moment, no camera move, no "then".
           */
          firstFrame: { type: "STRING" },
          /** What MOVES across this shot's seconds, once the clip is running. */
          motion: { type: "STRING" },
          /**
           * How the clip enters this setup. The director's own note: does it start
           * held for a beat, or is the action already underway on the first frame?
           */
          entry: { type: "STRING", enum: ["straight-into-action", "held-then-moves"] },
          characters: { type: "ARRAY", items: { type: "STRING" } },
          propKeys: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "order", "time", "label", "camera", "blocking",
          "firstFrame", "motion", "entry", "characters", "propKeys",
        ],
      },
    },
  },
  required: ["sceneNumber", "coverage", "shots"],
};

// ── The continuity pass ─────────────────────────────────────────────────────

/**
 * The system prompt for the one-call continuity pass.
 *
 * `branded` is the single difference between this box and the story sandbox's
 * copy, and it only decides whether products and packaging are in scope.
 */
function continuityDirective({ numScenes, branded = true }) {
  return `You are the CONTINUITY SUPERVISOR. A film has already been written: ${numScenes} scenes, each rendered later as its own separate ten-second clip by a video model with NO MEMORY of any other clip.

That memorylessness is the whole problem you exist to solve. Nothing carries from one clip to the next except what is written down. If the kitchen is not written down identically for scene 2 and scene 7, the model invents a second kitchen — and it will, every time.

Your job is to write down, ONCE, the things that must not change:

1. LOCATIONS. Read every scene and group them by PLACE. Two scenes are the same location only if they are literally the same physical place — the same room, the same stretch of street, the same vehicle interior. A different corner of the same compound is the same location; a different compound is not.

   For each location author:
   • lock — 120–200 words describing the PLACE ITSELF and nothing else: the walls and what is on them, the floor, the ceiling, the windows and what is through them, every piece of furniture and where it stands, the fittings, the clutter, the wear, the colours, the materials. No people. No action. No camera. A production designer's note, not a shot list.
   • geometry — where things ARE, as fixed facts. Which wall the door is in. Which side the counter runs down. What is on the left as you come in. For anything with seats, who sits where and on which side. THIS FIELD IS THE ONE THAT KEEPS BREAKING, so be blunt and physical: "the door is in the left-hand wall", not "the room feels open".
   • light — the light in this place, and what time of day it is. One or two sentences, and it must be the SAME across every scene set here unless the story explicitly moves the clock.
   • vehicle — true for any car, taxi, van, bus, boat or tricycle interior.

   VEHICLES GET SPECIAL TREATMENT, because vehicle interiors fail more than anything else in this pipeline. Drivers and passengers swap seats between clips, the steering wheel moves to the other side of the car, doors disappear. So for any vehicle you MUST state, in geometry, in plain words: which side the steering wheel is on, who is in the driver's seat, who is in the front passenger seat, who is in the back and on which side, which way the vehicle is facing, and which windows are up or down. Name the people. Do not write "the two of them sit in front".

2. OBJECTS. Find every physical thing whose exact appearance has to be the same every time it is on screen${branded ? " — including the product and its packaging" : ""}. Documents and letters. Phone screens, chat threads, app interfaces, dashboards. Vehicles seen from outside. Signage. A distinctive garment or bag that travels through the film.

   For each: an anchor of 60–120 words (shape, size, colour, material, condition, markings) and a detail field naming what must be LEGIBLE and identical every time — the exact letterhead, the exact three messages in the thread and who sent them, the exact plate number. If nothing on it is readable, leave detail empty.

   Mark plateWorthy true when the object will be photographed as its own reference still. Say yes when it appears in two or more scenes, OR when it carries readable detail that must not change, OR when it is a vehicle. Say no to background scenery, to anything glimpsed once, and to anything whose exact look genuinely does not matter. Put the reason in reasoning either way.

3. Then map every scene to its locationKey and the propKeys that are actually in it. Every scene number must appear exactly once. A scene with no props gets an empty list — do not pad it.

Write the locks the way a person who has stood in the room would write them. Specific beats evocative every time: "a wall calendar from a hardware shop, two months out of date, curling at the bottom right" is worth a paragraph of "warmly lit and lived-in".`;
}

/** What the continuity pass reads: the film, compactly. */
function continuityBrief({ scenes, registry, characterNames, brandName, product }) {
  const sceneLines = (scenes || [])
    .map((s, i) => {
      const n = s.sceneNumber ?? i + 1;
      return `── SCENE ${n} ──
Setting: ${oneLine(s.setting)}
Action: ${oneLine(s.action)}${s.sound ? `\nSound: ${oneLine(s.sound, 240)}` : ""}`;
    })
    .join("\n\n");

  // New films persist the swarm's own registry, which already contains locked set
  // blocks and object anchors authored against the storyline. Where it exists it
  // is the better source and this pass should extend it, not overrule it. Films
  // made before it was persisted simply arrive without one.
  const registrySection = registry
    ? `\n\nTHE FILM'S EXISTING CONSISTENCY REGISTRY. These locks are already pasted verbatim inside the scene prompts, so the video model has been told them. Reuse them — keep the same wording where it already covers a location or an object, and only extend where it is silent:
${JSON.stringify(
        {
          recurringSets: registry.recurringSets || [],
          elements: registry.elements || [],
          products: registry.products || [],
        },
        null,
        2
      ).slice(0, 12000)}`
    : "";

  return `THE FILM${brandName ? ` — for ${brandName}${product ? `, ${product}` : ""}` : ""}
${characterNames?.length ? `Recurring cast: ${characterNames.join(", ")}` : "No recurring named cast."}

${sceneLines}${registrySection}`;
}

// ── The per-scene shot designer ─────────────────────────────────────────────

function shotDesignDirective({ location, maxShots = MAX_SHOTS_PER_SCENE }) {
  return `You are the SHOT DESIGNER. One scene of a film has been fully written as a video-generation prompt. You are deciding how that ten seconds is SHOT — how many camera setups it takes, what each one sees, and what the very first frame of each one looks like.

Every setup you name gets PHOTOGRAPHED before the clip is rendered: an image model builds a still of it, the director looks at it, and the approved stills are handed to the video model as the clip's own frames. So a setup you describe vaguely becomes a still that is wrong, and a still that is wrong becomes a clip that is wrong. Be exact.

HOW MANY SETUPS
Read the scene's own timestamped beats and follow them — the cuts are already planned in the prompt and you are not re-editing the film.
• If the scene is one continuous locked shot — where the physical continuity IS the content — that is ONE setup covering the full ten seconds. That is a legitimate answer and often the strongest one.
• If the scene cuts, one setup per cut. Two or three is the house pattern.
• Never more than ${maxShots}. Ten seconds split more ways than that gives each angle under two seconds, which is a trailer, not a scene.
Your setups must tile the ten seconds end to end: no gaps, no overlaps, first one starts at 0.0s, last one ends at 10.0s.

WHAT EACH SETUP OWES

camera — the lens, the height, the distance, the angle, and what is inside the frame. "A 35mm wide from just above knee height, low and close to the passenger footwell, taking in the gear lever, both front seats and the windscreen beyond." Not "a dynamic angle".

blocking — who and what is where in THIS frame, stated left to right and near to far, using the location's fixed geometry. This is where the film stops swapping people around: name the person, name their side of frame, name what they are touching. If they are in a vehicle, say which seat.

firstFrame — the single frozen instant this still shows. One moment, present tense, everything in it visible: posture, hands, where the eyes are looking, expression, what is mid-air. A camera cannot move in a still, so do not write a move; a still has no "then", so do not write two moments. This text becomes the image prompt, and it is the most important field you write.

motion — what happens across this setup's seconds once the clip is running, in physical verbs. The video model reads this to know where the frame is going.

entry — "straight-into-action" when the cut lands with the movement already underway, "held-then-moves" when the frame sits still for a beat first. Most cuts inside a ten-second scene should be straight-into-action; a held frame is a choice you make deliberately, usually to open a scene or to let something land.

characters — the exact names, as spelled in the scene prompt, of the people visible in this setup. Nobody else.
propKeys — the keys, from the list you are given, of the objects visible in this setup. Only what is genuinely in this frame.

THE PLACE IS ALREADY DECIDED. ${
    location
      ? `This scene is shot at "${location.name}". Its locked description and its fixed geometry are below, and they are not yours to change — the room has already been photographed and every one of your setups is a camera position INSIDE that photograph. Do not move a wall, add a window, change the furniture or relight it. Place your camera and place your people, and let the room be the room.${
          location.vehicle
            ? `\n\nTHIS IS A VEHICLE INTERIOR, which is where this pipeline fails most often. Obey the seating in the geometry exactly, in every single setup: the same person stays in the driver's seat, the steering wheel stays on the side it is on, and the doors, windows and mirrors stay where they are. If you place a camera outside the vehicle looking in, say which side of the vehicle you are on and which windows you are seeing through.`
            : ""
        }`
      : "No locked location was supplied for this scene, so take the setting exactly as the scene prompt describes it and do not invent beyond it."
  }

NEVER, in any field: on-screen text, captions, subtitles, titles, watermarks, logos overlaid on the frame, split screens, collages, insets, picture-in-picture, film-strip borders, letterboxing, or any visible camera, crew, rig or lighting equipment. These are stills FROM a film, not posters about one.`;
}

function shotDesignBrief({ scene, location, props, characters, aspectRatio }) {
  return `SCENE ${scene.sceneNumber} — the full video prompt this ten seconds will be rendered from. Your setups implement THIS, exactly as written, and the timestamped beats inside it are the cuts you are covering:

${scene.fullPrompt}

${
    location
      ? `THE LOCKED LOCATION — "${location.name}"
${location.lock}

FIXED GEOMETRY (obey in every setup): ${location.geometry}
LIGHT: ${location.light}${location.vehicle ? "\nThis is a VEHICLE INTERIOR." : ""}`
      : "No locked location for this scene."
  }

${
    characters?.length
      ? `THE PEOPLE WHO CAN APPEAR IN THIS SCENE (use these names exactly):
${characters.map((c) => `• ${c.name}${c.role ? ` — ${c.role}` : ""}${c.wardrobe ? `\n  Wearing: ${oneLine(c.wardrobe, 400)}` : ""}`).join("\n")}`
      : "This scene has no named recurring cast. Refer to people the way the scene prompt does."
  }

${
    props?.length
      ? `OBJECTS AVAILABLE IN THIS SCENE (use these keys in propKeys):
${props.map((p) => `• ${p.key} — ${p.name}: ${oneLine(p.anchor, 220)}`).join("\n")}`
      : "No locked objects in this scene."
  }

The film is framed ${aspectRatio || "16:9"}. Design for that shape.`;
}

// ── Image prompts ───────────────────────────────────────────────────────────

/**
 * The prohibitions every generated still carries.
 *
 * Written once because all three plate types need the same ones, and because a
 * frame that comes back with a subtitle burned into it is unusable as a video
 * reference — the video model will faithfully reproduce the subtitle.
 */
const STILL_PROHIBITIONS = `- NO text of any kind anywhere in the image: no caption, no subtitle, no title, no label, no watermark, no signature, no timecode, no logo laid over the picture. Writing that genuinely exists on an object inside the scene (a sign on a wall, a label on a bottle) is fine and belongs there; writing added ON TOP of the photograph is not.
- NO split screen, no collage, no inset, no picture-in-picture, no grid of variations, no before-and-after, no film-strip border, no letterbox bars, no frame or matte around the image.
- NO camera, crew, tripod, boom, light stand, reflector or monitor visible anywhere in frame.
- Photographic realism: a real photograph of a real place, taken on a real camera. Not an illustration, not a render, not a painting, not 3D, not stylised, not a cartoon, not AI-glossy.
- Natural skin texture on every person. Not retouched, not airbrushed, not glamorised.`;

/**
 * A SET PLATE: the location, empty of people.
 *
 * Empty is the entire point and it is worth being stubborn about. A plate with a
 * person in it drags that person into every frame generated from it — which is
 * exactly the contamination §14.4 describes, arriving through a different door.
 * An empty room can be attached to all four setups of a scene and to every other
 * scene shot there, and all it can leak is the room, which is what we want.
 */
function setPlatePrompt(location, { aspectRatio, styleHeader } = {}) {
  return `A photorealistic establishing photograph of ONE location, shot as a film-production location reference. Nobody is in it.

THE PLACE — build it exactly to this description:
${location.lock}

WHERE THINGS ARE — this is fixed and must be exactly as stated:
${location.geometry}

THE LIGHT:
${location.light}

HOW TO SHOOT IT:
- A wide establishing angle that takes in as much of the place as one frame honestly can, from roughly standing eye height, on a normal lens with no distortion.
- COMPLETELY EMPTY OF PEOPLE. Nobody in frame, nobody in the background, nobody passing, nobody reflected in a window, a mirror or a screen. Not a hand, not a shadow of a person. This is the room before anyone walks in.
- Everything that lives in this place is present and in its stated position${location.vehicle ? ", including every seat, the steering wheel on its stated side, the mirrors, the dashboard, the doors and the windows" : ""}.
- Sharp throughout, deep focus, no shallow depth of field, no grade, no filter, no vignette, no lens flare.
${aspectRatio ? `- Framed ${aspectRatio}.` : ""}
${STILL_PROHIBITIONS}
${styleHeader ? `\nThe film this location belongs to looks like this — match its register, not its subject:\n${oneLine(styleHeader, 700)}` : ""}

This is a location scout's photograph, kept on file so the same room can be filmed again next week. Make it accurate and plain, not beautiful.`;
}

/**
 * A PROP PLATE: one object, on nothing.
 *
 * Same discipline as the character sheet — a neutral plate with nothing to leak.
 * The `detail` field is separated out and hammered because it is the reason this
 * exists: a letter whose letterhead changes between two cuts is a continuity
 * error a viewer WILL see, and it is the sort of thing a paragraph never holds.
 */
function propPlatePrompt(prop, { aspectRatio, hasReference = false } = {}) {
  const vehicle = prop.kind === "vehicle";
  const screen = prop.kind === "screen";
  const document = prop.kind === "document";

  return `A photorealistic reference photograph of ONE single object, for film production continuity. Nothing else is in the picture.

${
    hasReference
      ? `THE ATTACHED PHOTOGRAPH IS THE REAL OBJECT, supplied by the client. Reproduce it EXACTLY: the same shape, the same proportions, the same colours, the same materials, the same label, the same type and the same logo, letter for letter. This is a real thing that exists and the film has to show that thing and not something like it.
Take ONLY the object from it — not its background, not its lighting, not its angle, not anything else in that photograph. Where the attached photograph and the written description below disagree about the object itself, THE PHOTOGRAPH WINS: it is the object, the words are only a description of it.

`
      : ""
  }THE OBJECT — build it exactly to this description:
${prop.anchor}

${
    prop.detail
      ? `WHAT MUST BE READABLE, AND MUST BE EXACTLY THIS EVERY TIME:
${prop.detail}
Render this legibly and correctly. Every word, number and mark of it is part of the object's identity — if it changes between shots, the film has a continuity error the audience will notice.`
      : "This object carries no readable text. Do not invent any writing on it."
  }

HOW TO SHOOT IT:
${
    vehicle
      ? `- The whole vehicle, three-quarter front angle, on flat neutral ground with a plain empty background — no street, no traffic, no buildings, no people.
- Both the front and one full side visible, so the shape, the panels, the wheels and the glass all read.
- Nobody inside it, nobody near it, no reflections of people in the paint or the glass.`
      : screen
        ? `- The device held square to the camera or lying flat, screen filling most of the frame, screen ON and perfectly legible with no glare, no moiré and no reflection.
- Shot straight on so nothing on the screen is distorted or cut off.
- Plain neutral surface beneath it. No hands, no fingers, no people, no other objects.`
        : document
          ? `- The document flat and square to the camera, filling the frame, evenly lit with no shadow across it and no glare.
- Every part of it inside the frame — nothing cropped off, nothing folded away.
- Plain neutral surface beneath it. No hands, no people, no other objects.`
          : `- The object alone on a plain, neutral, seamless surface, at a three-quarter angle that shows its shape, its scale and its main face.
- Nothing else in frame: no props, no hands, no people, no location, no scenery.`
}
- Flat, even, soft light. No dramatic shadow, no coloured gel, no rim light.
- Sharp focus throughout, true colour, no grade, no filter, no stylisation.
${aspectRatio ? `- Framed ${aspectRatio}.` : ""}
${STILL_PROHIBITIONS}

This is a props-department continuity still. Make it accurate and plain, not a product advertisement.`;
}

/**
 * A FRAME: one camera setup of one scene, built on top of the plates.
 *
 * The clauses below are load-bearing in the same way §14's quarantine clause is.
 * The attached images each say something different about what to take and what to
 * ignore, and without naming them individually the model averages them: it takes
 * the set plate's emptiness as well as its walls, and puts the character sheet's
 * flat studio light into the room.
 */
function framePrompt(shot, { location, characters = [], props = [], inputs = [], aspectRatio, styleHeader } = {}) {
  const attachments = inputs
    .map((input, i) => {
      const n = i + 1;
      if (input.role === "set") {
        return `Attached image ${n} is THE LOCATION — a photograph of this exact place, empty. Take the room from it and take it exactly: the same walls, the same floor, the same furniture in the same positions, the same fittings, the same clutter, the same colours, the same light and the same time of day. Your camera is standing somewhere inside THAT room. Do NOT take its emptiness — the people described below are in this frame — and do NOT take its camera position, which is a different angle from the one you are shooting.`;
      }
      if (input.role === "character") {
        return `Attached image ${n} is ${String(input.name || "").toUpperCase()}. Match this person's face, skin tone, hair and outfit exactly — they appear across several clips of this film and must be recognisably identical in every one. Take ONLY the person: the reference is a studio continuity still on a plain grey backdrop under flat light in a neutral standing pose, and none of that belongs here. Not the backdrop, not the lighting, not the pose, not the framing. This frame has its own room, its own light and its own action.`;
      }
      return `Attached image ${n} is ${String(input.name || "the object").toUpperCase()}, an object reference. The object in this frame must match it exactly — same shape, same colour, same markings, same wear${input.detail ? ", and the same readable detail on it, word for word" : ""}. Take ONLY the object: not its plain background, not its flat lighting, not its angle. In this frame it is where the blocking says it is, lit by this room's light.`;
    })
    .join("\n\n");

  const people = characters.length
    ? characters
        .map(
          (c) =>
            `${c.name.toUpperCase()}${c.role ? ` (${c.role})` : ""}: ${c.lcb || ""}${
              c.wardrobe ? `\nWearing, exactly: ${c.wardrobe}` : ""
            }`
        )
        .join("\n\n")
    : "";

  return `A photorealistic single frame from a live-action film — one frozen instant, shot on a real camera.

${
    attachments
      ? `=== THE ATTACHED REFERENCES ===
${attachments}

Where an attached reference and the words below disagree, the WORDS WIN. The pictures confirm; the writing specifies.

`
      : ""
  }=== THE MOMENT THIS FRAME SHOWS ===
${shot.firstFrame}

=== THE CAMERA ===
${shot.camera}

=== WHERE EVERYONE AND EVERYTHING IS ===
${shot.blocking}
${location?.geometry ? `\nThe place's fixed geometry, which this frame must obey: ${location.geometry}` : ""}

${
    location
      ? `=== THE PLACE ===
${location.lock}

THE LIGHT: ${location.light}${
          location.vehicle
            ? `\n\nTHIS IS A VEHICLE INTERIOR. The seating above is fixed and is not negotiable: the person named as driving is behind the wheel, the steering wheel is on the side stated, everyone else is in the seat they are given. Every door, window and mirror the place has is present. Do not move anyone between seats, do not mirror the vehicle, and do not remove a door or a pillar to make the shot easier.`
            : ""
        }

`
      : ""
  }${
    people
      ? `=== WHO IS IN FRAME ===
${people}

Every person in this frame is a Black Gambian / West African person. Any background people are Black Gambian too, and they differ from one another — different complexions across the real range, different hairstyles, a spread of ages and builds.

`
      : ""
  }=== HOW IT IS SHOT ===
- A still frame from a film: real photographic depth, real lens character, natural light behaviour.
- Everything in the frame described above is in it, in the position described. Nothing that is not described is invented into the foreground.
${aspectRatio ? `- Framed ${aspectRatio}. Compose for that shape.\n` : ""}${STILL_PROHIBITIONS}
${styleHeader ? `\n=== THE FILM'S LOOK ===\n${oneLine(styleHeader, 700)}` : ""}

This frame will be handed to a video model as the actual opening frame of a ten-second shot, so it has to be a photograph of a real moment in a real place — not a poster, not a composite, not a pretty picture of the idea.`;
}

/**
 * Which references ride along with one frame generation, in priority order.
 *
 * The set plate goes FIRST and is never dropped. It is the thing that makes this
 * whole feature work — a frame with the right faces in the wrong room is the bug
 * we are here to fix, and the room only comes from the plate.
 */
function frameInputPlan(shot, { setPlate, characterRefs = [], propPlates = [] }) {
  const inputs = [];
  // Bytes are the qualifier, not intent. The prompt numbers its attachments
  // ("Attached image 2 is BINTA"), so a reference that is planned but not
  // actually sent would shift every number after it and point the model at the
  // wrong picture. If it has no bytes it is not an input.
  if (setPlate?.base64) {
    inputs.push({ role: "set", name: setPlate.name, ref: setPlate });
  }

  const wanted = new Set((shot.characters || []).map(normalizeName));
  for (const ref of characterRefs) {
    if (!ref?.base64 || !wanted.has(normalizeName(ref.name))) continue;
    inputs.push({ role: "character", name: ref.name, ref });
  }

  const keys = new Set(shot.propKeys || []);
  for (const plate of propPlates) {
    if (!plate?.base64 || !keys.has(plate.key)) continue;
    inputs.push({ role: "prop", name: plate.name, detail: plate.detail, ref: plate });
  }

  return inputs.slice(0, MAX_INPUTS_PER_FRAME);
}

// ── The clause that goes into the video prompt ──────────────────────────────

/**
 * Bracketing markers, so the block can be replaced without touching the prompt
 * around it. A shot board that is rebuilt — because the director re-rolled a
 * frame, or because the scene was rewritten — must not leave the previous board's
 * instructions buried in the prompt, telling the model to cut to frames that are
 * no longer attached.
 */
const SHOT_BOARD_OPEN = "=== THE SHOT BOARD — THE ATTACHED IMAGES ARE THIS CLIP'S OWN FRAMES ===";
const SHOT_BOARD_CLOSE = "=== END OF SHOT BOARD ===";

/**
 * The block appended to a scene's fullPrompt once its frames exist.
 *
 * Appended rather than woven in, deliberately. The scene prompt is a gated
 * artefact — it passed word count, verbatim locks, density and the sound policy —
 * and re-compiling it through a model to insert a paragraph risks all of that to
 * save nothing. Appending is deterministic, reversible, and lands the shot board
 * in the last thing the model reads, which is where a hard spec belongs.
 *
 * It also has to SUPERSEDE, explicitly: the prompt above it may still carry the
 * character-reference quarantine clause from ../characterRefs.js, written when
 * the attachments were grey-backdrop studio portraits. They are not any more.
 */
function shotBoardClause(shots, { sceneSeconds = 10 } = {}) {
  // Filtered on `url` alone, and it must stay that way: this list IS the
  // numbering the clause hands the video model ("ATTACHED IMAGE 2"), so it has to
  // be exactly the list the render attaches — which is the frames that exist.
  const list = (shots || []).filter((s) => s.url);
  if (list.length === 0) return "";

  const single = list.length === 1;
  const roll = list
    .map((shot, i) => {
      const entry =
        shot.entry === "held-then-moves"
          ? "The frame holds for a beat before anything moves."
          : "The action is already underway on this frame — cut straight into it, no pause.";
      return `ATTACHED IMAGE ${i + 1} — ${shot.time}${shot.label ? ` — ${shot.label}` : ""}
This is the FIRST FRAME of this part of the clip, exactly as it must appear. Camera: ${oneLine(shot.camera, 400)}
Positions: ${oneLine(shot.blocking, 400)}
${entry}
What moves across these seconds: ${oneLine(shot.motion, 400)}`;
    })
    .join("\n\n");

  return `${SHOT_BOARD_OPEN}
${list.length} image${single ? " is" : "s are"} attached to this render, and ${single ? "it is not a reference — it is this clip's opening frame" : `they are not references — they are this clip's ${list.length} frames, in order`}. ${
    single
      ? "Begin the clip on it exactly: the same place, the same people in the same positions, the same lighting, the same lens and the same framing, and move on from there."
      : `Shoot the ten seconds AS THESE ${list.length} SETUPS, in this order, cutting at the times given. Each attached image is the exact opening frame of its part: match its place, its people and their positions, its light, its lens and its framing precisely, then play its movement out from there.`
  }

${roll}

RULES FOR USING THEM:
- These images are the same location and the same people photographed from ${single ? "this angle" : "different angles"}. ${single ? "" : "They are NOT different places and NOT different people — do not treat a change of angle as a change of scene, and do not blend them into one composite frame. "}Everything about the room — the walls, the floor, the furniture and where it stands, the objects, the colours, the light, the time of day — is IDENTICAL in all of them and must stay identical for the whole clip.
- Every person keeps the face, hair, skin tone and clothes they have in these frames, for the whole ${sceneSeconds} seconds, without exception.
- Every object keeps the exact appearance it has in these frames, including anything written or displayed on it. A document, a screen or a label must not change between one second and the next.
${
    single
      ? "- Do NOT cut. This is one continuous shot from the attached frame."
      : `- Cut ONLY at the times given above — ${list.map((s) => s.time).join(", ")} — and cut hard. No dissolves, no fades, no wipes, no transitions of any kind. Between those cuts the camera does only what the movement above describes.`
  }
- Do not invent an establishing shot, a reaction cut or an insert that is not in this board.

THIS SUPERSEDES ANY EARLIER INSTRUCTION IN THIS PROMPT ABOUT ATTACHED IMAGES. Nothing attached here is a studio portrait on a grey backdrop, so there is no backdrop, no studio lighting and no neutral pose to discard — these are photographs OF THIS SCENE, in the real location, and everything in them belongs in the clip. Where these frames and the writing above disagree about what something looks like, THE FRAMES WIN; where they disagree about what HAPPENS, the writing above wins.
${SHOT_BOARD_CLOSE}`;
}

/** Strips any previous board, then appends the current one. Idempotent. */
function applyShotBoardClause(fullPrompt, shots, options) {
  const stripped = stripShotBoardClause(fullPrompt);
  const clause = shotBoardClause(shots, options);
  if (!clause) return stripped;
  return `${stripped.trimEnd()}\n\n${clause}`;
}

function stripShotBoardClause(fullPrompt) {
  const text = String(fullPrompt || "");
  const start = text.indexOf(SHOT_BOARD_OPEN);
  if (start === -1) return text;
  const end = text.indexOf(SHOT_BOARD_CLOSE, start);
  if (end === -1) return text.slice(0, start).trimEnd();
  return (text.slice(0, start) + text.slice(end + SHOT_BOARD_CLOSE.length)).trimEnd();
}

/**
 * The board block on its own, or "".
 *
 * This is what keeps a shot board alive through a revision. The scene reviser
 * re-compiles a prompt from scratch and would silently drop the block — leaving
 * frames attached to the render with nothing telling the model what they are.
 * So the block is lifted off before the reviser sees it and put back afterwards,
 * unchanged: the frames did not change, only the words around them did.
 */
function extractShotBoardClause(fullPrompt) {
  const text = String(fullPrompt || "");
  const start = text.indexOf(SHOT_BOARD_OPEN);
  if (start === -1) return "";
  const end = text.indexOf(SHOT_BOARD_CLOSE, start);
  if (end === -1) return text.slice(start).trim();
  return text.slice(start, end + SHOT_BOARD_CLOSE.length).trim();
}

/** Puts a previously extracted block back on a rewritten prompt. */
function restoreShotBoardClause(fullPrompt, clause) {
  const stripped = stripShotBoardClause(fullPrompt);
  if (!clause) return stripped;
  return `${stripped.trimEnd()}\n\n${clause}`;
}

// ── Gates ───────────────────────────────────────────────────────────────────

/**
 * What a designed shot list has to satisfy before anything is rendered.
 *
 * Cheap and worth it: a malformed shot list costs one text call to repair here
 * and a whole scene's worth of wrong stills if it gets through.
 */
function shotPlanViolations(plan, { maxShots = MAX_SHOTS_PER_SCENE, sceneSeconds = 10 } = {}) {
  const violations = [];
  const shots = plan?.shots || [];

  if (shots.length === 0) {
    violations.push("No setups were returned. Every scene has at least one camera setup.");
    return violations;
  }
  if (shots.length > maxShots) {
    violations.push(
      `${shots.length} setups is over the ${maxShots}-setup ceiling. Merge the weakest cuts — ten seconds cannot carry more than ${maxShots} angles.`
    );
  }

  let previousEnd = 0;
  shots.forEach((shot, i) => {
    const span = parseTimeSpan(shot.time);
    if (!span) {
      violations.push(`Setup ${i + 1} has an unreadable time "${shot.time}". Use the form "0.0–3.5s".`);
    } else {
      if (i === 0 && span.start > 0.01) {
        violations.push(`The first setup starts at ${span.start}s. It must start at 0.0s.`);
      }
      if (i > 0 && Math.abs(span.start - previousEnd) > 0.11) {
        violations.push(
          `Setup ${i + 1} starts at ${span.start}s but the one before it ends at ${previousEnd}s. The setups must tile the ${sceneSeconds} seconds with no gap and no overlap.`
        );
      }
      if (span.end <= span.start) {
        violations.push(`Setup ${i + 1} ends at or before it starts ("${shot.time}").`);
      }
      previousEnd = span.end;
    }

    for (const field of ["camera", "blocking", "firstFrame", "motion"]) {
      if (countWords(shot[field]) < 8) {
        violations.push(
          `Setup ${i + 1}'s ${field} is too thin ("${oneLine(shot[field], 60)}"). Every one of these becomes part of an image prompt, and a vague field makes a wrong picture.`
        );
      }
    }

    // A still cannot pan. This catches the single most common mistake: writing
    // the SHOT into the field that describes the FRAME.
    if (/\b(pans?|panning|zooms?|zooming|tracks? (?:in|out|left|right)|dollies|then|after that|cuts? to)\b/i.test(
        shot.firstFrame || ""
      )) {
      violations.push(
        `Setup ${i + 1}'s firstFrame describes movement or a second moment ("${oneLine(shot.firstFrame, 80)}"). It is a single frozen instant — one moment, no camera move, no "then". Put the movement in motion.`
      );
    }

    if (/\b(text overlay|caption|subtitle|lower third|split screen|watermark|title card)\b/i.test(
        `${shot.camera} ${shot.blocking} ${shot.firstFrame}`
      )) {
      violations.push(`Setup ${i + 1} asks for on-screen text or a split screen. These are frames from a film; neither is allowed.`);
    }
  });

  if (previousEnd > 0 && Math.abs(previousEnd - sceneSeconds) > 0.6) {
    violations.push(
      `The setups cover ${previousEnd}s of a ${sceneSeconds}-second scene. They must run to ${sceneSeconds}.0s.`
    );
  }

  return violations;
}

/** What a continuity pass has to satisfy. Faults here poison every frame. */
function continuityViolations(continuity, scenes) {
  const violations = [];
  const locations = continuity?.locations || [];
  const mapping = continuity?.sceneLocations || [];

  if (locations.length === 0) {
    violations.push("No locations were returned. Every film is shot somewhere.");
  }
  if (locations.length > MAX_SET_PLATES) {
    violations.push(
      `${locations.length} locations is more than the ${MAX_SET_PLATES} this film can photograph. Merge the ones that are genuinely the same place.`
    );
  }

  const keys = new Set(locations.map((l) => l.key));
  for (const location of locations) {
    if (countWords(location.lock) < 60) {
      violations.push(`Location "${location.name}" has a ${countWords(location.lock)}-word lock. It needs 120–200 words of the place itself.`);
    }
    if (countWords(location.geometry) < 10) {
      violations.push(`Location "${location.name}" has no real geometry. State where things ARE — walls, doors, sides, seats.`);
    }
    if (location.vehicle && !/\b(steering wheel|driver|driving seat|driver's seat)\b/i.test(location.geometry || "")) {
      violations.push(
        `Location "${location.name}" is a vehicle interior but its geometry never says which side the steering wheel is on or who is driving. That omission is the single most common failure in this pipeline.`
      );
    }
  }

  const numbers = (scenes || []).map((s, i) => Number(s.sceneNumber ?? i + 1));
  const mapped = new Set(mapping.map((m) => Number(m.sceneNumber)));
  for (const n of numbers) {
    if (!mapped.has(n)) violations.push(`Scene ${n} was not given a location.`);
  }
  for (const entry of mapping) {
    if (!keys.has(entry.locationKey)) {
      violations.push(`Scene ${entry.sceneNumber} points at location "${entry.locationKey}", which does not exist.`);
    }
  }

  return violations;
}

// ── Selection ───────────────────────────────────────────────────────────────

/**
 * Which objects actually get photographed.
 *
 * The model's own plateWorthy judgement is honoured, then trimmed by the same
 * economics as §14.3: a thing that appears once has no consistency burden and an
 * image spent on it buys nothing. Readable detail is the exception — a document
 * whose letterhead changes is a visible error even inside one scene, across cuts.
 */
function selectPropPlates(props, { max = MAX_PROP_PLATES } = {}) {
  return (props || [])
    .filter((p) => p && p.key && p.anchor)
    .filter((p) => {
      if (!p.plateWorthy) return false;
      const scenes = (p.scenes || []).length;
      if (scenes >= MIN_SCENES_FOR_PROP_PLATE) return true;
      if (p.detail && String(p.detail).trim()) return true;
      return p.kind === "vehicle";
    })
    .sort((a, b) => (b.scenes || []).length - (a.scenes || []).length)
    .slice(0, max);
}

/** Locations, most-used first, capped — a film that hits the cap spends its plates where they matter. */
function selectSetPlates(locations, { max = MAX_SET_PLATES } = {}) {
  return (locations || [])
    .filter((l) => l && l.key && l.lock)
    .sort((a, b) => (b.scenes || []).length - (a.scenes || []).length)
    .slice(0, max);
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** "0.0–3.5s" / "0-3.5" / "00:00–00:03" → { start, end } seconds, or null. */
function parseTimeSpan(text) {
  const raw = String(text || "").replace(/\s/g, "");
  const clock = raw.match(/^(\d+):(\d+(?:\.\d+)?)[–—\-to]+(\d+):(\d+(?:\.\d+)?)/i);
  if (clock) {
    return {
      start: Number(clock[1]) * 60 + Number(clock[2]),
      end: Number(clock[3]) * 60 + Number(clock[4]),
    };
  }
  const plain = raw.match(/^(\d+(?:\.\d+)?)s?[–—\-]+(?:to)?(\d+(?:\.\d+)?)s?$/i);
  if (plain) return { start: Number(plain[1]), end: Number(plain[2]) };
  return null;
}

function normalizeName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function slug(name) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "unnamed"
  );
}

function countWords(text) {
  return String(text || "").split(/\s+/).filter(Boolean).length;
}

/** Collapses whitespace and clips, for prompts that quote another prompt. */
function oneLine(text, max = 600) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

module.exports = {
  // schemas
  CONTINUITY_SCHEMA,
  SHOT_SCHEMA,
  // prompts
  continuityDirective,
  continuityBrief,
  shotDesignDirective,
  shotDesignBrief,
  setPlatePrompt,
  propPlatePrompt,
  framePrompt,
  frameInputPlan,
  // the video-prompt clause
  shotBoardClause,
  applyShotBoardClause,
  stripShotBoardClause,
  extractShotBoardClause,
  restoreShotBoardClause,
  SHOT_BOARD_OPEN,
  SHOT_BOARD_CLOSE,
  // gates + selection
  shotPlanViolations,
  continuityViolations,
  selectPropPlates,
  selectSetPlates,
  // constants + helpers
  MAX_SHOTS_PER_SCENE,
  MAX_SET_PLATES,
  MAX_PROP_PLATES,
  MAX_INPUTS_PER_FRAME,
  parseTimeSpan,
  slug,
};
