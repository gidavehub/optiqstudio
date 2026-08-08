# OPTIQ KNOWLEDGE — PART II: THE PROMPT ARCHITECTURE (canonical block order, length doctrine, copy-ready rule)
(Internal operating doctrine for the Optiq Documentary agent swarm. The ad swarm's Part II, re-cut for a silent, narrated film.)

# PART II — THE PROMPT ARCHITECTURE

## 2.1 THE CANONICAL BLOCK ORDER

Every scene prompt is a single copy-paste block, in this exact order. The order is not cosmetic — models weight early tokens more heavily, so **identity and the hard prohibitions come first.**

```
1.  LOCKED SUBJECT BLOCK(S)        <- only if this film follows somebody. Usually absent.
2.  BUILD / CLOTHING / SKIN LINE   <- ~20 words. Attached to each locked subject.
3.  CLOTHING (THIS SCENE)          <- only if it differs from the lock.
4.  STYLE                          <- the film's visual contract.
5.  ABSOLUTE RULES                 <- ALWAYS PRESENT HERE: no music, no speech,
                                      no on-screen text, nobody looks at the lens.
6.  THE SETTING / THE WORLD        <- the environment engine output (Part IV).
7.  THE PEOPLE IN FRAME            <- every human visible, described. One-offs.
8.  THE SEQUENCE / ACTION          <- timestamped beats. The event. The heart.
9.  THE SILENCE DECLARATION        <- where a drama puts dialogue, this film states
                                      plainly that nobody speaks and no lips move.
10. CAMERA                         <- Part V.
11. LIGHTING                       <- Part V.
12. COLOR                          <- Part V.
13. SOUND (diegetic)               <- Part V. Opens by restating no music, no speech.
14. THE CLOSING RESTATEMENT        <- one paragraph re-asserting the non-negotiables.
```

Block 9 is the structural difference between this sandbox and the other two, and it is deliberate. The slot exists in the model's expectation of a film prompt; leaving it empty invites the model to fill it. Putting an explicit statement of silence there is what keeps mouths shut.

## 2.2 BLOCK-BY-BLOCK SPECIFICATION

### BLOCK 1 — LOCKED SUBJECT BLOCK
See Part III. Present **only** in a film that follows one named person across scenes, which most documentaries do not. When present: 150–200 words, repeated **verbatim** in every scene that person appears in. Never paraphrased, never trimmed, never "summarised because we already established it." The model has no memory between generations. Every prompt is the first prompt.

In a scene cast `fresh-faces` there is no locked block and there must not be one — pasting a lock into a one-off scene is how a documentary collapses into the same two faces in every shot.

### BLOCK 2 — BUILD / CLOTHING / SKIN
~20 words. Height, build, skin tone, and the working outfit. Workwear, marked by the job — nobody in a documentary is dressed for the camera.

### BLOCK 3 — CLOTHING (THIS SCENE)
Only when it deviates: protective gear, waders, a different shift's clothes. **Rule:** if clothing changes, name **one constant** that persists (the sandals, the wristwatch, the taped finger).

### BLOCK 4 — STYLE
The film's visual contract, ~60–100 words. It answers: what kind of film is this? It always contains:
- The register (`observational documentary` / `close, patient, hand-held` / `formal and still, locked-off`)
- The optical signature (`natural available light, fine film grain, honest colour, no gloss`)
- The motion policy (`the camera is a witness, not a participant — it does not lead the action`)
- The prohibitions (`no lens contact, no posing, no slow motion on people, no drone-and-sunset travelogue`)
- The text policy (`No on-screen text of any kind.`)

There is **no dialogue-language tag** in this film's style header, because nothing is spoken. State instead that the footage is silent of speech and the narration is added afterwards.

### BLOCK 5 — ABSOLUTE RULES
In the other sandboxes this block is optional and deployed only when a constraint is load-bearing. **Here it is always present**, because four constraints are always load-bearing:

```
=== ABSOLUTE RULES (follow strictly) ===
- NO MUSIC of any kind. No soundtrack, no melody, no instrumental bed, no
  humming or singing, no music from any radio, phone or speaker in the scene.
- NO SPEECH of any kind. Nobody speaks. No lips move in speech - not talking,
  not mouthing, not mid-sentence. No dialogue, no conversation, no shouted line.
  This clip contains no audible words. The narration is recorded separately.
- NO ON-SCREEN TEXT of any kind. No captions, subtitles, lower thirds, names,
  dates, numbers, charts or title cards.
- NOBODY LOOKS AT THE LENS. No posing, no smiling for the camera, no
  acknowledgement of being filmed.
```

Anything else genuinely load-bearing for this scene is added underneath, in the same imperative register.

### BLOCK 6 — THE SETTING / THE WORLD
The environment engine. See Part IV. This is where a documentary lives or dies. Density here is the single highest-leverage investment in the whole prompt, and more so than in a drama: with no dialogue and no plot, the world **is** the content.

### BLOCK 7 — THE PEOPLE IN FRAME
**Every human in frame gets described**: age, clothing (specific fabric/colour/garment), position in the scene, and *what they are doing*. People who are merely "a crowd" render as a smear of AI mannequins. People who are "a tailor at a foot-pedal sewing machine who glances up mid-stitch" render as a country. Everyone is explicitly a Black Gambian / Black West African person, and they differ from one another in complexion, hair, age and build.

Nobody in this block is talking to anybody.

### BLOCK 8 — THE SEQUENCE / ACTION
Timestamped: `[0.0-3.0s]`, `[3.0-6.5s]`, `[6.5-10.0s]`. Physical verbs only. At least three separate beats, aiming for five. This is the Prime Directive made concrete, and in a silent film it is the only thing carrying the scene.

One documentary-only consideration: **leave the narrator somewhere to sit.** Plan the ten seconds so at least one stretch of ~2.5s is legible and settled rather than mid-scramble. Dense does not mean frantic.

### BLOCK 9 — THE SILENCE DECLARATION
Where a drama puts its dialogue. Written plainly, in prose:

> *No character speaks at any point in this clip. No lips move in speech, nobody mouths words, nobody is mid-sentence, and there is no conversation of any kind. The clip contains no audible words. The film's narration is recorded separately and laid over the finished cut.*

### BLOCKS 10–13 — CRAFT
See Part V. The SOUND block opens by restating the no-music and no-speech laws, then pastes the locked sound spec verbatim, then this scene's own diegetic event sounds — every physical event in block 8 gets a sound.

### BLOCK 14 — THE CLOSING RESTATEMENT
One paragraph, at the very bottom, restating the non-negotiables. Models weight the *end* of a prompt heavily too — this is the second-most-valuable real estate after the top. It exists to re-hammer the things most likely to drift: **the setting, the key events, the light, the motion policy, no music, no speech, no on-screen text.**

## 2.3 LENGTH DOCTRINE

Prompt length is a function of **how much of the frame is under our authorship.**

| Scene type | Target length | Why |
|---|---|---|
| Single locked shot on one object or process, sparse set | 700–1,100 words | Few elements. Over-writing invites drift. |
| Standard observational scene, one location, few people | 1,100–1,500 words | The house default for this format. |
| Dense working environment with crowds (market, landing site, yard) | **1,500–2,000 words** | Every person, every stall, every reaction must be authored or the model defaults to fake. |
| Multi-cut sequence (three stages of a process in 10s) | 1,200–1,700 words | Each cut is a mini-scene. |

**The rule that matters:** length is never the goal. **Density of authored specifics** is the goal. A 2,000-word prompt full of adjectives about mood is worse than a 900-word prompt full of nouns and verbs. But a landing-site scene *cannot* be authored in 900 words, so it gets 2,000.

## 2.4 THE COPY-READY RULE

> **The prompt is the deliverable. Not the discussion of the prompt.**

Subject blocks, style, rules and craft all live **inside** the copy-paste block. Nothing the model needs may sit outside it in commentary. This was learned the hard way: a description presented "above" the prompt as reference material is a description that never reaches the model.

**The narration is the one thing that must NOT be in the block.** It is not spoken in the clip, it is not printed on the screen, and a video model handed a line of narration will try to render somebody saying it. The narration travels beside the prompt, in its own field, and reaches the audience only through audio post.
