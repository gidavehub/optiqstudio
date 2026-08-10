// ─── OPTIQ STORY X — THE SHOT BOARD ─────────────────────────────────────────
//
// THE EXPERIMENTAL STORY SANDBOX'S OWN COPY, and the ONLY shot board left in the
// tree. The board was once built for every film and was reverted on cost: a
// hundred-plus images before a second of video is the wrong trade for an ad. It
// lives here now, behind one deliberately expensive film type, where the
// photography IS what the director is buying.
//
// Nothing else in this repository imports this file, and nothing in this file
// may ever be imported by functions/optiqSkills, functions/optiqStory or
// functions/optiqDocumentary. Four boxes, one door each.
//
// WHAT DIFFERS FROM THE VERSION AT TAG `shot-board-experiment`:
//   • The film is longer. The ceilings on places, arrangements and objects were
//     sized for an 18-scene ad; a 30-scene film legitimately visits more.
//   • The shooting brief carries a CAST KEY — who is who in the attached frames,
//     and what each of them is wearing in this scene. With thirty clips and no
//     character sheet attached, "the man" is the single easiest thing for the
//     model to assign to the wrong face.
//   • Nothing here is best-effort any more. On this film type an unphotographed
//     scene has no usable fallback: its long prompt was written NOT to describe
//     how anything looks, so rendering it from prose produces a clip of a
//     different film. A missing picture is surfaced and retried, never skipped.
//
// ════════════════════════════════════════════════════════════════════════════
// THE HIERARCHY
// ════════════════════════════════════════════════════════════════════════════
//
// A film is a pile of separately generated ten-second clips and the video model
// has no memory between them. Character references fixed the faces. The first
// shot board fixed the places. Neither fixed the thing in between — WHERE THINGS
// ARE INSIDE A PLACE, and what happens to them as the film runs.
//
// The failure that is left looks like this: the kitchen is right and the plate is
// on the wrong side of the table; the taxi is right and the phone that was on the
// dashboard is now in the cupholder; the room is right but the meal that was
// half-eaten in the wide is untouched in the reverse. Every one of those is the
// same bug — a description was handed to two separate image generations and they
// interpreted it two different ways, because that is what descriptions are for.
//
// So this module builds the film as a HIERARCHY OF PHOTOGRAPHS, each tier
// generated FROM the tier above it rather than from a fresh reading of the same
// paragraph. A picture cannot be interpreted two ways.
//
//   TIER 1 — THE ENVIRONMENT.  The whole place, empty. A taxi, a compound, a
//            stretch of beach, a corridor, the surface of a planet. One master
//            plate, plus a second covering angle when the film shoots past what
//            the master sees. Generated from words, because something has to be.
//
//   TIER 2 — THE SETTINGS.     An ARRANGEMENT inside an environment: the dressed
//            dining table, the front of the cab, the desk with the papers on it.
//            Generated WITH THE ENVIRONMENT PLATE ATTACHED, so a setting is
//            physically inside the place it belongs to and cannot drift from it.
//            This is the tier that fixes where the plate sits on the table.
//
//   TIER 2 — THE OBJECTS.      One thing, on nothing. The phone, the letter, the
//            bag. Unchanged from the previous design, and still the only way a
//            legible document stays legibly the same.
//
//   TIER 2 — THE CAST.         Character sheets, from ./characterRefs.js.
//
//   TIER 3 — THE STATES.       None of the above is frozen. A film CHANGES its
//            world: the meal gets eaten, the letter gets torn, the room gets
//            dark, the phone screen advances to the next message. Every
//            environment, setting and object may therefore carry STATES, and a
//            state's plate is generated FROM THE PREVIOUS STATE'S PLATE with one
//            instruction: this is the same thing, later; exactly this changed;
//            everything else is identical. Change becomes a chain of photographs
//            instead of a chain of adjectives.
//
//   TIER 4 — THE FRAMES.       The angles. The final result, and the only tier
//            the video model ever sees. Each frame is generated from the
//            state-resolved setting plate (or the environment plate when the shot
//            is wider than any one setting), plus the character sheets of the
//            people in it, plus the object plates of the things in it. A shot
//            that MOVES also gets an END frame, generated from its own first
//            frame, so a pan is specified by both of its ends.
//
// Every tier is empty of people except the frames. That is deliberate and it is
// load-bearing: a plate with a person in it drags that person into everything
// generated from it.
//
// ════════════════════════════════════════════════════════════════════════════
// WHAT THIS BUYS AT THE BOTTOM
// ════════════════════════════════════════════════════════════════════════════
//
// Once a scene has been photographed, its video prompt no longer has to describe
// anything the pictures already show. Two thousand words of walls, wardrobe and
// complexion were only ever there to hold the look still, and the frames hold it
// far better. So a photographed scene renders from a FRAMED PROMPT instead: a few
// hundred words of what HAPPENS — the beats, the dialogue verbatim with the voice
// that says it, the sound each event makes, the ambience, and where the camera
// goes. See `framedPromptDirective`. The long prompt stays on the scene as the
// script the director reads and revises; it simply stops being what gets rendered.
//
// Nothing here calls Vertex, exactly like ./characterRefs.js. This module decides
// WHAT gets photographed, WHAT each image prompt says, and WHAT the clause in the
// video prompt tells the model to do with the results. The orchestration — the
// image calls, storage, quota, the job that survives a closed tab — lives in
// ../shotBoardRun.js, the one piece both boxes share, and it owns no prompts.

"use strict";

// The one definition of "what counts as a spoken line", shared with the pipeline
// rather than re-implemented here. This module is otherwise import-free — it is
// the brain handed to a runner that owns no prompts — but two different line
// counters would drift, and the whole dialogue floor rests on this one number.
// ./creative.js is pure and calls nothing.
const { countSpokenLines, MIN_LINES_PER_SCENE } = require("./creative");

// What may be photographed.
//
// The board is where this bites hardest, and where it was actually lost: a
// weapon written into a world STATE is photographed once into a plate, and every
// frame of that scene is then generated FROM that plate. The object outlives any
// number of rewrites of the scene's words, because by then it is in a picture.
// See ./safety.js.
const { shootableMandate, SHOOTABLE_PLATE_RULE, graphicViolations } = require("./safety");

// ── The numbers, and why they are these numbers ─────────────────────────────

/**
 * How many camera setups one 10-second scene may carry.
 *
 * Doctrine §6.3's house patterns are 2-cut and 3-cut; §6.1 sends a scene whose
 * content IS physical continuity to a single locked shot. Four is therefore the
 * generous ceiling, not the target — at five setups a ten-second clip is giving
 * each angle two seconds, which is a music video, not a scene.
 */
const MAX_SHOTS_PER_SCENE = 4;

/**
 * How many stills may ride along with ONE video render.
 *
 * Higher than MAX_SHOTS_PER_SCENE because a moving shot spends two: where it
 * starts and where it arrives. Five is the ceiling on the whole scene, so the
 * budget genuinely trades — a three-setup scene can buy two moves, a four-setup
 * scene can buy one, and doctrine §3.8's fusion warning is not repealed by the
 * fact that the extra image is a frame.
 */
const MAX_STILLS_PER_SCENE = 5;

/**
 * No film needs more distinct places photographed than this.
 *
 * 8 was the ad ceiling, sized for eighteen scenes. A thirty-scene story that
 * genuinely moves — a house, a street, a car, a workplace, a hospital, a
 * shoreline, two interiors nobody planned for — hits eight and starts folding
 * distinct places into one plate, which is the drift the board exists to stop.
 */
const MAX_ENVIRONMENTS = 14;

/**
 * Settings are cheap relative to what they fix, and a film legitimately has more
 * arrangements than places — one kitchen holds the stove, the table and the door.
 */
const MAX_SETTINGS = 24;

/** Objects. Past this, the film is asking the plates to do the writing. */
const MAX_OBJECTS = 14;

/**
 * How many times one thing may visibly change across a film.
 *
 * Base plus three. A world that needs a fourth change inside ten scenes is
 * usually one where the writer means "and then it got worse", which the frames
 * can carry without another plate.
 */
const MAX_STATES_PER_THING = 4;

/**
 * How many reference images one FRAME generation may carry.
 *
 * Higher than the video model's two-face cap because a still is a far easier
 * reconciliation than ten seconds of motion, and because the anchor plate is
 * doing most of the work. The order they are attached in is the order of
 * importance — see `frameInputPlan()`, which is what truncates.
 */
const MAX_INPUTS_PER_FRAME = 5;

/** An object earns a plate once it has to look the same twice. Same rule as §14.3. */
const MIN_SCENES_FOR_OBJECT_PLATE = 2;

// ── Clauses reused across every prompt in this module ───────────────────────

/**
 * The anti-copying clause.
 *
 * Every directive below teaches by example, because "a 35mm wide from just above
 * knee height" communicates a standard that "be specific" does not. The cost of
 * teaching that way is that models reproduce the example: ask for a room and
 * describe a kitchen in the brief, and you get that kitchen back in six films.
 *
 * So every directive that shows an example also carries this. It is not
 * decoration — the worked examples in here are deliberately drawn from taxis and
 * dining tables, and without this clause every film acquires a taxi.
 */
const CREATIVE_MANDATE = `═══ THE EXAMPLES ARE FORMAT, NEVER CONTENT ═══
Anything shown to you in this brief as an example — a phrasing, a room, an object, an angle, a piece of blocking — is there ONLY to show you the LEVEL OF DETAIL expected and the SHAPE of a good answer. None of it is in this film. Do not reuse it, do not adapt it, do not let it steer you.

Invent this film's world yourself, from this film's own material. Be genuinely creative and specific: reach for the place, the arrangement, the object, the angle and the detail that belong to THIS story and could not be swapped into another one. A generic answer that satisfies every rule is a worse answer than a surprising one that satisfies them too. If your instinct is a dining table and a phone because those were the examples, that is the instinct to distrust.

This applies hardest to WHERE the film happens. Nothing in this system restricts a film to rooms, to buildings, to interiors, to the present day, to the ground, or to this planet. If the examples read as domestic, that is an accident of which examples were written down, not a boundary. Set this film wherever it genuinely belongs and describe that place fully — the machinery below works exactly the same on a shoreline, a hull, a shaft, a canopy or a vacuum as it does on a kitchen.`;

/**
 * The prohibitions every generated still carries.
 *
 * Written once because all the plate types need the same ones, and because a
 * frame that comes back with a subtitle burned into it is unusable as a video
 * reference — the video model will faithfully reproduce the subtitle.
 */
const STILL_PROHIBITIONS = `- NO text of any kind anywhere in the image: no caption, no subtitle, no title, no label, no watermark, no signature, no timecode, no logo laid over the picture. Writing that genuinely exists on an object inside the scene (a sign on a wall, a label on a bottle) is fine and belongs there; writing added ON TOP of the photograph is not.
- NO split screen, no collage, no inset, no picture-in-picture, no grid of variations, no before-and-after, no film-strip border, no letterbox bars, no frame or matte around the image.
- NO camera, crew, tripod, boom, light stand, reflector or monitor visible anywhere in frame.
- Photographic realism: a real photograph of a real place, taken on a real camera. Not an illustration, not a render, not a painting, not 3D, not stylised, not a cartoon, not AI-glossy.
- Natural skin texture on every person. Not retouched, not airbrushed, not glamorised.
- ${SHOOTABLE_PLATE_RULE}`;

/**
 * What "a real camera was there" means, stated to the image model.
 *
 * The director's note, and it is a correction of a specific failure: image models
 * default to the impossible ideal angle — the one floating four feet from a wall
 * that is two feet away, or hovering where a ceiling is. A frame that could not
 * have been photographed reads as fake before anyone can say why, and it also
 * cannot be matched by the next frame, because there is no consistent room that
 * both angles are inside.
 */
const REAL_CAMERA_CLAUSE = `- A REAL CAMERA WAS PHYSICALLY IN THIS PLACE. It is standing, sitting, kneeling or mounted somewhere a camera could actually be, at a height a camera could actually be at, with room behind it for the lens it is using. It is not floating inside a wall, hovering where the ceiling is, standing outside a solid surface looking through it, or positioned somewhere no operator could stand. If the place is cramped, the shot is cramped — that is what the real lens would do, and it is more convincing than an impossible wide.
- Real lens behaviour throughout: honest perspective for the stated focal length, honest depth of field, honest falloff. No impossible sharpness from front to back on a long lens, no distortion a real lens would not produce.`;

// ── Schemas ─────────────────────────────────────────────────────────────────

/** A state, on any tier. The shape is identical for places, arrangements and things. */
const STATE_SCHEMA = {
  type: "OBJECT",
  properties: {
    key: { type: "STRING" },
    name: { type: "STRING" },
    /** The scenes this state is true for. The base state's list may be empty. */
    scenes: { type: "ARRAY", items: { type: "INTEGER" } },
    /** True for exactly one state per thing: how it starts, before the film touches it. */
    isBase: { type: "BOOLEAN" },
    /**
     * WHAT IS DIFFERENT from the state before it, and ONLY that. Physical and
     * specific — "the left-hand plate is now empty and pushed two inches toward
     * the middle; the chair beside it is pulled back at an angle". Empty on the
     * base state, which is not different from anything.
     */
    change: { type: "STRING" },
  },
  required: ["key", "name", "scenes", "isBase", "change"],
};

