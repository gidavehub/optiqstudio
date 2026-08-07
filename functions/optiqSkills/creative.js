// ─── OPTIQ SKILLS — THE CONCEPT ROOM & THE DENSITY LAW ──────────────────────
//
// Why this module exists.
//
// Two complaints, one root cause.
//
//   "The story was bland and empty. It spends a whole 10 seconds on one action —
//    a lady carrying a cup and putting it down. It's dead."
//
//   "So much has to happen in the first three to five seconds or the person
//    scrolls past. 10 seconds is a LOT of time. The ad has to be PACKED."
//
// The doctrine already knew this — Part I is a whole essay on moments not mood,
// and §1.1 has the dead/alive table. The swarm reads it and still writes dead
// film, for two structural reasons that no amount of re-stating the doctrine
// fixes:
//
//   1. NOTHING FORCES A GOOD IDEA. The storyline skill is asked to "internally
//      consider several candidates and output the winner". A model asked to
//      consider privately and report a winner does not consider — it writes its
//      first idea and calls it the winner. The obvious idea for groundnut paste
//      is a woman making groundnut paste. That is not a concept, it is a
//      description of the product with a camera pointed at it.
//
//   2. NOTHING COUNTS THE EVENTS. "Every scene must contain at least one
//      physical thing that happens" is satisfied by a woman putting down a cup.
//      One event per ten seconds IS the dead footage the director is describing.
//      The floor was set at the wrong number and never checked.
//
// So this module does two things the doctrine cannot do on its own:
//
//   THE PROVOCATION — a comic engine, a structural device, a tonal spice and an
//     opening hook, drawn fresh per film. This is the trick ./casting.js proved
//     out: a sterner instruction cannot break convergence, but a different INPUT
//     can. A brief that arrives carrying "the confident expert who is completely
//     wrong" and "a relay: each scene hands an object to the next" cannot come
//     back as a woman stirring a pot.
//
//   THE COUNT — beats per scene, enforced in JS against the storyline's own
//     output and again against the built prompt. Not a request, a gate.
//
// What this is NOT: a template library. The provocation is a starting pressure,
// not a plot. Two films drawing the same comic engine should still be unrelated
// films — the engine says how the humour works, never what happens.

"use strict";

const { rngFor, pick, sample } = require("./rng");

// ─── THE PALETTES ───────────────────────────────────────────────────────────

/**
 * The mechanism that makes a film alive — the thing generating events.
 *
 * Written as machinery rather than mood on purpose. "Heartwarming" is not an
 * engine, it is a result; "a small kindness is repaid by someone who did not see
 * it happen" is an engine, and it produces scenes by itself.
 */
const CREATIVE_ENGINES = [
  "ESCALATING MISUNDERSTANDING — two people are having completely different conversations and neither realises. Each scene widens the gap; the reveal lands the point.",
  "THE RUNNING GAG — one specific thing goes wrong the same way three times, and the fourth time it goes right. The repetition IS the structure, and the payoff is the product.",
  "THE CONFIDENT EXPERT WHO IS WRONG — someone explains, with total authority, how a thing works. They are completely wrong. Somebody quieter is proved right without gloating.",
  "CHAIN REACTION — one small action in scene one sets off a sequence that gets progressively more out of hand, and the last domino is the payoff.",
  "ROLE REVERSAL — the person who should know least knows most. A child instructs an adult, an apprentice corrects a master, a customer teaches the shopkeeper.",
  "ENORMOUS SERIOUSNESS ABOUT A TINY STAKE — a trivial matter treated with the gravity of a heist. Nobody in the film finds it funny, which is what makes it funny.",
  "THE THING THAT WILL NOT COOPERATE — an object, an animal, a queue or a door actively refuses. The comedy is in the negotiation with it.",
  "AN AUDIENCE FORMS — a private moment acquires spectators, then commentary, then sides. The crowd becomes a character.",
  "COMPETENCE IN AN ABSURD PLACE — someone does something genuinely skilful in completely the wrong setting, and everybody around them carries on as normal.",
  "THE DEADLINE — a mundane clock (a bus, a closing shop, rice about to burn) turns ordinary actions into a sprint.",
  "SOMEBODY OVERHEARS THE WRONG HALF — one sentence is heard out of context and acted on immediately, with consequences.",
  "AN UNSPOKEN COMPETITION — two people who will not admit they are competing, competing. Neither ever says so.",
  "THE FAVOUR THAT TRAVELS — a small kindness is passed from person to person and comes back to the first person changed.",
  "SHOWING OFF, AND BEING CAUGHT — someone performs for an audience they think isn't watching. Somebody is watching.",
  "THE SECRET METHOD — someone is visibly better at something and refuses to explain why. The film reveals it in the last beat.",
  "TWO PLACES AT ONCE — cutting between two locations doing the same thing differently, converging in the final scene.",
];

