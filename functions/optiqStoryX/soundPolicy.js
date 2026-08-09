// ─── OPTIQ SKILLS — THE SOUND POLICY (NO MUSIC, EVER) ───────────────────────
//
// Why this module exists.
//
// The video model used to be told to generate the film's background music, and
// to describe that music identically in every scene so the clips would cut
// together as one track. That was the right call when the platform had no
// composer. It is the wrong call now: Lyria 3 Pro composes the score after
// generation, against the finished cut, and lays it under the timeline at an
// exact length. Two sources of music in one film collide — the model's invented
// bed fights the composed score, cannot be removed from the clip's audio, and
// the take is wasted money.
//
// So the rule inverts. The video model now generates NO music at all, in every
// video type. What it delivers is diegetic sound — the real noise of the
// physical events in frame — plus dialogue where the scene has dialogue. Music
// arrives later, from Lyria, and only from Lyria.
//
// This is enforced the way casting variety is (see ./casting.js): a mandate
// injected at several points in the prompt rather than once, plus a JS gate that
// inspects the result and a repair pass for failures. A single instruction
// buried in a 2,000-word prompt does not survive; the model weights early tokens
// and drifts by the sound block. Repetition at top, at the sound block and at the
// closing restatement is the mechanism.

"use strict";

// ─── THE MANDATE ────────────────────────────────────────────────────────────

/**
 * The ~200-word no-music block, pasted verbatim into prompts at several points.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.allowDialogue=true] False for the fully-muted video
 *        type, where narration is added later as a TTS voiceover and the clip
 *        must carry no speech of its own either.
 */
function noMusicMandate({ allowDialogue = true } = {}) {
  return `═══ ABSOLUTE SOUND LAW — NO MUSIC, EVER (NON-NEGOTIABLE) ═══
This film is scored SEPARATELY, after generation, by a dedicated composer model
(Lyria 3 Pro), and the composed track is laid under the finished cut in the
timeline at an exact length. Your clip must therefore contain NO MUSIC AT ALL.
Anything you invent here cannot be stripped out of the clip's audio afterwards —
it collides with the composed score and the take is thrown away.

Generate NO music of any kind. No background music, no soundtrack, no underscore,
no theme, no jingle, no melody, no instrumental bed, no orchestration, no strings,
no piano, no guitar, no kora, no balafon, no djembe, no synth, no bassline, no
drum loop, no percussion groove, no rhythmic musical pulse, no humming, no
singing, no whistled tune, no chanting. No music leaking from a radio,
television, phone, speaker, passing car, market stall or nearby shop. No musical
sting on a cut. No swell under a line. No rising bed at the payoff. Nothing
tonal, nothing melodic, nothing rhythmic that any listener would call music.

What the clip DOES carry: the real diegetic sounds of the physical events in
frame — footsteps, cloth, breath, hands on objects, liquid, metal, wood, doors,
engines, tools, wind, room tone — and the natural ambience of the location${
    allowDialogue
      ? ", plus the scene's spoken dialogue."
      : ". This clip carries NO SPEECH either: no dialogue, no narration, no voiceover, no audible words at all. Narration is added separately afterwards."
  }
Crisp, clean, unscored, and musically SILENT. Treat any impulse toward a score as
a hard error.`;
}

/** Compact restatement for the closing paragraph, where budget is tight. */
const NO_MUSIC_RESTATEMENT = `Sound is diegetic only: NO MUSIC of any kind — no soundtrack, no melody, no instrumental bed, no humming or singing, no music from any radio or speaker in the scene. Only the real sounds of the events in frame and the location's ambience. The film is scored separately afterwards.`;

/**
 * What the casting-registry must author instead of a music spec.
 *
 * The registry used to write 250–300 words locking the ad's background music.
 * That field still exists and is still repeated verbatim in every scene — but it
 * now locks the SILENCE and the ambient bed, which is what makes continuous
 * scenes still sound like one unbroken take.
 */
