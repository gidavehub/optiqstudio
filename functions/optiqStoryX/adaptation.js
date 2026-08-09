// ─── OPTIQ STORY X — ADAPTATION MODE ────────────────────────────────────────
//
// WHAT THIS EXISTS TO PREVENT, stated plainly because it happened:
//
// A director pasted a complete 900-word story — a boy taught to steal in Brikama
// market, escalating robberies, a gang in the night markets, repeated arrests,
// his mother bribing him out, a violent heist at a coastal compound, the arrest
// on the wall, the interrogation, the raid that found her chest under the
// floorboards, the trial, the prison van. Eleven locations, a decade of time.
//
// The film came back with nineteen of its thirty scenes in one holding room,
// eleven near-identical "she shoves him into the market" scenes, an invented
// detective nobody asked for, and a different ending.
//
// That was not a model failing to follow instructions. It was the pipeline
// working exactly as designed — for a DIFFERENT INPUT. The concept room's stated
// job is "reject the literal reading first", and the storyline is then told to
// build the room's winner. For "a woman hides money from her family" that is
// right and it is what makes the films good. For a finished story it is
// vandalism: it throws away the thing the director actually wrote.
//
// So the pipeline now has two modes, and the input decides which:
//
//   PREMISE MODE — a line or two of idea. The concept room runs, invents, and
//     the swarm builds the best story it can find in the space around it.
//
//   ADAPTATION MODE — a story that already exists. The concept room does NOT
//     run. Nothing is invented, nothing is relocated, nothing is dropped. The
//     job stops being "what film should this be" and becomes "spread THIS story
//     across N scenes so all of it fits in the run-time".
//
// Everything below serves the second mode.

"use strict";

/**
 * Words past which a prompt is a STORY rather than a premise.
 *
 * A brief is 5–40 words ("a woman hides money from her own family"). A pasted
 * story is 300+. The gap between them is wide and empty, so a threshold is a
 * genuinely reliable classifier here rather than a guess — and it is set low
 * enough (120) that a detailed multi-sentence brief also gets treated as
 * something to honour rather than something to improve upon, which is the safer
 * side to err on. Nobody has ever been annoyed that their brief was followed
 * too closely.
 */
const ADAPTATION_WORD_FLOOR = 120;

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Is this prompt a story to adapt, rather than a premise to develop?
 *
 * Length is the primary signal. The secondary one is narrative shape: a story
 * has sentences with people doing things in sequence, which shows up as several
 * sentence-ending marks. A 200-word list of adjectives about a brand is long but
 * is not a story.
 */
