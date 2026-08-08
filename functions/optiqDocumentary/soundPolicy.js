// ─── OPTIQ DOCUMENTARY — THE SOUND POLICY (NO MUSIC, NO SPEECH) ─────────────
//
// The documentary sandbox's own copy. It shares no code with the ad swarm or the
// story sandbox, and it is stricter than either of them, because this film's
// clips carry neither of the two things a video model most wants to invent.
//
// Why the no-music half exists (unchanged from the other two sandboxes): Lyria 3
// Pro composes the score after generation, against the finished cut, and lays it
// under the timeline at an exact length. Music the video model invents cannot be
// removed from a clip's audio, collides with the composed score, and wastes the
// render.
//
// Why the no-speech half exists, and why it is load-bearing HERE: a documentary
// is carried by narration that is written and recorded AFTER the footage, over
// the finished cut. A clip with somebody talking in it does two bad things at
// once — the voice fights the narrator, and the lips on screen do not match the
// words the audience is hearing. Both are permanent. Only a paid re-render
// undoes either.
//
// So the mandate is enforced the way casting variety is: injected at several
// points in the prompt rather than once, plus a JS gate that inspects the result
// and a repair pass for failures. A single instruction buried in a 2,000-word
// prompt does not survive; the model weights early tokens and drifts by the sound
// block. Repetition at the top, at the sound block and at the closing
// restatement is the mechanism.

"use strict";

// ─── THE MANDATE ────────────────────────────────────────────────────────────

/**
 * The no-music / no-speech block, pasted verbatim into prompts at several points.
 *
 * `allowDialogue` exists only so this module keeps the same shape as its two
 * siblings; in this sandbox it is always false, because no documentary clip
 * carries speech. It is a named parameter rather than a hard-coded false so a
 * caller that copies a call site from the story sandbox fails loudly at review
 * rather than quietly re-enabling dialogue.
 */
function noMusicMandate({ allowDialogue = false } = {}) {
  return `═══ ABSOLUTE SOUND LAW — NO MUSIC, NO SPEECH (NON-NEGOTIABLE) ═══
This film is scored SEPARATELY, after generation, by a dedicated composer model
(Lyria 3 Pro), and NARRATED separately by a text-to-speech voice recorded against
the finished cut. Both are laid over the timeline afterwards. Your clip must
therefore contain NO MUSIC AT ALL and NO SPEECH AT ALL. Anything you invent here
cannot be stripped out of the clip's audio — it collides with the score or the
narration, and the take is thrown away.

Generate NO music of any kind. No background music, no soundtrack, no underscore,
no theme, no jingle, no melody, no instrumental bed, no orchestration, no strings,
no piano, no guitar, no kora, no balafon, no djembe, no synth, no bassline, no
drum loop, no percussion groove, no rhythmic musical pulse, no humming, no
singing, no whistled tune, no chanting. No music leaking from a radio,
television, phone, speaker, passing car, market stall or nearby shop. No musical
sting on a cut. No swell under a beat. Nothing tonal, nothing melodic, nothing
rhythmic that any listener would call music.

Generate NO speech of any kind either${
    allowDialogue
      ? " — except this film's own on-camera dialogue, which is written in the DIALOGUE block."
      : `. No dialogue, no conversation, no greeting, no shouted line, no narration,
no voiceover, no audible words at all. Nobody in frame speaks, and no lips move
in speech: not talking, not mouthing, not mid-sentence. The narration is recorded
afterwards and laid over this clip, so a mouth moving on screen — or a voice on
the clip's own audio — breaks the finished film.`
  }

