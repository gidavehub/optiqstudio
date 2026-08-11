# OPTIQ SKILLS KNOWLEDGE — PART XVII: THE LOCATION BIBLE (every place written once, pasted verbatim, and kept apart from its neighbours)

(Internal operating doctrine for the Optiq Story X sandbox. **This module exists in the experimental original-story sandbox only.** The ad swarm, the original-story swarm and the documentary swarm do not have it and must not be given it.)

# PART XVII — THE LOCATION BIBLE

## 17.1 WHAT THIS REPLACED, AND WHY THE REPLACEMENT HAS TO BE THIS LONG

This sandbox used to **photograph** the film before it filmed it. Every place got a still; every arrangement inside the place got a still generated from that still; every scene got a frame generated from the arrangement. Those frames were attached to the render and they were the only thing the video model saw.

It worked, on the one axis it was built for: the rooms stopped drifting. It failed on three others.

1. **It cost a hundred-plus images and twenty-odd minutes** before a second of video existed.
2. **It could not be revised.** "Move the desk" was not a prompt edit, it was a re-photograph of a tier and everything under it.
3. **The classifier refused it, silently.** Hand a video model a photorealistic picture of a specific person and ask for that person handcuffed, in a cell, being arrested, cornered by police — and the request reads as a real, identifiable human being placed in a defamatory situation. The model cannot know the face was itself generated. It declines, without saying it declined, and bills for the attempt. Any story with teeth in it — and a story without teeth is not a story — was unfilmable that way.

So the pictures are gone and **the words carry the whole load now**. That is not a downgrade dressed up: text-to-video renders these scenes, and image-to-video did not.

But it only works at density. A place described in forty words is a place the model invents twelve different ways across twelve scenes. **The unit of consistency is the identical paragraph.** Two clips generated from the same 600 words of room come back as the same room. Two clips generated from two different summaries of the same room come back as two rooms.

## 17.2 THE BIBLE

Every location the film uses is written **once**, in full, by the location designer, before a single scene prompt is compiled. That block is then **pasted verbatim** into every scene set there — not summarised, not re-worded, not "adapted for this moment." Verbatim.

**500–700 words per location.** Not 200 with the promise of more later. The block is the room.

Where in the range:

- **700 — complex places.** A bank, a hall, a courtroom, a police station, a ward, a classroom, a restaurant, a shop, a market, an office with more than one desk, a wedding, a funeral, **the inside of a car**. Anything with a queue, a counter, a crowd, signage, multiple seats, or more than three background people. These have dozens of independently-invented details and every one of them is a continuity error waiting to happen.
- **500 — simple places.** A bedroom, a corridor, a stretch of wall, a single-room bitik, a patch of yard. Four surfaces and a handful of objects.

Below 500 the block does not hold a room. There is no upper mercy either: at 900 the model starts losing the early sentences.

## 17.3 THE ORDER THE BLOCK IS WRITTEN IN

Fixed. Same order every time, for every place in the film. The order is itself a consistency device — the model reads position-in-paragraph as importance, and a room whose blocks are ordered differently from scene to scene is a room whose priorities keep changing.

**1. THE SHELL.** What kind of structure, how big in real terms (paces across, ceiling height), the shape of the footprint. Where the openings are — every door and every window, on which wall, how wide, what is on the other side of them.

**2. THE SURFACES.** Floor: material, colour, condition, what is on it. Walls: material, finish, colour, and **the marks** — the scuff at chair height, the damp bloom in the corner, the paint that stops where the old shelf was. Ceiling: material, fittings, stains. This is where §4.2's Rung 3 lives, and it is what separates a real room from a rendered one.

**3. THE LIGHT.** Where it comes from — which window, which fitting, which doorway — what colour and quality it is, what it lands on and what it leaves dark, and where the shadows fall. State the time of day this block assumes; if the film uses the place at two different times, the bible writes **two separate locations** (see §17.5).

**4. THE FIXED FURNITURE AND FITTINGS.** Everything that does not move between scenes, placed relative to the openings and to each other. Not "a desk" — *the* desk: what it is made of, how big, where it stands, which way it faces, what is on it, what is under it.

**5. THE DRESSING.** The loose, specific, local objects. Rung 4 of the specificity ladder is the floor here, not the target: the named local thing that makes a Gambian audience nod. What is stacked in the corner, taped to the wall, hanging on the nail, left on the sill. **The mess.** Models do not add wear unprompted and wear is the signature of reality.

