// ─── OPTIQ STORY — THE STORY CRAFT MODULE ───────────────────────────────────
//
// The heart of the story sandbox. Nothing in functions/optiqSkills imports it and
// nothing here imports from there.
//
// Why this module exists.
//
// The ad swarm assumes an offering: there is a product, it is the hero, the last
// scene lands the brand. That assumption is what organises the whole film — it
// decides the arc, the final beat and what every scene is FOR.
//
// An ORIGINAL STORY has none of it. Strip the offering out of an ad pipeline and
// you do not get a short film — you get an ad with a hole in it, which is a mood
// reel. Something has to take the offering's place as the thing that organises
// the film, and that something is STRUCTURE: a hook, a want, a turn, a climax and
// a landing, all of them inside the run-time.
//
// So this module does the two things that were proven to work on the ad side,
// re-cut for stories:
//
//   THE PROVOCATION — dramatic engines, story shapes and cold-open hooks drawn
//     fresh per film. casting.js established the principle: a sterner instruction
//     cannot break convergence, but a different INPUT can. The ad swarm's comic
//     engines are tuned to land a product in thirty seconds; a story needs
//     engines that produce consequence, secrecy, debt and reversal.
//
//   THE GATES — the five obligations, checked in JS against the storyline's own
//     act tags before a single scene is built, plus an ad-purity gate that
//     catches any commercial reflex leaking into a film with nothing to sell.
//
// What this is NOT: a plot library. An engine says how a story generates its
// events; it never says what happens. Two films drawing "a debt nobody admits
// to" must still be unrelated films.

"use strict";

const { rngFor, pick, sample } = require("./rng");

// ─── THE PALETTES ───────────────────────────────────────────────────────────

/**
 * The machinery that generates a story's events.
 *
 * Deliberately different in kind from CREATIVE_ENGINES in ./creative.js. Those
 * are comic engines built to land a product in thirty seconds. These are
 * dramatic engines: each one carries an unresolved pressure that gets worse
 * every scene on its own, which is exactly what a film with no product to arrive
 * and fix things needs.
 */
const STORY_ENGINES = [
  "THE LIE THAT HAS TO BE MAINTAINED — somebody said something untrue for a decent reason, and every scene costs them more to keep it standing. The film ends when it falls or when we see what holding it up has cost.",
  "THE DEBT NOBODY ADMITS TO — one person owes another something (money, a favour, an apology) and neither will name it. Every ordinary interaction is really about the debt.",
  "THE THING TAKEN WITHOUT ASKING — borrowed, pocketed, used 'just this once'. The whole film is the race to put it back before it is missed, and the race is lost or won in the last scene.",
  "SOMEBODY IS ABOUT TO FIND OUT — the audience knows before the characters do. The tension is not the secret, it is watching the moment approach.",
  "THE PROMISE MADE TOO EASILY — a small promise made without thinking becomes very hard to keep. Keeping it is the story; what it costs is the ending.",
  "TWO PEOPLE WHO CANNOT SAY THE THING — a parent and a child, two old friends, a couple. They talk around it for the whole film. One of them nearly says it.",
  "THE OUTSIDER WHO WILL NOT LEAVE — someone belongs here less than everyone else and refuses to go. Either the place changes or they do.",
  "THE INHERITANCE — something is left behind (a trade, a tool, a shop, a name) and somebody has to decide whether to carry it. They decide on camera.",
  "THE SUBSTITUTION — one thing is quietly swapped for another and everyone must be prevented from noticing. It gets harder every scene.",
  "THE LAST DAY — this is the final time something will happen, and only one person in the film knows it.",
  "THE WITNESS WHO SHOULD SPEAK — somebody saw something. Saying so costs them. Not saying so costs somebody else.",
  "THE RIVAL WHO IS BETTER — the person we are rooting for is genuinely outmatched. They do not become better; they find another way, or they lose honestly.",
  "THE FAVOUR THAT WAS NOT A FAVOUR — an act of generosity turns out to have a hook in it. The film is the moment the hook is felt.",
  "THE THING THAT WAS ALWAYS GOING TO BREAK — an object, a routine, a relationship held together by effort. We watch the effort, then we watch it stop being enough.",
  "SOMEBODY IS PRETENDING TO BE FINE — and the film is the specific, physical, entirely non-verbal evidence that they are not, building until one small thing breaks it open.",
  "THE WRONG PERSON GETS THE CREDIT — and the right person watches it happen and has to decide, in the last scene, what to do about it.",
  "A KINDNESS THAT CANNOT BE REPAID — someone does something too big to give back. The story is the recipient trying anyway.",
  "THE DEADLINE THAT IS SOMEBODY'S LIFE — a mundane clock (a bus, a closing office, a tide, a pot about to burn) is attached to something that genuinely matters.",
  "THE RETURN — somebody comes back after a long time to a place that carried on without them. Everything they do reveals how much has changed.",
  "THE TEST NOBODY ANNOUNCED — one character is quietly assessing another, who has no idea they are being assessed. The verdict lands in the final beat.",
];