/**
 * THE WORLD BIBLE: ONE call for the whole film.
 *
 * It has to be one call because its entire job is agreement. Asked per scene, two
 * parallel builders describe the same kitchen two different ways and there is
 * nothing to compare them against — which is precisely the bug this feature
 * exists to kill. One pass sees every scene at once, decides that scenes 2, 5 and
 * 9 are the same place, decides that the table is laid in 2 and cleared in 9, and
 * writes all of it down ONCE.
 */
const WORLD_SCHEMA = {
  type: "OBJECT",
  properties: {
    environments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          /** Stable slug the scenes refer to. "taxi-interior-day". */
          key: { type: "STRING" },
          name: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
          /** The place itself, 120–200 words. Pasted verbatim into every frame. */
          lock: { type: "STRING" },
          /**
           * Where things ARE, stated as fixed facts of the place: which wall the
           * door is in, which side the counter runs down, which side the steering
           * wheel is on, what lies in which direction. This field is the car fix.
           */
          geometry: { type: "STRING" },
          light: { type: "STRING" },
          /** True for car/van/taxi interiors, boats, anything with fixed seating. */
          vehicle: { type: "BOOLEAN" },
          /**
           * Whether the film shoots past what one master angle can see, and which
           * way the second plate should look. A film that only ever shoots one
           * direction does not need a second plate and should not buy one.
           */
          needsSecondAngle: { type: "BOOLEAN" },
          secondAngle: { type: "STRING" },
          states: { type: "ARRAY", items: STATE_SCHEMA },
        },
        required: [
          "key", "name", "scenes", "lock", "geometry", "light",
          "vehicle", "needsSecondAngle", "secondAngle", "states",
        ],
      },
    },
    settings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          key: { type: "STRING" },
          name: { type: "STRING" },
          /** Which environment this arrangement lives inside. Never empty. */
          environmentKey: { type: "STRING" },
          scenes: { type: "ARRAY", items: { type: "INTEGER" } },
          /** The arrangement, 80–160 words: what is dressed here and how. */
          lock: { type: "STRING" },
          /**
           * EXACT POSITIONS. The field this tier exists for: which plate is where
           * on which side of the table, which way the cup handle faces, what is
           * stacked on what, what is nearest the camera-side edge. Written so two
           * different photographs of it would put the same object in the same
           * place to the inch.
           */
          layout: { type: "STRING" },
          /**
           * Where PEOPLE go in this arrangement, by name, as fixed facts: who sits
           * in which chair, who stands on which side. Empty when nobody is placed
           * here. This is the vehicle-seating fix, generalised to every table,
           * bench, counter and doorway in the film.
           */
          seating: { type: "STRING" },
          objectKeys: { type: "ARRAY", items: { type: "STRING" } },
          states: { type: "ARRAY", items: STATE_SCHEMA },
        },
        required: [
          "key", "name", "environmentKey", "scenes", "lock",
          "layout", "seating", "objectKeys", "states",
        ],
      },
    },
    objects: {
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
          states: { type: "ARRAY", items: STATE_SCHEMA },
        },
        required: [
          "key", "name", "kind", "scenes", "anchor", "detail",
          "plateWorthy", "reasoning", "states",
        ],
      },
    },
    sceneWorld: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          sceneNumber: { type: "INTEGER" },
          environmentKey: { type: "STRING" },
          settingKeys: { type: "ARRAY", items: { type: "STRING" } },
          objectKeys: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["sceneNumber", "environmentKey", "settingKeys", "objectKeys"],
      },
    },
  },
  required: ["environments", "settings", "objects", "sceneWorld"],
};

/**
 * The per-scene shot designer. One call per scene, in parallel — safe to
 * parallelise because the world pass has already decided everything the scenes
 * must agree ON.
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
          /**
           * Whether the camera itself travels, and how. A locked-off shot is a
           * legitimate and common answer — this is not an invitation to move.
           */
          cameraMove: {
            type: "STRING",
            enum: ["locked", "pan", "tilt", "push-in", "pull-back", "track", "handheld-drift"],
          },
          /**
           * The frame this shot ARRIVES at, when the camera or the action carries
           * it somewhere genuinely different. Same rules as firstFrame: one frozen
           * instant. Empty when the shot ends where it started.
           */
          endFrame: { type: "STRING" },
          /** Which arrangement this setup is looking at, or "" for a wide of the place. */
          settingKey: { type: "STRING" },
          /**
           * True when this setup looks BACK toward where a wide establishing
           * angle would stand — into the half of the place a master plate cannot
           * see. It is what selects the second covering plate, so a reverse shot
           * stops inventing the surface behind the camera.
           */
          reverseAngle: { type: "BOOLEAN" },
          characters: { type: "ARRAY", items: { type: "STRING" } },
          objectKeys: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "order", "time", "label", "camera", "blocking", "firstFrame", "motion",
          "entry", "cameraMove", "endFrame", "settingKey", "reverseAngle", "characters", "objectKeys",
        ],
      },
    },
  },
  required: ["sceneNumber", "coverage", "shots"],
};

/** The compressed video prompt a photographed scene renders from. */
const FRAMED_PROMPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    framedPrompt: { type: "STRING" },
  },
  required: ["framedPrompt"],
};

/** A prompt the image model refused, rewritten so it can be asked again. */
const UNBLOCK_SCHEMA = {
  type: "OBJECT",
  properties: {
    prompt: { type: "STRING" },
    /** What was changed and why — this is what the director reads in the notes. */
    whatChanged: { type: "STRING" },
  },
  required: ["prompt", "whatChanged"],
};

// ── The world pass ──────────────────────────────────────────────────────────

/**
 * The system prompt for the one-call world pass.
 *
 * `branded` is the single difference between this box and the ad swarm's copy,
 * and it only decides whether products and packaging are in scope. A story sells
 * nothing, so it is off here.
 */
function worldDirective({ numScenes, branded = false }) {
  return `You are the CONTINUITY SUPERVISOR and the PRODUCTION DESIGNER. A film has already been written: ${numScenes} scenes, each rendered later as its own separate ten-second clip by a video model with NO MEMORY of any other clip.

That memorylessness is the whole problem you exist to solve. Nothing carries from one clip to the next except what is written down and what is photographed. If the kitchen is not written down identically for scene 2 and scene 7, the model invents a second kitchen — and it will, every time.

You are writing the film's WORLD BIBLE, in four parts. Everything you write here gets PHOTOGRAPHED before a single clip is rendered, and every photograph is built from the one above it, so an error you make on the top tier is reproduced faithfully all the way down.

${shootableMandate()}

THAT RULE MATTERS MORE HERE THAN ANYWHERE ELSE IN THE FILM, and the reason is the hierarchy you are at the top of. A weapon you write into a place or into one of its states gets photographed into a plate, and every frame of every scene in that place is then generated FROM that plate. The object survives being deleted from the script, because by then it is in a picture rather than in a sentence. A room that a fight happened in is written as the AFTERMATH — the splintered door, the overturned stool, the scattered floor — and never as a room with the weapon still lying in it.

═══ 1. ENVIRONMENTS — the places ═══

Read every scene and group them by PLACE. Two scenes share an environment only if they are literally the same physical place — the same room, the same stretch of road, the same vehicle interior, the same patch of water. A different corner of the same compound is the same environment; a different compound is not.

A PLACE IS WHATEVER THIS FILM NEEDS IT TO BE, and nothing in this brief is a list of the kinds you may pick from. Nothing here assumes a place has walls, a floor, a ceiling, ground, air, weather, gravity or daylight — those words appear below only because most rooms have most of them, not because your place must. If this story happens somewhere with none of them, write that place on its own terms and use the words it actually deserves. If there are no walls, do not write walls. If "the floor" is the wrong word for whatever is underfoot, use the right one. If there is no underfoot, say so. Describe what is genuinely there.

For each environment author:
• lock — 120–200 words describing the PLACE ITSELF and nothing else: every surface and what is on it, whatever is underfoot and overhead if anything is, whatever bounds the place and what lies beyond it if anything does, every fixed thing and where it stands, the clutter, the wear, the colours, the materials, the scale. No people. No action. No camera. A production designer's note, not a shot list.
• geometry — where things ARE, as fixed facts, in whatever terms this place is actually organised by: what lies in which direction, what is on which side of what, what is near and what is far, what you pass through to get in and where that is. For anything with seats, who sits where and on which side. THIS FIELD IS THE ONE THAT KEEPS BREAKING, so be blunt and physical — state positions, not atmosphere.
• light — the light in this place and the time of day, in one or two sentences. It stays the SAME across every scene set here unless the story explicitly moves the clock — and if it does, that is a STATE, not a second environment.
• needsSecondAngle / secondAngle — one photograph only sees one way. Decide whether this film ever shoots back toward where the master angle is standing, or into a part of the place the master cannot see. If it does, say TRUE and name the second angle plainly ("looking back at the doorway wall from the far corner", "high, looking straight down on the whole yard"). If the film only ever shoots one direction here, say FALSE and do not buy a photograph nothing uses.
• vehicle — true for any car, taxi, van, bus, boat or tricycle interior.

VEHICLES GET SPECIAL TREATMENT, because vehicle interiors fail more than anything else in this pipeline. Drivers and passengers swap seats between clips, the steering wheel moves to the other side of the car, doors disappear. So for any vehicle you MUST state, in geometry, in plain words: which side the steering wheel is on, who is in the driver's seat, who is in the front passenger seat, who is in the back and on which side, which way the vehicle is facing, and which windows are up or down. Name the people. Do not write "the two of them sit in front".

═══ 2. SETTINGS — the arrangements inside a place ═══

This is the tier that stops a film from getting the room right and everything in it wrong.

A SETTING is a dressed part of an environment that the film actually shoots into: the table as it is laid, the front of the cab with what is on the dashboard and in the cupholder, the desk with the papers on it, the shop counter with the goods across it, the patch of sand where the things were dropped. It is smaller than the place and bigger than any one object.

Author a setting wherever the film shoots a specific arrangement more than once, or from more than one angle, or where the exact position of things carries meaning. Do not author one for a corner nothing is shot in.

For each:
• environmentKey — the place it is inside. It must be one you authored above.
• lock — 80–160 words on the arrangement itself: what is dressed here, on what, in what condition.
• layout — THE FIELD THIS TIER EXISTS FOR. Exact positions, stated so precisely that two different photographers would put every item in the same place to the inch. Which side of the surface each thing is on, how far from which edge, what faces which way, what is on top of what, what is nearest the near edge. Use the environment's geometry as your frame of reference — "on the door side of the table", not "on the right", because right depends on where the camera is and the camera moves.
• seating — where PEOPLE go in this arrangement, by name, as fixed facts: who sits in which chair, who stands on which side, who is nearest the opening. This is the vehicle-seat failure arriving at a table, and it is prevented the same way: name the person and name their place. Empty only if nobody is ever placed here.
• objectKeys — the objects, from part 3, that live in this arrangement.

═══ 3. OBJECTS — the things ═══

Find every physical thing whose exact appearance has to be the same every time it is on screen${branded ? " — including the product and its packaging" : ""}. Documents and letters. Phone screens, chat threads, app interfaces, dashboards. Vehicles seen from outside. Signage. A distinctive garment or bag that travels through the film.

For each: an anchor of 60–120 words (shape, size, colour, material, condition, markings) and a detail field naming what must be LEGIBLE and identical every time — the exact letterhead, the exact three messages in the thread and who sent them, the exact plate number. If nothing on it is readable, leave detail empty.

Mark plateWorthy true when the object will be photographed as its own reference still. Say yes when it appears in two or more scenes, OR when it carries readable detail that must not change, OR when it is a vehicle. Say no to background scenery, to anything glimpsed once, and to anything whose exact look genuinely does not matter. Put the reason in reasoning either way.

═══ 4. STATES — the world moves ═══

A film is not a set of photographs of a still world. Things get eaten, spilled, broken, opened, cleared, torn, dirtied, switched on. The sun moves. The message thread gets another message. If the world is photographed once and used everywhere, scene 9 shows the untouched meal that scene 2 ate.

So every environment, every setting and every object carries a states array.

• Every thing has exactly ONE state with isBase true: how it starts, before the film touches it. Its change is empty, because it is not different from anything.
• Add a further state ONLY where the film VISIBLY changes that thing, and where a later scene shoots it after the change. Give each state the scenes it is true for.
• change describes ONLY WHAT IS DIFFERENT from the state before it — physically, specifically, and in as few things as possible. "The two plates on the near side are empty and pushed toward the middle; the left-hand chair is pulled back at an angle; the jug is half down." NOT a re-description of the whole table. The photograph of this state is generated FROM the photograph of the state before it, and everything you do not mention stays pixel-identical, which is exactly what you want.
• A thing that never visibly changes has ONE state and that is the correct answer. Do not invent change to fill the array.
• At most ${MAX_STATES_PER_THING} states for any one thing. Every scene a thing appears in must be covered by exactly one of its states.

If the change is large enough that nothing of the original survives — the room burns down, the car is wrecked — that is a NEW ENVIRONMENT, not a state. States are for a world that is recognisably the same world.

═══ 5. THE MAP ═══

Then map every scene to its environmentKey, the settingKeys it actually shoots, and the objectKeys actually in it. Every scene number appears exactly once. A scene with no dressed arrangement gets an empty settingKeys list — do not pad it.

Write the locks the way a person who has stood in the place would write them. Specific beats evocative every time: "a wall calendar from a hardware shop, two months out of date, curling at the bottom right" is worth a paragraph of "warmly lit and lived-in".

${CREATIVE_MANDATE}`;
}

