// ─── OPTIQ DOCUMENTARY — THE DOCUMENTARY CRAFT MODULE ───────────────────────
//
// The heart of the documentary sandbox. Nothing in functions/optiqSkills or
// functions/optiqStory imports it, and nothing here imports from either of them.
//
// Why this module exists.
//
// The ad swarm is organised by an OFFERING: there is a product, it is the hero,
// the last scene lands the brand. The story sandbox replaced that with DRAMA: a
// hook, a want, a turn, a climax, a landing, all carried by characters who speak
// on camera.
//
// A DOCUMENTARY has neither. Nothing is being sold, and nobody speaks: the
// footage is silent and illustrative, and every word in the finished film is
// narration recorded afterwards and laid over the cut. Strip the drama out of a
// story pipeline and you do not get a documentary — you get a mood reel with a
// voice on it, which is the single most common failure of this format.
//
// So something has to take the offering's place, and for a documentary that
// something is an ARGUMENT: a thesis, a question the film owes an answer to,
// evidence that accumulates, a complication that stops it being simple, and a
// close that actually lands the answer inside the run-time.
//
// The two mechanisms are the ones proven on the other two sandboxes, re-cut:
//
//   THE PROVOCATION — angles, shapes, tones and cold opens drawn fresh per film,
//     because identical inputs land a sampler in the same basin every run. An
//     ANGLE says how the film looks at its subject; it never says what the
//     subject is. Two films drawn on "the cost nobody counts" must still be
//     unrelated films.
//
//   THE GATES — the obligations, checked in JS against the outline's own act
//     tags before a single scene is built, plus a purity gate that catches the
//     three reflexes this format is prone to: writing an advert, writing a drama
//     with speaking characters, and putting words on the screen.

"use strict";

const { rngFor, pick, sample } = require("./rng");

// ─── THE PALETTES ───────────────────────────────────────────────────────────

/**
 * The ANGLE — how this film looks at whatever it is about.
 *
 * The equivalent of the story sandbox's dramatic engines, and the fix for the
 * same failure in a different costume. A documentary brief arrives as a SUBJECT
 * ("the fish market", "how salt is made", "my grandmother's village"), and a
 * subject is not a film. The angle is what turns a subject into something with a
 * spine: it decides what the film notices, and therefore what it can conclude.
 */
const DOC_ANGLES = [
  "THE THING EVERYONE WALKS PAST — the subject is completely ordinary to the people around it, and the film's whole job is to make the audience see it for the first time. Nobody in frame finds any of this remarkable.",
  "THE COST NOBODY COUNTS — something works, and the film shows what is quietly spent to make it work: hours, bodies, materials, patience. The close is the size of the bill.",
  "WHAT IT TAKES TO MAKE ONE — follow a single finished thing all the way back to its beginning. The film is the distance between the two.",
  "THE PERSON BEHIND THE OBJECT — start with a thing everyone uses and end on the specific pair of hands that made it. Never the other way round.",
  "THE DAY IT CHANGED — a place is doing what it has always done, and one specific change has arrived. The film holds both in the same frames.",
  "THE OLD WAY AND THE NEW WAY, SIDE BY SIDE — two methods of doing the same job coexist in the same street. The film does not take a side; it shows the trade.",
  "THE RULE NOBODY WROTE DOWN — a place runs on an unwritten system everybody obeys. The film reveals the system by showing it being followed.",
  "WHAT HAPPENS AFTER EVERYONE LEAVES — the film is about the part of this nobody sees: the clean-up, the night shift, the empty version.",
  "THE WORK THAT IS INVISIBLE BECAUSE IT WORKS — a thing that only gets noticed when it fails. The film notices it while it is still working.",
  "THE THING THAT IS DISAPPEARING WHILE WE WATCH — this is one of the last of something. Said once, shown throughout, never mourned out loud.",
  "THE SCALE NOBODY PICTURES — the subject is a number until you see it stacked, queued, poured, carried or counted. The film makes the number physical.",
  "WHAT IT LOOKS LIKE FROM THE OTHER SIDE — take the familiar view of something and spend the whole film on the view nobody is shown.",
  "THE SMALL DETAIL THAT EXPLAINS THE WHOLE SYSTEM — one tiny, specific, physical thing (a mark, a knot, a colour, a place in a queue) turns out to be the key to how all of it works.",
  "THE CYCLE — the subject runs on a season, a tide, a week or a shift, and the film is one full turn of it.",
  "WHO GETS TO DECIDE — somewhere in this process a decision is made, and the film finds the exact moment and the exact hands that make it.",
  "THE ONE WHO STAYED — everyone else moved on from this and somebody did not. The film is what that looks like day to day.",
  "WHAT IT COSTS TO GET IT HERE — the journey of a thing from where it starts to where it is used, and every pair of hands in between.",
  "THE REPAIR — nothing here is new; everything is mended, adapted and re-used. The film is a study in keeping things alive.",
];

