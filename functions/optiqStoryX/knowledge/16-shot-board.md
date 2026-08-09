# OPTIQ STORY KNOWLEDGE — PART XVI: THE SHOT BOARD (the world, photographed, in tiers)
(Internal operating doctrine. Added when the platform started photographing its films before rendering them; rewritten when the flat board became a hierarchy. Extends Part XIV from faces to places, arrangements, objects, change and angles.)

# PART XVI — THE SHOT BOARD

> Part XIV fixed the faces. This part fixes everything the faces are standing in, everything they are holding, and what happens to all of it while the film runs.

## 16.1 THE FAILURE THIS EXISTS FOR

A film is a pile of separately generated ten-second clips, and the video model has no memory between them. Character references solved identity: the same person survives nine clips because every clip carries their picture.

The failure then moved outward, one layer at a time, and each layer had to be caught in turn.

**The place moved.** The kitchen had a different window in scene 4, the shop counter changed sides, the light went from afternoon to evening and back. **Vehicles were the worst of it**: between two clips of the same journey the driver and the passenger swapped seats, the steering wheel moved to the other side of the car, a door disappeared.

**Then the place held and the things inside it moved.** The room was right and the plate was on the wrong side of the table. The taxi was right and the phone that was on the dashboard was now in the cupholder. Two angles of the same scene disagreed about where everything was, because each angle was generated from the same paragraph and a paragraph does not say which side of the table.

**Then nothing moved that should have.** The meal that got eaten in scene 2 was untouched in scene 9. The letter that was torn was whole. A world photographed once and used everywhere is a world where nothing the story does to it survives.

The diagnosis is the same one §14.1 made about faces, applied three times. **Prose is a specification the model approximates. A picture is a target it matches.** A paragraph cannot hold a room still, cannot hold a table setting still, and cannot make a change stick.

## 16.2 THE ANSWER: A HIERARCHY OF PHOTOGRAPHS

Before any clip is rendered, the film is photographed — and crucially, **each tier is generated FROM the picture of the tier above it**, never from a fresh reading of the same paragraph. Two readings of a description disagree. Two crops of a photograph cannot.

**TIER 1 — THE ENVIRONMENT.** The whole place, empty of people — and *place* means whatever this film needs it to mean. One master plate, plus a **second covering angle** when the film shoots back past what the master can see. Generated from words, because something has to be.

There is deliberately **no taxonomy of place-types** anywhere in this system. An earlier version classified every location — interior, exterior, vehicle, underwater, space — and wrote a different prompt for each. That was wrong twice over. It made every plate prompt quietly assume the place was one of a handful of known kinds, and worse, the classification leaked upstream: a film asked to sort its own locations into a fixed list starts inventing locations that sort neatly, which is how every story ends up happening in a room. Nothing in the prompts now assumes walls, a floor, a ceiling, ground, air, weather, gravity or daylight. A place is described on its own terms, in the words it actually deserves, and the machinery works identically on a shoreline, a hull, a shaft or a vacuum as it does on a kitchen.

**TIER 2 — THE SETTINGS.** An *arrangement* inside an environment: the dressed dining table, the front of the cab, the desk with the papers on it, the patch of sand where the things were dropped. **Generated with the environment plate attached**, so an arrangement is physically inside the place it belongs to. This is the tier that fixes which side of the table the plate is on, and it deliberately keeps the surrounding place in frame so one plate carries both the table and the room.

**TIER 2 — THE OBJECTS.** One thing, on nothing. Each carries a `detail` field naming what must be *legible* and identical every time: the letterhead, the three messages and who sent them, the plate number. A document whose letterhead changes between two cuts is an error the audience sees.

**TIER 2 — THE CAST.** Character sheets, from Part XIV, unchanged.

**TIER 3 — THE STATES.** None of the above is frozen. Every environment, setting and object carries a `states` array, and **a state's plate is generated FROM the previous state's plate** with one instruction: this is the same thing, later, exactly this changed, everything else is pixel-identical. Change becomes a chain of photographs instead of a chain of adjectives. A thing that never visibly changes has one state, and that is the correct answer.

**TIER 4 — THE FRAMES.** The angles — the final result, and the only tier the video model ever sees. Each frame is generated from the state-resolved setting plate (or the environment plate for a shot wider than any one arrangement), plus the character sheets of the people in it, plus the object plates of the things in it.

Everything above the frames is **empty of people**, and that is load-bearing: a plate with a person in it drags that person into every picture generated from it, which is §14.4's contamination arriving through a different door.

## 16.3 WHAT THE HIERARCHY BUYS AT THE BOTTOM

Once a scene has been photographed, its video prompt no longer has to describe anything the pictures already show.

