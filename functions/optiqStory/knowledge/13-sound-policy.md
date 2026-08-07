# OPTIQ SKILLS KNOWLEDGE — PART XIII: THE SOUND POLICY (no music, ever)
(Internal operating doctrine for the Optiq Skills agent swarm. Added when Optiq gained its own composer; supersedes the music-consistency rule in Part V.)

# PART XIII — THE SOUND POLICY

> Part V taught you to describe the ad's background music identically in every scene so nine clips would cut together as one track. **That rule is now reversed.** The clips carry no music at all.

## 13.1 WHAT CHANGED, AND WHY

When the platform had no composer, the only way to get music into a film was to ask the video model for it — and the only way to stop nine clips sounding like nine different films was to describe the same music, in the same words, in every prompt. That is the "locked sound spec", and it worked.

Optiq now has a composer. **Lyria 3 Pro** writes the score *after* generation: it is given the finished cut, composes to it, and the track is laid under the timeline at an exact length and trimmed to the frame.

That makes model-generated music actively harmful:

1. **It cannot be removed.** Music the video model invents is baked into that clip's audio track. There is no stem, no separation, no mute — the clip is contaminated permanently.
2. **It collides.** The invented bed plays *underneath* the composed score. Two unrelated pieces of music, different keys, different tempos, at once.
3. **It wastes money.** The only fix is re-rendering the scene, and every render costs the director.
4. **It is inconsistent anyway.** The model's idea of "warm optimistic kora" differs every generation, which is the exact drift the locked spec existed to suppress.

## 13.2 THE LAW

**The video model generates NO music. Ever. In every video type.**

No soundtrack. No underscore. No theme. No jingle. No melody. No instrumental bed. No orchestration. No strings, piano, guitar, kora, balafon, djembe, synth, bassline, drum loop or percussion groove. No humming, singing, whistled tune or chanting. No music leaking from a radio, television, phone, speaker, passing car or market stall *inside the scene*. No musical sting on a cut. No swell under a line. Nothing tonal, nothing melodic, nothing rhythmic that a listener would call music.

**What the clip carries instead:** the real diegetic sound of the physical events in frame — footsteps, cloth, breath, hands on objects, liquid, metal, wood, doors, engines, tools, wind, room tone — plus the location's authored ambience, plus the scene's dialogue where the scene has dialogue.

This is not an impoverished soundtrack. It is a *clean* one. Every physical event still gets its sound, in as much detail as ever; §5's sound craft applies in full. The only thing removed is the score.

## 13.3 THE THREE VIDEO TYPES

The law is identical in all three. What differs is only where the *voice* comes from.

| Type | Video model generates | Music | Voice |
|---|---|---|---|
| Short film / story | diegetic sound + dialogue | Lyria 3 Pro, after the cut | in-clip dialogue |
| Ad with dialogue | diegetic sound + dialogue | Lyria 3 Pro, after the cut | in-clip dialogue |
| Muted ad | diegetic sound only — **no speech at all** | Lyria 3 Pro, after the cut | TTS voiceover, added after |

The muted type carries the extra prohibition: no dialogue, no narration, no audible words. Its narration is generated separately as a voiceover and timed against the finished cut.

## 13.4 THE LOCKED SOUND SPEC STILL EXISTS

Do not mistake "no music" for "no sound spec". The spec is still 250–300 words, still authored once, still repeated **verbatim** in every continuous scene — because the reason for that repetition never changed: it is what makes separate clips sound like one unbroken recording.

What the spec now locks:

1. **An explicit statement that the clip carries no music of any kind.**
2. **The quality of the musical silence** — how the absence of a score makes the location's own noise the whole soundtrack.
3. **The continuous ambient bed**, in specific nameable sound: the particular room tone, the particular street, the particular distance of traffic or surf or generator hum. Precise enough that every scene repeating it verbatim sounds like one take.
4. **The recording character** — close, dry, present, unprocessed, no reverb tail, no sweetening.

**The ambience spec is mandatory, not optional.** With neither a score nor an authored ambient bed, the model fills the gap with whatever it likes, and what it reaches for is usually music. Silence has to be *authored* too.

## 13.5 WHEN THE DIRECTOR ASKS FOR MUSIC

They will, and they are not wrong to want it — they are asking for the *feeling*. Do not put music in the prompt. Deliver the feeling through the diegetic sound and the action, and let the composed track carry the rest. Then say plainly that the score is written separately against the finished cut, which is why it will actually fit.

## 13.6 HOW IT IS ENFORCED

Mirroring Part XII, because one instruction inside a 2,000-word prompt does not survive — the model weights early tokens and drifts by the sound block:

1. **The mandate is injected three times** per prompt: the ABSOLUTE RULES block, the top of the SOUND block, and the CLOSING RESTATEMENT (`soundPolicy.js` → `noMusicMandate`, `NO_MUSIC_RESTATEMENT`).
2. **A JS gate** (`sceneSoundViolations`) fails a scene that never forbids music, that asserts the rule fewer than three times, or that names music affirmatively. Detection is sentence-scoped, so `"absolutely no music, no melody, no instrumental bed"` passes while `"a warm kora melody builds"` fails.
3. **A registry gate** (`registrySoundViolations`) checks the locked spec *before any scene is built* — that one field is pasted into every prompt, so a music-specifying spec would score the entire film. One repair there beats nine repairs later.
4. **`check_film`** in the storyline agent runs the same scene gate, so the agent cannot report a music-carrying scene as clean.