/**
 * How the film is BUILT. Independent of the engine, so the same comic idea can
 * come out as a relay, a countdown or a hard before/after and be three films.
 */
const STRUCTURAL_DEVICES = [
  "COLD OPEN AT THE WORST MOMENT — start mid-disaster with no setup, then let the film explain how we got here.",
  "THE RELAY — each scene hands a physical object to the next scene. The object is the through-line, and we follow it, not a person.",
  "THE VISIBLE CLOCK — something in frame is counting down in every scene: a queue getting shorter, a pot getting emptier, light going.",
  "SAME ACTION, DIFFERENT PEOPLE — every scene is the same specific gesture performed by a completely different person in a completely different place.",
  "HARD BEFORE / AFTER — scenes pair up and cut on the identical framing, so the change is the cut itself.",
  "ONE JOURNEY, LEG BY LEG — a single continuous trip where each scene is the next stage, and the destination is the payoff.",
  "THE QUESTION — somebody asks something in the first five seconds and the whole film is the answer arriving in the last scene.",
  "THE LIST — each scene is one numbered, specific, concrete claim, delivered fast, physically demonstrated rather than stated.",
  "ONE OBJECT, NEVER LEAVING IT — the camera stays with a single object for the whole film while the world changes around it.",
  "THE ARGUMENT — the film is one continuous disagreement across locations, settled by the offering.",
  "ROUND TRIP — the film ends exactly where it began, on the same frame, with one thing different.",
  "THE WITNESS — one character watches the whole film happen to other people, and only acts in the final scene.",
];

/** The emotional register, expressed as behaviour rather than adjective. */
const TONAL_SPICES = [
  "affectionate teasing between people who obviously love each other",
  "deadpan — nobody in the film reacts as much as the situation deserves",
  "delight at a small thing working exactly right, played big",
  "exasperation that keeps tipping over into laughter",
  "the swagger of someone who knows they are very good at this",
  "pride played completely straight, with no music-video sheen",
  "conspiratorial — the characters are in on something the viewer works out late",
  "brisk, competent, unsentimental: people who have things to do",
  "warmth with a streak of mischief running under it",
  "mock-heroic — ordinary work shot like it matters enormously, because to them it does",
];

/**
 * The first three seconds, which is all a scroll gives you.
 *
 * Deliberately a separate draw: a film can have a brilliant engine and still open
 * on an establishing shot, and an establishing shot is a lost viewer.
 */
const OPENING_HOOKS = [
  "OPEN ON THE LOUDEST MOMENT — the noisiest, busiest instant of the entire story is the first frame. No build-up.",
  "OPEN ON A REACTION — a face responding to something we cannot see yet. We meet the cause a beat later.",
  "OPEN MID-SENTENCE — we arrive in the middle of an exchange already in progress and catch up as it runs.",
  "OPEN ON SOMETHING GOING WRONG — something spills, drops, tears, snaps or falls in the first second.",
  "OPEN ON MOTION TOWARD CAMERA — someone or something is already moving fast at the lens when the film starts.",
  "OPEN ON THE HANDS — an extreme close shot of a physical action already underway, revealed wider on the first cut.",
  "OPEN ON THE ODDEST IMAGE IN THE FILM — the single most 'wait, what?' frame you have, with no explanation.",
  "OPEN ON A DIRECT CHALLENGE — one character does something provocative to another in the first two seconds.",
];

// ─── THE DRAW ───────────────────────────────────────────────────────────────

/**
 * The creative provocation for one film.
 *
 * `seed` should be stable per film (the project id) so a retried generation
 * chases the same idea rather than lurching to a different film halfway. Two
 * engines are drawn, not one: a single engine reads as an instruction to obey,
 * whereas two force an actual choice — and the concept room is asked to build a
 * distinct concept from each.
 */
function drawProvocation(seed) {
  const rng = rngFor(seed, "creative:");
  const engines = sample(CREATIVE_ENGINES, 3, rng);
  return {
    engines,
    device: pick(STRUCTURAL_DEVICES, rng),
    spice: pick(TONAL_SPICES, rng),
    hook: pick(OPENING_HOOKS, rng),
  };
}

// ─── THE CONCEPT ROOM DIRECTIVE ─────────────────────────────────────────────

/**
 * The brief handed to the concept-room skill.
 *
 * @param {string|number} seed        Stable per film.
 * @param {object}        opts
 * @param {object}        opts.kind   A FILM_KINDS entry.
 * @param {number}        opts.numScenes
 * @param {number}        [opts.count=4] How many concepts to demand.
 */