/**
 * How the story is BUILT. Independent of the engine, so the same pressure can
 * come out as a countdown, a two-hander or a reversal and be three different
 * films.
 */
const STORY_SHAPES = [
  "ONE CONTINUOUS HOUR — the film is a single unbroken stretch of one day, scene to scene with no time jumps. Everything happens now.",
  "THE COUNTDOWN — a specific, visible deadline is stated in the first ten seconds and the whole film runs at it.",
  "THE TWO-HANDER — two people, one situation, start to finish. Everyone else is background. The film is what passes between them.",
  "THE OBJECT'S JOURNEY — we follow a thing, not a person. It changes hands, and every hand it passes through is a different life.",
  "THE REVERSAL — the film sets up who is strong and who is weak, then swaps them in the last third. The setup exists to be overturned.",
  "BOOKENDS — the first shot and the last shot are the same framing of the same place, and everything that matters is the difference between them.",
  "ONE PERSON, FOUR PLACES — a single character moving through a chain of locations, each one raising the pressure, converging on the last.",
  "THE PARALLEL — two separate strands cut against each other, apparently unrelated, until the final scene puts them in the same frame.",
  "IN AT THE END — open at the moment of maximum trouble, then run forward from there. No backstory is ever supplied.",
  "THE OVERHEARD FILM — the story belongs to people we barely see; we follow the person listening to it happen, and the last scene is what they do with it.",
  "THE ROUTINE, BROKEN — establish an exact daily pattern fast, then break it once, and follow only the break.",
  "THE THREE ATTEMPTS — somebody tries the same thing three times, differently, escalating. The third is the film.",
];

/** Emotional register, expressed as behaviour rather than adjective. */
const STORY_TONES = [
  "held-in — everyone in the film is behaving better than they feel, and it shows in their hands",
  "quick and dry — people are funny about serious things because that is how they cope",
  "tender without sentiment — nobody says anything loving and everything they do is",
  "tense underneath ordinary — the surface is a completely normal day",
  "warm and chaotic — a household where three things are happening at once and everybody is fine with it",
  "bruised and stubborn — somebody has had a bad year and is still going",
  "watchful — the film notices things the characters do not",
  "mischievous — somebody in this film is enjoying themselves at somebody else's expense",
  "matter-of-fact about something enormous — the scale is never acknowledged, which is what makes it land",
  "raw and immediate — no politeness, no distance, we are inside it",
];

/**
 * The first three seconds, drawn separately because a film can have a superb
 * engine and still open on an establishing shot, and an establishing shot is a
 * viewer who never sees the second scene.
 */
const STORY_HOOKS = [
  "OPEN ON SOMEBODY HIDING SOMETHING — hands are already concealing, burying, pocketing or covering when the film starts.",
  "OPEN MID-ARGUMENT — we arrive several sentences in and never learn how it began.",
  "OPEN ON THE DAMAGE — something is already broken, spilled, torn or missing, and someone is looking at it.",
  "OPEN ON A HAND THAT WILL NOT BE TAKEN — an offer being physically refused, in the first second.",
  "OPEN ON SOMEBODY RUNNING — already at full speed, already late, before we know for what.",
  "OPEN ON THE WRONG REACTION — somebody laughs at something nobody laughs at, or does not react to something enormous.",
  "OPEN ON A COUNT — money, tablets, days on a calendar, stock on a shelf. Counting means something is not enough.",
  "OPEN ON SOMEBODY BEING WATCHED — the first frame is a person unaware of the observer we can see.",
  "OPEN ON A DOOR ABOUT TO OPEN — someone is on the wrong side of it, doing something they should not be doing.",
  "OPEN ON THE LAST STEP OF SOMETHING — the final stitch, the last note counted, the lid going on. Completion, then interruption.",
];