/** What the world pass reads: the film, compactly. */
function worldBrief({ scenes, registry, characterNames, brandName, product }) {
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
    ? `\n\nTHE FILM'S EXISTING CONSISTENCY REGISTRY. These locks are already pasted verbatim inside the scene prompts, so the video model has been told them. Reuse them — keep the same wording where it already covers a place or an object, and only extend where it is silent:
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

${sceneLines}${registrySection}

Read the whole film before you write anything. The states are the part that needs the whole film: you cannot know the table gets cleared until you have read the scene where it does.`;
}

// ── The per-scene shot designer ─────────────────────────────────────────────

function shotDesignDirective({ environment, settings = [], maxShots = MAX_SHOTS_PER_SCENE }) {
  const settingList = settings.length
    ? settings.map((s) => `• ${s.key} — ${s.name}`).join("\n")
    : "";

  return `You are the SHOT DESIGNER. One scene of a film has been fully written as a video-generation prompt. You are deciding how that ten seconds is SHOT — how many camera setups it takes, what each one sees, where each one starts, and where it ends up.

Every setup you name gets PHOTOGRAPHED before the clip is rendered: an image model builds a still of it, the director looks at it, and the approved stills are handed to the video model as the clip's own frames. So a setup you describe vaguely becomes a still that is wrong, and a still that is wrong becomes a clip that is wrong. Be exact.

${shootableMandate()}

YOU ARE THE LAST PERSON WHO CAN HONOUR THAT RULE, because you decide where the camera stands. The scene may be written with a beating in it; your job is to choose the angle that tells the audience it happened without photographing it — the face of the man watching, the empty doorway it is happening beyond, the stool going over, the hand on the counter. A setup that frames the act itself produces a still the video model refuses, and one refused still takes the whole clip with it.

═══ HOW MANY SETUPS ═══
Read the scene's own timestamped beats and follow them — the cuts are already planned in the prompt and you are not re-editing the film.
• If the scene is one continuous locked shot — where the physical continuity IS the content — that is ONE setup covering the full ten seconds. That is a legitimate answer and often the strongest one.
• If the scene cuts, one setup per cut. Two or three is the house pattern.
• Never more than ${maxShots}. Ten seconds split more ways than that gives each angle under two seconds, which is a trailer, not a scene.
Your setups must tile the ten seconds end to end: no gaps, no overlaps, first one starts at 0.0s, last one ends at 10.0s.

═══ WHERE THE CAMERA CAN BE ═══
A REAL CAMERA IS IN THIS PLACE, operated by a real person. Every setup you write has to be one that could physically be shot: the camera stands, sits, kneels or is mounted somewhere a camera could actually go, at a height a body could hold it, with room behind it for the lens. It does not float inside a wall, hover at ceiling height in a car, or look through solid matter. If the place is cramped, the coverage is cramped — a tight, awkward, honest angle beats an impossible wide every single time, and it is also the one the next setup can match.

Think in real coverage, the way a crew with one camera and limited time actually works: a wide that establishes, a closer angle that carries the performance, an insert on the thing that matters. Do not design coverage that would need a crane, a second unit or a wall removed unless the scene genuinely warrants it.

═══ WHAT EACH SETUP OWES ═══

camera — the lens, the height, the distance, the angle, and what is inside the frame. State it the way a DP states it, e.g. "a 35mm wide from just above knee height, low and close to the passenger footwell, taking in the gear lever, both front seats and the windscreen beyond" — that is the LEVEL OF DETAIL, not the shot. Never "a dynamic angle".

blocking — who and what is where in THIS frame, stated left to right and near to far, using the place's fixed geometry and the arrangement's fixed layout and seating. This is where the film stops swapping people around: name the person, name their side of frame, name what they are touching. If they are seated anywhere the world bible has placed them, they are in THAT seat.

firstFrame — the single frozen instant this still shows. One moment, present tense, everything in it visible: posture, hands, where the eyes are looking, expression, what is mid-air. A camera cannot move in a still, so do not write a move; a still has no "then", so do not write two moments. This text becomes the image prompt, and it is the most important field you write.

motion — what happens across this setup's seconds once the clip is running, in physical verbs. The video model reads this to know where the frame is going.

cameraMove — "locked" if the camera does not travel, which is the right answer most of the time. Otherwise the move it makes.

endFrame — WHERE THIS SETUP ARRIVES. Fill this in ONLY when the camera move or the action carries the frame somewhere genuinely different from where it started: a pan that ends on something the first frame could not see, a push that ends in a close-up, a person who crosses the whole frame and sits down. Then write it exactly like firstFrame: one frozen instant, present tense, no move, no "then" — the LAST frame of this setup. It gets photographed too, from the first frame, so the move is specified by both of its ends and cannot wander. Leave it EMPTY for a locked shot, or where the frame ends more or less where it began. An empty endFrame is a normal answer; do not fill it to look thorough.

entry — "straight-into-action" when the cut lands with the movement already underway, "held-then-moves" when the frame sits still for a beat first. Most cuts inside a ten-second scene should be straight-into-action; a held frame is a choice you make deliberately, usually to open a scene or to let something land.

settingKey — which dressed arrangement this setup is looking at, from the list below. Use "" only for a setup that is a wide of the whole place, or one that looks at no dressed arrangement at all. Naming the right setting is what gets this frame photographed on top of the correct arrangement, so it is the difference between the plate being where it should be and the model guessing.

reverseAngle — true if this setup is shooting BACK toward the part of the place a wide establishing angle would be standing in, and false if it is shooting the same way that wide does. A place is only ever photographed from one or two directions, so this is how the right one gets attached to your frame. Get it wrong and the surface behind the camera is invented from nothing.

characters — the exact names, as spelled in the scene prompt, of the people visible in this setup. Nobody else.
objectKeys — the keys, from the list you are given, of the objects visible in this setup. Only what is genuinely in this frame.

═══ THE PLACE IS ALREADY DECIDED ═══
${
    environment
      ? `This scene is shot at "${environment.name}". Its locked description and its fixed geometry are below, and they are not yours to change — the place has already been photographed and every one of your setups is a camera position INSIDE that photograph. Do not move anything the place is made of, add a way in or out that is not there, rearrange what stands in it, or relight it. Place your camera and place your people, and let the place be the place — whatever kind of place it turns out to be.${
          environment.vehicle
            ? `\n\nTHIS IS A VEHICLE INTERIOR, which is where this pipeline fails most often. Obey the seating in the geometry exactly, in every single setup: the same person stays in the driver's seat, the steering wheel stays on the side it is on, and the doors, windows and mirrors stay where they are. If you place a camera outside the vehicle looking in, say which side of the vehicle you are on and which windows you are seeing through.`
            : ""
        }`
      : "No locked place was supplied for this scene, so take the setting exactly as the scene prompt describes it and do not invent beyond it."
  }

${
    settingList
      ? `═══ THE ARRANGEMENTS ALREADY DRESSED IN THIS SCENE ═══
${settingList}

These have been photographed too, with everything in a fixed position. Their layout is below and it is not yours to rearrange: if the layout says an object sits on the far side of the surface, it is on the far side in every one of your setups, no matter where you put the camera.`
      : ""
  }

NEVER, in any field: on-screen text, captions, subtitles, titles, watermarks, logos overlaid on the frame, split screens, collages, insets, picture-in-picture, film-strip borders, letterboxing, or any visible camera, crew, rig or lighting equipment. These are stills FROM a film, not posters about one.

${CREATIVE_MANDATE}`;
}

function shotDesignBrief({ scene, environment, settings = [], objects = [], characters = [], aspectRatio }) {
  return `SCENE ${scene.sceneNumber} — the full video prompt this ten seconds will be rendered from. Your setups implement THIS, exactly as written, and the timestamped beats inside it are the cuts you are covering:

${scene.fullPrompt}

${
    environment
      ? `THE LOCKED PLACE — "${environment.name}"
${environment.lock}

FIXED GEOMETRY (obey in every setup): ${environment.geometry}
LIGHT: ${environment.light}${environment.vehicle ? "\nThis is a VEHICLE INTERIOR." : ""}${
          environment.stateChange
            ? `\nBY THIS SCENE, THIS HAS CHANGED: ${environment.stateChange}`
            : ""
        }`
      : "No locked place for this scene."
  }

${
    settings.length
      ? `THE DRESSED ARRANGEMENTS IN THIS SCENE (use these keys in settingKey):
${settings
          .map(
            (s) => `• ${s.key} — ${s.name}
  ${oneLine(s.lock, 400)}
  EXACT LAYOUT: ${oneLine(s.layout, 500)}${s.seating ? `\n  WHO GOES WHERE: ${oneLine(s.seating, 300)}` : ""}${
              s.stateChange ? `\n  BY THIS SCENE, THIS HAS CHANGED: ${oneLine(s.stateChange, 300)}` : ""
            }`
          )
          .join("\n")}`
      : "No dressed arrangements in this scene — every setup gets an empty settingKey."
  }

${
    characters?.length
      ? `THE PEOPLE WHO CAN APPEAR IN THIS SCENE (use these names exactly):
${characters.map((c) => `• ${c.name}${c.role ? ` — ${c.role}` : ""}${c.wardrobe ? `\n  Wearing: ${oneLine(c.wardrobe, 400)}` : ""}`).join("\n")}`
      : "This scene has no named recurring cast. Refer to people the way the scene prompt does."
  }

${
    objects?.length
      ? `OBJECTS AVAILABLE IN THIS SCENE (use these keys in objectKeys):
${objects
          .map(
            (o) =>
              `• ${o.key} — ${o.name}: ${oneLine(o.anchor, 220)}${
                o.stateChange ? ` [BY THIS SCENE: ${oneLine(o.stateChange, 160)}]` : ""
              }`
          )
          .join("\n")}`
      : "No locked objects in this scene."
  }

The film is framed ${aspectRatio || "16:9"}. Design for that shape.`;
}

// ── Image prompts: TIER 1, the environment ──────────────────────────────────

/**
 * What "empty" means. One clause, and deliberately not a list.
 *
 * An earlier version of this branched on a place-type enum — interior, exterior,
 * underwater, space — and wrote a different sentence for each. That was a
 * mistake twice over. It made every plate prompt quietly assume the place was one
 * of a handful of known kinds, and worse, the enum leaked upstream: a film asked
 * to classify its own locations starts inventing locations that classify neatly,
 * which is how every story ends up happening in a room.
 *
 * So there is no taxonomy anywhere in this module now. A place is a place, it is
 * whatever the film says it is, and the only thing this clause insists on is that
 * nobody is in it — which is true of a kitchen, a shoreline and a hull breach
 * alike.
 */
const EMPTINESS_CLAUSE = `COMPLETELY EMPTY OF PEOPLE. Nobody in frame, nobody in the background, nobody in the far distance, nobody passing, nobody half out of frame, nobody reflected in anything that reflects. Not a hand, not a limb, not a silhouette, not a shadow cast by a person. Anything in this place that a person would normally be in, on or operating is unoccupied and unattended. This is the place at a moment when nobody is in it.`;

/**
 * A MASTER ENVIRONMENT PLATE: the place, empty, in its base state.
 *
 * Empty is the entire point and it is worth being stubborn about. A plate with a
 * person in it drags that person into every frame generated from it — which is
 * exactly the contamination §14.4 describes, arriving through a different door.
 * An empty place can be attached to every setting, every state and every frame
 * shot there, and all it can leak is the place, which is what we want.
 */
