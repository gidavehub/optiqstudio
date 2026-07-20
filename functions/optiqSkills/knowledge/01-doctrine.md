# OPTIQ SKILLS KNOWLEDGE — PART I: THE DOCTRINE (moments not mood, the seven laws, banned vocabulary, the dead test)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART I â€” THE DOCTRINE

Everything in this system exists to solve one problem: **AI video defaults to beautiful, empty, dead footage.** It will happily give you a woman stirring a pot in golden light while the camera drifts lovingly around her, and it will be worthless, because nothing *happens*. It is a screensaver. It is a stock photo that moves.

Our entire method is a machine for forcing events into frames.

## 1.1 THE PRIME DIRECTIVE: MOMENTS, NOT MOOD

> **We do not capture scenes. We capture moments.**

A scene is a place with a mood. A moment is a **specific physical event with a beginning, a middle and an end**, that could have been caught by a camera that happened to be there.

The difference, concretely:

| âœ— DEAD (mood) | âœ“ ALIVE (moment) |
|---|---|
| "She tends a pot over a fire, soft sweat on her brow, glowing embers establishing her hard work." | "She stirs the pot with a wooden spoon. The back of her hand grazes the hot rim. She snaps it back, winces, shakes it out, mouths *'oy!'*, and goes back in." |
| "He walks through campus, determined but visibly exhausted from his commute." | "He raises his hand in the lecture hall to answer a question." |
| "She waits by the roadside, the daily struggle etched on her face." | "She extends her right arm into the road, holds the arm still, and flaps her open palm up and down. The third bus pulls over. She boards." |
| "The businessman is overwhelmed by his paperwork." | "He counts the notes, punches the calculator, frowns, checks it against the ledger â€” they don't match. He flips back a page and runs a finger down the column." |

The left column is what an AI model *wants* to produce and what a lazy prompt-writer *asks for*. It contains adjectives about feelings. The right column contains **verbs about hands**.

**The test:** Can you *film* it? "Establishing her hard work" cannot be filmed. "Her hand grazes the hot pot rim" can be filmed. If a line in your prompt cannot be filmed, delete it.

## 1.2 THE SEVEN LAWS

**LAW 1 â€” An event, not an atmosphere.**
Every scene must contain at least one physical thing that *happens*. Something changes state. A hand touches. A ball is struck. A lid closes. A bus stops. If nothing changes state, the scene is dead.

**LAW 2 â€” The camera is a witness, not a poet.**
The camera happened to be there. It does not swoon. It does not zoom into a face to tell you how to feel. It does not slow-motion a tear. It watches a thing occur and it lets the thing occur.
*Exception:* product/food beauty and motion graphics, where the camera IS the show. Never for people.

**LAW 3 â€” Nobody looks at the lens. Ever.**
Eyelines go to other people, to the road, to the page, to the pot, to the phone. The instant a character stares down the barrel, it becomes an advert. We are making a film that is an advert, not an advert that is pretending to be a film.

**LAW 4 â€” Specify the key, let the model fill the incidental.**
The model knows how to make dust. It knows how to make steam, embers, exhaust, feathers, sweat. **Do not spend words on particulate matter.** Spend them on the *event*, the *objects*, and the *people*. A prompt that describes "dust motes drifting from beneath the tyres" and forgets to say what the driver does is a failed prompt.

**LAW 5 â€” Real over pretty.**
Groundnut fields in harvest season are dry, brown, and scrubby â€” not lush green. A working morning is flat and hazy, not golden-hour. A poor home is lit by one candle, not a "dimly lit bulb or lantern." When beauty and truth conflict, truth wins, because truth is what makes the audience believe it, and belief is what makes them feel.

**LAW 6 â€” Emotion is earned by event, never by instruction.**
You cannot write "she looks determined but exhausted, embodying her journey" and get anything but a blank actress doing Blank Actress Face. You write the *event* that produces the emotion â€” the third bus that doesn't stop â€” and the emotion arrives free.

**LAW 7 â€” Consistency is authored, not uploaded.**
A face is held across nine clips by a **verbatim block of words repeated at the top of every prompt**, not by attaching a reference image. (See Part III â€” this is the heart of the system.)

## 1.3 THE BANNED VOCABULARY

These words and constructions are **prohibited** in scene prompts. They are the fingerprints of dead footage.

**Banned: "establishing" language**
- "establishing her hard work" / "grounding the viewer in her reality" / "conveying the weight of"
- *Why:* it instructs a theme, not an action. The model renders a pose.

**Banned: emotional-summary language**
- "embodying her struggle" / "she looks determined but exhausted" / "a face that tells the story of"
- *Why:* produces Blank Actress Face. Write the event instead.

**Banned: the golden-hour reflex**
- "golden light" / "golden hour" / "glorious warm sun" â€” *unless the scene is genuinely at dawn/dusk and the beauty is the point.*
- *Why:* it is the model's favourite default and it makes everything look like a fake NGO advert. Working scenes get **flat, hazy, honest daylight.**

**Banned: particulate poetry**
- "dust motes catching the light" / "embers drifting" / "particles falling from the sky" / "dust kicking up from beneath the tyres"
- *Why:* Law 4. The model does this natively. You are wasting your word budget and crowding out the event.

**Banned: staged joy**
- "jolly" / "beaming with pride" / "villagers laughing joyfully together"
- *Why:* it produces a tourism board commercial. People at work are *working*. Joy must be earned by an event (a goal, a saved plate, a mother-in-law's approval).

**Banned: the drama verbs**
- "dramatically" / "cinematically sweeping" / "epic" (as an instruction rather than a result)
- *Why:* these are outcomes, not directions. Direct the camera and the light; the epic is a consequence.

**Banned in scenes with minors:** see Part IX. `heartbreak`, `crestfallen`, `dejected`, `distress`, `sad`, `slumps`, `braced for bad news` â€” all trip minor-safety classifiers even in wholesome content.

## 1.4 THE "IS THIS DEAD?" TEST

Before any prompt ships, run it:

1. **The Verb Count.** Count the physical verbs in the action block. Under five for a 10s scene? It's dead. Rewrite.
2. **The Filmability Scan.** Read every sentence. Any sentence that cannot be pointed at with a camera gets deleted.
3. **The Adjective Purge.** Every adjective describing a *feeling* is deleted. Every adjective describing a *physical property* (blackened, faded, ridged, dusty, glossy) stays.
4. **The "So What Happens?" Question.** Say the scene out loud in one sentence, using only actions. "She stirs, she burns her hand, she pulls back." Good. "She... cooks, and it's meaningful." Dead.
5. **The Eyeline Check.** Does anyone look at camera? Fix it.
6. **The Default-Africa Check.** Would this footage be indistinguishable from a stock "Africa" clip? If yes, you have failed Part IV.

## 1.5 TRUST THE MODEL, FEED THE MODEL

Two apparently opposite truths that must be held at once:

**Trust it.** Modern video models render text, UI, packaging, complex motion graphics, crowd scenes and physical comedy. Do not hedge. Do not write timid prompts. Do not say "if the model can manage it." Ask for the thing you actually want.

**Feed it.** Trust is not the same as brevity. The model will fill any gap you leave with its own defaults â€” and its defaults are the generic Africa of Part IV. **Every unspecified element is a vote for the clichÃ©.** So specify: the vendor's wares, the colour of the wall, what the man in the background is doing, the make of the bus, what's on the coffee table.

> **The formula:** Trust it with the *ambition*. Feed it the *specifics*. Never trust it with the specifics â€” that's where the fake comes from.

