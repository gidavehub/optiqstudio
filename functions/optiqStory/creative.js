// ─── OPTIQ STORY — THE CONCEPT ROOM & THE DENSITY LAW ───────────────────────
//
// The story sandbox's twin of functions/optiqSkills/creative.js. Same two
// mechanisms, because they are the two that were proven on this codebase; the
// content is re-cut for films that sell nothing.
//
// The ad version's argument is "do not describe the product with a camera
// pointed at it". That failure cannot happen here — there is no product. The
// failure that happens HERE is subtler and far more common:
//
//   A SITUATION PITCHED AS A STORY.
//
// "A family runs a fishing business." "A tailor takes pride in her work."
// "Friends spend a day together." Those are settings with people in them. Nobody
// wants anything, nothing can go wrong, and so there is nothing to end — which
// produces six beautiful scenes of people being themselves and a viewer who
// leaves after four seconds.
//
// So the criteria are re-cut around WANT, JEOPARDY and OUTCOME, and the palette
// is dramatic rather than comic. The ad swarm's engines are comic devices tuned
// to land a product in thirty seconds; asked for a story they produce a sketch.
//
// What this is NOT: a template library. An engine says how a story generates its
// events, never what happens in it. Two films drawing "the debt nobody admits
// to" must still be unrelated films.

"use strict";

const { drawStoryProvocation, storyStructureLaw } = require("./storyCraft");

// ─── THE CONCEPT ROOM DIRECTIVE ─────────────────────────────────────────────

/**
 * The brief handed to the concept-room skill.
 *
 * @param {string|number} seed        Stable per film (the project id), so a
 *        retried generation chases the same story instead of lurching into a
 *        different one halfway.
 * @param {object}        opts
 * @param {number}        opts.numScenes
 * @param {number}        [opts.count=4] How many concepts to demand.
 */
function conceptDirective(seed, { numScenes, count = 4 } = {}) {
  const p = drawStoryProvocation(seed);
  const scenes = numScenes || 6;
  const seconds = scenes * 10;

  return `═══ THE CONCEPT ROOM — ORIGINAL SHORT FILM ═══
You are the room BEFORE the writer's room. Nothing is being sold here: no brand,
no product, no client, no pitch. This is a film someone will watch because they
want to know what happens next, and your whole job is to make sure the idea it
gets built on can carry ${seconds} seconds of that.

THE FAILURE YOU EXIST TO PREVENT: a SITUATION pitched as a story.
"A family runs a fishing business." "A tailor takes pride in her work." "Friends
spend a day together." Those are settings with people in them. Nobody wants
anything, nothing can go wrong, and so there is nothing to end — which produces
${scenes} beautiful scenes of people being themselves and an audience that leaves
after four seconds. A story is somebody who WANTS something they might not get.

WHAT AN IDEA HAS TO CLEAR — all five, or it is not a candidate:
1. SOMEBODY WANTS SOMETHING, and you can say what in four words.
2. SOMETHING IS IN THE WAY, and it can genuinely beat them.
3. IT CAN BE TOLD WHOLE IN ${seconds} SECONDS. Not the first act of something
   bigger, not a teaser, not an excerpt. A complete film with an ending you can
   already name.
4. IT TURNS. There is a point where it stops being the story we thought it was.
   If you cannot find that point, the idea is an anecdote.
5. SOMEBODY WOULD REPEAT IT. Write the sentence they would say to a friend. "It
   was nice" is a failed concept, and so is anything you have seen before. Be
   brave here — the safe idea is the dead one.

SCALE IS NOT STAKES. A borrowed dress can be worth more than a shipwreck. The
domestic scale is the strongest available: a debt to a neighbour, a promise to a
brother, a lie about to be found out, something taken without asking. It renders
beautifully, costs nothing, and every human alive has felt it. Reach for a
disaster only when the story genuinely is one.

═══ THIS FILM'S PROVOCATION (drawn fresh — different for every film) ═══
This exists because identical inputs produce identical films. It is pressure, not
a plot: it tells you HOW the story generates its events, never what happens in
it. Bend the director's brief around it rather than mentioning it.

DRAMATIC ENGINES — build ONE concept from each of these three, then a fourth
from anywhere you like:
${p.engines.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}

STORY SHAPE for this film — how it is built:
  ${p.shape}

TONE — how it feels to watch:
  ${p.tone}

COLD OPEN — the first three seconds, which is all a scrolling viewer gives us:
  ${p.hook}

${storyStructureLaw({ numScenes: scenes })}

═══ WHAT TO RETURN ═══
${count} genuinely DIFFERENT stories. Different means different — if two of them
could be described by the same sentence, you have written one concept twice.
Then pick the strongest and say why, naming what you give up by not picking the
others.

For each concept:
- title — three or four words, the way a film gets referred to on set.
- logline — ONE sentence: who, what they want, what is in the way, what it costs.
- engine — the machinery in your own words: the pressure that keeps this story
  generating events on its own, without you pushing it.
- openingImage — the literal first frame, honouring the cold open above. Not a
  place: an event already in progress.
- eventDensity — name at least ${Math.max(6, scenes * 3)} separate physical
  things that happen across this film. Count them. If you cannot reach the
  number, the story is too thin and you must say so rather than padding the list.
- whatIsAtStake — the specific thing this person loses if it goes wrong, in their
  own life, on their own terms. Not "her future": the school fees, this Friday.
- theTurn — where the story stops being what we thought it was.
- theEnding — what is PHYSICALLY different in the final shot. An event, not a
  feeling. "She smiles" is not an ending.
- risk — the one way this could come out badly. Every real idea has one; a
  concept with no risk is the safe one, which is the dead one.

THE FILM YOU ARE PITCHING FOR: an original short film, ${scenes} scenes of 10
seconds, ${seconds} seconds total. People SPEAK on camera, so dialogue is
available to you — but a character who explains the story is a character nobody
believes. Keep it to interruptions, deflections and things half-said.`;
}

