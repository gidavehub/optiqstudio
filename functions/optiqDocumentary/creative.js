// ─── OPTIQ DOCUMENTARY — THE CONCEPT ROOM & THE DENSITY LAW ─────────────────
//
// The documentary sandbox's twin of functions/optiqStory/creative.js. Same two
// mechanisms, because they are the two proven on this codebase; the content is
// re-cut for a narrated film that observes something real.
//
// The story sandbox's argument is "a situation is not a story". The failure HERE
// is its cousin, and it is even easier to fall into:
//
//   A SUBJECT PITCHED AS A FILM.
//
// "A documentary about the fish market." "A film about how salt is made." "The
// life of a tailor." Those are topics with a camera pointed at them. Nothing is
// being claimed, nothing is at issue, and so there is nothing to arrive at —
// which produces eight beautiful shots in any order and a viewer who leaves
// after four seconds.
//
// The other failure, unique to this format: THE NARRATED SLIDESHOW. Pretty
// pictures with a voice explaining them. The test that catches it is brutal and
// simple — turn the sound off. If the film stops meaning anything, the pictures
// were never doing the work.
//
// What this is NOT: a template library. An angle says how a film looks at its
// subject, never what the subject is. Two films drawn on "the cost nobody
// counts" must still be unrelated films.

"use strict";

const { drawDocumentaryProvocation, documentaryStructureLaw } = require("./documentaryCraft");

// ─── THE CONCEPT ROOM DIRECTIVE ─────────────────────────────────────────────

/**
 * The brief handed to the concept-room skill.
 *
 * @param {string|number} seed        Stable per film (the project id), so a
 *        retried generation chases the same film instead of lurching into a
 *        different one halfway.
 * @param {object}        opts
 * @param {number}        opts.numScenes
 * @param {number}        [opts.count=4] How many treatments to demand.
 */
function conceptDirective(seed, { numScenes, count = 4 } = {}) {
  const p = drawDocumentaryProvocation(seed);
  const scenes = numScenes || 6;
  const seconds = scenes * 10;

  return `═══ THE CONCEPT ROOM — DOCUMENTARY ═══
You are the room BEFORE the writer's room. Nothing is being sold here: no brand,
no product, no client, no pitch. This is a documentary someone will watch because
they want to know the thing it knows, and your whole job is to make sure the idea
it gets built on can carry ${seconds} seconds of that.

THE FAILURE YOU EXIST TO PREVENT: a SUBJECT pitched as a film.
"A documentary about the fish market." "How salt is made." "The life of a
tailor." Those are topics with a camera pointed at them. Nothing is claimed,
nothing is at issue, so there is nothing to arrive at — which produces ${scenes}
beautiful shots in any order and an audience that leaves after four seconds. A
documentary is an ARGUMENT: it says something specific that you could be wrong
about, and then it shows you why it is right.

THE SECOND FAILURE, and it is the one this format dies of: THE NARRATED
SLIDESHOW. Pretty pictures with a voice explaining them. Nobody speaks on camera
in this film — every word is a voiceover added afterwards — and that makes the
temptation enormous: let the narrator carry it. Do not. THE SOUND-OFF TEST: play
your treatment silently in your head. If the film stops meaning anything without
the voice, the pictures were never doing the work and the concept has failed.

WHAT AN IDEA HAS TO CLEAR — all five, or it is not a candidate:
1. THERE IS A THESIS. One sentence, and it is a claim, not a topic. "The hard
   part of salt is not making it, it is carrying it." Say it out loud.
2. IT CAN BE FILMED. Every part of the argument is a physical, visible thing
   somebody does or something that happens. An argument that needs statistics,
   maps, archive footage or a person explaining it to camera cannot be made here.
3. IT CAN BE MADE WHOLE IN ${seconds} SECONDS. Not the first chapter of a
   series, not a trailer. A complete film with a close you can already name.
4. THERE IS A COMPLICATION. Somewhere this is harder, costlier or less tidy than
   it first looks. If everything about your subject is straightforwardly good,
   you have a brochure.
5. SOMEBODY WOULD REPEAT IT. Write the sentence a viewer would say to a friend
   afterwards: "did you know they…". If you cannot write that sentence, the idea
   has not found its point yet.

SPECIFIC BEATS GENERAL, ALWAYS. One woman's forty-kilo basin beats "the salt
industry". One worn groove in one bench beats "generations of craftsmanship". The
particular is the only thing that renders, the only thing that is true, and the
only thing anyone remembers.

═══ THIS FILM'S PROVOCATION (drawn fresh — different for every film) ═══
This exists because identical inputs produce identical films. It is pressure, not
a plan: it tells you HOW to look at the subject, never what the subject is. Bend
the director's brief around it rather than mentioning it.

ANGLES — build ONE treatment from each of these three, then a fourth from
anywhere you like:
${p.angles.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}

SHAPE for this film — how it is built:
  ${p.shape}

TONE — how it feels to watch:
  ${p.tone}

COLD OPEN — the first three seconds, which is all a scrolling viewer gives us:
  ${p.opening}

${documentaryStructureLaw({ numScenes: scenes })}

═══ WHAT TO RETURN ═══
${count} genuinely DIFFERENT treatments. Different means different — if two of
them could be described by the same sentence, you have written one twice. Then
pick the strongest and say why, naming what you give up by not picking the others.

For each treatment:
- title — three or four words, the way a film gets referred to on set.
- thesis — the ONE sentence this film lands. A claim, not a topic.
- logline — one sentence: what we watch, and what it turns out to be about.
- angle — how this film looks at the subject, in your own words.
- openingImage — the literal first frame, honouring the cold open above. Not a
  place: an event already in progress.
- eventDensity — name at least ${Math.max(6, scenes * 3)} separate physical
  things that happen or are shown across this film. Count them. If you cannot
  reach the number, the subject is too thin as framed and you must say so rather
  than padding the list.
- theComplication — where this stops being simple.
- theClose — what is PHYSICALLY happening in the final shot, and why that lands
  the thesis. An event, not a feeling. "A wide shot at sunset" is not a close.
- risk — the one way this could come out badly. Every real idea has one; a
  treatment with no risk is the safe one, which is the dead one.

THE FILM YOU ARE PITCHING FOR: a documentary, ${scenes} scenes of 10 seconds,
${seconds} seconds total. The footage is SILENT — nobody speaks on camera, there
are no interviews and no talking heads — and a narrator's voiceover is written
and recorded afterwards, over the finished cut. Plan for pictures that carry
themselves.`;
}