/**
 * How the film is BUILT. Independent of the angle, so the same angle can come
 * out as a process, a day or a chain and be three different films.
 */
const DOC_SHAPES = [
  "THE PROCESS — follow the thing from raw to finished, roughly one step per scene, in order. The close is the finished thing in use.",
  "THE DAY — first light to dark, in order, in one place. The clock is the structure.",
  "THE CHAIN — every scene hands over to the next link. Somebody finishes and somebody else starts.",
  "THE SCALE LADDER — open on one pair of hands, then one room, then one street, then the whole thing. Or run it exactly backwards.",
  "THE THREE PLACES — the same activity in three different settings, cut against each other, converging in the last scene.",
  "THEN AND NOW — the old method and the current one, alternating, and the final scene puts both in one frame.",
  "THE JOURNEY — follow one thing along an actual route, geographically, start to destination.",
  "THE INVENTORY — the tools, the objects, the materials. Each scene is a thing, and together they describe a life.",
  "THE ZOOM IN — begin with the phenomenon at its widest and finish on one entirely specific person's hands doing one entirely specific task.",
  "BEFORE AND AFTER — one event splits the film. The first half is the preparation, the second is the consequence.",
  "THE SEASON — a full cycle: planting to harvest, dry to rains, empty to full.",
  "ONE PLACE, EIGHT ANGLES — the film never leaves a single location and finds a completely different film in each corner of it.",
];

/** Register, expressed as behaviour rather than adjective. */
const DOC_TONES = [
  "plain and unhurried — the pictures are trusted, and the narration says less than it could",
  "cool and precise — the tone of somebody counting, with no adjectives in the way",
  "warm and admiring, without flattery. Nobody is called a hero and everybody is treated as one",
  "urgent and close to the ground — present tense, right here, happening now",
  "wry — the film notices what is absurd about this and never once comments on it",
  "elegiac without sentiment — this is going, the film says so once, then gets on with looking at it",
  "curious and specific — the tone of someone who learned this last week and cannot wait to tell you",
  "steady and serious — no drama is added, because the subject does not need any",
  "matter-of-fact about something enormous — the scale is stated flatly, which is what makes it land",
];

/**
 * The first three seconds, drawn separately because a documentary can have a
 * superb angle and still open on an establishing drone shot, and an establishing
 * drone shot is a viewer who never sees the second scene.
 */
const DOC_OPENINGS = [
  "OPEN ON HANDS ALREADY WORKING — mid-task, mid-motion, no introduction, the work already well underway.",
  "OPEN ON THE LOUDEST, HOTTEST, WETTEST MOMENT of the whole process, out of order, before we know what it is.",
  "OPEN ON THE SCALE — hundreds or thousands of one thing, stacked, poured, spread or queued, filling the frame.",
  "OPEN ON A DETAIL nobody would notice: a worn groove, a mark, a repair, a stain. The film earns it back later.",
  "OPEN ON SOMETHING BEING DESTROYED OR USED UP — cut, split, burnt, emptied, broken open.",
  "OPEN ON A MEASUREMENT — something weighed, counted, marked, cut to length, checked against a line.",
  "OPEN ON THE CROWD THAT IS ALREADY THERE — before dawn, before opening, before anyone would expect it.",
  "OPEN ON THE EMPTY VERSION of a place we will later see full, with one person in it doing one small thing.",
  "OPEN ON SOMETHING GOING WRONG and being fixed, entirely, inside the first ten seconds.",
  "OPEN ON THE FINISHED THING, in use, ordinary — then spend the rest of the film on where it came from.",
];

