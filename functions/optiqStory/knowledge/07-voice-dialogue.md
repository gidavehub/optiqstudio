# OPTIQ STORY KNOWLEDGE — PART VII: DIALOGUE (how people talk on camera, language protocol, timing)
(Internal operating doctrine for the Optiq Story agent swarm.)

# PART VII — DIALOGUE

> **This module is the story sandbox's replacement for the ad swarm's Part VII.**
> The ad version is mostly about VOICEOVER — the separation principle, the house
> narrator voices, transcript formats for a TTS engine, the tagline at the end.
> **None of that exists here.** An original short film has no narrator, no
> voiceover and no tagline. Its only words are spoken by its characters, on
> camera, in the shot. What survives from the original is the part that is about
> people actually talking: the language protocol and the timing math.

## 7.1 THE ONE RULE

> **A character who explains the story is a character nobody believes.**

Dialogue in a short film is not how the audience learns the plot. It is a thing
people do to each other. Every line is somebody trying to get something — to
avoid a question, to change a subject, to win, to apologise without apologising,
to find out what the other person knows.

If a line's job is to inform the viewer, cut it and find the picture that does
the same work.

## 7.2 HOW REAL DIALOGUE BEHAVES

| ✗ Written dialogue | ✓ Spoken dialogue |
|---|---|
| "Ever since Father died and left us the shop, I've had to manage everything alone." | "Where's the key?" — "You had it." — "I gave it back." |
| "I'm worried we won't make the payment this month." | "How much short?" — *(nothing)* — "How much?" |
| "You've always been the responsible one, and I admire that." | "You'd have counted it twice." — "I'd have counted it three times." |

The rules that produce the right column:

- **Under ten words a line.** Almost always. Ten seconds of screen time holds far
  less speech than you think, and the picture is doing most of the work.
- **People answer a different question** than the one they were asked.
- **People interrupt.** Overlap is normal; two people finishing each other's
  sentences politely is not.
- **Somebody starts a sentence and stops.** The unfinished line is frequently the
  best one in the scene.
- **Nobody says the theme.** If a line could be printed on a poster, delete it.
- **Names are used sparingly.** Real people rarely say each other's names.
- **Silence is a legitimate scene.** A scene with no dialogue at all is often the
  strongest one in the film. Write `(no dialogue)` and let the action carry it.

## 7.3 WHAT NEVER APPEARS

- A narrator, a voiceover, or any voice that is not a person in the frame.
- A tagline, a slogan or a closing line of copy.
- A line that names or praises a product, a shop, a service or a brand.
- Exposition delivered to a character who would already know it.
- Anyone speaking to the camera. (Law 3: nobody looks at the lens, ever.)

## 7.4 THE LANGUAGE TAG

Every scene prompt carries an explicit language tag in its style block —
`Dialogue in ENGLISH.` or `Dialogue in WOLOF.` — because an untagged prompt gets
whatever the model feels like, and a film that changes language between scene 2
and scene 3 is unusable.

**Default: English.** Choose Wolof only when the story is purely local and the
register genuinely calls for it. Mixed is realistic and allowed within one scene
(a Gambian household switches constantly), but the tag must say so explicitly:
`Dialogue in ENGLISH with Wolof phrases.`

## 7.5 WOLOF PROTOCOL

**The standing rule, on every Wolof deliverable:**
> These lines are a faithful guide — have a **native Gambian Wolof speaker**
> confirm the exact phrasing and natural register before recording, or let your
> actors say them naturally in their own words. Each line is provided with its
> English meaning so it can be checked.

**Why this is non-negotiable:** Wolof orthography varies; Gambian Wolof differs
from Senegalese; loan words need a native ear; and register is a performance
choice a native speaker will land better than a transliteration.

**Bilingual format** — always give the meaning alongside:
```
"Waaw doomam, ñam bi jeex na."
— ("Sorry my son, the food is finished.")
```

**The working Wolof lexicon from production:**
| Wolof | English |
|---|---|
| *ñam bi jeex na* | the food is finished |
| *waaw doomam* | yes/sorry my son |
| *dénk naa la benn assiet* | I kept a plate for you |
| *am na ñam?* | is there food? |
| *lu tax…?* | why…? |
| *doole* | strength / energy |
| *bu set* | clean / pure |
| *bu bees* | fresh / new |
| *sunu bopp* | our own selves |
| *benn ndab, benn njaboot* | one bowl, one family |
| *xanaa dafa dof?* | is he mad? |
| *foo jëm?* | where are you going? |
| *dem na* | he/she has gone |
| *baal ma* | forgive me |

## 7.6 TIMING MATH

**Measured rate:** ordinary conversational speech runs about **2.5 words per
second**. A ten-second scene therefore holds roughly 25 words of speech *in
total*, across every character — and that is the absolute ceiling, not a target.

**The real target is half that.** A scene needs room for the physical beats, and
dialogue that fills the whole ten seconds leaves no space for anything to happen.

| Scene type | Realistic speech budget |
|---|---|
| A scene carried by an exchange | 15–20 words total |
| A scene with one line that lands | 5–8 words |
| A scene carried by action | 0 words |

**If a scene is tight, cut the second line, never the first** — the first carries
the intent. And when two characters both have something to say in ten seconds,
one of them should be interrupted rather than both being shortened.
