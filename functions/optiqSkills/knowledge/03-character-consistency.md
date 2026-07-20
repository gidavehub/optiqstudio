# OPTIQ SKILLS KNOWLEDGE — PART III: CHARACTER CONSISTENCY WITHOUT REFERENCE IMAGES (LCB, five anchors, wardrobe lock, recurrence)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART III â€” CHARACTER CONSISTENCY WITHOUT REFERENCE IMAGES

> This is the most valuable single system in this document. It is what lets us generate nine separate clips, in nine separate context windows, weeks apart, and have them cut together as one film starring one person.

## 3.1 WHY WE DON'T ATTACH CHARACTER IMAGES

Attaching a character reference image seems obvious and is usually wrong:

1. **It trips content classifiers.** Attaching a person's image, especially with any emotional or physical description, flags moderation systems far more aggressively than a text description of the same person. This is the single biggest practical reason. Production observation: *"Attaching the Image as a character always flags the model for some weird reason."*
2. **It fights the prompt.** The model tries to reconcile a fixed 2D likeness with a new pose, new lighting, new angle â€” and produces waxwork faces, wrong ages, and uncanny drift.
3. **It contaminates.** The image brings its *background*, its *lighting*, its *wardrobe*, its *grade*. You wanted a face; you got a kitchen. (Observed repeatedly: a reference flyer's kitchen background bleeding into unrelated scenes.)
4. **It doesn't scale.** Two characters in one shot = two images = the model fuses them or confuses who is who.
5. **Text describes; images demand.** A text block is a *specification the model builds toward*. An image is a *thing the model copies*. Specifications generalise across angles and scenes. Copies don't.

**Conclusion:** faces are authored in words. **Images are reserved for products only** (Â§3.8).

## 3.2 THE LOCKED CHARACTER BLOCK (LCB)

**Definition:** a 50â€“100 word paragraph describing a character's face and presence, written once, and pasted **verbatim** at the top of every single prompt in which that character appears.

**The spec:**
- **50â€“100 words.** Not less â€” under 50 you get drift. Not more â€” over 100 the block starts competing with the action for the model's attention and you get portrait-posing.
- **Physical properties only.** Bone structure, skin, hair, eyes, brows, the shape of things. Not "beautiful," not "kind-hearted," not "she has been through much."
- **One temperament line is permitted at the end** â€” because it governs performance, not appearance. *"Her resting expression is calm, focused, and quietly determined, warming easily into a genuine smile."*
- **Verbatim. Every time.** No paraphrasing, no shortening, no "as established." The model has no memory. Every generation is a cold start.

**The canonical example (Nyima, CONNEKT):**

> **NYIMA** â€” a 20-year-old Gambian woman with deep warm dark-brown skin and a soft oval face. She has high cheekbones, a broad gentle nose, full lips, and large expressive dark-brown eyes under naturally thick eyebrows. Her hair is in neat medium-length black box braids, usually pulled back off her face. She is slim and of average height, around 5'6", with a natural everyday look and no heavy makeup. Her resting expression is calm, focused, and quietly determined, warming easily into a genuine smile. Youthful, hardworking, and real.

**Why it works:** every clause is a *constraint the model can satisfy*. "High cheekbones" is buildable. "Box braids pulled back" is buildable. "No heavy makeup" is buildable and prevents the model's glamour default. "Around 5'6", slim" fixes the body. The final line fixes the performance register.

## 3.3 THE FIVE ANCHORS

Every LCB must nail these five, in roughly this order. They are the load-bearing walls; everything else is decoration.

**ANCHOR 1 â€” SKIN.** Exact tone and finish. `"smooth, even dark-brown skin"` / `"deep warm dark-brown skin"` / `"warm dark-brown skin"`. This is the first thing that drifts and the most noticeable when it does.

**ANCHOR 2 â€” FACE SHAPE + THE THREE FEATURES.** Face shape (`oval`, `round`, `soft oval`) plus **nose, lips, cheekbones**. These three carry identity more than eyes do.
> `"a strong straight nose, full lips, defined high cheekbones"`

**ANCHOR 3 â€” HAIR.** Cut, length, texture, and how it's worn. Be exact.
> `"short black hair cut in a low, tidy fade, slightly fuller on top, with a clean hairline"`
> `"neat medium-length black box braids, usually pulled back off her face"`

**ANCHOR 4 â€” FACIAL HAIR / BROWS / EYES.** For men, the beard is the strongest anchor there is â€” specify its length, grooming, and *how it connects*.
> `"a clean firm jawline framed by a neat, short, well-groomed black beard and a trimmed moustache that connect cleanly along the jaw"`
For women, brows do this work: `"large expressive dark-brown eyes under naturally thick eyebrows"`.

**ANCHOR 5 â€” AGE + BUILD.** Explicit number or tight range, plus build and height.
> `"a 20-year-old Gambian woman... slim and of average height, around 5'6""`
> `"in his late twenties to early thirties... tall and athletic, around 6'0""`

**The Sixth Anchor (optional but powerful): THE STATE MARKER.** A physical condition tied to the film's situation, which the model renders consistently and which reads as *life*:
> `"a light, realistic sheen of sweat on his forehead and temples, jaw set with determined effort"`
> `"beads of light sweat from the cooking heat"`
> `"a little road-dust and honest sweat on his brow; the look of someone who has been moving since dawn"`

## 3.4 THE WARDROBE LOCK

Faces drift. Clothes drift *faster*. The wardrobe lock is a separate, explicit contract.

**The pattern:**
```
=== [NAME] â€” LOCKED OUTFIT, BUILD, SKIN (identical every scene) ===
He is tall and athletic, around 6'0", lean and fit, warm dark-brown skin.
He wears the EXACT SAME OUTFIT throughout: a fitted short-sleeve button shirt
in a warm muted ORANGE/RUST colour worn OPEN over a plain white crew-neck
t-shirt; slim-fit dark NAVY chino trousers; and worn white-and-grey running
trainers. A simple wristwatch on his left wrist. This outfit never changes â€”
same open rust shirt, white tee, navy chinos, white trainers.
```

**The rules:**

**R1 â€” Name the colour twice.** Once in the description, once in the restatement. `ORANGE/RUST` in caps. Colour names drift; caps and repetition hold them.

**R2 â€” Name the garment type precisely.** Not "a shirt." A **camp-collar (Cuban-collar) short-sleeve shirt**. Not "trousers." **Slim-fit chinos**. The model has these as distinct concepts; use them.

**R3 â€” State the closure.** Open over a tee, or buttoned up? This is a real production note that was learned live. `"BUTTONED UP and worn closed (NO t-shirt visible underneath)"`.

**R4 â€” Plain beats patterned for multi-scene consistency.** A solid rust shirt holds across seven clips. A pastel geometric print will drift badly â€” the pattern re-randomises every generation. **If a patterned garment is mandatory, expect to babysit continuity, and describe the print's *palette and geometry* explicitly**: `"a soft PASTEL GEOMETRIC/ABSTRACT PRINT â€” muted blocks and shapes of cream, dusty sage-green, soft terracotta/peach and pale grey"`.

**R5 â€” The Constant.** When wardrobe *must* change scene to scene (a boy who wears his uniform to school and his kit to football), you **name one object that never changes** and carry it in the LCB:
> `"He is the same recognisable boy throughout, though his clothes change from day to day; he always wears the same worn rubber flip-flops."`
Other proven constants: a thin beaded bracelet, a wristwatch, a worn navy backpack, a specific pair of earrings. The constant is a continuity handshake between clips.

**R6 â€” Wardrobe changes are stated as *narrative*, not error.** Put the change in the LCB itself (`"though his clothes change from day to day"`), so the model doesn't try to reconcile a contradiction and mangle the face instead.

## 3.5 THE RECURRENCE RULE

> **Every prompt is generation #1.**

The model has zero memory. Not across clips, not across sessions, not across a single conversation. Therefore:

- The LCB is repeated **in full**, at the top, in **every** prompt.
- The wardrobe lock is repeated **in full**, in **every** prompt.
- The recurring set (a parlour, a pitch, a restaurant) is repeated **in full**, in **every** prompt that uses it.
- The closing restatement repeats identity + wardrobe + the key event.

This feels absurdly redundant to a human reader. It is the entire mechanism. **Redundancy is the feature.**

## 3.6 THE FACE-SUPPRESSION PROTOCOL

Sometimes you need a character *without* their face â€” for a hero shot from behind, to preserve mystery, to match plate footage, or because the face keeps rendering wrong.

**The critical insight, learned in production:**
> **Describing a face forces the model to show it.** The LCB is an instruction to render that face. If you don't want the face, you must *remove the facial description entirely* â€” not merely ask for a back angle while still describing the cheekbones.

**The protocol:**

1. **Strip the LCB to non-facial anchors only.** Keep skin tone, hair cut, build. **Delete** every reference to nose, lips, eyes, brows, jaw, cheekbones, expression.
2. **State the constraint in ABSOLUTE RULES, in the affirmative and the negative, repeatedly.**
3. **Lock the camera to a geometry that makes the face impossible** â€” behind, side-on, overhead â€” and say so in the framing.
4. **Restate it in the closing paragraph.**

**The production-proven wording:**
```
THE BOY â€” a slim, athletic young Gambian boy of about ten, with warm dark-brown
skin and short black hair in a low, neat natural cut. He is seen ONLY from BEHIND
and from the SIDE throughout this entire scene â€” his back is to the camera, turned
toward the goal. His FULL FACE IS NEVER SHOWN and he NEVER turns to face the camera
at any point in time; we only ever see the back of his head, the back and side of
his body, his short black hair, his arms and legs. Do NOT show his facial features
at any moment.
```
Note: **no nose, no eyes, no lips, no expression.** Only skin, hair, build. That absence is what does the work.

## 3.7 MULTI-CHARACTER FILMS

**Rule 1 â€” Every character in the scene gets a full LCB at the top.** Two characters, two blocks. Four characters (the in-law dinner), four blocks.

**Rule 2 â€” Order by prominence.** The scene's lead goes first.

**Rule 3 â€” Single-scene characters get *more* description, not less.** Counter-intuitive but correct: a character who appears in only one scene has no consistency burden, so you can afford â€” and should spend â€” rich specification, because they only need to be right once.
> The in-laws appear in exactly one scene, so they get lavish blocks (`"an elegant, rich wax-print grand mbubb in deep jewel tones with an elaborately tied tall matching headwrap, gold earrings and a beaded necklace"`).

**Rule 4 â€” Accept that single-clip characters won't match across clips.** If a mother appears in Scene 2 and Scene 5 as separate generations, her face **will** differ. Options:
- (a) Accept it if the framing differs enough that nobody notices.
- (b) Give her a proper LCB and treat her as a recurring character.
- (c) Restructure so she appears in one scene only.
This is a real constraint. Design around it at the outline stage, not at the prompt stage.

**Rule 5 â€” Never attach two images.** The model fuses identities. This is why the whole system is text-based.

## 3.8 THE ONE-IMAGE EXCEPTION (PRODUCTS ONLY)

The **only** image we attach is a **product**, and only ever **one per prompt**.

**Why products are different:** a product is a rigid object with fixed geometry and printed artwork. It has no expression to drift, no pose to reconcile. It is exactly the kind of thing image-conditioning is good at.

**The rules:**
1. **One image per prompt. Never two.** Four logos in one prompt (SWIPE + Wave + APS + Afrimoney) = fusion and garbage. That's what compositing is for.
2. **Quarantine the reference.** State explicitly what to take and what to ignore:
> `"Match the BUCKET DESIGN and LABEL from the attached product image exactly... IMPORTANT: take ONLY the tub/label design from the reference â€” do NOT use any kitchen background, flyer layout, or surrounding scene from the image."`
This clause exists because a reference flyer's kitchen background bled into unrelated scenes. It is mandatory.
3. **Describe the product in words anyway.** The image is confirmation; the words are the specification.
> `"the white lid, the green 'Sidrah Salaam' leaf logo, the bold 'GROUNDNUT PASTE / DEYGEH' wordmark with gold underline, '100% GROUNDNUT â€” MADE IN THE GAMBIA', and the 'NET WEIGHT 4.5Kg' badge"`
4. **Character + product in one prompt = character in text, product as the image.** Never both as images.