function environmentPlatePrompt(environment, { aspectRatio, styleHeader } = {}) {
  return `A photorealistic establishing photograph of ONE PLACE, shot as a film-production location reference. Nobody is in it.

This place is whatever the description below says it is, and nothing about this instruction assumes it is a room, a building, an interior, or anywhere on the ground. Build exactly what is written, on its own terms.

THE PLACE — build it exactly to this description:
${environment.lock}

WHERE THINGS ARE — this is fixed and must be exactly as stated:
${environment.geometry}

THE LIGHT:
${environment.light}

HOW TO SHOOT IT:
- A wide establishing angle that takes in as much of the place as one frame honestly can, from roughly standing eye height, on a normal lens with no distortion.
- ${EMPTINESS_CLAUSE}
- Everything that lives in this place is present and in its stated position${environment.vehicle ? ", including every seat, the steering wheel on its stated side, the mirrors, the dashboard, the doors and the windows" : ""}.
- Sharp throughout, deep focus, no shallow depth of field, no grade, no filter, no vignette, no lens flare.
${aspectRatio ? `- Framed ${aspectRatio}.` : ""}
${REAL_CAMERA_CLAUSE}
${STILL_PROHIBITIONS}
${styleHeader ? `\nThe film this place belongs to looks like this — match its register, not its subject:\n${oneLine(styleHeader, 700)}` : ""}

This is a location scout's photograph, kept on file so the same place can be filmed again next week. Make it accurate and plain, not beautiful.`;
}

/**
 * THE SECOND ANGLE: the same place, looking the other way.
 *
 * One photograph only sees one direction, and a film that shoots the reverse is
 * asking the model to invent the wall behind the camera — which it does, freshly,
 * every time. This plate is generated FROM the master so the two agree about the
 * place they are both inside, and it only exists for films that need it.
 */