/**
 * The creative provocation for one short film.
 *
 * `seed` is stable per film (the project id) so a retried generation chases the
 * same story rather than lurching into a different one halfway. Three engines,
 * not one: a single engine reads as an instruction to obey, whereas three force
 * a real choice — and the concept room is made to build a distinct story from
 * each so the losers exist in the open.
 */
function drawStoryProvocation(seed) {
  const rng = rngFor(seed, "story:");
  return {
    engines: sample(STORY_ENGINES, 3, rng),
    shape: pick(STORY_SHAPES, rng),
    tone: pick(STORY_TONES, rng),
    hook: pick(STORY_HOOKS, rng),
  };
}

// ─── THE FIVE OBLIGATIONS ───────────────────────────────────────────────────

/**
 * The acts a scene can be tagged with, in the order they must occur.
 *
 * Tagged rather than inferred because a JS gate cannot read a paragraph and tell
 * whether a story has a turn in it — but it can check that the storyline SAID
 * which scene is the turn, and that the turn is not scene one, and that the last
 * scene is a landing rather than another escalation. Making the model commit to
 * an act per scene is what makes the structure checkable at all.
 */
const ACTS = ["open", "want", "turn", "escalate", "climax", "land"];

/** Position (0–1) through the film where each act may legitimately sit. */
const ACT_WINDOWS = {
  open: [0, 0.25],
  want: [0, 0.5],
  turn: [0.15, 0.75],
  escalate: [0.15, 0.9],
  climax: [0.55, 1],
  land: [0.8, 1],
};

/**
 * The structure contract, injected into the concept room, the storyline skill,
 * the story doctor and every scene builder for this film kind.
 *
 * Deliberately written as a budget rather than a template: it says how many
 * scenes each act may have for THIS run-time, and refuses to say what happens in
 * them.
 */
function storyStructureLaw({ numScenes } = {}) {
  const scenes = numScenes || 6;
  const seconds = scenes * 10;
  const turnBy = Math.max(2, Math.round(scenes * 0.45));
  const climaxFrom = Math.max(2, Math.round(scenes * 0.7));

  return `═══ THE COMPLETE-STORY LAW — A WHOLE FILM, NOT A FRAGMENT ═══
This film is ${seconds} seconds long and it is a COMPLETE STORY. Beginning,
middle, end — and the end happens ON SCREEN, in the final scene, inside the
run-time. Not implied, not left open, not resolved by a caption or a fade. When
the film stops, the audience knows how it turned out.

A story with no ending is not a short story, it is a fragment, and a fragment is
what somebody paid for a whole film and did not get.

THE FIVE OBLIGATIONS. Every scene is tagged with the one it serves, in its "act"
field. All five must appear across the ${scenes} scenes:

  "open"     — scene 1 ONLY. Something is already wrong, strange, funny or urgent
               in the first frame, and it raises a question the viewer needs
               answered. No establishing shot, no landscape, no one walking into
               frame to begin, nobody waking up.
  "want"     — we learn who this is and what they are trying to get, WITHOUT
               anybody explaining it. Wanting is physical: reaching, checking,
               hiding, counting, going back for it.
  "turn"     — the story stops being the story we thought it was. Not a new
               event, a new SITUATION: the hidden thing is seen, the plan works
               and that is the problem, the helper becomes the obstacle, the cost
               is revealed. This must land by scene ${turnBy} at the latest.
  "escalate" — after the turn the film runs FASTER, not calmer. Pressure rises,
               options close, the cost goes up.
  "climax"   — the single biggest moment: the confrontation, the decision, the
               reveal, the collision. Scene ${climaxFrom} or later.
  "land"     — the FINAL scene, and only the final scene. The outcome, physical
               and on camera. Something is different from how it started and we
               watch it become different.

THE ENDING IS AN EVENT, NOT A MOOD. The final scene carries the same beat count
as every other scene in the film. "She smiles and the camera pulls back" is not
an ending, it is a film giving up. "She puts the empty tin back on the shelf,
turns it label-in so the dent doesn't show, and her daughter — who has been
watching from the doorway the whole time — hands her the last note" is an ending.

START LATER THAN YOU THINK. ${scenes} scenes is not tight, it is normal. The
mistake is spending scene 1 introducing somebody. Open after the setup has
already happened and let us catch up — a film that uses a whole scene on
introductions has thrown away a ${scenes}th of itself.${
    scenes >= 12
      ? `\n\nThis is a LONG film. That means a BIGGER story — more turns, more people, a
real second act with its own reversal — never the same story told more slowly. A
long film that drifts is worse than a short one that does, because it drifts for
longer.`
      : ""
  }`;
}