// ─── THE DENSITY LAW ────────────────────────────────────────────────────────

/**
 * Beats a single 10-second scene must contain.
 *
 * THREE, not one. "At least one physical thing happens" is satisfied by a woman
 * putting down a cup, which is exactly the dead footage this system exists to
 * prevent. A beat is a discrete change of state — not a camera move, not a mood,
 * not "she continues stirring".
 */
const MIN_BEATS_PER_SCENE = 3;
const TARGET_BEATS_PER_SCENE = 5;

/**
 * How many of a film's scenes may be a single continuous shot.
 *
 * Continuous is a legitimate and sometimes superior choice — a long unbroken take
 * of one action can be the most alive thing in a film, and a story earns those
 * more often than an ad does. It is only a problem as a DEFAULT. A quarter of the
 * film, rounded up, with at least one always permitted.
 */
function oneShotAllowance(numScenes) {
  return Math.max(1, Math.ceil((numScenes || 1) / 4));
}

/**
 * The packed-seconds contract, injected into the storyline and scene-builder
 * prompts.
 */
function densityLaw({ numScenes } = {}) {
  const scenes = numScenes || 6;

  return `═══ THE DENSITY LAW — TEN SECONDS IS A LOT OF TIME ═══
Ten seconds is not a moment, it is a scene. Sixty seconds is not a film clip, it
is a film. Both get treated as though they were barely enough to hold one action,
and the result is footage where somebody carries a cup across a room for the
entire shot.

THE RULE: every 10-second scene contains at least ${MIN_BEATS_PER_SCENE} distinct
beats, and should aim for ${TARGET_BEATS_PER_SCENE}. A beat is a CHANGE OF STATE —
something starts, stops, breaks, arrives, is handed over, is noticed, is refused,
spills, lands, is switched on. These are NOT beats: a camera move, a mood, a
person continuing to do what they were already doing, a reaction with nothing to
react to.

Count them before you write the scene. "She stirs the pot" is one beat and a dead
scene. "She stirs, the spoon catches, she looks up, her brother is already holding
the lid out, she takes it without a word" is five, and it is the same ten seconds.

THE FIRST THREE SECONDS decide whether the film is watched at all. The viewer's
thumb is already moving. Scene 1 opens ON an event — not on an establishing shot,
not on a landscape, not on someone walking into frame to begin. Something is
already happening when the film starts.

CONTINUOUS SHOTS: at most ${oneShotAllowance(scenes)} of this film's ${scenes}
scenes may be a single unbroken take, and only where the unbroken-ness IS the
content (a physical continuity you would lose by cutting, or a performance you
would break). Every other scene carries 2–4 hard cuts, each a complete moment
with its own verb. A continuous scene is still held to the
${MIN_BEATS_PER_SCENE}-beat floor — one shot, several events.

TALK COUNTS, IF IT IS REALLY TALK. People speak on camera in this film, so a
scene may run on conversation — but it has to be an actual exchange with
something at stake: an interruption, a disagreement, someone talking over
someone, a question that lands badly, a decision changing mid-sentence, a
sentence somebody starts and does not finish. Two people politely alternating
statements is not a beat, it is a pause with words in it. And even a talking
scene carries physical events underneath: hands do things while mouths move.

AND IT BINDS HARDER HERE, BECAUSE THIS IS A STORY. An ad can survive a slow
scene — the viewer already knows why they are watching it. A story cannot. Ten
dead seconds in a short film is ten seconds in which the viewer decides they do
not need to know how this ends, and once they have decided that, the ending you
wrote does not exist. A longer run-time is a BIGGER story — more turns, more
people, a real second act — never the same story told more slowly.

WHAT PADDING LOOKS LIKE, so you can catch yourself doing it: the same beat shot
from a second angle; a person arriving somewhere they were already going; a slow
reveal of something we have already seen; "she looks at it thoughtfully"; a
reaction shot of somebody who has already reacted. If a beat can be cut without
the film losing anything, it was never a beat.`;
}

