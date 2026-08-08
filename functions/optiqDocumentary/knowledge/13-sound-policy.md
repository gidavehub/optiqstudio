# OPTIQ KNOWLEDGE — PART XIII: THE SOUND POLICY (no music, no speech)
(Internal operating doctrine for the Optiq Documentary agent swarm. Supersedes the music-consistency rule in Part V, and is stricter than the copies in the other two sandboxes.)

# PART XIII — THE SOUND POLICY

> Part V taught you to describe a film's background music identically in every scene so nine clips would cut together as one track. **That rule is reversed.** The clips carry no music at all — and in this film they carry no speech either.

## 13.1 WHAT CHANGED, AND WHY

When the platform had no composer, the only way to get music into a film was to ask the video model for it. Optiq now has one. **Lyria 3 Pro** writes the score *after* generation: it is given the finished cut, composes to it, and the track is laid under the timeline at an exact length.

That makes model-generated music actively harmful:

1. **It cannot be removed.** Music the video model invents is baked into that clip's audio. There is no stem, no separation, no mute.
2. **It collides.** The invented bed plays underneath the composed score. Two unrelated pieces of music, different keys, different tempos, at once.
3. **It wastes money.** The only fix is re-rendering the scene, and every render costs the director.
4. **It is inconsistent anyway.** The model's idea of "warm optimistic kora" differs every generation, which is the exact drift the locked spec existed to suppress.

## 13.2 AND IN A DOCUMENTARY, THE SAME IS TRUE OF SPEECH

Every word in this film is a narrator's voiceover, written in the outline and recorded afterwards against the finished cut. So speech in a clip fails in exactly the same three ways music does, plus one worse one:

1. **It cannot be removed** — it is in the clip's audio permanently.
2. **It collides** — a voice in the footage talks over the narrator.
3. **It wastes money** — only a paid re-render undoes it.
4. **The lips do not match.** This is the one that has no equivalent on the music side. The audience hears a narrator and watches a mouth forming completely different words. There is no mix that fixes it.

That is why a scene prompt in this sandbox states, three separate times, that nobody speaks and no lips move in speech — and why the scene gate fails a prompt that says it fewer than twice.

## 13.3 THE LAW

**The video model generates NO music and NO speech. Ever.**

No soundtrack. No underscore. No theme. No jingle. No melody. No instrumental bed. No orchestration. No strings, piano, guitar, kora, balafon, djembe, synth, bassline, drum loop or percussion groove. No humming, singing, whistled tune or chanting. No music leaking from a radio, television, phone, speaker, passing car or market stall *inside the scene*. No musical sting on a cut. Nothing tonal, nothing melodic, nothing rhythmic a listener would call music.

And: no dialogue, no conversation, no greeting, no shouted line, no narration, no voiceover, no audible words at all. No lips moving in speech — not talking, not mouthing, not mid-sentence. No interviews, no talking heads, no piece to camera.

**What the clip carries instead:** the real diegetic sound of the physical events in frame — footsteps, cloth, breath, hands on objects, liquid, metal, wood, doors, engines, tools, wind, room tone — plus the location's authored ambience.

This is not an impoverished soundtrack. It is a *clean* one, and in a documentary it is the point: with no score and no voices, the location's own noise carries the whole clip, and every physical event gets its sound in as much detail as ever. §5's sound craft applies in full.

## 13.4 THE FOUR VIDEO TYPES

The music law is identical in all four. What differs is only where the *voice* comes from.

| Type | Video model generates | Music | Voice |
|---|---|---|---|
| Short film / story | diegetic sound + dialogue | Lyria 3 Pro, after the cut | in-clip dialogue |
| Ad with dialogue | diegetic sound + dialogue | Lyria 3 Pro, after the cut | in-clip dialogue |
| Narrated ad | diegetic sound only — **no speech** | Lyria 3 Pro, after the cut | TTS voiceover, written after by watching the cut |
| **Documentary** | diegetic sound only — **no speech** | Lyria 3 Pro, after the cut | TTS voiceover, **written in the outline**, fitted to the cut afterwards |

The last row is the one this sandbox lives in, and the difference from the row above it matters: a narrated ad's voiceover is invented at audio-post time by a model watching the pictures. A documentary's narration is authored by the outline skill, because the argument has to be decided before the pictures are — and re-deriving it from footage afterwards is exactly how a documentary becomes a slideshow with a voice on it.

## 13.5 THE LOCKED SOUND SPEC STILL EXISTS

Do not mistake "no music" for "no sound spec". The spec is still 250–300 words, still authored once, still repeated **verbatim** in every scene — because the reason for that repetition never changed: it is what makes separate clips sound like one unbroken recording.

What the spec locks here:

1. **An explicit statement that the clip carries no music of any kind.**
2. **An explicit statement that it carries no speech of any kind**, and that the narration is recorded separately.
3. **The quality of that silence** — how, with no score and no voices, the location's own noise is left carrying the whole clip.
4. **The continuous ambient bed**, in specific nameable sound: the particular room tone, the particular street, the particular distance of traffic or surf or generator hum. Precise enough that every scene repeating it verbatim sounds like one take.
5. **The recording character** — close, dry, present, unprocessed, no reverb tail, no sweetening.

**Pitch the bed so a narrator fits on top of it.** This is the documentary-only addition. A wall-to-wall roar of ambience is a bed the voiceover has to fight, and audio post cannot duck what is baked into the clip. Present, textured, and not overwhelming.

**The ambience spec is mandatory, not optional.** With neither a score, nor voices, nor an authored ambient bed, the model fills the gap with whatever it likes, and what it reaches for is usually music. Silence has to be *authored* too.

## 13.6 WHEN THE DIRECTOR ASKS FOR MUSIC — OR FOR SOMEBODY TO SPEAK

They will, and they are not wrong to want either.

**Music:** they are asking for a *feeling*. Do not put it in the prompt. Deliver the feeling through the diegetic sound and the action, and let the composed track carry the rest. Then say plainly that the score is written separately against the finished cut, which is why it will actually fit.

**Speech:** they are usually asking for something to be *said*. That is what the narration is for, and changing narration is free — no footage moves, no render is paid for. Offer that instead. If they genuinely want people talking on camera, that is an original story or a dialogue ad, which are different project types started from the portal.

## 13.7 HOW IT IS ENFORCED

Mirroring Part XII, because one instruction inside a 2,000-word prompt does not survive — the model weights early tokens and drifts by the sound block:

1. **The mandate is injected several times** per prompt: the ABSOLUTE RULES block, the top of the SOUND block, and the CLOSING RESTATEMENT (`soundPolicy.js` → `noMusicMandate`, `NO_MUSIC_RESTATEMENT`).
2. **A JS gate** (`sceneSoundViolations`) fails a scene that never forbids music, that asserts the music rule fewer than three times, that names music affirmatively, or that asserts the no-speech rule fewer than twice. Detection is sentence-scoped, so `"absolutely no music, no melody, no instrumental bed"` passes while `"a warm kora melody builds"` fails.
3. **A registry gate** (`registrySoundViolations`) checks the locked spec *before any scene is built* — that one field is pasted into every prompt, so a spec that omits either rule omits it from the whole film. One repair there beats N repairs later.
4. **A purity gate** (`scenePurityViolations`) fails any scene whose dialogue field is non-empty, or whose prompt contains a talking head, a mouth mid-sentence or an on-screen caption.
5. **`check_film`** in the documentary agent runs the same gates, so the agent cannot report a music-carrying or speech-carrying scene as clean.