/**
 * The creative provocation for one documentary.
 *
 * `seed` is stable per film (the project id) so a retried generation chases the
 * same film rather than lurching into a different one halfway. Three angles, not
 * one: a single angle reads as an instruction to obey, whereas three force a
 * real choice — and the concept room is made to build a distinct film from each
 * so the losers exist in the open.
 */
function drawDocumentaryProvocation(seed) {
  const rng = rngFor(seed, "doc:");
  return {
    angles: sample(DOC_ANGLES, 3, rng),
    shape: pick(DOC_SHAPES, rng),
    tone: pick(DOC_TONES, rng),
    opening: pick(DOC_OPENINGS, rng),
  };
}

// ─── THE OBLIGATIONS ────────────────────────────────────────────────────────

/**
 * The acts a documentary scene can be tagged with, in the order they occur.
 *
 * Tagged rather than inferred, for the same reason the story sandbox tags its
 * five: a JS gate cannot read a paragraph and decide whether a film has a
 * complication in it, but it can check that the outline SAID which scene is the
 * complication, that it is not scene one, and that the last scene closes rather
 * than adding more evidence.
 *
 *   open      — the hook. An event, already happening, in the first frame.
 *   question  — what this film is actually about. The thing it owes an answer to.
 *   context   — what you have to know to care. Rationed.
 *   evidence  — the body of the film. The specifics that build the case.
 *   turn      — the complication. The reason this is not simple.
 *   close     — the answer, landed physically, in the final scene.
 */
const ACTS = ["open", "question", "context", "evidence", "turn", "close"];

/** Position (0–1) through the film where each act may legitimately sit. */
const ACT_WINDOWS = {
  open: [0, 0.2],
  question: [0, 0.45],
  context: [0, 0.6],
  evidence: [0.1, 0.95],
  turn: [0.35, 0.85],
  close: [0.8, 1],
};

/**
 * The structure contract, injected into the concept room, the outline skill, the
 * outline doctor and every scene builder.
 *
 * Written as a budget rather than a template: it says what the film owes for
 * THIS run-time and refuses to say what is in it.
 */
function documentaryStructureLaw({ numScenes } = {}) {
  const scenes = numScenes || 6;
  const seconds = scenes * 10;
  const turnFrom = Math.max(2, Math.round(scenes * 0.4));
  const evidenceFloor = Math.max(1, Math.round(scenes * 0.35));
  const contextCap = Math.max(1, Math.round(scenes * 0.2));

  return `═══ THE ARGUMENT LAW — A DOCUMENTARY IS NOT A SUBJECT ═══
This film is ${seconds} seconds long and it is a COMPLETE DOCUMENTARY. It opens on
something, it asks something, it shows you enough to answer it, and it ANSWERS IT
before it stops — inside the run-time, on screen, in the final scene.

THE FAILURE THIS LAW EXISTS TO PREVENT: a film that is ABOUT something instead of
SAYING something. "A film about the fish market" is not a film, it is a location
with a camera in it — ${scenes} beautiful shots in no particular order, ending
because the run-time ended. Every one of those shots could be swapped with any
other and nothing would change. That is the test, and it is the one this format
fails most often.

THE THESIS. Before anything else, commit to ONE SENTENCE this film is going to
land: the thing the audience did not know, or did not see, or had not put
together. Write it down. It is not a topic ("salt production in The Gambia"), it
is a claim you could be wrong about ("the hard part of salt is not making it, it
is carrying it"). Every scene either builds toward that sentence or is cut.

THE OBLIGATIONS. Every scene is tagged with the one it serves, in its "act" field:

  "open"     — scene 1 ONLY. An event already in progress in the first frame,
               raising a question the viewer needs answered. NEVER an establishing
               shot, a landscape, a drone move over a place, a sunrise or a title.
  "question" — the film shows what it is really about. Not by captioning it: by
               showing the specific physical thing that makes the question
               unavoidable.
  "context"  — what the audience must know to care. Rationed: at most
               ${contextCap} scene(s) in a ${scenes}-scene film. Context is where
               documentaries go to die.
  "evidence" — the body. Specific, physical, particular things that build the
               case. At least ${evidenceFloor} of this film's scenes are evidence,
               and no two of them may make the SAME point twice.
  "turn"     — the complication: the reason this is not as simple as it looked.
               The cost, the disagreement, the thing being lost, the part that
               does not fit. Scene ${turnFrom} or later. A documentary with no
               complication is a brochure.
  "close"    — the FINAL scene, and only the final scene. It lands the thesis
               PHYSICALLY: the finished thing in use, the boat leaving, the last
               one going into the box, the light going off, the hands stopping.

THE CLOSE IS AN EVENT, NOT A SUMMARY. The last scene carries the same beat count
as every other scene. "A wide shot of the market at sunset as the day ends" is
not a close, it is a film running out. "The last basket goes onto the truck, the
tailgate slams, and the woman who filled it sits down on the empty crate for the
first time in the film" is a close.

ORDER IS AN ARGUMENT. Scenes are not interchangeable. Scene 4 is where it is
because of what scene 3 showed. If you can shuffle your outline and it reads the
same, you have a slideshow — go back and make each scene depend on the one before
it.${
    scenes >= 12
      ? `\n\nThis is a LONG film. That means MORE ARGUMENT, never the same argument at a
slower pace: a second strand, a further complication, somewhere the film goes
that the first half did not prepare you for. A long documentary that drifts is
worse than a short one that does, because it drifts for longer.`
      : ""
  }`;
}