function conceptDirective(seed, { kind, numScenes, count = 4 } = {}) {
  const p = drawProvocation(seed);
  const seconds = (numScenes || 6) * 10;

  return `═══ THE CONCEPT ROOM ═══
You are not writing the film yet. You are the room BEFORE the writer's room: your
whole job is to make sure the idea this film gets built on is a real idea and not
a description of the product with a camera pointed at it.

THE FAILURE YOU EXIST TO PREVENT, stated plainly by the director:
"The story was bland and empty. It spends ten whole seconds on one action — a
woman carries a cup and puts it down. It's dead."
That happens when the concept is literal. If the offering is groundnut paste and
the concept is "a family makes groundnut paste", there is nothing for the scenes
to DO, so they fill ${seconds} seconds with atmosphere. A concept's job is to
generate events faster than the run-time can hold them.

WHAT AN IDEA HAS TO CLEAR — all four, or it is not a candidate:
1. NOT LITERAL. If the concept is "person uses product and is pleased", it is the
   product's description wearing a plot. Reject it yourself before we do.
2. NOT VAGUE. "A celebration of community" is not an idea, it is a category. A
   real idea can be told in one sentence with a specific person doing a specific
   thing for a specific reason.
3. IT GENERATES EVENTS. Say out loud how many separate things happen. If you
   cannot fill ${numScenes} scenes without repeating a beat, the idea is too thin
   — it is a poster, not a film.
4. SOMEBODY WOULD REPEAT IT. Funny, surprising, moving or genuinely clever. "It
   was nice" is a failed concept. Be brave here: the safe idea is the dead one.

═══ THIS FILM'S PROVOCATION (drawn fresh — different for every film) ═══
This exists because identical inputs produce identical films. It is pressure, not
a plot: it tells you HOW the film works, never what happens in it. Bend the brief
around it rather than mentioning it.

COMIC / DRAMATIC ENGINES — build ONE concept from each of these three, then a
fourth from anywhere you like:
${p.engines.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}

STRUCTURAL DEVICE for this film — how it is built:
  ${p.device}

TONAL SPICE — how it feels to watch:
  ${p.spice}

OPENING HOOK — the first three seconds, which is all a scrolling viewer gives us:
  ${p.hook}

═══ WHAT TO RETURN ═══
${count} genuinely DIFFERENT concepts. Different means different — if two of them
could be described by the same sentence, you have written one concept twice.
Then pick the strongest and say why, naming what you are giving up by not
picking the others.

For each concept:
- title — three or four words, the way a film gets referred to on set.
- logline — ONE sentence: who, what they do, what is at stake, what goes wrong.
- engine — the machinery, in your own words: what keeps generating events.
- openingImage — the literal first frame, honouring the opening hook above.
- eventDensity — name at least ${Math.max(6, numScenes * 3)} separate physical
  things that happen across this film. Count them. If you cannot reach the number,
  the concept is too thin and you must say so rather than padding the list.
- whereTheOfferingLands — ${
    kind?.id === "short-film"
      ? "how the brand belongs in the story without being announced. A short film never pitches."
      : "the exact moment the product or service turns the story. Not a slot at the end — a turn."
  }
- risk — the one way this concept could come out badly. Every real idea has one;
  a concept with no risk is a safe concept, which is the dead one.

THE FILM YOU ARE PITCHING FOR: a ${kind?.noun || "ad"}, ${numScenes} scenes of 10
seconds, ${seconds} seconds total.
${kind?.register || ""}${
    kind?.dialogueInVideo
      ? "\nPeople SPEAK on camera in this film, so dialogue is available to you as an event generator — an argument, a negotiation, someone talking over someone else."
      : "\nNOBODY SPEAKS ON CAMERA in this film. Every concept must work as pure picture: if a beat only lands when someone explains it aloud, that concept is disqualified. This raises the bar — pick ideas whose events are visible."
  }`;
}

// ─── THE DENSITY LAW ────────────────────────────────────────────────────────

/**
 * Beats a single 10-second scene must contain.
 *
 * THREE, not one. The doctrine's "at least one physical thing happens" is what
 * produced the cup-carrying scene: it is technically satisfied and completely
 * dead. A beat is a discrete change of state — not a camera move, not a mood,
 * not "she continues stirring".
 */
const MIN_BEATS_PER_SCENE = 3;
const TARGET_BEATS_PER_SCENE = 5;