The old 1,500–2,000-word scene prompt spent most of its length on how things look, for exactly one reason: to stop the video model inventing a different-looking world. It no longer has to. So a photographed scene renders from a **FRAMED PROMPT** instead — a few hundred words of what the pictures *cannot* say:

- **what happens**, on the clock, every timestamped beat, losing none of them;
- **the dialogue, word for word**, with its language tag;
- **who speaks and in what voice** — age, register, texture, pace, emotional state. The pictures show faces and say nothing about what those faces sound like, and an unattributed line comes back in the wrong mouth;
- **every sound** — the continuous ambience, and a named sound for every physical event in the beats. This is now one of the most important parts of the prompt, because it is the half of the film no still can carry;
- **no music**, stated explicitly, as always;
- **camera movement and cuts** — where the camera travels, not where it is.

Everything about appearance is deleted. The only exception is appearance that *changes* during the ten seconds — someone gets soaked, a shirt tears, a screen lights up — because a still cannot show a change.

Keeping the look-description would be worse than redundant: it invites the model to re-interpret something it can already see, and the two never agree.

**This is not a compression exercise, and the budget says so: 1,000–1,500 words.** The temptation is to read "drop the look" as "write less", and that produces a clip that comes back half-silent and flatly performed. One subject is dropped; every remaining subject goes *deeper* than the original prompt ever went. Sound alone is worth several hundred words and almost never gets them — the ambience, its level under the voices, and a named noise for every physical event across ten seconds. Voices are worth more than a name: age, register, texture, pace, and the state a line is delivered in. Under-specifying costs a render; over-specifying costs nothing.

The long prompt stays on the scene as the script the director reads and revises. It simply stops being what gets rendered. **A revision clears the framed prompt**, because a brief compressed from the old script ignores the revision.

## 16.4 THE ECONOMICS, WHICH ARE THE REAL ARGUMENT

A wrong frame costs one image. A wrong clip costs a video render, and the director finds out three minutes later. Everything this catches is caught at roughly a fortieth of the price, in a form they can look at before spending anything.

That is also why the board is built by its own background job rather than inside the storyboard pipeline: a long film is now well over a hundred pictures, the image quota is eight a minute, and bolting an hour of photography onto a nine-minute pipeline would strand the storyboard itself. A stranded storyboard costs the whole generation; a stranded shot board costs some pictures, and the next pass makes them.

The board is photographed on the **pro image tier**, not the flash tier, and the reason is legibility: the flash tier garbles readable text on a document or a phone screen, which is half of what an object plate is *for*.

## 16.5 HOW MANY SETUPS A SCENE GETS

Straight from the cut logic in Part VI. A scene whose content **is** physical continuity is ONE setup for the full ten seconds (§6.2) — a legitimate answer and often the strongest. A scene that cuts gets one setup per cut, two or three being the house pattern (§6.3).

**Four setups is the hard ceiling**, and **five stills** is the ceiling on the whole scene. Those two numbers differ because a setup whose camera travels is photographed **twice** — where it starts and where it arrives — and both ride along with the render. So the budget genuinely trades: a three-setup scene can buy two moves, a four-setup scene can buy one.

The setups must tile the ten seconds end to end: no gaps, no overlaps, 0.0s to 10.0s.

## 16.6 THE FIELDS THAT DO THE WORK

**geometry** (environment) — where things ARE, as fixed physical facts of the place. Which side the door is in, which way the counter runs, what lies straight ahead. Written bluntly: "the door is in the left-hand wall", never "the room feels open".

**For any vehicle it must state, by name**: which side the steering wheel is on, who is in the driver's seat, who is in the front passenger seat, who is in the back and on which side, which way the vehicle faces, which windows are down. "The two of them sit in front" is exactly the sentence that produces a clip where they have swapped.

**layout** (setting) — the field the whole middle tier exists for. Exact positions, stated precisely enough that two different photographers would place every item identically. Stated against the environment's geometry — "on the door side of the table", never "on the right", because right depends on where the camera is and the camera moves.

**seating** (setting) — where people go, by name. This is the vehicle-seat failure arriving at a dining table, and it is prevented the same way: name the person and name their place.

**change** (state) — only what is physically different from the state before, and as few things as possible. Not a re-description. The photograph of this state is generated from the photograph of the one before it, and **everything not mentioned stays identical**, which is exactly what you want. If the change is so large that nothing of the original survives — the room burns down — that is a new environment, not a state.

**firstFrame** — the single frozen instant a still shows. One moment, present tense, no camera move, no "then". A still cannot pan. Writing the shot into the field that describes the frame is the most common mistake there is, and the gates reject it.

**endFrame** — where a moving setup *arrives*, written to the same rules, and photographed **from its own first frame**. A pan specified by one end and a sentence is a pan the model improvises; a pan specified by both ends is one it interpolates. Left empty for a locked shot — an empty endFrame is a normal answer, and filling it to look thorough wastes a still the scene's budget needs elsewhere.