/**
 * What replaces "the product is the hero" for a film with nothing to sell.
 *
 * Injected everywhere the ad pipeline would otherwise assert its commercial
 * purpose. Stated as a prohibition list because the swarm's default behaviour —
 * every prompt it has ever been tuned on — is to sell something.
 *
 * Note the one deliberate difference from the story sandbox's twin: a narrator
 * is NOT forbidden here. A documentary is narrated by design. What is forbidden
 * is a narrator who is selling.
 */
function noSellingMandate() {
  return `═══ THIS IS NOT AN AD. THERE IS NOTHING TO SELL. ═══
This film is a DOCUMENTARY. There is no client, no brand, no product, no service
and no offering anywhere in it. Nothing is being advertised, demonstrated,
recommended or launched, and the narration is NOT a sales script.

NONE of the following may appear, in the outline, in a scene prompt, in the
narration, or in the finished frame:
• A product being sold, held up, hero-shot, or turned label-out to camera.
• A logo, wordmark, brand card, end card, title card or closing plate.
• A tagline, slogan, strapline or call to action ("visit", "try", "discover
  today", "get yours").
• A scene whose PURPOSE is "proof", "benefit", "demonstration" or "the brand
  lands" in the commercial sense.
• The words customer, client, offering, solution, brand, or any sentence that
  reads like copy.

Objects are SUBJECTS, not products. A boat, a knife, a sack, a machine, a
handmade thing — a documentary is full of objects, and looking at one closely and
honestly is the opposite of a hero shot. The test: is the camera showing this
object as part of the WORLD, or presenting it to the AUDIENCE the way an advert
does? Presented, it is an ad shot. Cut it.

The subject is the hero. Nothing else is.`;
}

/**
 * The other half of what makes this sandbox different: the footage is SILENT and
 * the film's words arrive later.
 *
 * This is the rule that most needs repeating, because the swarm's whole training
 * — and both of its sibling sandboxes — writes people who talk.
 */