/**
 * What replaces "the product is the hero" for a film that has nothing to sell.
 *
 * Injected everywhere the ad pipeline would otherwise assert its commercial
 * purpose. Stated as a prohibition list because the swarm's default behaviour —
 * every prompt it has ever been tuned on — is to sell something.
 */
function noCommercialMandate() {
  return `═══ THIS IS NOT AN AD. THERE IS NOTHING TO SELL. ═══
This film is an ORIGINAL STORY, made to be watched for its own sake. There is no
client, no brand, no product, no service and no offering anywhere in it. Nothing
in this film is being advertised, demonstrated, recommended or launched.

NONE of the following may appear, in the storyline, in a scene prompt, or in the
finished frame:
• A product being sold, held up, hero-shot, or turned label-out to camera.
• A logo, wordmark, brand card, end card, title card or closing plate.
• A tagline, slogan, strapline or call to action.
• A narrator or voiceover explaining the film (the only words are the characters'
  own, spoken on camera).
• A scene whose PURPOSE is "proof", "benefit", "demonstration", "the brand lands"
  or "the payoff" in the commercial sense.
• The words customer, client, offering, solution, brand, or any sentence that
  reads like copy.

Props are not products. A tin, a phone, a dress, a boat, a bag of rice — a story
needs objects and they must stay visually consistent, exactly like any other
locked element. The test is: is the camera showing this object TO THE CHARACTERS,
or TO THE AUDIENCE? Shown to the audience, it is an ad shot. Cut it.

The story is the hero. Nothing else is.`;
}

// ─── THE GATES ──────────────────────────────────────────────────────────────