// ─── THE DENSITY LAW ────────────────────────────────────────────────────────

/**
 * Beats a single 10-second scene must contain.
 *
 * THREE, not one. "At least one physical thing happens" is satisfied by a woman
 * putting down a basin, which is exactly the dead footage this system exists to
 * prevent. A beat is a discrete change of state — not a camera move, not a mood,
 * not "she continues stirring".
 */
const MIN_BEATS_PER_SCENE = 3;
const TARGET_BEATS_PER_SCENE = 5;

/**
 * How many of a film's scenes may be a single continuous shot.
 *
 * Continuous is a legitimate and sometimes superior choice — an unbroken take of
 * one process is often the most honest thing a documentary can do. It is only a
 * problem as a DEFAULT. A quarter of the film, rounded up, at least one always
 * permitted.
 */
function oneShotAllowance(numScenes) {
  return Math.max(1, Math.ceil((numScenes || 1) / 4));
}

/**
 * The packed-seconds contract, injected into the outline and scene-builder
 * prompts.
 */
function densityLaw({ numScenes } = {}) {
  const scenes = numScenes || 6;

  return `═══ THE DENSITY LAW — TEN SECONDS IS A LOT OF TIME ═══
Ten seconds is not a moment, it is a scene. Sixty seconds is not a clip, it is a
film. Both get treated as though they were barely enough to hold one action, and
the result is footage where somebody carries a basin across a yard for the entire
shot.

THE RULE: every 10-second scene contains at least ${MIN_BEATS_PER_SCENE} distinct
beats, and should aim for ${TARGET_BEATS_PER_SCENE}. A beat is a CHANGE OF STATE —
something starts, stops, breaks, arrives, is handed over, is lifted, is refused,
spills, lands, is switched on. These are NOT beats: a camera move, a mood, a
person continuing to do what they were already doing, a slow reveal of something
we have already seen.

Count them before you write the scene. "She sorts the fish" is one beat and a
dead scene. "She flicks a fish onto the left pile, catches the next one before it
lands, sends it right, wipes her palm down her wrapper and the boy drops another
crate at her feet" is five, and it is the same ten seconds.

IT BINDS HARDER HERE, BECAUSE NOBODY SPEAKS. A drama can survive a slow scene on
a performance; a silent illustrative clip has nothing to survive on but events.
Ten seconds of somebody standing thoughtfully in a doorway is ten seconds of
nothing, whatever the narrator is saying over it — and a narrator talking over
nothing is exactly the narrated slideshow this system exists to prevent.

THE FIRST THREE SECONDS decide whether the film is watched at all. The viewer's
thumb is already moving. Scene 1 opens ON an event — not an establishing shot,
not a landscape, not a drone move over a place, not somebody walking into frame
to begin. Something is already happening when the film starts.

CONTINUOUS SHOTS: at most ${oneShotAllowance(scenes)} of this film's ${scenes}
scenes may be a single unbroken take, and only where the unbroken-ness IS the
content (a process you would lose by cutting). Every other scene carries 2–4 hard
cuts, each a complete moment with its own verb. A continuous scene is still held
to the ${MIN_BEATS_PER_SCENE}-beat floor — one shot, several events.

WHAT PADDING LOOKS LIKE, so you can catch yourself doing it: the same action shot
from a second angle; somebody arriving somewhere they were already going; a slow
push in on a face; "she looks at it thoughtfully"; a reaction shot of somebody
who has already reacted; a drone rising over the location for no reason. If a
beat can be cut without the film losing anything, it was never a beat.`;
}