**entry** — does the cut land with the action already underway, or does the frame hold for a beat first? Most cuts inside ten seconds are straight into action; a held frame is a deliberate choice.

## 16.7 WHERE THE CAMERA CAN BE

**A real camera is physically in the place, operated by a real person.** It stands, sits, kneels or is mounted somewhere a camera could actually go, at a height a body could hold it, with room behind it for the lens. It does not float inside a wall, hover at ceiling height inside a car, or look through solid matter.

This is not fussiness. An angle that could not have been photographed reads as fake before anyone can say why, and — worse — it cannot be matched by the next angle, because there is no consistent place that both are inside. **If the place is cramped, the coverage is cramped.** A tight, awkward, honest angle beats an impossible wide every time.

Coverage is designed the way a crew with one camera and limited time actually works: a wide that establishes, a closer angle that carries the performance, an insert on the thing that matters. Not coverage that needs a crane, a second unit or a wall removed.

## 16.8 THE EXAMPLES ARE FORMAT, NEVER CONTENT

Every directive in this system teaches by example, because "a 35mm wide from just above knee height" communicates a standard that "be specific" does not. The cost is that models reproduce the example: show a taxi and a dining table in the brief and every film acquires a taxi and a dining table.

So **every directive that shows an example also carries the creative mandate**: the examples show the LEVEL OF DETAIL and the SHAPE of a good answer, none of it is in this film, and a generic answer that satisfies every rule is worse than a surprising one that satisfies them too. If the instinct is the thing that was in the example, that is the instinct to distrust.

## 16.9 WHAT THE CLAUSE SAYS, AND WHAT IT SUPERSEDES

The block appended to the render prompt tells the video model that the attachments are not references but **its own frames**, gives each one its timecode and its movement, pairs a moving setup's two stills as one continuous shot rather than a cut, forbids cutting anywhere except at the stated times, and forbids dissolves.

It ends by explicitly superseding the character-reference quarantine clause above it. That clause was written when attachments were grey-backdrop studio portraits and told the model to discard the backdrop, the flat light and the pose. Frames are the opposite: photographs *of this scene, in the real place*, where **everything in them belongs in the clip**. Leaving the old instruction unanswered is how a scene comes back looking like it was shot in a studio.

The precedence rule inverts, for the same reason: where the frames and the writing disagree about **what something looks like**, the frames win. Where they disagree about **what happens**, the writing wins.

## 16.10 SELF-HEALING

Three ways a picture fails, and they want three different answers. Treating them alike is how a pipeline spends money learning nothing.

**Transient** — the service was busy or slow and the prompt is fine. This is the *only* case where asking the identical question again is right: back off and retry.

**Refused** — a classifier declined the prompt. Asking again produces the identical refusal, so the prompt goes to the **prompt doctor** and is REWRITTEN before the retry. The doctor's instruction is mostly a list of what may **not** be given up: every stated position, every piece of geometry, every legible detail, every identity, every shooting instruction, every prohibition. That list is the important half, because the obvious rewrite is the wrong one — a model asked to "make this safe" deletes the specifics, since vagueness is the safest thing there is, and a vague plate is then reproduced faithfully by every picture built on top of it. The rewrite targets only the incidental phrasing a classifier actually reacts to. The film keeps what it needs; the prompt stops asking for it in the register that failed.

**Empty** — a success with no picture in it. In practice a silent refusal, and treated as one.

**Nothing trusts a `url` on its own.** A stored row saying a plate exists is not the same claim as the file existing: an upload can half-fail, a lifecycle rule can sweep it, a delete can take a shared file with it, a killed pass can land between generating and storing. So every stored picture is **verified by loading its bytes** before it is used as a reference, and a missing one is re-shot. This matters more than it sounds, because believing a dead reference fails *silently* — the child picture still comes back, it was just built from prose instead of from its parent, and the board still reports itself complete. Character sheets get the same treatment for the same reason: a missing sheet does not break a frame, it just quietly stops holding the face, which is the exact thing character references were added to fix.

Everything the run repairs is recorded and surfaced to the director. A pipeline that rewrites its own prompts and re-takes its own pictures without saying so is one nobody can debug.

## 16.11 WHEN IT FAILS

Best-effort throughout, like Part XIV. A place whose plate fails falls back to its written lock. A state whose parent plate failed stops its chain rather than silently regenerating from words — because "built from words" is the exact failure the hierarchy exists to remove, and doing it invisibly is worse than not doing it. A scene whose setups fail renders from its prompt alone, exactly as every film did before this existed. A framed prompt that drops a line of dialogue is **discarded**, and the scene keeps its full prompt — correct, just longer-winded.

Nothing here is allowed to cost a director their film.