function normalize(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The act a beat claims, defaulting safely when a model omits the field. */
function beatAct(beat) {
  const raw = String(beat?.act || "").toLowerCase().trim();
  return ACTS.includes(raw) ? raw : null;
}

/**
 * Structural faults in a storyline, checked BEFORE any scene is built.
 *
 * The cheapest place in the pipeline to fix a film with no ending: caught here
 * it is one repair call, caught after the scenes are built it is N rebuilds of
 * 2,000 words each, and caught after rendering it is the director's money.
 *
 * Returned as repair instructions rather than booleans — they go straight back
 * to the story doctor, and a fault the model cannot act on is a fault that ships.
 */
function storyStructureViolations(storyline, { numScenes } = {}) {
  const beats = (storyline?.sceneBeats || []).filter(Boolean);
  const violations = [];
  if (beats.length === 0) return violations;

  const total = numScenes || beats.length;
  const ordered = [...beats].sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
  const acts = ordered.map((b) => beatAct(b));

  // Every scene has to declare which obligation it serves. An untagged scene is
  // a scene nobody decided the purpose of, which is how middles rot.
  const untagged = ordered.filter((b) => !beatAct(b)).map((b) => b.sceneNumber ?? "?");
  if (untagged.length > 0) {
    violations.push(
      `Scene(s) ${untagged.join(", ")} carry no "act" tag. Every scene must declare which of the five ` +
        `obligations it serves — one of ${ACTS.map((a) => `"${a}"`).join(", ")} — so the film can be checked ` +
        `for a beginning, a turn and an ending. Tag every scene.`
    );
  }

  // The opening.
  if (acts[0] && acts[0] !== "open") {
    violations.push(
      `Scene 1 is tagged "${acts[0]}", but the first scene of a short film is always the "open": something already ` +
        `wrong, strange, funny or urgent in the first frame, raising a question the viewer needs answered. Re-tag it ` +
        `and rewrite it to open ON an event.`
    );
  }

  // The ending — the failure this whole gate exists for.
  const last = ordered[ordered.length - 1];
  if (beatAct(last) !== "land") {
    violations.push(
      `The final scene (scene ${last?.sceneNumber ?? total}) is tagged "${beatAct(last) || "nothing"}", so this film ` +
        `does not end — it stops. The last scene must be the "land": the outcome, physical and on camera, showing ` +
        `what is different now. Rewrite it as an EVENT with the same beat count as every other scene. A smile, a ` +
        `look, a pull-back or a fade is not an ending.`
    );
  }
  const landings = acts.filter((a) => a === "land").length;
  if (landings > 1) {
    violations.push(
      `${landings} scenes are tagged "land". A film has exactly one ending, and it is the last scene. Re-tag the ` +
        `others as "escalate" or "climax" and make sure they still raise the pressure rather than resolving it early.`
    );
  }

  // The turn — the middle's spine.
  const turnIdx = acts.indexOf("turn");
  if (turnIdx === -1) {
    violations.push(
      `No scene is tagged "turn", so this story never stops being the story it started as — which is the definition ` +
        `of a middle that sags. Choose the scene where the situation genuinely changes (the hidden thing is seen, ` +
        `the plan works and that is the problem, the helper becomes the obstacle, the cost is revealed) and rewrite ` +
        `it to carry that change.`
    );
  } else {
    const latestTurn = Math.max(2, Math.round(total * 0.45));
    if (turnIdx + 1 > latestTurn) {
      violations.push(
        `The turn does not arrive until scene ${turnIdx + 1} of ${total}, which leaves no room to escalate or land. ` +
          `Move it to scene ${latestTurn} at the latest.`
      );
    }
    if (turnIdx === 0) {
      violations.push(
        `Scene 1 is the turn, which means the film turns before we know what it is turning from. Scene 1 opens the ` +
          `story; the turn comes after we understand what is at stake.`
      );
    }
  }

  // The climax, and where it may sit.
  const climaxIdx = acts.indexOf("climax");
  if (climaxIdx === -1 && total >= 4) {
    violations.push(
      `No scene is tagged "climax". Every story has one biggest moment — a confrontation, a decision, a reveal, a ` +
        `collision. Name which scene it is and make sure it is the loudest thing in the film.`
    );
  } else if (climaxIdx !== -1) {
    const earliest = Math.max(2, Math.round(total * 0.7));
    if (climaxIdx + 1 < earliest) {
      violations.push(
        `The climax is at scene ${climaxIdx + 1} of ${total}, so the film peaks early and then has ` +
          `${total - climaxIdx - 1} scenes of aftermath. Move it to scene ${earliest} or later and let what comes ` +
          `before it escalate.`
      );
    }
  }

  // Longer films need a real second act rather than a longer first one.
  if (total >= 6 && !acts.includes("escalate")) {
    violations.push(
      `No scene is tagged "escalate". After the turn a short film must run FASTER, not calmer — pressure rising, ` +
        `options closing, the cost going up. A film that goes turn → climax with nothing between them has no middle.`
    );
  }

  // The stated ending, which is what the "land" scene is measured against.
  const ending = normalize(storyline?.theEnding);
  if (!ending) {
    violations.push(
      `The storyline does not say how the film ends ("theEnding" is empty). State the OUTCOME in physical terms — ` +
        `what is different, and how we see that it is different.`
    );
  } else if (/feel|realis|realiz|understand|learn|appreciate|at peace|content|hopeful|inspired|happy|better/.test(ending) &&
             !/hands|takes|puts|gives|leaves|walks|drops|opens|closes|pays|hands over|throws|returns|breaks|locks|burns|tears/.test(ending)) {
    violations.push(
      `The ending is written as a feeling ("${String(storyline?.theEnding).slice(0, 100)}"), not an event. An ` +
        `audience cannot watch somebody realise something. Replace it with the physical thing that happens in the ` +
        `final scene, from which the feeling follows.`
    );
  }

  // Stakes. Without them the film is a schedule.
  if (!normalize(storyline?.whatIsAtStake)) {
    violations.push(
      `The storyline does not say what is at stake. Name the specific thing this person loses if it goes wrong — ` +
        `the school fees this Friday, the borrowed dress, the neighbour finding out — in their own life, on their ` +
        `own terms. "Her future" is not a stake.`
    );
  }

  return violations;
}

// ─── AD-PURITY ──────────────────────────────────────────────────────────────

/**
 * Commercial reflexes, as phrases.
 *
 * Phrases rather than single words on purpose: a short film may perfectly well
 * contain a shop, a sign, a price or a customer buying fish, and a gate that
 * flagged those would fire on every market scene in the library. What is being
 * caught is the pipeline's ad grammar — the closing brand plate, the hero shot,
 * the tagline — leaking into a film that has nothing to sell.
 */
const AD_PHRASES = [
  "tagline",
  "call to action",
  "brand card",
  "end card",
  "logo card",
  "logo animation",
  "closing logo",
  "brand logo",
  "wordmark",
  "hero shot of the product",
  "product hero",
  "hero the product",
  "packshot",
  "pack shot",
  "product shot",
  "label turns to camera",
  "label turned to camera",
  "land the brand",
  "the brand lands",
  "brand reveal",
  "the offering",
  "the product is the hero",
  "voiceover",
  "voice-over",
  "narrator",
  "narration",
  "sales pitch",
  "advertisement",
  "commercial for",
  "unique selling",
  "the client's",
  "our customers",
  "strapline",
];

/**
 * Ad language in a STORYLINE. Checked on the beats' purposes and moments, where
 * a fix is one repair call.
 */
function storyPurityViolations(storyline) {
  const violations = [];
  const beats = (storyline?.sceneBeats || []).filter(Boolean);

  for (const beat of beats) {
    const text = normalize(
      `${beat.purpose || ""} ${beat.moment || ""} ${(beat.cuts || []).map((c) => c?.shot || "").join(" ")}`
    );
    const hits = AD_PHRASES.filter((p) => text.includes(p));
    if (hits.length > 0) {
      violations.push(
        `Scene ${beat.sceneNumber ?? "?"} is written like an ad (${hits.map((h) => `"${h}"`).join(", ")}). This film ` +
          `has no brand, no product and nothing to sell — there is no logo, no tagline, no voiceover and no closing ` +
          `plate anywhere in it. Replace that beat with something that happens in the story.`
      );
    }
    if (beat.productPresent === true) {
      violations.push(
        `Scene ${beat.sceneNumber ?? "?"} sets productPresent = true. There is no product in this film. Set it false ` +
          `on every scene; objects the story needs are ELEMENTS, not products.`
      );
    }
  }

  const spine = normalize(`${storyline?.concept || ""} ${storyline?.storyPitch || ""} ${storyline?.storyArc || ""}`);
  const spineHits = AD_PHRASES.filter((p) => spine.includes(p));
  if (spineHits.length > 0) {
    violations.push(
      `The storyline itself carries advertising language (${spineHits.map((h) => `"${h}"`).join(", ")}). Rewrite the ` +
        `concept, pitch and arc as a story about people, with nothing being promoted.`
    );
  }

  return violations;
}

/**
 * Ad language in a BUILT scene prompt.
 *
 * Narrower than the storyline gate: a 2,000-word prompt describing a real place
 * legitimately mentions signage and shopfronts, so only the phrases that can
 * ONLY mean "this is an advert" are caught here.
 */
const SCENE_AD_PHRASES = [
  "tagline",
  "call to action",
  "brand card",
  "end card",
  "logo card",
  "closing logo",
  "brand reveal",
  "packshot",
  "pack shot",
  "product hero",
  "hero shot of the product",
  "land the brand",
  "voiceover",
  "voice-over",
  "narrator",
  "strapline",
];

function scenePurityViolations(scene) {
  const prompt = normalize(scene?.fullPrompt);
  if (!prompt) return [];
  const hits = SCENE_AD_PHRASES.filter((p) => prompt.includes(p));
  if (hits.length === 0) return [];
  return [
    `The prompt contains advertising apparatus (${hits.map((h) => `"${h}"`).join(", ")}) in a film that has nothing ` +
      `to sell. Remove it entirely — no logo, no tagline, no brand plate, no narrator and no voiceover. The only ` +
      `words in this film are the characters' own, spoken on camera.`,
  ];
}

module.exports = {
  drawStoryProvocation,
  storyStructureLaw,
  noCommercialMandate,
  storyStructureViolations,
  storyPurityViolations,
  scenePurityViolations,
  beatAct,
  ACTS,
  ACT_WINDOWS,
  STORY_ENGINES,
  STORY_SHAPES,
  STORY_TONES,
  STORY_HOOKS,
  AD_PHRASES,
};