// ─── THE GATES ──────────────────────────────────────────────────────────────

/**
 * Phrases that mean nothing happened. Drawn from the doctrine's banned
 * vocabulary (§1.3) plus the ones a story reaches for when it is drifting.
 *
 * Matched on the storyline's BEATS, where they are cheap to fix, rather than
 * only on the finished 2,000-word prompt where a repair costs a whole rebuild.
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
  // Story-specific drift: the endings that are not endings.
  "at peace with",
  "comes to terms with",
  "finds closure",
  "a moment of reflection",
  "life goes on",
  "smiles knowingly",
  "smiles to herself",
  "smiles to himself",
];

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** How many discrete beats a storyline beat actually plans. */
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
 * Dead-content and density faults in a storyline, before a single scene is built.
 *
 * Returned as repair instructions rather than booleans: they go straight back to
 * the story doctor, and a fault the model cannot act on is a fault that ships.
 */
function storylineDensityViolations(storyline, { numScenes } = {}) {
  const beats = (storyline?.sceneBeats || []).filter(Boolean);
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
          `That language cannot be filmed — it instructs a theme and the model renders a pose. ` +
          `Replace it with what physically happens: verbs about hands.`
      );
    }
  }

  // The opening is checked hardest, because it is the only part most viewers see.
  const opener = beats.find((b) => Number(b.sceneNumber) === 1) || beats[0];
  if (opener && beatCount(opener) < MIN_BEATS_PER_SCENE + 1) {
    violations.push(
      `Scene 1 has to be the busiest scene in the film — it is competing with a thumb already moving. ` +
        `Give it at least ${MIN_BEATS_PER_SCENE + 1} beats and open ON an event, not on an establishing shot ` +
        `or somebody walking into frame to begin.`
    );
  }

  // The ending is checked just as hard, because it is the part that decides
  // whether the film was worth watching. This is the story sandbox's addition:
  // an ad can fade out on a logo, a story cannot fade out on anything.
  const closer = beats.find((b) => Number(b.sceneNumber) === total) || beats[beats.length - 1];
  if (closer && beatCount(closer) < MIN_BEATS_PER_SCENE) {
    violations.push(
      `The final scene plans only ${beatCount(closer)} beat(s). An ending is an EVENT and carries the same weight ` +
        `as every other scene — it is the beat the audience remembers. Give scene ${closer.sceneNumber ?? total} at ` +
        `least ${MIN_BEATS_PER_SCENE} distinct changes of state that show, physically, how this turned out.`
    );
  }

  // Too much of the film sitting on single continuous takes.
  const allowance = oneShotAllowance(total);
  const oneShots = beats.filter((b) => (b.cuts || []).filter((c) => c && c.shot).length <= 1);
  if (oneShots.length > allowance) {
    violations.push(
      `${oneShots.length} of ${beats.length} scenes are planned as a single uncut shot (scenes ` +
        `${oneShots.map((b) => b.sceneNumber).join(", ")}), and at most ${allowance} may be. ` +
        `A continuous take is a real choice when the continuity IS the content; as a default it is what makes ` +
        `a film feel empty. Plan 2–4 hard cuts in the rest.`
    );
  }

  return violations;
}

/**
 * Density faults in a BUILT scene prompt.
 *
 * Cheap and deliberately coarse: it counts the timestamped beats in the action
 * block, because that is the one structural feature the prompt architecture
 * guarantees. A backstop for the storyline gate, not a substitute.
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
  storylineDensityViolations,
  scenePromptDensityViolations,
  beatCount,
  oneShotAllowance,
  MIN_BEATS_PER_SCENE,
  TARGET_BEATS_PER_SCENE,
  DEAD_PHRASES,
};