What the clip DOES carry: the real diegetic sounds of the physical events in
frame — footsteps, cloth, breath, hands on objects, liquid, metal, wood, doors,
engines, tools, wind, room tone — and the natural ambience of the location.
Crisp, clean, unscored, wordless. Present but not wall-to-wall: a narrator's
voice will sit on top of this, so the bed must leave room for one. Treat any
impulse toward a score, or toward somebody saying something, as a hard error.`;
}

/** Compact restatement for the closing paragraph, where budget is tight. */
const NO_MUSIC_RESTATEMENT = `Sound is diegetic only: NO MUSIC of any kind and NO SPEECH of any kind — no soundtrack, no melody, no instrumental bed, no humming or singing, no music from any radio or speaker in the scene, no dialogue, no voiceover, and nobody's lips moving in speech. Only the real sounds of the events in frame and the location's ambience. The film is scored and narrated separately afterwards.`;

/**
 * What the registry must author instead of a music spec.
 *
 * The ad swarm's registry used to write 250–300 words locking the film's
 * background music. That field still exists and is still repeated verbatim in
 * every scene — but it now locks the SILENCE and the ambient bed, which is what
 * makes separate clips sound like one unbroken recording, and (in this sandbox)
 * what keeps a narrator audible over them.
 */
function silenceSpecDirective(soundMin, soundMax) {
  return `SOUND SPEC — ${soundMin}–${soundMax} words locking this film's UNSCORED, WORDLESS sound bed. There is NO MUSIC and NO SPEECH in this film's clips: do not describe instruments, tempo, BPM, mood-of-the-music or any musical progression, and do not describe anybody talking. Instead lock, in this exact order and this much detail: (1) an explicit statement that the clip carries absolutely no music of any kind — no soundtrack, no melody, no instrumental bed, no humming or singing, no music from any radio, phone or speaker in the scene; (2) an explicit statement that the clip carries no speech of any kind — no dialogue, no conversation, no narration, no audible words, nobody's lips moving in speech, because the narration is recorded separately and laid over the finished cut; (3) the exact quality of that silence — how, with no score and no voices, the location's own noise is left carrying the entire clip; (4) the continuous ambient bed of the film's world in specific, nameable sound (the particular room tone, the particular street, the particular distance of traffic or surf or generator hum), described precisely enough that every scene repeating it verbatim sounds like one unbroken recording, and pitched so a narrator's voice sits cleanly on top of it rather than fighting it; (5) the recording character — close, dry, present, unprocessed, no reverb tail, no sweetening. NOT incidental birds/breeze padding. This exact text repeats VERBATIM in the sound block of every scene.`;
}

// ─── THE GATE ───────────────────────────────────────────────────────────────

// Vocabulary that means "a score is playing". Deliberately excludes words that
// carry an innocent meaning in a film prompt and would produce false failures:
// "score" (a goal is scored), "beat" (a story beat, a heart beating), "drum" (a
// drum of oil), "tempo" (the tempo of the cutting), "band" (a rubber band), and
// bare "string" (a string of beads) — only the plural and the musical phrase.
const MUSIC_TERMS = [
  "music", "musical", "soundtrack", "sound track", "underscore", "scoring",
  "song", "melody", "melodic", "instrumental", "jingle", "anthem", "lullaby",
  "guitar", "kora", "balafon", "djembe", "piano", "violin", "cello", "flute",
  "saxophone", "trumpet", "synth", "synthesizer", "bassline", "bass line",
  "orchestra", "orchestral", "chord", "harmony", "riff", "arpeggio", "bpm",
  "drumbeat", "drum beat", "percussion", "singing", "sings", "sung", "humming",
  "hums", "whistling a tune", "chanting", "rhythm track", "backing track",
  "strings", "string swell", "crescendo",
];

// A term inside one of these constructions is being FORBIDDEN, not requested.
//
// Matched on WORD BOUNDARIES, which is load-bearing: as plain substrings, "no "
// matches inside "piano ", so "a soft piano motif rises" counted as negated and
// the gate waved through the exact contradiction it exists to catch.
const NEGATIONS = [
  "no", "not", "never", "without", "absent", "absence", "zero", "free of",
  "devoid", "silent", "silence", "unscored", "forbidden", "banned", "prohibited",
  "avoid", "avoided", "exclude", "omit", "stripped", "must not", "cannot",
  "can't", "don't", "do not", "none", "lacks", "nothing", "neither", "nor",
];

const NEGATION_RE = new RegExp(
  `(^|[^a-z])(${NEGATIONS.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})([^a-z]|$)`
);

function lower(text) {
  return String(text || "").toLowerCase();
}

/** Split into sentence-ish spans. Negation is judged within a span. */
function spans(text) {
  return lower(text)
    .split(/[.!?;\n]+|—/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Music terms used AFFIRMATIVELY — i.e. a span that names music without
 * forbidding it. Sentence-scoped rather than a character window, because
 * "absolutely no music, no melody, no instrumental bed" is one long clause and a
 * fixed window would flag its tail.
 *
 * Returns the offending terms, deduped.
 */
function affirmativeMusic(text) {
  const found = new Set();
  for (const span of spans(text)) {
    if (NEGATION_RE.test(span)) continue;
    for (const term of MUSIC_TERMS) {
      const re = new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
      if (re.test(span)) found.add(term);
    }
  }
  return [...found];
}

/** How many times the prompt actually asserts the no-music rule. */
function noMusicAssertions(text) {
  return (lower(text).match(/no music|without music|musically silent|no soundtrack|unscored/g) || []).length;
}

/** How many times the prompt actually asserts that nobody speaks. */
function noSpeechAssertions(text) {
  return (
    lower(text).match(
      /no dialogue|no speech|no spoken|no audible words|nobody speaks|no one speaks|does not speak|no words are spoken|silent of speech|no lips move/g
    ) || []
  ).length;
}

/**
 * Sound violations for one compiled scene prompt.
 *
 * Four independent failures, because they fail differently: a prompt can state a
 * rule and then contradict it, or state it once at the top and drift by the
 * sound block 1,500 words later — and it can do either of those about music or
 * about speech.
 */
function sceneSoundViolations(fullPrompt, { allowDialogue = false } = {}) {
  const violations = [];
  const text = String(fullPrompt || "");

  const musicAsserted = noMusicAssertions(text);
  if (musicAsserted === 0) {
    violations.push(
      `The prompt never forbids music. The video model's default is to invent a background score, which collides ` +
        `with the separately composed track and wastes the render. State plainly that the clip carries NO MUSIC of ` +
        `any kind — in the opening rules, in the SOUND block, and again in the closing restatement.`
    );
  } else if (musicAsserted < 3) {
    violations.push(
      `The no-music rule is asserted only ${musicAsserted} time(s). In a 1,500–2,000 word prompt one mention does ` +
        `not survive — the model weights early tokens and drifts by the sound block. Restate it in the ABSOLUTE ` +
        `RULES, again at the top of the SOUND block, and again in the CLOSING RESTATEMENT.`
    );
  }

  const affirmed = affirmativeMusic(text);
  if (affirmed.length > 0) {
    violations.push(
      `The prompt asks for music: it names ${affirmed.join(", ")} without forbidding it. This film's score is ` +
        `composed separately afterwards, so the clip must contain none. Remove every musical instruction and ` +
        `replace it with the diegetic sound of the physical events in frame plus the location's ambient bed.`
    );
  }

  if (!allowDialogue) {
    const speechAsserted = noSpeechAssertions(text);
    if (speechAsserted === 0) {
      violations.push(
        `This is a NARRATED film — nobody speaks on camera — but the prompt never says so. State explicitly that no ` +
          `character speaks, that no lips move in speech, and that the clip contains no audible words. The narration ` +
          `is a voiceover added after the cut, and speech in the footage would talk over it and mismatch the lips.`
      );
    } else if (speechAsserted < 2) {
      violations.push(
        `The no-speech rule is asserted only once in a 1,500–2,000 word prompt, and one mention does not survive to ` +
          `the action block. Restate it in the ABSOLUTE RULES, in the SOUND block, and in the CLOSING RESTATEMENT: ` +
          `nobody speaks, no lips move in speech, no audible words.`
      );
    }
  }

  return violations;
}