// ─── THE GATES ──────────────────────────────────────────────────────────────

/**
 * Phrases that mean nothing happened. Drawn from the doctrine's banned
 * vocabulary (§1.3) plus the ones a documentary reaches for when it is drifting
 * into a tourist board film.
 *
 * Matched on the outline's BEATS, where they are cheap to fix, rather than only
 * on the finished 2,000-word prompt where a repair costs a whole rebuild.
 */
const DEAD_PHRASES = [
  "establishing",
  "conveying",
  "embodying",
  "showcasing",
  "reflecting on",
  "taking in the",
  "soaking in",
  "basking",
  "lost in thought",
  "deep in thought",
  "gazing",
  "gazes",
  "stares off",
  "contemplating",
  "admiring",
  "enjoying the moment",
  "savouring the moment",
  "savoring the moment",
  "golden hour",
  "golden light",
  "dust motes",
  "beaming with pride",
  "the daily struggle",
  "a face that tells",
  "atmosphere of",
  "sense of community",
  "captures the essence",
  "montage of beautiful",
  // Documentary-specific drift: the travelogue and the tourist board.
  "sweeping aerial",
  "drone rises",
  "drone sweeps",
  "timelapse of the sky",
  "time-lapse of the sky",
  "vibrant tapestry",
  "bustling market",
  "rich culture",
  "way of life",
  "resilience of the",
  "the human spirit",
  "hard at work",
  "smiles for the camera",
  "poses for the camera",
];

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** How many discrete beats an outline beat actually plans. */
function beatCount(beat) {
  const cuts = (beat?.cuts || []).filter((c) => c && String(c.shot || "").trim());
  if (cuts.length > 1) return cuts.length;
  // A single planned cut (or none) means the scene's density has to live in the
  // moment text, so count the clauses that carry a verb.
  const moment = String(beat?.moment || "");
  const clauses = moment
    .split(/[.;•]|\s+then\s+|\s+and then\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  return Math.max(cuts.length, clauses.length);
}

/**
 * Dead-content and density faults in an outline, before a single scene is built.
 *
 * Returned as repair instructions rather than booleans: they go straight back to
 * the outline doctor, and a fault the model cannot act on is a fault that ships.
 */
function outlineDensityViolations(outline, { numScenes } = {}) {
  const beats = (outline?.sceneBeats || []).filter(Boolean);
  const violations = [];
  if (beats.length === 0) return violations;

  const total = numScenes || beats.length;

  for (const beat of beats) {
    const n = beat.sceneNumber ?? "?";
    const count = beatCount(beat);
    if (count < MIN_BEATS_PER_SCENE) {
      violations.push(
        `Scene ${n} plans only ${count} beat(s) in ten seconds — that is the dead footage this film exists to avoid. ` +
          `Give it at least ${MIN_BEATS_PER_SCENE} distinct changes of state (aim for ${TARGET_BEATS_PER_SCENE}), ` +
          `each with its own physical verb, and plan the cuts that carry them.`
      );
    }

    const text = normalize(`${beat.moment || ""} ${(beat.cuts || []).map((c) => c.shot).join(" ")}`);
    const dead = DEAD_PHRASES.filter((phrase) => text.includes(phrase));
    if (dead.length > 0) {
      violations.push(
        `Scene ${n} is written as mood, not as a moment (${dead.map((d) => `"${d}"`).join(", ")}). ` +
          `That language cannot be filmed — it instructs a theme and the model renders a postcard. ` +
          `Replace it with what physically happens: verbs about hands.`
      );
    }
  }

  // The opening is checked hardest, because it is the only part most viewers see.
  const opener = beats.find((b) => Number(b.sceneNumber) === 1) || beats[0];
  if (opener && beatCount(opener) < MIN_BEATS_PER_SCENE + 1) {
    violations.push(
      `Scene 1 has to be the busiest scene in the film — it is competing with a thumb already moving. ` +
        `Give it at least ${MIN_BEATS_PER_SCENE + 1} beats and open ON an event, not on an establishing shot, ` +
        `a landscape or a drone move.`
    );
  }

  // The close is checked just as hard: it is what decides whether the argument
  // arrived. A documentary cannot fade out on anything.
  const closer = beats.find((b) => Number(b.sceneNumber) === total) || beats[beats.length - 1];
  if (closer && beatCount(closer) < MIN_BEATS_PER_SCENE) {
    violations.push(
      `The final scene plans only ${beatCount(closer)} beat(s). A close is an EVENT and carries the same weight as ` +
        `every other scene — it is the beat that lands the thesis. Give scene ${closer.sceneNumber ?? total} at ` +
        `least ${MIN_BEATS_PER_SCENE} distinct changes of state that show, physically, how this ends.`
    );
  }

  // Too much of the film sitting on single continuous takes.
  const allowance = oneShotAllowance(total);
  const oneShots = beats.filter((b) => (b.cuts || []).filter((c) => c && c.shot).length <= 1);
  if (oneShots.length > allowance) {
    violations.push(
      `${oneShots.length} of ${beats.length} scenes are planned as a single uncut shot (scenes ` +
        `${oneShots.map((b) => b.sceneNumber).join(", ")}), and at most ${allowance} may be. ` +
        `A continuous take is a real choice when the continuity IS the content; as a default it is what makes a ` +
        `film feel empty. Plan 2–4 hard cuts in the rest.`
    );
  }

  return violations;
}

/**
 * Density faults in a BUILT scene prompt.
 *
 * Cheap and deliberately coarse: it counts the timestamped beats in the action
 * block, because that is the one structural feature the prompt architecture
 * guarantees. A backstop for the outline gate, not a substitute.
 */
function scenePromptDensityViolations(scene) {
  const prompt = String(scene?.fullPrompt || "");
  if (!prompt) return [];
  // Timestamps as the prompt architecture writes them: "0.0s", "0-2s", "00:03".
  const stamps = prompt.match(/\b\d{1,2}[:.]\d{1,2}\s*(?:s\b|sec)?|\b\d{1,2}\s*[–—-]\s*\d{1,2}\s*s\b/gi) || [];
  if (stamps.length >= MIN_BEATS_PER_SCENE) return [];
  return [
    `The ACTION block carries only ${stamps.length} timestamped beat(s). A ten-second scene needs at least ` +
      `${MIN_BEATS_PER_SCENE} (aim for ${TARGET_BEATS_PER_SCENE}), each a separate change of state with its own ` +
      `physical verb and its own timestamp. Re-time the action across the full ten seconds instead of describing ` +
      `one continuous activity.`,
  ];
}

module.exports = {
  conceptDirective,
  densityLaw,
  outlineDensityViolations,
  scenePromptDensityViolations,
  beatCount,
  oneShotAllowance,
  MIN_BEATS_PER_SCENE,
  TARGET_BEATS_PER_SCENE,
  DEAD_PHRASES,
};