function silenceSpecDirective(soundMin, soundMax) {
  return `SOUND SPEC — ${soundMin}–${soundMax} words locking this film's UNSCORED sound bed. There is NO MUSIC in this film's clips: do not describe instruments, tempo, BPM, mood-of-the-music, or any musical progression, because none will be generated. Instead lock, in this exact order and this much detail: (1) an explicit statement that the clip carries absolutely no music of any kind — no soundtrack, no melody, no instrumental bed, no humming or singing, no music from any radio, phone or speaker in the scene; (2) the exact quality of that musical silence — how, with no score under it, the location's own noise is left carrying the entire clip; (3) the continuous ambient bed of the film's world in specific, nameable sound (the particular room tone, the particular street, the particular distance of traffic or surf or generator hum), described precisely enough that every scene repeating it verbatim sounds like one unbroken recording; (4) the recording character — close, dry, present, unprocessed, no reverb tail, no sweetening. NOT incidental birds/breeze padding. This exact text repeats VERBATIM in the sound block of every continuous scene.`;
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
      // Word-ish boundary so "chord" doesn't match "chorded" oddities and
      // "hums" doesn't match "humssomething".
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

/**
 * No-music violations for one compiled scene prompt.
 *
 * Two independent failures, because they fail differently: a prompt can state
 * the rule and then contradict it, or state it once at the top and drift by the
 * sound block 1,500 words later.
 */
function sceneSoundViolations(fullPrompt, { allowDialogue = true } = {}) {
  const violations = [];
  // The narrated type is cut silent: its words are a TTS voiceover added later,
  // so speech baked into the footage would talk over its own narration — and,
  // like invented music, cannot be removed without paying to re-render.
  if (!allowDialogue && !/no (dialogue|speech|spoken|audible words|words)|nobody speaks|does not speak|no one speaks|silent/i.test(String(fullPrompt || ""))) {
    violations.push(
      `This is a narrated film — nobody speaks on camera — but the prompt never says so. State explicitly that no ` +
        `character speaks, that no lips move in speech, and that the clip contains no audible words. The narration is ` +
        `a voiceover added after the cut, and dialogue in the footage would talk over it.`
    );
  }
  const asserted = noMusicAssertions(fullPrompt);
  if (asserted === 0) {
    violations.push(
      `The prompt never forbids music. The video model's default is to invent a background score, which collides ` +
        `with the separately composed track and wastes the render. State plainly that the clip carries NO MUSIC of ` +
        `any kind — in the opening rules, in the SOUND block, and again in the closing restatement.`
    );
  } else if (asserted < 3) {
    violations.push(
      `The no-music rule is asserted only ${asserted} time(s). In a 1,500–2,000 word prompt one mention does not ` +
        `survive — the model weights early tokens and drifts by the sound block. Restate it in the ABSOLUTE RULES, ` +
        `again at the top of the SOUND block, and again in the CLOSING RESTATEMENT.`
    );
  }
  const affirmed = affirmativeMusic(fullPrompt);
  if (affirmed.length > 0) {
    violations.push(
      `The prompt asks for music: it names ${affirmed.join(", ")} without forbidding it. This film's score is ` +
        `composed separately afterwards, so the clip must contain none. Remove every musical instruction and ` +
        `replace it with the diegetic sound of the physical events in frame plus the location's ambient bed.`
    );
  }
  return violations;
}

/** No-music violations for the registry's locked sound spec. */
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
  const affirmed = affirmativeMusic(spec);
  if (affirmed.length > 0) {
    violations.push(
      `The locked sound spec specifies music (${affirmed.join(", ")}). Because it is repeated verbatim in every ` +
        `scene, this one field would put a score in every clip in the film. Replace it with the unscored sound bed: ` +
        `the explicit absence of music, the quality of that silence, and the film's continuous ambience.`
    );
  }
  // The ambient bed is not music and is required — but it must exist, or
  // "silence" degrades into the model inventing something to fill it.
  if (!registry?.ambienceSpec) {
    violations.push(
      `There is no ambience spec. With no music AND no authored ambient bed, the model fills the gap with whatever ` +
        `it likes — often a score. Author the film's continuous ambient sound explicitly.`
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
  MUSIC_TERMS,
};