/** Sound violations for the registry's locked sound spec. */
function registrySoundViolations(registry) {
  const violations = [];
  const spec = registry?.soundSpec;
  if (!spec) return violations;

  if (noMusicAssertions(spec) === 0) {
    violations.push(
      `The locked sound spec never states that there is no music. It is pasted verbatim into every scene, so a spec ` +
        `that omits the rule omits it from the whole film. Rewrite it to lock the musical SILENCE and the ambient ` +
        `bed instead of a score.`
    );
  }
  if (noSpeechAssertions(spec) === 0) {
    violations.push(
      `The locked sound spec never states that there is no speech. This film's words are all narration laid over the ` +
        `finished cut, and the spec is pasted into every scene — so it is the one place the rule reaches the whole ` +
        `film. Add an explicit line: no dialogue, no voices, no audible words, nobody's lips moving in speech.`
    );
  }
  const affirmed = affirmativeMusic(spec);
  if (affirmed.length > 0) {
    violations.push(
      `The locked sound spec specifies music (${affirmed.join(", ")}). Because it is repeated verbatim in every ` +
        `scene, this one field would put a score in every clip in the film. Replace it with the unscored sound bed: ` +
        `the explicit absence of music and speech, the quality of that silence, and the film's continuous ambience.`
    );
  }
  if (!registry?.ambienceSpec) {
    violations.push(
      `There is no ambience spec. With no music, no speech AND no authored ambient bed, the model fills the gap with ` +
        `whatever it likes — usually a score. Author the film's continuous ambient sound explicitly.`
    );
  }
  return violations;
}

module.exports = {
  noMusicMandate,
  NO_MUSIC_RESTATEMENT,
  silenceSpecDirective,
  sceneSoundViolations,
  registrySoundViolations,
  affirmativeMusic,
  noMusicAssertions,
  noSpeechAssertions,
  MUSIC_TERMS,
};