function environmentCoveragePrompt(environment, { aspectRatio, styleHeader } = {}) {
  return `A photorealistic photograph of ONE PLACE, from a SECOND ANGLE. Nobody is in it.

THE ATTACHED PHOTOGRAPH IS THIS EXACT PLACE, already photographed from another angle. It is the truth about this place: the same surfaces, the same materials, the same colours, the same fixtures, the same clutter, the same wear, the same light, the same time of day. Nothing about the place changes here.

WHAT CHANGES IS ONLY WHERE THE CAMERA IS STANDING. Move it, and shoot:
${environment.secondAngle}

Anything visible in the attached photograph that is still in your frame must be identical to it — same object, same position, same condition. Anything the attached photograph could not see, you are building for the first time, and it must be consistent with the written description and the geometry below: the same architecture, the same materials, the same period, the same level of wear, the same light falling the same way.

THE PLACE, IN FULL:
${environment.lock}

WHERE THINGS ARE — fixed, and it applies from every angle including this one:
${environment.geometry}

THE LIGHT:
${environment.light}

HOW TO SHOOT IT:
- ${EMPTINESS_CLAUSE}
- From roughly standing eye height on a normal lens, unless the angle above says otherwise.
- Sharp throughout, deep focus, no grade, no filter, no vignette, no lens flare.
${aspectRatio ? `- Framed ${aspectRatio}.` : ""}
${REAL_CAMERA_CLAUSE}
${STILL_PROHIBITIONS}
${styleHeader ? `\nThe film's look, for register only:\n${oneLine(styleHeader, 500)}` : ""}

This is the second location-scout photograph of the same place, taken two minutes after the first without moving anything.`;
}

// ── Image prompts: TIER 2, the settings ─────────────────────────────────────

/**
 * A SETTING PLATE: a dressed arrangement, photographed inside its own place.
 *
 * The tier the hierarchy was built for. It is generated WITH THE ENVIRONMENT
 * PLATE ATTACHED, which is what makes it physically part of that place rather
 * than a second interpretation of the same paragraph — and it deliberately keeps
 * the surrounding place visible around the arrangement, so that a frame built on
 * this one plate gets both the table AND the room it is in.
 *
 * Still empty of people, for the same reason everything above it is.
 */
function settingPlatePrompt(setting, { environment, objects = [], inputs = [], aspectRatio, styleHeader } = {}) {
  const attachments = describeAttachments(inputs);

  return `A photorealistic photograph of ONE DRESSED ARRANGEMENT inside a place, shot as a film-production continuity reference. Nobody is in it.

${
    attachments
      ? `=== THE ATTACHED REFERENCES ===
${attachments}

`
      : ""
  }THE ARRANGEMENT — build it exactly to this description:
${setting.lock}

WHERE EVERY SINGLE THING SITS — this is the whole point of this photograph, and it is not negotiable. Place each item exactly here:
${setting.layout}

Every position above is a fact about this arrangement, not a suggestion about composition. This photograph is the reference every angle of this scene is built from, so an object you put on the wrong side of the surface is on the wrong side in the finished film, in every shot, and the audience sees it move between cuts.

${
    environment
      ? `THE PLACE THIS SITS INSIDE:
${environment.lock}

ITS FIXED GEOMETRY: ${environment.geometry}
ITS LIGHT: ${environment.light}

`
      : ""
  }HOW TO SHOOT IT:
- An angle that reads the WHOLE arrangement clearly — every item in it visible, nothing hidden behind anything else, nothing cropped off — from a height that shows how things are laid out relative to each other. Slightly above and to one side usually reads best; straight down reads the layout most clearly of all when the arrangement is flat.
- KEEP THE PLACE AROUND IT IN FRAME. This is not an object photograph on a plain background: the arrangement is sitting where it really sits, and the place is visible around and behind it, so anyone looking at this picture can see exactly where in that place this is.
- ${EMPTINESS_CLAUSE}
- Lit by the place's own light, exactly as described above. Not studio-lit, not relit, not brightened.
- Sharp throughout, deep focus so every item in the arrangement is legible, no grade, no filter, no vignette.
${aspectRatio ? `- Framed ${aspectRatio}.` : ""}
${REAL_CAMERA_CLAUSE}
${STILL_PROHIBITIONS}
${
    objects.length
      ? `\nTHE OBJECTS IN THIS ARRANGEMENT — each one must match its own description exactly:
${objects.map((o) => `• ${o.name}: ${oneLine(o.anchor, 260)}${o.detail ? ` — and this must be readable and exactly right: ${oneLine(o.detail, 200)}` : ""}`).join("\n")}`
      : ""
  }
${styleHeader ? `\nThe film's look, for register only:\n${oneLine(styleHeader, 500)}` : ""}

This is a continuity still from the props and set-dressing department, taken so the same arrangement can be rebuilt identically tomorrow. Make it accurate and complete, not beautiful.`;
}

// ── Image prompts: TIER 2, the objects ──────────────────────────────────────

/**
 * An OBJECT PLATE: one object, on nothing.
 *
 * Same discipline as the character sheet — a neutral plate with nothing to leak.
 * The `detail` field is separated out and hammered because it is the reason this
 * exists: a letter whose letterhead changes between two cuts is a continuity
 * error a viewer WILL see, and it is the sort of thing a paragraph never holds.
 */
function objectPlatePrompt(object, { aspectRatio, hasReference = false } = {}) {
  const vehicle = object.kind === "vehicle";
  const screen = object.kind === "screen";
  const document = object.kind === "document";

  return `A photorealistic reference photograph of ONE single object, for film production continuity. Nothing else is in the picture.

${
    hasReference
      ? `THE ATTACHED PHOTOGRAPH IS THE REAL OBJECT, supplied by the client. Reproduce it EXACTLY: the same shape, the same proportions, the same colours, the same materials, the same label, the same type and the same logo, letter for letter. This is a real thing that exists and the film has to show that thing and not something like it.
Take ONLY the object from it — not its background, not its lighting, not its angle, not anything else in that photograph. Where the attached photograph and the written description below disagree about the object itself, THE PHOTOGRAPH WINS: it is the object, the words are only a description of it.

`
      : ""
  }THE OBJECT — build it exactly to this description:
${object.anchor}

${
    object.detail
      ? `WHAT MUST BE READABLE, AND MUST BE EXACTLY THIS EVERY TIME:
${object.detail}
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

// ── Image prompts: TIER 3, the states ───────────────────────────────────────

/**
 * A STATE PLATE: the same thing, later.
 *
 * Generated from the PREVIOUS state's photograph, never from the words. That is
 * the entire mechanism: an instruction to change one thing about a picture is a
 * far tighter contract than an instruction to build a second picture that happens
 * to match the first everywhere except one place. Everything not mentioned in
 * `change` is required to survive untouched, and the model can actually do that
 * when it is looking at the thing it must not touch.
 *
 * `tier` routes the wording only — a place, an arrangement and an object want the
 * same instruction phrased in their own nouns.
 */
function statePlatePrompt(thing, state, { tier, environment, aspectRatio, styleHeader } = {}) {
  const noun =
    tier === "environment" ? "place" : tier === "setting" ? "dressed arrangement" : "object";

  const shootingNote =
    tier === "object"
      ? `- Shot from the SAME angle, the SAME distance and under the SAME flat, even light as the attached photograph, on the same plain neutral surface. Nothing about the photograph changes except the object's condition.`
      : `- Shot from EXACTLY the same camera position, the same height, the same lens and the same distance as the attached photograph. This is the same tripod, not moved. If the two pictures were laid on top of each other, every fixed thing in them would line up.
- ${EMPTINESS_CLAUSE}`;

  return `A photorealistic photograph of the SAME ${noun} shown in the attached image, photographed LATER IN THE SAME FILM, after something has changed.

=== THE ATTACHED IMAGE IS THE TRUTH ===
It is this exact ${noun}, and it is your starting point. Reproduce it. Every surface, every material, every colour, every fixture, every mark, every piece of wear, every item and its exact position, the light and its exact direction — all of it is identical here, because it is the same ${noun} on the same day and nobody has touched it except in the one way described below.

=== THE ONE THING THAT IS DIFFERENT ===
${state.change}

CHANGE ONLY THAT. Nothing else in the picture moves, changes colour, changes condition, appears or disappears. Do not tidy anything. Do not improve the composition. Do not relight it. Do not re-dress it. Do not "refresh" any part of it. If you find yourself adjusting something the line above did not name, you are producing a continuity error, and it will show up on screen as an object jumping between two cuts of the same scene.

The change itself must be fully and physically visible in this photograph — this picture is the evidence that it happened.

${
    tier === "environment"
      ? `THE PLACE, FOR REFERENCE (unchanged except as stated above):
${thing.lock}

ITS FIXED GEOMETRY, WHICH STILL HOLDS: ${thing.geometry}
ITS LIGHT: ${thing.light}`
      : tier === "setting"
        ? `THE ARRANGEMENT, FOR REFERENCE (unchanged except as stated above):
${thing.lock}

ITS EXACT LAYOUT, WHICH STILL HOLDS EXCEPT WHERE THE CHANGE MOVES SOMETHING: ${thing.layout}${
            environment ? `\n\nTHE PLACE IT SITS IN: ${oneLine(environment.lock, 700)}\nITS LIGHT: ${environment.light}` : ""
          }`
        : `THE OBJECT, FOR REFERENCE (unchanged except as stated above):
${thing.anchor}${thing.detail ? `\n\nSTILL READABLE AND STILL EXACTLY THIS, unless the change above says otherwise: ${thing.detail}` : ""}`
  }

HOW TO SHOOT IT:
${shootingNote}
- Sharp throughout, deep focus, no grade, no filter, no vignette.
${aspectRatio ? `- Framed ${aspectRatio}.` : ""}
${tier === "object" ? "" : `${REAL_CAMERA_CLAUSE}\n`}${STILL_PROHIBITIONS}
${styleHeader && tier !== "object" ? `\nThe film's look, for register only:\n${oneLine(styleHeader, 400)}` : ""}

This is the continuity department's second photograph of the same thing, taken after the scene that changed it, so the two can be compared. Make the change obvious and make everything else identical.`;
}

// ── Image prompts: TIER 4, the frames ───────────────────────────────────────

/**
 * How each attached reference is introduced.
 *
 * These clauses are load-bearing in the same way §14's quarantine clause is. The
 * attached images each say something different about what to take and what to
 * ignore, and without naming them individually the model averages them: it takes
 * the plate's emptiness as well as its walls, and puts the character sheet's flat
 * studio light into the place.
 */
function describeAttachments(inputs) {
  return (inputs || [])
    .map((input, i) => {
      const n = i + 1;
      switch (input.role) {
        case "environment":
          return `Attached image ${n} is THE PLACE — a photograph of this exact location, empty. Take the place from it and take it exactly: the same surfaces, the same materials, the same fixtures in the same positions, the same clutter, the same colours, the same light and the same time of day. Your camera is standing somewhere inside THAT place. Do NOT take its emptiness — the people described below are in this frame — and do NOT take its camera position, which is a different angle from the one you are shooting.`;
        case "setting":
          return `Attached image ${n} is THE ARRANGEMENT — a photograph of this exact dressed area, in this exact place, with every item already in its correct position, shot empty of people. This is the most important reference you have. Every object visible in it stays EXACTLY where it is: same surface, same side, same distance from the edge, same orientation, same thing stacked on the same thing. Take the surrounding place from it too. Do NOT take its emptiness, and do NOT take its camera position — you are shooting this arrangement from the angle described below, and the objects must be in the same real-world positions seen from that new angle.`;
        case "character":
          return `Attached image ${n} is ${String(input.name || "").toUpperCase()}. Match this person's face, skin tone, hair and outfit exactly — they appear across several clips of this film and must be recognisably identical in every one. Take ONLY the person: the reference is a studio continuity still on a plain grey backdrop under flat light in a neutral standing pose, and none of that belongs here. Not the backdrop, not the lighting, not the pose, not the framing. This frame has its own place, its own light and its own action.`;
        case "first-frame":
          return `Attached image ${n} is THE FIRST FRAME OF THIS VERY SHOT — the same camera, the same place, the same people, a few seconds earlier. Everything in it that has not been explicitly moved by the description below is IDENTICAL here: the same faces, the same clothes in the same state, the same objects in the same places, the same light, the same lens, the same grain. This is the same continuous piece of film, so nothing may be re-cast, re-dressed or re-lit between the two.`;
        default:
          return `Attached image ${n} is ${String(input.name || "the object").toUpperCase()}, an object reference. The object in this frame must match it exactly — same shape, same colour, same markings, same wear${input.detail ? ", and the same readable detail on it, word for word" : ""}. Take ONLY the object: not its plain background, not its flat lighting, not its angle. In this frame it is where the blocking says it is, lit by this place's light.`;
      }
    })
    .join("\n\n");
}

/** The shared body of a frame prompt — the first and last frames differ only at the top. */
function frameBody(shot, { environment, setting, characters = [], aspectRatio, styleHeader, moment }) {
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

  return `=== THE MOMENT THIS FRAME SHOWS ===
${moment}

=== THE CAMERA ===
${shot.camera}

=== WHERE EVERYONE AND EVERYTHING IS ===
${shot.blocking}
${environment?.geometry ? `\nThe place's fixed geometry, which this frame must obey: ${environment.geometry}` : ""}${
    setting?.layout ? `\nThe arrangement's exact layout, which this frame must obey: ${setting.layout}` : ""
  }${setting?.seating ? `\nWho goes where, which this frame must obey: ${setting.seating}` : ""}

${
    environment
      ? `=== THE PLACE ===
${environment.lock}

THE LIGHT: ${environment.light}${
          environment.vehicle
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
${aspectRatio ? `- Framed ${aspectRatio}. Compose for that shape.\n` : ""}${REAL_CAMERA_CLAUSE}
${STILL_PROHIBITIONS}
${styleHeader ? `\n=== THE FILM'S LOOK ===\n${oneLine(styleHeader, 700)}` : ""}`;
}

/**
 * A FRAME: one camera setup of one scene, built on top of the tiers above it.
 */
function framePrompt(shot, { environment, setting, characters = [], inputs = [], aspectRatio, styleHeader } = {}) {
  const attachments = describeAttachments(inputs);

  return `A photorealistic single frame from a live-action film — one frozen instant, shot on a real camera.

${
    attachments
      ? `=== THE ATTACHED REFERENCES ===
${attachments}

Where an attached reference and the words below disagree, the WORDS WIN. The pictures confirm; the writing specifies.

`
      : ""
  }${frameBody(shot, { environment, setting, characters, aspectRatio, styleHeader, moment: shot.firstFrame })}

This frame will be handed to a video model as the actual opening frame of a ten-second shot, so it has to be a photograph of a real moment in a real place — not a poster, not a composite, not a pretty picture of the idea.`;
}

/**
 * AN END FRAME: where a moving setup arrives.
 *
 * Generated from its own first frame, which is the same trick the state plates
 * use one tier up. A pan specified by one end and a sentence is a pan the model
 * improvises; a pan specified by both ends is a pan it interpolates. It is also
 * the only honest way to promise that the thing revealed at the end of the move
 * is the thing the director meant to reveal.
 */
function endFramePrompt(shot, { environment, setting, characters = [], inputs = [], aspectRatio, styleHeader } = {}) {
  const attachments = describeAttachments(inputs);
  const move =
    shot.cameraMove && shot.cameraMove !== "locked"
      ? `The camera has made this move since that frame: a ${String(shot.cameraMove).replace(/-/g, " ")}. `
      : "";

  return `A photorealistic single frame from a live-action film — the LAST frame of a shot whose FIRST frame is attached.

${
    attachments
      ? `=== THE ATTACHED REFERENCES ===
${attachments}

`
      : ""
  }=== WHAT HAS HAPPENED IN BETWEEN ===
This is the same uninterrupted shot, a few seconds later. ${move}What has moved since the first frame: ${shot.motion}

Nothing else has changed. Same place, same light, same time of day, same people with the same faces and the same clothes in the same condition, same objects with the same markings. The only differences between the attached frame and this one are the camera's new position and the movement described above. Anything you change beyond those is a continuity error inside a single shot, which is the most visible kind there is.

${frameBody(shot, { environment, setting, characters, aspectRatio, styleHeader, moment: shot.endFrame })}

This frame will be handed to a video model as the actual CLOSING frame of this shot, and the model will interpolate the seconds between the two. So it must be reachable from the attached frame by exactly the movement described — not a different angle of the same scene, and not a new setup.`;
}

// ── Which references ride along ─────────────────────────────────────────────

/**
 * The plan for one FRAME generation, in priority order.
 *
 * The anchor plate goes FIRST and is never dropped. It is the thing that makes
 * this whole feature work — a frame with the right faces in the wrong place is
 * the bug we are here to fix, and the place only comes from the plate.
 *
 * The setting plate is preferred over the environment plate when the shot names
 * one, and the two are never both attached. That is deliberate: the setting plate
 * was itself generated from the environment plate and keeps the surrounding place
 * in frame, so it already carries everything the environment plate would say, and
 * sending both invites the model to average two camera positions into one.
 */
function frameInputPlan(shot, { settingPlate, environmentPlate, characterRefs = [], objectPlates = [] }) {
  const inputs = [];

  // Bytes are the qualifier, not intent. The prompt numbers its attachments
  // ("Attached image 2 is BINTA"), so a reference that is planned but not
  // actually sent would shift every number after it and point the model at the
  // wrong picture. If it has no bytes it is not an input.
  const anchor = settingPlate?.base64 ? { role: "setting", plate: settingPlate } : null;
  if (anchor) {
    inputs.push({ role: "setting", name: settingPlate.name, ref: settingPlate });
  } else if (environmentPlate?.base64) {
    inputs.push({ role: "environment", name: environmentPlate.name, ref: environmentPlate });
  }

  const wanted = new Set((shot.characters || []).map(normalizeName));
  for (const ref of characterRefs) {
    if (!ref?.base64 || !wanted.has(normalizeName(ref.name))) continue;
    inputs.push({ role: "character", name: ref.name, ref });
  }

  const keys = new Set(shot.objectKeys || shot.propKeys || []);
  for (const plate of objectPlates) {
    if (!plate?.base64 || !keys.has(plate.key)) continue;
    inputs.push({ role: "object", name: plate.name, detail: plate.detail, ref: plate });
  }

  return inputs.slice(0, MAX_INPUTS_PER_FRAME);
}

/**
 * The plan for one END FRAME generation.
 *
 * The first frame leads and everything else is optional garnish — it already
 * contains the place, the arrangement, the people and the objects, correctly
 * reconciled, which is more than any of the plates can say individually. The
 * character sheets ride along only to hold a face that a single generated frame
 * may have drifted on, and they come after.
 */
function endFrameInputPlan(shot, { firstFrame, characterRefs = [] }) {
  const inputs = [];
  if (!firstFrame?.base64) return inputs;
  inputs.push({ role: "first-frame", name: shot.label || "the first frame", ref: firstFrame });

  const wanted = new Set((shot.characters || []).map(normalizeName));
  for (const ref of characterRefs) {
    if (!ref?.base64 || !wanted.has(normalizeName(ref.name))) continue;
    inputs.push({ role: "character", name: ref.name, ref });
  }
  return inputs.slice(0, 3);
}

/**
 * Which setups may buy an end frame, given the scene's still budget.
 *
 * The budget is the whole scene's, not the shot's, because the ceiling that
 * matters is how many images ride on ONE video render. Spent longest-shot-first:
 * a five-second move genuinely wanders without both ends, while a one-second one
 * has no time to.
 */
function allocateEndFrames(shots, { maxStills = MAX_STILLS_PER_SCENE } = {}) {
  const list = shots || [];
  const wants = list
    .map((shot, index) => ({ index, shot, seconds: spanSeconds(shot.time) }))
    .filter(({ shot }) => wantsEndFrame(shot))
    .sort((a, b) => b.seconds - a.seconds);

  const granted = new Set();
  let stills = list.length;
  for (const { index } of wants) {
    if (stills >= maxStills) break;
    granted.add(index);
    stills += 1;
  }
  return granted;
}

/** A setup asks for an end frame by writing one and by actually moving. */
function wantsEndFrame(shot) {
  const text = String(shot?.endFrame || "").trim();
  if (countWords(text) < 8) return false;
  const moves = shot?.cameraMove && shot.cameraMove !== "locked";
  return Boolean(moves || countWords(shot?.motion) >= 8);
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
 * Flattens a scene's designed setups into the ordered list of stills that
 * actually rides along with the render.
 *
 * One entry per attached image, which is what the clause numbers and what the
 * caller attaches — so these two must be generated from the same function or the
 * numbering drifts and the model is told image 3 is something it is not.
 */
function stillRoll(shots) {
  const roll = [];
  for (const shot of shots || []) {
    if (shot.url) roll.push({ ...shot, kind: "start" });
    if (shot.end?.url) roll.push({ ...shot, kind: "end", url: shot.end.url, path: shot.end.path, mimeType: shot.end.mimeType });
  }
  return roll;
}

/**
 * The block appended to a scene's prompt once its frames exist.
 *
 * Appended rather than woven in, deliberately. The scene prompt is a gated
 * artefact — it passed word count, verbatim locks, density and the sound policy —
 * and re-compiling it through a model to insert a paragraph risks all of that to
 * save nothing. Appending is deterministic, reversible, and lands the shot board
 * in the last thing the model reads, which is where a hard spec belongs.
 *
 * It also has to SUPERSEDE, explicitly: the prompt above it may still carry the
 * character-reference quarantine clause from ./characterRefs.js, written when the
 * attachments were grey-backdrop studio portraits. They are not any more.
 */
function shotBoardClause(shots, { sceneSeconds = 10 } = {}) {
  const roll = stillRoll(shots);
  if (roll.length === 0) return "";

  const setups = (shots || []).filter((s) => s.url);
  const singleSetup = setups.length === 1;

  let n = 0;
  let setupNumber = 0;
  const lines = [];
  for (const shot of setups) {
    const startNumber = ++n;
    setupNumber += 1;
    const hasEnd = Boolean(shot.end?.url);
    const endNumber = hasEnd ? ++n : null;
    const entry =
      shot.entry === "held-then-moves"
        ? "The frame holds for a beat before anything moves."
        : "The action is already underway on this frame — cut straight into it, no pause.";
    const move =
      shot.cameraMove && shot.cameraMove !== "locked"
        ? `Camera move: a ${String(shot.cameraMove).replace(/-/g, " ")}.`
        : "Camera move: none — this setup is locked off.";

    lines.push(
      `SETUP ${setupNumber} — ${shot.time}${shot.label ? ` — ${shot.label}` : ""}
ATTACHED IMAGE ${startNumber} is where this setup STARTS: its exact opening frame. Camera: ${oneLine(shot.camera, 400)}
Positions: ${oneLine(shot.blocking, 400)}
${entry} ${move}
What moves across these seconds: ${oneLine(shot.motion, 400)}${
        hasEnd
          ? `\nATTACHED IMAGE ${endNumber} is where this same setup ENDS — the last frame of these seconds, same shot, no cut in between. Travel smoothly from image ${startNumber} to image ${endNumber} across the setup's time, and land on image ${endNumber} exactly.`
          : ""
      }`
    );
  }

  const total = roll.length;
  const pairNote = roll.some((r) => r.kind === "end")
    ? "\n- Some setups have TWO images — a start and an end. Those two are the SAME continuous shot, not a cut: move from one to the other, do not cut between them, and do not treat the end frame as a new angle."
    : "";

  return `${SHOT_BOARD_OPEN}
${total} image${total === 1 ? " is" : "s are"} attached to this render, and ${total === 1 ? "it is not a reference — it is this clip's opening frame" : "they are not references — they are this clip's own frames, in order"}. ${
    singleSetup && total === 1
      ? "Begin the clip on it exactly: the same place, the same people in the same positions, the same lighting, the same lens and the same framing, and move on from there."
      : singleSetup
        ? `This is ONE continuous shot with no cut in it. Image 1 is exactly where it begins and image 2 is exactly where it ends: open on the first, travel to the second across the ${sceneSeconds} seconds, and land on it.`
        : `Shoot the ${sceneSeconds} seconds AS THE SETUPS BELOW, in this order, cutting at the times given. Each image is an exact frame of its setup: match its place, its people and their positions, its light, its lens and its framing precisely.`
  }

${lines.join("\n\n")}

RULES FOR USING THEM:
- These images are the same place and the same people photographed from ${singleSetup ? "one angle" : "different angles"}. ${singleSetup ? "" : "They are NOT different places and NOT different people — do not treat a change of angle as a change of scene, and do not blend them into one composite frame. "}Everything about the place — the surfaces, what is underfoot, the fixtures and where they stand, the objects and their exact positions, the colours, the light, the time of day — is IDENTICAL in all of them and must stay identical for the whole clip.
- Every person keeps the face, hair, skin tone and clothes they have in these frames, for the whole ${sceneSeconds} seconds, without exception.
- Every object keeps the exact appearance AND THE EXACT POSITION it has in these frames, including anything written or displayed on it. A document, a screen or a label must not change between one second and the next, and nothing slides across a surface unless the movement above says a person moves it.${pairNote}
${
    singleSetup
      ? "- Do NOT cut. This is one continuous shot."
      : `- Cut ONLY at the times given above — ${setups.map((s) => s.time).join(", ")} — and cut hard. No dissolves, no fades, no wipes, no transitions of any kind. Between those cuts the camera does only what the movement above describes.`
  }
- Do not invent an establishing shot, a reaction cut or an insert that is not in this board.

THIS SUPERSEDES ANY EARLIER INSTRUCTION IN THIS PROMPT ABOUT ATTACHED IMAGES. Nothing attached here is a studio portrait on a grey backdrop, so there is no backdrop, no studio lighting and no neutral pose to discard — these are photographs OF THIS SCENE, in the real place, and everything in them belongs in the clip. Where these frames and the writing above disagree about what something looks like, THE FRAMES WIN; where they disagree about what HAPPENS, the writing above wins.
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

// ── The framed prompt: what a photographed scene actually renders from ───────

/**
 * How long a framed prompt should be.
 *
 * The full prompt is 1,500–2,000 words because it was carrying the entire LOOK of
 * the film in prose. The frames carry the look now, and far better — so all of
 * that comes out. What is left is everything a picture genuinely cannot say, and
 * the mistake would be to assume that is a small amount.
 *
 * It is not. A still says nothing about what any of it SOUNDS like, and sound is
 * half a film: the ambience, its level under the voices, and a named noise for
 * every physical event in ten seconds. It says nothing about a voice — whose it
 * is, its age, its texture, its pace, its state. It says nothing about timing, or
 * about what happens between one frame and the next. And it says nothing about
 * intention, which is what makes a performance rather than a pose.
 *
 * So this is not a compression job with a small budget. It is a full brief with a
 * different subject, and it is given the room to be thorough: an under-specified
 * brief is exactly how a clip comes back half-silent, flatly performed, or racing
 * through its beats. Anything the writer would have to leave out to hit a tighter
 * number is something the render then has to guess.
 */
const FRAMED_PROMPT_MIN = 1200;
const FRAMED_PROMPT_MAX = 1800;

function framedPromptDirective({ sceneSeconds = 10 } = {}) {
  return `You are the FIRST ASSISTANT DIRECTOR. A ${sceneSeconds}-second scene has already been fully written as a long video-generation prompt, and it has now been PHOTOGRAPHED: every camera setup in it exists as a real still image, and those stills are attached to the render as the clip's own frames.

That changes what the prompt is for, completely.

The long prompt spent most of its length describing how things LOOK — the place, the walls, the light, every person's face and complexion and clothes, every object. All of that description existed for one reason: to stop the video model inventing a different-looking world. It no longer has to, because the world is attached as photographs, and a photograph is a target the model matches instead of a paragraph it approximates. Every word of look-description you keep is now actively harmful: it invites the model to re-interpret something it can already see, and the two never agree.

YOUR JOB: rewrite that prompt as a SHOOTING BRIEF of ${FRAMED_PROMPT_MIN}–${FRAMED_PROMPT_MAX} words covering everything the pictures cannot show.

THAT IS A LOT OF WORDS, AND THEY ARE THERE TO BE SPENT. This is not a summary and it is not a compression exercise. You are dropping one subject — how things look — and going deeper on every other subject than the original prompt ever did. The sound alone is worth several hundred words and almost never gets them. If your brief comes in short, you have not been disciplined; you have left the render guessing, and it will guess wrong about the exact things nobody thought to specify.

Be exhaustive and be concrete. Every beat, every sound, every voice, every piece of timing, every instruction the render needs in order to have no decisions left to improvise.

═══ KEEP, IN FULL ═══

1. THE DIALOGUE, WORD FOR WORD, AND IT IS THE BIGGEST THING YOU WRITE. Every spoken line exactly as written, with its language tag, in the order spoken. Never paraphrase a line, never shorten one, never translate one, and above all NEVER DROP ONE.

   This is the whole point of the film. These are watched on a phone, and what holds a viewer is people talking — the argument, the accusation, the thing that should not have been said. A ${sceneSeconds}-second scene here carries six to eight lines and has somebody speaking for about eight of its ten seconds. If the script you are compressing has seven lines and your brief has three, you have destroyed the scene, whatever else you got right.

   Losing dialogue is the single most damaging thing this rewrite can do, because the pictures cannot carry any of it. A dropped visual detail is invisible — the frame shows it anyway. A dropped LINE is simply gone, and the clip comes back with a silence where the story was. Count the lines in the source. Count them in your brief. The numbers match, or you go back.

   Mark the overlaps and interruptions explicitly: who cuts across whom, who is still talking when the next person starts, who repeats themselves because they were ignored. The back-and-forth is the performance, not the words in isolation.

2. WHAT HAPPENS, on the clock. Every timestamped beat, in order, across the whole ${sceneSeconds} seconds. Physical verbs, one change of state per beat. It must lose nothing — if the long prompt has six beats, you have six beats — but remember these run UNDERNEATH the talking rather than instead of it: hands do things while mouths move.

3. WHO IS SPEAKING, AND IN WHAT VOICE. Before each line, name the speaker and describe their voice in a few words — age, register, texture, pace, and the emotional state it is delivered in. The pictures show faces; they say nothing about what those faces sound like, and an unattributed line comes back in the wrong mouth. If two people speak, make it unmistakable which voice is which. Note where a line overlaps another, is interrupted, or trails off.

4. EVERY SOUND. This is now one of the most important parts of the prompt, because it is the half of the film no still can carry:
   • the continuous ambience under the whole clip — what the place itself sounds like, and how loud relative to the voices;
   • a specific sound for every physical event in the beats, named where it happens. Something that touches, opens, closes, lands, tears, spills, starts or stops MAKES A NOISE, and if you do not name it the clip comes back half-silent;
   • the film's locked sound spec, kept as it appears in the long prompt.

5b. THE CAMERA NEVER WATCHES THE VIOLENCE. The long prompt has already been written so the act happens off frame — keep it that way, and never restore it while "keeping every beat". No weapon in shot, no blow or grab or pin as it lands, nobody restrained, nobody cowering, no blood. But NAME THE SOUND OF IT EXACTLY — the impact, the scuffle, the body, the wood — because sound is unrestricted here and is where the violence belongs. Threats in dialogue are unrestricted too.

5. NO MUSIC. State it explicitly and state it plainly: this clip carries NO MUSIC of any kind — no score, no soundtrack, no instrument, no hum, no drone, no rhythmic bed. Never name an instrument, a tempo, a BPM or a musical mood. This law is absolute and it must survive the rewrite.

6. CAMERA MOVEMENT AND CUTS. Where the camera goes across each setup, and where the cuts fall. Keep it short — the frames already show where the camera IS; this is only where it TRAVELS.

7. Anything the pictures genuinely cannot show: weather changing, something arriving from off camera, a performance note about intention, the pace of an action.

8. THE CAST KEY, AND THE RULES THAT GO WITH IT. This is not a description and it is not an exception to the cut list below — it is a POINTER, and without it a thirty-clip film hands its lines to the wrong faces.

   For each person in this scene, one line: their NAME, WHERE THEY ARE in the attached frames ("the one seated at the left of the table", "the one standing in the doorway"), and — in a few words only — WHAT THEY ARE WEARING IN THIS SCENE, purely so the model can tell two people apart and cannot swap their clothes between setups. Not their face. Not their build. Not their complexion. Not their hair. The frames carry all of that far better than a sentence can, and re-describing it is what makes the picture and the words disagree.

   Then state these rules plainly, in the prompt, in your own words:
   • Every person visible in this clip is one of the people in the attached frames. Do NOT add anyone who is not in them.
   • Each named person keeps the exact face and the exact clothing they have in the attached frames, for the whole clip. Nobody swaps an outfit with anybody else and nobody changes clothes mid-clip.
   • Whoever is in a frame stays who they are across every setup in this scene: the person at the left of the table in setup 1 is the same person in setup 3.
   • Nobody in this clip is under 18.
   • Where the words and the attached frames appear to disagree about how anything or anyone looks, THE FRAMES ARE RIGHT.

═══ CUT, ENTIRELY ═══

Every word about how anything LOOKS. The place, its walls, its floor, its furniture, its light, its colours, its clutter. Every character's face, complexion, hair, build, age and clothes. Every object's shape, colour and markings. Background people and what they are wearing. The film's style, grade, lens and look. The character-reference clause. Locked character blocks. Locked set blocks. The closing restatement paragraph.

All of it is in the attached photographs, exactly and unambiguously. Delete it.

TWO NARROW EXCEPTIONS, and they are the only two:
  • Appearance that CHANGES during these ${sceneSeconds} seconds — someone gets soaked, a shirt tears, a screen lights up — because a still cannot show a change. Say what changes, in a clause, and nothing more.
  • The few words of clothing in the CAST KEY above, which exist to tell two people apart and to stop their outfits swapping. A garment and a colour. "Green wrapper, white headscarf" is the key; "a green wrapper of hand-dyed cotton falling to mid-calf" is the description you are deleting.

═══ HOW TO WRITE IT ═══

Plain headings, in this order: CAST KEY · DIALOGUE (with voices, every line) · WHAT HAPPENS (the timestamped beats) · SOUND · CAMERA. DIALOGUE comes second, right after the cast key, and it is normally the longest block on the page — models weight early tokens, and the talk is what this film is. The cast key goes FIRST and stays short — models weight early tokens, and who-is-who is the thing that must not be got wrong. No preamble, no restatement of the story, no summary at the end — but the blocks themselves are as long as they need to be, and SOUND is usually the longest of them. Write it as a working call sheet for a crew who are standing in the place and can already see it, and who need to be told everything they cannot see — because that is exactly the situation the video model is now in.

Keep the prohibitions that are about BEHAVIOUR, not looks: no on-screen text, captions, subtitles or titles; no split screen; no music. Drop the rest.`;
}

/**
 * @param {object}   args
 * @param {object}   args.scene    the long-form scene, whose fullPrompt is the source
 * @param {Array}    args.shots    this scene's photographed setups, in order
 * @param {Array}    args.cast     the registry characters IN THIS SCENE. Supplies the
 *                                 names and this scene's wardrobe so the writer can
 *                                 build the cast key from fact rather than from
 *                                 whatever it can infer out of 2,000 words of prose.
 *                                 A film whose scenes are cast fresh-faces passes [].
 */
function framedPromptBrief({ scene, shots = [], cast = [], sceneSeconds = 10 }) {
  const board = (shots || [])
    .filter((s) => s.url)
    .map((shot, i) => {
      const who = (shot.characters || []).filter(Boolean).join(", ");
      return `Setup ${i + 1} — ${shot.time}${shot.label ? ` — ${shot.label}` : ""}: ${oneLine(shot.camera, 200)}${
        shot.cameraMove && shot.cameraMove !== "locked" ? ` [${String(shot.cameraMove).replace(/-/g, " ")}]` : " [locked]"
      }${who ? ` — in frame: ${who}` : ""}`;
    })
    .join("\n");

  // Name + this scene's wardrobe only. The Locked Character Block is deliberately
  // NOT passed: handing the writer 200 words of face is how a "cast key" comes
  // back as a character description, which is the one thing this rewrite exists
  // to delete.
  const castKey = (cast || [])
    .filter((c) => c && c.name)
    .map((c) => `- ${c.name}${c.wardrobe ? ` — wardrobe this scene: ${oneLine(c.wardrobe, 220)}` : ""}`)
    .join("\n");

  return `THE SCENE AS IT WAS WRITTEN — ${sceneSeconds} seconds. This is your source. Everything you keep must come from here, word for word where the rules above say word for word:

${scene.fullPrompt}

${
    board
      ? `THIS SCENE HAS ALREADY BEEN PHOTOGRAPHED AS THESE SETUPS. The look of every one of them is settled and attached to the render, so none of it needs describing again:
${board}`
      : ""
  }

${
    castKey
      ? `THE PEOPLE IN THIS SCENE, and what they are wearing in it. Build your CAST KEY from these names — do not invent a name that is not here, and do not promote a background person to a named one:
${castKey}`
      : `THIS SCENE HAS NO NAMED CAST. Either nobody is on camera, or the people in it are one-off faces who appear in no other scene. Write no cast key; instead state plainly that every person visible is one of the people in the attached frames and that nobody else appears.`
  }

Write the shooting brief now, in full. ${FRAMED_PROMPT_MIN}–${FRAMED_PROMPT_MAX} words — and if the scene genuinely needs more to leave nothing to chance, take it. Under-specifying costs a render; over-specifying costs nothing.`;
}

// ── Self-healing: a prompt the image model would not answer ─────────────────

/**
 * The rewriter that runs when a picture comes back refused.
 *
 * A refusal is not the same failure as a rate limit and must not be treated like
 * one: asking the identical prompt again produces the identical refusal, and the
 * only thing a retry loop buys is the same money spent four times. So a blocked
 * prompt gets REWRITTEN before it is asked again.
 *
 * The hard part is that the obvious rewrite is the wrong one. A model asked to
 * "make this safe" will happily delete the specifics — the exact positions, the
 * legible detail, the fixed seating — because vagueness is the safest thing there
 * is. That would return a picture, and the picture would be useless: everything
 * this system does depends on those specifics surviving. So the instruction below
 * is mostly a list of what may NOT be given up, and the rewrite is aimed only at
 * the incidental phrasing that a classifier actually reacts to.
 *
 * It is also told, explicitly, not to soften the film. A story is allowed to be
 * about difficult things; what it is not allowed to do is describe them in the
 * register that trips an image filter.
 */
function unblockDirective({ kind = "blocked" } = {}) {
  return `You are the PROMPT DOCTOR. An image-generation prompt from a film production pipeline was sent to an image model and ${
    kind === "empty"
      ? "the model returned nothing at all — no picture and no explanation, which in practice is a silent refusal"
      : "the model refused it on content-policy grounds"
  }. Your job is to rewrite that prompt so it is answered, WITHOUT losing what it was for.

Read the failure this way: something in the WORDING tripped an automated classifier. It is almost never the film's subject and almost never the thing the prompt is actually specifying. It is usually one of a small number of incidental things:

• a phrase that reads as violent, sexual, medical, self-harming or criminal out of context, even though in context it is describing a prop, a stain, a wound in a story, or an ordinary object;
• wording about a person's body, age, state of dress or physical condition that reads as a description of a real individual rather than a character in a film;
• anything that sounds like it is asking for a real, named, identifiable living person, a real brand's asset, or a copy of an existing photograph;
• language that reads as an instruction to deceive — a forged document, a real institution's letterhead, an official seal — even where the film only needs a plausible prop;
• an accumulation of intense adjectives that individually mean nothing and together read as an attempt to push the model somewhere.

═══ WHAT YOU MUST NOT GIVE UP ═══

This is the important half of the job, and the failure mode you have to fight. The safest possible rewrite is a vague one, and a vague prompt produces a picture that is useless to this pipeline — every later picture is built on this one, so an approximate answer here is reproduced faithfully all the way down.

So keep, exactly, in full, and in the same words wherever you possibly can:
• every stated POSITION — what is on which side of what, how far from which edge, what faces which way, who is in which seat. These are continuity facts, not description.
• every stated piece of GEOMETRY, and every fixed fact about the place.
• every piece of text that must be LEGIBLE and identical, word for word and figure for figure.
• every identity: who is present, what they are wearing, what they look like.
• every instruction about how the picture is shot — the lens, the height, the distance, the framing, the light.
• every prohibition already in the prompt: no on-screen text, no split screen, no visible crew, no people in a plate that is meant to be empty.
• the photographic-realism instruction, and the requirement that the camera be somewhere a real camera could be.

═══ HOW TO REWRITE ═══

Change as little as possible. Find the smallest number of phrasings that could plausibly have caused the refusal and restate those in plain, neutral, physical, production-department language — the way a props list or a call sheet would say it. Describe what a camera would SEE, not what it means or how it feels.

Where the film needs something a classifier is likely to object to, keep the thing and change the framing: a document becomes a clearly fictional one with invented names, an injury becomes make-up on a performer, a weapon becomes a prop, an intense state becomes a described posture and expression. The film gets what it needs; the prompt stops asking for it in the register that failed.

Do NOT add anything new. Do not add on-screen text, do not add people, do not add a mood, do not add a style. Do not make the picture blander to be safe — make the words plainer and leave the picture identical.

Return the COMPLETE rewritten prompt, ready to send as-is, and one line saying what you changed.`;
}

/** What the doctor reads: the prompt that failed, and how it failed. */
function unblockBrief({ prompt, reason, attempt = 1 }) {
  return `THE PROMPT THAT WAS REFUSED${attempt > 1 ? ` (this is rewrite attempt ${attempt} — the previous rewrite was refused too, so look somewhere else in the prompt this time)` : ""}:

${prompt}

WHAT THE IMAGE MODEL SAID:
${reason || "No reason was given — the model simply returned no image."}

Rewrite it now. Keep every position, every piece of legible text, every identity and every shooting instruction exactly as they are.`;
}

// ── Gates ───────────────────────────────────────────────────────────────────

/**
 * What a designed shot list has to satisfy before anything is rendered.
 *
 * Cheap and worth it: a malformed shot list costs one text call to repair here
 * and a whole scene's worth of wrong stills if it gets through.
 */
function shotPlanViolations(plan, { maxShots = MAX_SHOTS_PER_SCENE, sceneSeconds = 10, settingKeys = null } = {}) {
  const violations = [];
  const shots = plan?.shots || [];

  // Read back what the setups actually put in frame. A setup labelled "The
  // Tackle and Pin" is a still the image model will refuse and, if it somehow
  // gets made, a picture the video model then refuses in turn — and neither says
  // why. Checked on the whole plan so a weapon mentioned in blocking is caught
  // as readily as one in the label.
  violations.push(...graphicViolations(JSON.stringify(shots), "This shot list"));

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
    // the SHOT into the field that describes the FRAME. It applies to endFrame
    // for exactly the same reason — it is also a still.
    for (const field of ["firstFrame", "endFrame"]) {
      const text = shot[field] || "";
      if (!text.trim()) continue;
      if (/\b(pans?|panning|zooms?|zooming|tracks? (?:in|out|left|right)|dollies|then|after that|cuts? to)\b/i.test(text)) {
        violations.push(
          `Setup ${i + 1}'s ${field} describes movement or a second moment ("${oneLine(text, 80)}"). It is a single frozen instant — one moment, no camera move, no "then". Put the movement in motion.`
        );
      }
    }

    // An end frame on a locked-off shot with nothing moving is a wasted image and,
    // worse, an invitation to the video model to move a camera that should not.
    if (String(shot.endFrame || "").trim() && shot.cameraMove === "locked" && countWords(shot.motion) < 8) {
      violations.push(
        `Setup ${i + 1} is locked off with little movement but still wrote an endFrame. Leave endFrame empty unless the frame genuinely arrives somewhere different.`
      );
    }

    if (settingKeys && String(shot.settingKey || "").trim() && !settingKeys.has(shot.settingKey)) {
      violations.push(
        `Setup ${i + 1} points at the arrangement "${shot.settingKey}", which is not in this scene. Use one of the keys given, or "" for a wide of the whole place.`
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

/** What the world pass has to satisfy. Faults here poison every plate below them. */
function worldViolations(world, scenes) {
  const violations = [];

  // THE ONE THAT WAS MISSED. A club written into a market stall's state was
  // photographed into a plate, and every frame of that scene was then built from
  // it — so the weapon outlived being deleted from the script twice. The whole
  // bible is checked as one document because it does not matter which tier the
  // object was written into; they all end up in the same photograph.
  violations.push(...graphicViolations(JSON.stringify(world || {}), "The world bible"));

  const environments = world?.environments || [];
  const settings = world?.settings || [];
  const objects = world?.objects || [];
  const mapping = world?.sceneWorld || [];

  if (environments.length === 0) {
    violations.push("No environments were returned. Every film is shot somewhere.");
  }
  if (environments.length > MAX_ENVIRONMENTS) {
    violations.push(
      `${environments.length} environments is more than the ${MAX_ENVIRONMENTS} this film can photograph. Merge the ones that are genuinely the same place.`
    );
  }
  if (settings.length > MAX_SETTINGS) {
    violations.push(
      `${settings.length} settings is more than the ${MAX_SETTINGS} this film can photograph. Keep the arrangements the film actually shoots into more than once.`
    );
  }

  const environmentKeys = new Set(environments.map((e) => e.key));
  for (const environment of environments) {
    if (countWords(environment.lock) < 60) {
      violations.push(`Environment "${environment.name}" has a ${countWords(environment.lock)}-word lock. It needs 120–200 words of the place itself.`);
    }
    if (countWords(environment.geometry) < 10) {
      violations.push(`Environment "${environment.name}" has no real geometry. State where things ARE — sides, openings, directions, seats.`);
    }
    if (environment.vehicle && !/\b(steering wheel|driver|driving seat|driver's seat)\b/i.test(environment.geometry || "")) {
      violations.push(
        `Environment "${environment.name}" is a vehicle interior but its geometry never says which side the steering wheel is on or who is driving. That omission is the single most common failure in this pipeline.`
      );
    }
    if (environment.needsSecondAngle && countWords(environment.secondAngle) < 4) {
      violations.push(
        `Environment "${environment.name}" asks for a second angle but never says what it looks at. Name it plainly, or set needsSecondAngle false.`
      );
    }
    violations.push(...stateViolations(environment, `Environment "${environment.name}"`));
  }

  for (const setting of settings) {
    if (!environmentKeys.has(setting.environmentKey)) {
      violations.push(
        `Setting "${setting.name}" belongs to environment "${setting.environmentKey}", which does not exist. Every arrangement is inside a place you authored.`
      );
    }
    if (countWords(setting.layout) < 15) {
      violations.push(
        `Setting "${setting.name}" has a ${countWords(setting.layout)}-word layout. This is the field the whole tier exists for: state where every item sits, precisely enough that two photographers would place them identically.`
      );
    }
    if (countWords(setting.lock) < 30) {
      violations.push(`Setting "${setting.name}" has a ${countWords(setting.lock)}-word lock. It needs 80–160 words on the arrangement itself.`);
    }
    violations.push(...stateViolations(setting, `Setting "${setting.name}"`));
  }

  for (const object of objects) {
    violations.push(...stateViolations(object, `Object "${object.name}"`));
  }

  const numbers = (scenes || []).map((s, i) => Number(s.sceneNumber ?? i + 1));
  const mapped = new Set(mapping.map((m) => Number(m.sceneNumber)));
  for (const n of numbers) {
    if (!mapped.has(n)) violations.push(`Scene ${n} was not given an environment.`);
  }
  const settingKeys = new Set(settings.map((s) => s.key));
  for (const entry of mapping) {
    if (!environmentKeys.has(entry.environmentKey)) {
      violations.push(`Scene ${entry.sceneNumber} points at environment "${entry.environmentKey}", which does not exist.`);
    }
    for (const key of entry.settingKeys || []) {
      if (!settingKeys.has(key)) {
        violations.push(`Scene ${entry.sceneNumber} points at setting "${key}", which does not exist.`);
      }
    }
  }

  return violations;
}

/**
 * What one thing's states have to satisfy.
 *
 * The base state is the load-bearing one: without exactly one, the runner has no
 * root to start the chain from and every later state would be generated from
 * nothing, which is the un-hierarchical behaviour this whole module replaces.
 */
function stateViolations(thing, label) {
  const violations = [];
  const states = thing?.states || [];

  if (states.length === 0) {
    violations.push(`${label} has no states at all. Every thing has at least a base state describing how it starts.`);
    return violations;
  }
  const bases = states.filter((s) => s.isBase);
  if (bases.length === 0) {
    violations.push(`${label} has no base state. Exactly one state must have isBase true — how it is before the film changes it.`);
  }
  if (bases.length > 1) {
    violations.push(`${label} has ${bases.length} base states. Exactly one, and every other state is a change from the one before it.`);
  }
  if (states.length > MAX_STATES_PER_THING) {
    violations.push(`${label} has ${states.length} states, over the ${MAX_STATES_PER_THING} ceiling. Merge the changes that land in the same scenes.`);
  }
  for (const state of states) {
    if (!state.isBase && countWords(state.change) < 6) {
      violations.push(
        `${label}'s state "${state.name}" does not say what changed. Name only what is physically different from the state before it.`
      );
    }
    if (!state.isBase && (state.scenes || []).length === 0) {
      violations.push(`${label}'s state "${state.name}" is true for no scenes. Either give it its scenes or delete it.`);
    }
  }
  return violations;
}

/**
 * What a framed prompt has to satisfy before it replaces a scene's full prompt.
 *
 * These gates are stricter than the shot gates and they are meant to be: the
 * framed prompt REPLACES a fully gated artefact at render time, so anything it
 * silently drops is dropped from the finished film. Dialogue is the one that
 * matters most — a paraphrased line is a wrong line, delivered confidently.
 */
function framedPromptViolations(framed, scene) {
  const violations = [];
  const text = String(framed || "").trim();
  const words = countWords(text);

  // The brief is what the video model is actually sent, so this is the last gate
  // in the entire pipeline. It catches a brief that re-introduced the act while
  // faithfully "keeping every beat" — the beats are exactly what it is told never
  // to lose, so this is a live risk rather than a theoretical one.
  violations.push(...graphicViolations(text, "This shooting brief"));

  if (words < FRAMED_PROMPT_MIN * 0.7) {
    violations.push(
      `The brief is ${words} words, well under the ${FRAMED_PROMPT_MIN}-word floor. This is the common failure: the writer treated the job as compression and cut things the pictures do NOT carry. Go back and spend the words — the ambience and its level, a named sound for every single physical event, each speaker's voice and state, the timing between beats, and the performance intention behind each one.`
    );
  }
  if (words > FRAMED_PROMPT_MAX * 1.6) {
    violations.push(
      `The brief is ${words} words, well over the ${FRAMED_PROMPT_MAX}-word ceiling. Length is not the problem by itself — but at this length it is almost always look-description creeping back in. Cut every word about the place, the people's appearance and the objects, and keep every word about action, voice, sound and timing.`
    );
  }

  // The no-music law survives every rewrite in this pipeline, and it is the one
  // the sound policy cannot re-check downstream because it only sees this text.
  if (!/no music/i.test(text)) {
    violations.push(`The brief never states that the clip carries NO MUSIC. That law is absolute and must appear explicitly.`);
  }
  const named = unnegatedMusicMention(text);
  if (named) {
    violations.push(`The brief names music or an instrument ("${named}") somewhere other than to forbid it. This clip is unscored — remove it.`);
  }

  if (!/sound|ambien|hum|noise|rustle|voice/i.test(text)) {
    violations.push(`The brief has no sound at all. Sound is now half of what this prompt is for.`);
  }

  // Every quoted line in the source has to survive verbatim. Compared on letters
  // alone so that quote style and punctuation drift do not raise a false fault.
  for (const line of quotedLines(scene?.fullPrompt)) {
    if (countWords(line) < 2) continue;
    if (!lettersOnly(text).includes(lettersOnly(line))) {
      violations.push(
        `The spoken line "${oneLine(line, 90)}" is missing or was reworded. Every line of dialogue is reproduced exactly as written, in full.`
      );
    }
  }

  // ── THE LINE COUNT ────────────────────────────────────────────────────────
  //
  // The check above only sees QUOTED lines, and a script written as
  // "NAME: the line" has none — so a brief could drop every one of them and pass.
  // This counts both sides instead, and it is the gate that matters most in this
  // whole module.
  //
  // Losing dialogue is the most damaging thing the rewrite can do. A dropped
  // visual detail is invisible, because the attached frame shows it anyway. A
  // dropped LINE is simply gone, and the clip comes back with silence where the
  // story was — which is the exact failure this film type exists to avoid.
  const sourceLines = countSpokenLines(scene?.dialogue) || countSpokenLines(scene?.fullPrompt);
  const briefLines = countSpokenLines(text);
  if (sourceLines > 0 && briefLines < sourceLines) {
    violations.push(
      `The script has ${sourceLines} spoken line(s) and this brief has ${briefLines}. ` +
        `${sourceLines - briefLines} line(s) were dropped or summarised away. Dialogue is what this film IS — ` +
        `the pictures carry everything else and can carry none of this. Put every line back, word for word, ` +
        `in the order spoken, each attributed to its speaker.`
    );
  } else if (sourceLines === 0 && briefLines < MIN_LINES_PER_SCENE) {
    violations.push(
      `This brief carries ${briefLines} spoken line(s). A scene in this film runs on talk — at least ` +
        `${MIN_LINES_PER_SCENE} lines of real exchange, back to back. If the script genuinely has none, it is the ` +
        `script that is wrong, and this brief should not paper over it.`
    );
  }

  if (/\b(text overlay|caption|subtitle|lower third|split screen|watermark|title card)\b/i.test(text)) {
    violations.push(`The brief asks for on-screen text or a split screen. Neither is allowed.`);
  }

  // ── The look-description gate ─────────────────────────────────────────────
  //
  // The whole point of a framed prompt is that the pictures carry appearance and
  // the words carry everything else. A brief that describes a complexion, a face
  // or a room is not merely redundant: the model now has two accounts of the same
  // thing and reconciles them by inventing a third. This is the single most
  // likely way for a rewrite to fail, because the source it is rewriting is two
  // thousand words of exactly this vocabulary and copying is easier than cutting.
  //
  // Deliberately narrow. Each pattern is a word that has no job in a brief about
  // action, voice, sound and timing — a clothing colour in the cast key does not
  // trip any of them, and neither does "she is soaked" as a change of state.
  const LOOK_WORDS = [
    ["complexion|skin tone|dark-skinned|light-skinned", "a complexion"],
    ["cheekbones|jawline|browline|nose bridge|facial structure", "a face"],
    ["locked character block|character reference|reference sheet", "a character lock"],
    ["colour grade|color grade|film stock|lens|anamorphic|bokeh|shallow depth of field", "the film's look"],
    ["peeling paint|scuffed|weathered walls|terrazzo|corrugated|floral wallpaper", "the room's surfaces"],
  ];
  for (const [pattern, what] of LOOK_WORDS) {
    const hit = new RegExp(`\\b(${pattern})\\b`, "i").exec(text);
    if (!hit) continue;
    violations.push(
      `The brief describes ${what} ("${hit[1]}"). The attached frames already show it, exactly, and describing it again gives the model two accounts to reconcile. Delete the phrase — appearance belongs to the pictures, and this brief carries action, voice, sound and timing.`
    );
  }

  // The cast key is a pointer, not a portrait, and it is the thing that stops a
  // thirty-clip film handing its lines to the wrong faces. Only demanded when the
  // scene actually has people who speak — a wordless or empty scene needs none.
  if (quotedLines(scene?.fullPrompt).length > 0 && !/cast key/i.test(text)) {
    violations.push(
      `The brief has no CAST KEY. With no character sheets attached, the frames are the only statement of who is who — and without a line naming each speaker and where they are in those frames, lines come back in the wrong mouth. Add it, first, and keep it to a name, a position and a few words of clothing.`
    );
  }

  return violations;
}

// ── Selection ───────────────────────────────────────────────────────────────

/** Places, most-used first, capped — a film that hits the cap spends its plates where they matter. */
function selectEnvironments(environments, { max = MAX_ENVIRONMENTS } = {}) {
  return (environments || [])
    .filter((e) => e && e.key && e.lock)
    .sort((a, b) => (b.scenes || []).length - (a.scenes || []).length)
    .slice(0, max);
}

/**
 * Which arrangements get photographed.
 *
 * Everything with a real layout, most-used first. Settings are not filtered the
 * way objects are: an arrangement that appears in one scene is still shot from
 * three angles inside that scene, and holding a table still across three angles
 * is exactly the job this tier was added to do.
 */
function selectSettings(settings, { max = MAX_SETTINGS, environmentKeys = null } = {}) {
  return (settings || [])
    .filter((s) => s && s.key && s.lock && s.layout)
    .filter((s) => !environmentKeys || environmentKeys.has(s.environmentKey))
    .sort((a, b) => (b.scenes || []).length - (a.scenes || []).length)
    .slice(0, max);
}

/**
 * Which objects actually get photographed.
 *
 * The model's own plateWorthy judgement is honoured, then trimmed by the same
 * economics as §14.3: a thing that appears once has no consistency burden and an
 * image spent on it buys nothing. Readable detail is the exception — a document
 * whose letterhead changes is a visible error even inside one scene, across cuts.
 */
function selectObjects(objects, { max = MAX_OBJECTS } = {}) {
  return (objects || [])
    .filter((o) => o && o.key && o.anchor)
    .filter((o) => {
      if (!o.plateWorthy) return false;
      const scenes = (o.scenes || []).length;
      if (scenes >= MIN_SCENES_FOR_OBJECT_PLATE) return true;
      if (o.detail && String(o.detail).trim()) return true;
      return o.kind === "vehicle";
    })
    .sort((a, b) => (b.scenes || []).length - (a.scenes || []).length)
    .slice(0, max);
}

/**
 * Which state of a thing is true in a given scene.
 *
 * The base state is the answer whenever nothing claims the scene, which is what
 * makes states optional: a world bible that authors no change at all resolves to
 * the base plate everywhere and behaves exactly like the flat design that came
 * before it.
 */
function resolveState(thing, sceneNumber) {
  const states = thing?.states || [];
  if (states.length === 0) return null;
  const n = Number(sceneNumber);
  const claimed = states.find((s) => (s.scenes || []).map(Number).includes(n));
  if (claimed) return claimed;
  return states.find((s) => s.isBase) || states[0];
}

/**
 * The states of one thing, in the order they must be PHOTOGRAPHED.
 *
 * Base first, then the rest by the earliest scene they are true for, because each
 * one is generated from the picture of the one before it. Get this order wrong
 * and a state is built from a plate that does not exist yet.
 */
function stateChain(thing) {
  const states = [...(thing?.states || [])];
  const base = states.find((s) => s.isBase) || states[0];
  if (!base) return [];
  const rest = states
    .filter((s) => s !== base)
    .sort((a, b) => earliestScene(a) - earliestScene(b));
  return [base, ...rest];
}

function earliestScene(state) {
  const scenes = (state?.scenes || []).map(Number).filter(Number.isFinite);
  return scenes.length ? Math.min(...scenes) : Number.MAX_SAFE_INTEGER;
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

function spanSeconds(text) {
  const span = parseTimeSpan(text);
  return span ? Math.max(0, span.end - span.start) : 0;
}

/**
 * A mention of music that is NOT a mention of its absence, or null.
 *
 * The naive version of this check — does the word "score" appear — fires on
 * every correct brief there is, because the directive above explicitly orders the
 * writer to say "no score, no soundtrack, no instrument". A gate that rejects
 * compliance is worse than no gate: it burns a repair pass, and the repair is
 * asked to remove the very sentence that enforces the law.
 *
 * So a term only counts when nothing negates it within the preceding clause.
 */
const MUSIC_WORDS = /\b(music|musical|soundtrack|score|scored|melody|guitar|drum|drums|kora|balafon|piano|violin|bpm|tempo|instrumental|underscore)\b/gi;
const NEGATOR_BEFORE = /\b(no|not|without|never|zero|absent|silent|unscored|free of|lacks?|nothing|neither|nor)\b[^.;:\n]{0,48}$/i;

function unnegatedMusicMention(text) {
  const source = String(text || "");
  for (const match of source.matchAll(MUSIC_WORDS)) {
    const before = source.slice(Math.max(0, match.index - 48), match.index);
    if (NEGATOR_BEFORE.test(before)) continue;
    return match[0];
  }
  return null;
}

/** Every quoted line in a prompt — what the framed prompt is checked against. */
function quotedLines(text) {
  const found = [];
  const source = String(text || "");
  for (const match of source.matchAll(/[""«]([^""»]{4,200})[""»]|"([^"\n]{4,200})"/g)) {
    const line = (match[1] || match[2] || "").trim();
    if (line) found.push(line);
  }
  return found;
}

function lettersOnly(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
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
  WORLD_SCHEMA,
  SHOT_SCHEMA,
  FRAMED_PROMPT_SCHEMA,
  UNBLOCK_SCHEMA,
  // the world pass
  worldDirective,
  worldBrief,
  // shot design
  shotDesignDirective,
  shotDesignBrief,
  // image prompts, by tier
  environmentPlatePrompt,
  environmentCoveragePrompt,
  settingPlatePrompt,
  objectPlatePrompt,
  statePlatePrompt,
  framePrompt,
  endFramePrompt,
  // what rides along
  frameInputPlan,
  endFrameInputPlan,
  allocateEndFrames,
  wantsEndFrame,
  // the video-prompt clause
  shotBoardClause,
  applyShotBoardClause,
  stripShotBoardClause,
  extractShotBoardClause,
  restoreShotBoardClause,
  stillRoll,
  SHOT_BOARD_OPEN,
  SHOT_BOARD_CLOSE,
  // the framed prompt
  framedPromptDirective,
  framedPromptBrief,
  framedPromptViolations,
  // self-healing
  unblockDirective,
  unblockBrief,
  FRAMED_PROMPT_MIN,
  FRAMED_PROMPT_MAX,
  // gates + selection
  shotPlanViolations,
  worldViolations,
  selectEnvironments,
  selectSettings,
  selectObjects,
  resolveState,
  stateChain,
  // constants + helpers
  MAX_SHOTS_PER_SCENE,
  MAX_STILLS_PER_SCENE,
  MAX_ENVIRONMENTS,
  MAX_SETTINGS,
  MAX_OBJECTS,
  MAX_STATES_PER_THING,
  MAX_INPUTS_PER_FRAME,
  CREATIVE_MANDATE,
  parseTimeSpan,
  slug,
};