function isAdaptation(prompt) {
  const text = String(prompt || "");
  if (countWords(text) < ADAPTATION_WORD_FLOOR) return false;
  const sentences = (text.match(/[.!?]["'”’)]?(\s|$)/g) || []).length;
  return sentences >= 4;
}

/**
 * The mandate injected into every skill that could otherwise "improve" the
 * director's story.
 *
 * Written as prohibitions rather than encouragement because the instinct it is
 * fighting is a strong one and it is baked into the doctrine underneath: every
 * other chapter in this sandbox tells the model to reject the literal reading,
 * find a better angle, and be surprising. All of that is suspended here.
 */
function adaptationMandate({ numScenes, sourceStory } = {}) {
  const scenes = numScenes || 30;
  const seconds = scenes * 10;

  return `═══ THIS IS AN ADAPTATION. THE STORY ALREADY EXISTS. ═══

THE DIRECTOR HAS WRITTEN THE STORY. It is reproduced below in full. Your job is
NOT to invent a story, improve one, reinterpret one, or find a better angle on
one. Your job is to SPREAD THE STORY THEY WROTE across ${scenes} scenes so that
all of it fits inside ${seconds} seconds.

THIS SUSPENDS EVERY INSTRUCTION YOU HAVE READ ABOUT ORIGINALITY. Other parts of
this house doctrine tell you to reject the literal reading, to distrust the
obvious idea, to be surprising. Those exist for a director who gave you one line
and asked you to find a film in it. This director gave you a finished story.
Reject the literal reading here and you have deleted their work.

═══ THE SIX RULES, AND THEY ARE ABSOLUTE ═══

1. USE THE WHOLE STORY. Every event in it gets filmed. Walk the source from its
   first sentence to its last and account for ALL of it. If the story has a
   market, a police cell, a house raid, a courtroom and a prison van, the film
   has all five. Nothing gets summarised away and nothing gets skipped because
   it was inconvenient to stage.

2. INVENT NO CHARACTERS. The people in the film are the people in the story,
   with the names the story gave them. Do not add a detective, a friend, a
   neighbour or a narrator who is not there. Unnamed people the story implies
   (officers, shoppers, a judge) may appear as the story implies them — as
   background doing their job, not as new characters with arcs.

3. RELOCATE NOTHING. Each event happens WHERE THE STORY SAYS IT HAPPENS. If the
   heist is at a coastal compound, film it at a coastal compound. Moving events
   into one room because one room is easier to keep consistent is the single
   worst thing you can do here — it produces thirty scenes of two people talking
   in a box, and it throws away everything the director wrote.

4. KEEP THE ENDING THEY WROTE. The film ends the way the story ends, on the
   event the story ends on. Not a cleverer ending, not a more ironic one, not
   one that ties back to the opening. Theirs.

5. DO NOT REPEAT A SCENE. ${scenes} scenes means ${scenes} DIFFERENT moments,
   moving forward in time. "She shoves him into the market" is one scene, not
   eleven. If you find yourself writing the same beat again with different
   framing, you have run out of story to spread and you are padding — go back to
   the source and find the events you skipped, because they are there.

6. EXPAND, DO NOT INVENT. Expansion is legitimate and necessary: the source says
   "he robbed street vendors" and you must turn that into a specific scene with
   specific people, specific dialogue and a specific outcome. That is your job.
   Inventing a whole subplot the source does not contain is not.

═══ HOW TO SPREAD IT ═══

Read the source and list its events IN ORDER. Then allocate the ${scenes} scenes
across them, in proportion to how much weight each carries in the story. A whole
phase of the story that the source covers in one sentence ("as he grew, his
mother's demands escalated") may deserve three or four scenes; a single dramatic
moment the source spends a paragraph on may deserve two.

EVERY PHASE GETS SCREEN TIME. If the source spans years, the film spans years —
show the passage by aging the characters, changing the seasons, changing what
they wear and what they carry. Do not compress a decade into one location
because it is tidier.

THE RUN-TIME IS THE CONSTRAINT, NOT THE STORY. ${seconds} seconds is what you
have and the whole story has to fit in it. That means moving fast: one scene per
event, no dwelling, no repeating. It does NOT mean cutting the story down to the
part that fits comfortably.

═══ THE DIRECTOR'S STORY — THIS IS WHAT YOU ARE FILMING ═══

${String(sourceStory || "").trim()}

═══ END OF THE DIRECTOR'S STORY ═══

Film that. All of it. In order. In ${scenes} scenes.`;
}

// ─── THE GATES ──────────────────────────────────────────────────────────────

/** Words too common to mean anything as a coverage signal. */
const STOPWORDS = new Set(
  ("the a an and or but of to in on at for with from by as is was were be been being that this these those " +
    "he she it they them his her its their him who whom which what when where why how not no nor so if then " +
    "than there here into out up down over under again once all any both each few more most other some such " +
    "only own same too very can will just should now had has have do does did done would could may might " +
    "one two three first last next after before while during until because since about against between " +
    "through above below off near own said says say told tell went go goes going come came get got make made " +
    "back down time day night year years old new young man woman boy girl people her his their our your my")
    .split(/\s+/)
);

/**
 * The distinctive terms of the source: proper nouns and uncommon words.
 *
 * Proper nouns are the strongest signal by far — "Brikama", "Kaddy", "Modou" —
 * because they are the things a rewrite silently drops. Capitalised words are
 * taken from mid-sentence positions only, so a word that merely starts a
 * sentence is not mistaken for a name.
 */
function keyTerms(text) {
  const raw = String(text || "");
  const terms = new Set();

  // Mid-sentence capitals: names and places.
  for (const m of raw.matchAll(/(?<![.!?]\s|^)\b([A-Z][a-z]{2,})\b/gm)) {
    const w = m[1].toLowerCase();
    if (!STOPWORDS.has(w)) terms.add(w);
  }
  // Uncommon lowercase nouns that carry the setting: "compound", "courtroom".
  for (const m of raw.matchAll(/\b([a-z]{5,})\b/g)) {
    const w = m[1];
    if (!STOPWORDS.has(w)) terms.add(w);
  }
  return terms;
}

/**
 * Which EVENTS of the director's story never got filmed.
 *
 * Measured per SENTENCE, not per word, and that choice is the whole design. A
 * word-level check drowns in the source's incidental prose — "terrifying",
 * "theatrical", "moonless" — none of which a terse scene beat will ever contain,
 * so a faithful film scores as badly as a replacement and the gate says nothing
 * useful.
 *
 * A SENTENCE is the right unit because it maps onto what the mandate actually
 * demands: walk the source from its first sentence to its last, and film all of
 * it. A sentence whose distinctive words appear NOWHERE in the storyline is an
 * event that did not make the film.
 *
 * @param {object} storyline
 * @param {string} sourceStory  the director's own text
 */
function coverageViolations(storyline, sourceStory) {
  if (!sourceStory) return [];
  const beats = (storyline?.sceneBeats || []).filter(Boolean);
  if (beats.length === 0) return [];

  const filmText = JSON.stringify(beats).toLowerCase();

  // Sentences carrying real content. Very short ones ("He agreed.") have nothing
  // distinctive in them and cannot be checked either way.
  const sentences = String(sourceStory)
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => countWords(x) >= 6);
  if (sentences.length < 3) return [];

  const unfilmed = [];
  for (const sentence of sentences) {
    const terms = [...keyTerms(sentence)];
    if (terms.length < 2) continue;
    // A sentence counts as FILMED when a fifth of its distinctive words survived
    // into the storyline. Both numbers here were measured against the two real
    // films — the one that collapsed into a holding room and a faithful spread of
    // the same source — rather than guessed:
    //
    //   at this threshold   collapsed film: 62% of sentences unfilmed
    //                       faithful film:   5%
    //
    // "Any single word" was too generous (both films say "Brikama" and "Modou",
    // so the collapsed one passed); demanding a third or more started failing
    // faithful films, because a scene beat is fifteen words summarising a
    // sentence of rich prose and cannot echo most of it.
    const FILMED_SHARE = 0.2;
    const hits = terms.filter((t) => filmText.includes(t)).length;
    if (hits / terms.length < FILMED_SHARE) unfilmed.push(sentence);
  }

  const missedShare = unfilmed.length / sentences.length;
  if (missedShare <= 0.34) return [];

  return [
    `${unfilmed.length} of the director's ${sentences.length} story sentences have no scene anywhere in this ` +
      `film — roughly ${Math.round(missedShare * 100)}% of what they wrote is missing. That is not an ` +
      `adaptation, it is a replacement. Events with no scene include: ` +
      unfilmed
        .slice(0, 5)
        .map((x) => `"${x.length > 110 ? `${x.slice(0, 110)}…` : x}"`)
        .join("  ·  ") +
      `. Walk the source from its first sentence to its last and give every phase of it scenes of its own.`,
  ];
}

/**
 * Scenes that are the same scene again.
 *
 * The failure this catches: eleven scenes of "Kaddy shoves Modou into the market
 * and points at a target", and nineteen scenes in one holding room. Each one
 * passes every other gate — it has beats, it has an act tag, it has dialogue —
 * and the film is still unwatchable.
 *
 * Two separate checks, because they are two separate failures:
 *   LOCATION CONCENTRATION — one place swallowing the film.
 *   BEAT REPETITION        — the same moment written again.
 */
function repetitionViolations(storyline, { numScenes } = {}) {
  const beats = (storyline?.sceneBeats || []).filter(Boolean);
  const total = numScenes || beats.length;
  if (beats.length < 6) return [];

  const violations = [];

  // ── Location concentration ────────────────────────────────────────────────
  //
  // Only for films long enough that one place cannot honestly hold them. A
  // six-scene two-hander in one kitchen is a legitimate and often superior
  // choice — the doctrine says so, and it is right. What is never legitimate is
  // a THIRTY-scene film set in one room, because no story that earns thirty
  // scenes happens in a box.
  const CONCENTRATION_FLOOR = 12;
  const byLocation = new Map();
  for (const b of beats) {
    const key = String(b.location || "")
      .toLowerCase()
      .replace(/[^a-z ]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      .slice(0, 3)
      .join(" ");
    if (!key) continue;
    byLocation.set(key, (byLocation.get(key) || 0) + 1);
  }
  // Half the film in one place is a film that has stopped moving. Generous —
  // a two-hander legitimately lives in one room — but 19 of 30 is not that.
  const ceiling = Math.max(4, Math.round(total * 0.45));
  for (const [place, count] of total >= CONCENTRATION_FLOOR ? byLocation : []) {
    if (count > ceiling) {
      violations.push(
        `${count} of ${total} scenes happen in the same place ("${place}") — more than the ${ceiling} this ` +
          `film's length allows. A story that visits several places must be FILMED in several places; collapsing ` +
          `it into one room is the laziest possible reading of it and it throws away everything else the ` +
          `director wrote. Re-spread the film across the locations the story actually contains.`
      );
    }
  }

  // ── Beat repetition ───────────────────────────────────────────────────────
  // Compared on the distinctive words of each scene's moment, so "she shoves him
  // into the market and points at a rich woman" and "she shoves him into the
  // crowd, pointing out a wealthy target" read as the same beat.
  const fingerprint = (b) => {
    const words = `${b.moment || ""} ${b.purpose || ""}`
      .toLowerCase()
      .replace(/[^a-z ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w));
    return new Set(words);
  };
  //
  // Also long-film-only, and for the same reason: in a six-scene film three
  // scenes sharing vocabulary is usually one continuous situation, which is what
  // a six-scene film IS. In a thirty-scene film it is padding.
  if (total < CONCENTRATION_FLOOR) return violations;

  const prints = beats.map((b) => ({ n: b.sceneNumber ?? "?", set: fingerprint(b) }));
  const clusters = [];
  const claimed = new Set();
  for (let i = 0; i < prints.length; i++) {
    if (claimed.has(i)) continue;
    const group = [prints[i].n];
    for (let j = i + 1; j < prints.length; j++) {
      if (claimed.has(j)) continue;
      const a = prints[i].set;
      const b = prints[j].set;
      if (a.size < 6 || b.size < 6) continue;
      let shared = 0;
      for (const w of a) if (b.has(w)) shared++;
      // Two thirds of the smaller scene's distinctive vocabulary in common.
      if (shared / Math.min(a.size, b.size) >= 0.72) {
        group.push(prints[j].n);
        claimed.add(j);
      }
    }
    if (group.length >= 3) clusters.push(group);
  }
  for (const group of clusters) {
    violations.push(
      `Scenes ${group.join(", ")} are the same scene written ${group.length} times. ${total} scenes means ${total} ` +
        `DIFFERENT moments moving forward in time. If you have run out of story to spread, you have skipped ` +
        `events that are in the source — go back and find them rather than repeating a beat you have already used.`
    );
  }

  return violations;
}

module.exports = {
  ADAPTATION_WORD_FLOOR,
  isAdaptation,
  adaptationMandate,
  coverageViolations,
  repetitionViolations,
  keyTerms,
};