/**
 * How many of a film's scenes may be a single continuous shot.
 *
 * Continuous is a legitimate and sometimes superior choice — a long unbroken
 * take of one action can be the most alive thing in a film. It is only a problem
 * as a DEFAULT, which is what it became. A quarter of the film, rounded up, with
 * at least one always permitted.
 */
function oneShotAllowance(numScenes) {
  return Math.max(1, Math.ceil((numScenes || 1) / 4));
}

/**
 * The packed-seconds contract, injected into the storyline and scene-builder
 * prompts.
 *
 * Differs by film kind exactly where the director drew the line: a film where
 * people talk can carry a stretch on conversation, and a narrated film cannot,
 * so its density has to be entirely physical.
 */
function densityLaw({ kind, numScenes } = {}) {
  const scenes = numScenes || 6;
  const talks = !!kind?.dialogueInVideo;

  return `═══ THE DENSITY LAW — TEN SECONDS IS A LOT OF TIME ═══
Ten seconds is not a moment, it is a scene. Sixty seconds is not a film clip, it
is a film. Both were being treated as though they were barely enough to hold one
action, and the result is footage where somebody carries a cup across a room for
the entire shot.

THE RULE: every 10-second scene contains at least ${MIN_BEATS_PER_SCENE} distinct
beats, and should aim for ${TARGET_BEATS_PER_SCENE}. A beat is a CHANGE OF STATE —
something starts, stops, breaks, arrives, is handed over, is noticed, is refused,
spills, lands, is switched on. These are NOT beats: a camera move, a mood, a
person continuing to do what they were already doing, a reaction with nothing to
react to.

Count them before you write the scene. "She stirs the pot" is one beat and a dead
scene. "She stirs, the spoon catches, she looks up, the child is already holding
the lid out, she takes it without a word" is five, and it is the same ten seconds.

THE FIRST THREE SECONDS decide whether the film is watched at all. This is social
media: the viewer's thumb is already moving. Scene 1 opens ON an event — not on
an establishing shot, not on a landscape, not on someone walking into frame to
begin. Something is already happening when the film starts.

CONTINUOUS SHOTS: at most ${oneShotAllowance(scenes)} of this film's ${scenes}
scenes may be a single unbroken take, and only where the unbroken-ness IS the
content (a physical continuity you would lose by cutting). Every other scene
carries 2–4 hard cuts, each a complete moment with its own verb. A continuous
scene is still held to the ${MIN_BEATS_PER_SCENE}-beat floor — one shot, several
events.

${
  talks
    ? `TALK COUNTS, IF IT IS REALLY TALK. In this film people speak, so a scene may
run on conversation — but it has to be an actual exchange with something at stake:
an interruption, a disagreement, someone talking over someone, a question that
lands badly, a decision changing mid-sentence. Two people politely alternating
statements is not a beat, it is a pause with words in it. And even a talking scene
carries physical events underneath: hands do things while mouths move.`
    : `NOBODY SPEAKS IN THIS FILM, so every one of those beats must be VISIBLE.
There is no dialogue to carry a thin scene and no voiceover to explain it — the
narration is written later, against whatever you shot, and it cannot rescue a
scene where nothing happened. This makes the density law stricter here, not
looser: aim for the full ${TARGET_BEATS_PER_SCENE} physical events in every scene.`
}

WHAT PADDING LOOKS LIKE, so you can catch yourself doing it: the same beat shot
from a second angle; a person arriving somewhere they were already going; a slow
reveal of something we have already seen; "she looks at it thoughtfully". If a
beat can be cut without the film losing anything, it was never a beat.`;
}

// ─── THE GATES ──────────────────────────────────────────────────────────────

/**
 * Phrases that mean nothing happened. Drawn from the doctrine's own banned
 * vocabulary (§1.3) plus the failure the director actually reported.
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
];

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** How many discrete beats a storyline beat actually plans. */
function beatCount(beat) {
  const cuts = (beat?.cuts || []).filter((c) => c && String(c.shot || "").trim());
  if (cuts.length > 1) return cuts.length;
  // A single planned cut (or none) means the scene's density has to live in the
  // moment text, so count the sentences that carry a verb.
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
 * the storyline skill, and a fault the model cannot act on is a fault that ships.
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
 * guarantees. It is a backstop for the storyline gate, not a substitute.
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
  drawProvocation,
  conceptDirective,
  densityLaw,
  storylineDensityViolations,
  scenePromptDensityViolations,
  beatCount,
  oneShotAllowance,
  MIN_BEATS_PER_SCENE,
  TARGET_BEATS_PER_SCENE,
  DEAD_PHRASES,
  CREATIVE_ENGINES,
  STRUCTURAL_DEVICES,
  TONAL_SPICES,
  OPENING_HOOKS,
};