function narratedFilmMandate() {
  return `═══ NOBODY SPEAKS ON CAMERA. THE FILM IS NARRATED. ═══
Every word in the finished documentary is VOICEOVER, written and recorded AFTER
the footage exists and laid over the cut. The clips themselves are silent of
speech. That has hard consequences for everything you write:

• NO DIALOGUE. Not a line, not a word, not a greeting, not a shout across a room.
  No character speaks and no scene contains a conversation.
• NO LIPS MOVING IN SPEECH. Not talking, not mouthing, not mid-sentence, not
  "saying something to the man beside her". People in this film work, carry,
  laugh, listen, react, gesture and get on with it — with their mouths closed. A
  face caught mid-word is an unusable shot, because narration will be playing
  over it and the audience will see the mismatch.
• NO TALKING HEADS. No interviews, nobody sitting facing the camera answering a
  question, no piece to camera, no expert at a desk. This is the reflex the word
  "documentary" triggers and it is unusable here: the footage has no speech.
• NO ON-SCREEN TEXT. No captions, no lower thirds, no names, no dates, no
  statistics, no charts, no labelled maps, no subtitles, no title cards. The
  video model renders text as garbled shapes, and a documentary that leans on
  captions has given up on its pictures.
• THE PICTURE CARRIES THE MEANING ALONE. Write every scene so it reads with the
  sound off, because that is exactly how it will be shot. If a beat only works
  because somebody explains it, it is not a beat yet.

What the clip DOES carry: the real diegetic sound of the physical events in
frame, and the location's ambience. Nothing else.`;
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
 * Structural faults in an outline, checked BEFORE any scene is built.
 *
 * The cheapest place in the pipeline to fix a film with no argument: caught here
 * it is one repair call, caught after the scenes are built it is N rebuilds of
 * 2,000 words each, and caught after rendering it is the director's money.
 *
 * Returned as repair instructions rather than booleans — they go straight back to
 * the outline doctor, and a fault the model cannot act on is a fault that ships.
 */
function documentaryStructureViolations(outline, { numScenes } = {}) {
  const beats = (outline?.sceneBeats || []).filter(Boolean);
  const violations = [];
  if (beats.length === 0) return violations;

  const total = numScenes || beats.length;
  const ordered = [...beats].sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
  const acts = ordered.map((b) => beatAct(b));

  const untagged = ordered.filter((b) => !beatAct(b)).map((b) => b.sceneNumber ?? "?");
  if (untagged.length > 0) {
    violations.push(
      `Scene(s) ${untagged.join(", ")} carry no "act" tag. Every scene must declare which obligation it serves — ` +
        `one of ${ACTS.map((a) => `"${a}"`).join(", ")} — so the film can be checked for an opening, an argument ` +
        `and a close. Tag every scene.`
    );
  }

  // The opening.
  if (acts[0] && acts[0] !== "open") {
    violations.push(
      `Scene 1 is tagged "${acts[0]}", but the first scene of a documentary is always the "open": an event already ` +
        `in progress in the first frame, raising a question the viewer needs answered. Re-tag it and rewrite it to ` +
        `open ON an event — never an establishing shot, a landscape or a drone move.`
    );
  }

  // The close — the failure this gate mostly exists for.
  const last = ordered[ordered.length - 1];
  if (beatAct(last) !== "close") {
    violations.push(
      `The final scene (scene ${last?.sceneNumber ?? total}) is tagged "${beatAct(last) || "nothing"}", so this film ` +
        `does not end — it stops. The last scene must be the "close": the thesis landed physically, on camera, as an ` +
        `EVENT with the same beat count as every other scene. A wide shot at sunset is not a close.`
    );
  }
  const closes = acts.filter((a) => a === "close").length;
  if (closes > 1) {
    violations.push(
      `${closes} scenes are tagged "close". A film closes once, in its last scene. Re-tag the others as "evidence" ` +
        `or "turn" and make sure they still advance the argument rather than concluding it early.`
    );
  }

  // The question — what stops it being a topic.
  if (total >= 3 && !acts.includes("question")) {
    violations.push(
      `No scene is tagged "question", so this film never shows what it is actually about — it is a subject with ` +
        `footage attached. Choose the early scene that makes the film's real question unavoidable, and show the ` +
        `specific physical thing that raises it.`
    );
  }

  // The complication.
  const turnIdx = acts.indexOf("turn");
  if (total >= 5 && turnIdx === -1) {
    violations.push(
      `No scene is tagged "turn". A documentary with no complication is a brochure: somewhere in this there is a ` +
        `cost, a disagreement, a thing being lost, or a part that does not fit. Find it, give it a scene, and put ` +
        `that scene in the back half.`
    );
  } else if (turnIdx !== -1) {
    const earliest = Math.max(2, Math.round(total * 0.4));
    if (turnIdx + 1 < earliest) {
      violations.push(
        `The complication arrives at scene ${turnIdx + 1} of ${total}, before the film has shown enough for it to ` +
          `complicate anything. Move it to scene ${earliest} or later and let the evidence build first.`
      );
    }
  }

  // Evidence: the body of the film.
  const evidence = acts.filter((a) => a === "evidence").length;
  const evidenceFloor = Math.max(1, Math.round(total * 0.35));
  if (evidence < evidenceFloor) {
    violations.push(
      `Only ${evidence} scene(s) are tagged "evidence", and a ${total}-scene documentary needs at least ` +
        `${evidenceFloor}. Evidence IS the film: specific, physical, particular things that build the case. ` +
        `Re-tag or rewrite scenes so the body of the film is actually showing us something.`
    );
  }

  // Context, rationed.
  const context = acts.filter((a) => a === "context").length;
  const contextCap = Math.max(1, Math.round(total * 0.2));
  if (context > contextCap) {
    violations.push(
      `${context} scenes are tagged "context" and at most ${contextCap} may be in a ${total}-scene film. Context is ` +
        `where documentaries go to die — an audience accepts far less setup than you think. Convert the extra ` +
        `scenes into evidence: show the specific thing instead of explaining the background to it.`
    );
  }

  // The thesis, which the close is measured against.
  const thesis = normalize(outline?.thesis);
  if (!thesis) {
    violations.push(
      `The outline has no thesis. State, in ONE sentence, the thing this film is going to land — something you could ` +
        `be wrong about, not a topic. "How salt is made" is a topic; "the hard part of salt is not making it, it is ` +
        `carrying it" is a thesis.`
    );
  } else if (thesis.split(" ").filter(Boolean).length < 6) {
    violations.push(
      `The thesis ("${String(outline?.thesis).slice(0, 80)}") is a label, not a claim. Write the full sentence the ` +
        `film is arguing, in plain words.`
    );
  }

  // How it closes, in physical terms.
  const close = normalize(outline?.theClose);
  if (!close) {
    violations.push(
      `The outline does not say how the film closes ("theClose" is empty). State the physical event in the final ` +
        `scene — what happens, what stops, what leaves, what is finished — from which the thesis lands.`
    );
  } else if (
    /feel|realis|realiz|understand|appreciate|reflect|sense of|beauty of|reminder/.test(close) &&
    !/hands|takes|puts|lifts|carries|closes|leaves|loads|slams|pours|cuts|stops|switches|locks|empties|hauls|ties/.test(close)
  ) {
    violations.push(
      `The close is written as a feeling ("${String(outline?.theClose).slice(0, 100)}"), not an event. An audience ` +
        `cannot watch somebody appreciate something. Replace it with the physical thing that happens in the final ` +
        `scene, from which the feeling follows.`
    );
  }

  return violations;
}

// ─── PURITY ─────────────────────────────────────────────────────────────────

/**
 * Commercial reflexes, as phrases.
 *
 * Phrases rather than single words on purpose: a documentary may perfectly well
 * be about a shop, a price, a market or somebody buying fish, and a gate that
 * flagged those would fire on every film this sandbox makes. What is caught is
 * the pipeline's ad GRAMMAR — the closing brand plate, the hero shot, the
 * tagline — leaking into a film with nothing to sell.
 *
 * Deliberately WITHOUT "narrator", "voiceover" and "narration", which the story
 * sandbox bans: this film is narrated by design, and those words appear all over
 * its prompts as legitimate instructions ("no speech — narration is added
 * separately"). Banning them here would fail every scene in the film.
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
  "sales pitch",
  "advertisement",
  "commercial for",
  "unique selling",
  "the client's",
  "our customers",
  "strapline",
];

/**
 * Speech reflexes. The footage is silent, so any of these in an outline is a
 * scene that comes back unusable — a mouth moving under a voiceover.
 */
const SPEECH_PHRASES = [
  "says to",
  "tells her",
  "tells him",
  "tells the",
  "shouts to",
  "shouts at",
  "calls out to",
  "asks her",
  "asks him",
  "asks the",
  "replies",
  "answers him",
  "answers her",
  "explains to",
  "talking to",
  "talks to",
  "speaking to",
  "speaks to",
  "in conversation",
  "conversation with",
  "interview",
  "interviewed",
  "talking head",
  "piece to camera",
  "chats with",
  "argues with",
  "negotiates with",
  "haggles with",
  "greets her",
  "greets him",
  "introduces himself",
  "introduces herself",
];

/**
 * On-screen text reflexes. The video model renders text as garbled shapes, and a
 * documentary is the format most tempted by captions, dates and statistics.
 */
const TEXT_PHRASES = [
  "caption",
  "captions",
  "lower third",
  "lower-third",
  "subtitle",
  "subtitles",
  "title card",
  "text overlay",
  "on-screen text",
  "onscreen text",
  "text appears",
  "words appear on screen",
  "graphic showing",
  "infographic",
  "graph showing",
  "statistic on screen",
  "date stamp",
];

/** Roughly how fast the narrator reads. Used to sanity-check a written line. */
const NARRATION_WORDS_PER_SECOND = 2.5;

/** The most words a scene's narration line may carry for a 10s scene. */
const MAX_NARRATION_WORDS = 24;

/**
 * Purity faults in an OUTLINE. Checked on the beats' purposes, moments and
 * narration, where a fix is one repair call rather than N rebuilds.
 */
function documentaryPurityViolations(outline) {
  const violations = [];
  const beats = (outline?.sceneBeats || []).filter(Boolean);

  for (const beat of beats) {
    const n = beat.sceneNumber ?? "?";
    const text = normalize(
      `${beat.purpose || ""} ${beat.moment || ""} ${(beat.cuts || []).map((c) => c?.shot || "").join(" ")}`
    );

    const adHits = AD_PHRASES.filter((p) => text.includes(p));
    if (adHits.length > 0) {
      violations.push(
        `Scene ${n} is written like an ad (${adHits.map((h) => `"${h}"`).join(", ")}). This is a documentary — there ` +
          `is no brand, no product and nothing to sell, and no logo, tagline or closing plate anywhere in it. ` +
          `Replace that beat with something the film actually observes.`
      );
    }

    const speechHits = SPEECH_PHRASES.filter((p) => text.includes(p));
    if (speechHits.length > 0) {
      violations.push(
        `Scene ${n} has people speaking (${speechHits.map((h) => `"${h}"`).join(", ")}). Nobody speaks on camera in ` +
          `this film: the footage is silent and every word is narration laid over it afterwards. Rewrite the beat as ` +
          `something we can SEE — the handover, the gesture, the reaction, the work — with no lips moving in speech.`
      );
    }

    const textHits = TEXT_PHRASES.filter((p) => text.includes(p));
    if (textHits.length > 0) {
      violations.push(
        `Scene ${n} puts text on screen (${textHits.map((h) => `"${h}"`).join(", ")}). There is no on-screen text in ` +
          `this film — no captions, no lower thirds, no dates, no charts. The video model renders text as garbled ` +
          `shapes. Say it in the narration or show it in the picture.`
      );
    }

    const words = String(beat.narration || "").trim().split(/\s+/).filter(Boolean).length;
    if (words > MAX_NARRATION_WORDS) {
      violations.push(
        `Scene ${n}'s narration is ${words} words, and a narrator reads about ` +
          `${NARRATION_WORDS_PER_SECOND} words a second — that is ` +
          `${Math.round(words / NARRATION_WORDS_PER_SECOND)}s of speech in a ten-second scene, with no room for the ` +
          `picture to breathe. Cut it to ${MAX_NARRATION_WORDS} words or fewer. A scene with NO narration is a ` +
          `legitimate and often better choice.`
      );
    }
  }

  // Wall-to-wall narration: the format's other besetting sin.
  const narrated = beats.filter((b) => String(b.narration || "").trim()).length;
  if (beats.length >= 6 && narrated === beats.length) {
    violations.push(
      `Every single scene carries narration. A film talked over from end to end is exhausting and it tells the ` +
        `audience the pictures cannot carry themselves. Leave at least one or two scenes to play on their own sound ` +
        `— the strongest moments in a documentary are usually the ones the narrator shuts up for.`
    );
  }

  const spine = normalize(`${outline?.thesis || ""} ${outline?.premise || ""} ${outline?.filmArc || ""}`);
  const spineHits = AD_PHRASES.filter((p) => spine.includes(p));
  if (spineHits.length > 0) {
    violations.push(
      `The outline itself carries advertising language (${spineHits.map((h) => `"${h}"`).join(", ")}). Rewrite the ` +
        `thesis and the arc as observation, with nothing being promoted.`
    );
  }

  return violations;
}

/**
 * Purity faults in a BUILT scene prompt.
 *
 * Narrower than the outline gate: a 2,000-word prompt describing a real place
 * legitimately mentions signage, shopfronts and people laughing together, so
 * only what can ONLY mean "this is an advert", "somebody is speaking" or "put
 * words on the screen" is caught here.
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
  "strapline",
];

const SCENE_SPEECH_PHRASES = [
  "lips moving in speech",
  "mid-sentence",
  "mouths the words",
  "says to",
  "shouts to",
  "shouts at",
  "calls out to",
  "talking head",
  "piece to camera",
  "interviewed",
  "in conversation with",
  "speaks to the camera",
  "answers the question",
];

const SCENE_TEXT_PHRASES = [
  "caption",
  "lower third",
  "lower-third",
  "subtitle",
  "title card",
  "text overlay",
  "on-screen text appears",
  "text appears on screen",
  "infographic",
];

function scenePurityViolations(scene) {
  const prompt = normalize(scene?.fullPrompt);
  const violations = [];
  if (!prompt) return violations;

  const adHits = SCENE_AD_PHRASES.filter((p) => prompt.includes(p));
  if (adHits.length > 0) {
    violations.push(
      `The prompt contains advertising apparatus (${adHits.map((h) => `"${h}"`).join(", ")}) in a documentary that ` +
        `has nothing to sell. Remove it entirely — no logo, no tagline, no brand plate.`
    );
  }

  const speechHits = SCENE_SPEECH_PHRASES.filter((p) => prompt.includes(p));
  if (speechHits.length > 0) {
    violations.push(
      `The prompt has somebody speaking (${speechHits.map((h) => `"${h}"`).join(", ")}). This film's footage is ` +
        `SILENT: no dialogue, no lips moving in speech, no talking heads. Every word is narration recorded ` +
        `separately and laid over the cut, so a mouth moving on screen breaks the film. Rewrite those beats as ` +
        `physical action and state explicitly that nobody speaks.`
    );
  }

  const textHits = SCENE_TEXT_PHRASES.filter((p) => prompt.includes(p));
  if (textHits.length > 0) {
    violations.push(
      `The prompt asks for on-screen text (${textHits.map((h) => `"${h}"`).join(", ")}). There is no text in this ` +
        `film — the video model renders it as garbled shapes. State "no on-screen text of any kind" instead.`
    );
  }

  // A dialogue field with anything in it means the builder wrote speech into a
  // silent film — cheap to catch here, expensive once it has been rendered.
  const dialogue = String(scene?.dialogue || "").trim();
  if (dialogue && !/^(no dialogue|none|n\/a|-|nobody speaks|no speech)\.?$/i.test(dialogue)) {
    violations.push(
      `The scene carries dialogue ("${dialogue.slice(0, 80)}"). Nobody speaks on camera in this film. Return an ` +
        `empty dialogue field and make sure the prompt says explicitly that no character speaks and no lips move ` +
        `in speech.`
    );
  }

  return violations;
}

module.exports = {
  drawDocumentaryProvocation,
  documentaryStructureLaw,
  noSellingMandate,
  narratedFilmMandate,
  documentaryStructureViolations,
  documentaryPurityViolations,
  scenePurityViolations,
  beatAct,
  ACTS,
  ACT_WINDOWS,
  MAX_NARRATION_WORDS,
  NARRATION_WORDS_PER_SECOND,
  DOC_ANGLES,
  DOC_SHAPES,
  DOC_TONES,
  DOC_OPENINGS,
  AD_PHRASES,
  SPEECH_PHRASES,
  TEXT_PHRASES,
};