**6. THE SEATING AND STANDING GEOGRAPHY.** *This is the block that stops people teleporting.* Every position a person can occupy in this place, named and fixed: which chair, on which side of which table, facing which way, with what within reach of their hands. A scene set here then says "MARIAMA is in the left-hand chair" and the model knows exactly what that means — because the bible already said what the left-hand chair is, where it stands and what is behind it.

For a **car**, this is the whole point and it must be exhaustive: driver's seat, front passenger, each rear seat, which way each faces, what each can see through which window, the gap between the front seats, what is on the dashboard, what is in the door pockets, the state of the upholstery, what hangs from the mirror.

**7. THE BACKGROUND LIFE.** Who else is in this place when it is in use, how many, roughly what ages, what they are wearing, and — the part that gets skipped — **what each of them is doing**. Rung 5. Not "customers"; a woman at the second window counting notes back into an envelope, a man by the door who keeps checking a phone he is not using. Background people every scene invents fresh are background people who change every cut.

**8. THE SOUND OF THE PLACE.** Its specific continuous noise, named precisely enough that every scene set here repeating it sounds like one recording. Not "ambient noise" — the particular ceiling fan, the particular generator two compounds over, the particular distance of the road.

## 17.4 THE STAGING LINE — WHAT THE SCENE ADDS ON TOP

The bible block is the place **at rest**. It never changes.

Each scene set there pastes the block verbatim and then adds a short **staging paragraph** of its own — and only this:

- Where each character in this scene is, in the bible's own vocabulary ("seated in the left-hand chair", "standing in the doorway to the yard").
- What is **different today**, and only what is genuinely different: a chair pulled out, the shutter closed, a bag on the table that is not usually there, water on the floor.
- Anything that **changes during these ten seconds**, because a fixed description cannot carry a change: the lamp switched on, the table overturned, the rain starting.

That is all. **A scene that re-describes the walls has already broken the room**, because its re-description and the bible's description are two accounts of one wall and the model reconciles them by inventing a third. Paste, stage, stop.

## 17.5 THE SEPARATION RULE — TWO ROOMS OF THE SAME KIND

The failure this rule exists for: a film with two offices in it, or two bedrooms, or two bank branches, described by a bible that calls one "a small office with a desk and a window" and the other "a modest office, desk, window". Those are the same room. The film now has one office in it and the audience has quietly lost track of where anything is happening.

**Two places of the same kind must be separated on at least four axes, and the block must say so explicitly:**

- **SIZE or SHAPE** — one is long and narrow, one is square.
- **LIGHT** — one takes hard sun from a high window, one is lit by a fluorescent tube with a dead end.
- **A DOMINANT COLOUR** or material — one has bare cement and grey steel, one has cream paint gone yellow and dark wood.
- **ONE UNMISTAKABLE OBJECT** the other does not have, and it must be big enough to be in most frames — a wall of box files, a broken air conditioner, a ceiling fan with one blade taped.

And the block **names the other place and says how it differs**: "This is NOT the branch office in scenes 4 and 9 — that one is narrow, fluorescent-lit and lined with box files; this one is square, sunlit, and dominated by the dark wooden cabinet on the back wall."

Naming the sibling is what makes the separation survive. A model that has been told what a place is *not* holds the difference far better than one that has merely been told what it is.

**The same rule binds time of day.** The same kitchen at dawn and at night is **two locations in the bible**, written separately, each with its own light block, each naming the other.

## 17.6 WHAT THE BIBLE DOES NOT CONTAIN

- **No people from the cast.** Characters are the casting registry's; the bible writes the room and the strangers in it. A named character who appears in a location block will start appearing in scenes they are not in.
- **No story.** No events, no beats, no "this is where the argument happens". The block is what a location scout photographs on an empty day.
- **No camera.** Where the camera goes is the scene's business. The bible states the *geography* the camera works in, never a shot.
- **No music, ever.** §13 binds here as everywhere. The sound-of-the-place field is the room's real noise and nothing else.
- **No mood adjectives doing the work of description.** "Oppressive", "cosy", "tense" are not things a camera can point at. §1.3's banned vocabulary applies in full. If the room is oppressive, say the ceiling is low, the window is high and small, and the walls are the colour of wet cement.

## 17.7 THE TEST

Read one location block. Then answer, without inventing anything:

- How many paces across is it, and where are the doors?
- What is under your feet, and what is on the wall behind the main seat?
- Where is the light coming from, and what is in shadow?
- If two people sit down, where exactly do they sit, and what can each of them reach?
- Who else is in the room, and what are their hands doing?
- What does it sound like?

Any question you cannot answer is a detail the video model will invent — and invent differently in the next clip. Go back and write it.
