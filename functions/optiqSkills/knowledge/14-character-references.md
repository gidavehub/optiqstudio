# OPTIQ SKILLS KNOWLEDGE — PART XIV: CHARACTER REFERENCE IMAGES (the reversal of §3.8)
(Internal operating doctrine. Added when the platform gained its own image model. Supersedes §3.1 and §3.8's "images are reserved for products only".)

# PART XIV — CHARACTER REFERENCE IMAGES

> Part III says faces are authored in words and images are for products. That was right for years. It is no longer what we do, and this part explains what changed, what did not, and what it costs.

## 14.1 WHAT CHANGED

Consistency is now carried by **words AND a generated picture**. For every character who appears in more than one scene, the swarm renders a character reference sheet with its own image model and attaches it to exactly the scenes that character is in.

The Locked Character Block did not go away. It is still authored to the full word budget and still pasted verbatim in every prompt. What is new is that the model can now *see* the person as well as read about them.

**Why:** text-only consistency held a face across nine clips well enough to be impressive and not well enough to be invisible. Two hundred words about cheekbones is a specification the model approximates. A picture is a target it matches.

## 14.2 WHAT §3.1 GOT RIGHT, AND HOW EACH IS HANDLED

§3.1's five objections were all observed in production. None of them were wrong. Each is now mitigated rather than dismissed — and if a mitigation is removed, the original failure comes straight back.

**"It contaminates."** The worst of the five: a reference flyer's kitchen background bled into unrelated scenes. **Mitigation:** the reference is generated on a plain seamless mid-grey backdrop, under flat frontal studio light, in a neutral standing pose, with *nothing else in frame* — no props, no furniture, no location, no scenery. There is no background to leak. On top of that, every prompt carrying a reference also carries a quarantine clause that names what to ignore: the backdrop, the lighting, the angle, the pose, the framing. **Both halves are required.** An empty plate with no clause still drags the flat grey look in; a clause over a busy reference still leaks the room.

**"It doesn't scale — two images fuse."** Real, and it degrades fast: three faces in one prompt and the model starts averaging them. **Mitigation:** a hard cap of **two** references per scene, the two most prominent characters, and when two ride together the prompt states which image is which person and forbids blending, merging, averaging or swapping. A scene with four characters carries two references and leans on text for the rest. That is what the word budgets are for.

**"It trips content classifiers."** **Mitigation:** the reference brief is a plain casting still — neutral expression, no emotion, no situation, no action. "Not beautiful, just accurate." There is nothing in it for a classifier to catch.

**"It fights the prompt."** Waxwork faces and uncanny drift came from asking a model to reconcile a fixed 2D likeness with a new pose and new light. **Mitigation:** the reference is deliberately unstylised — no grade, no grain, no shallow focus, no dramatic shadow — so there is no *look* to fight, only a face and an outfit. And the scene's own location, light, camera and action are stated to override the reference completely.

**"Text describes; images demand."** Still true, and it is why the last line of the quarantine clause is **"where the reference and the words disagree, the WORDS WIN."** §3.8 rule 3 already had this right for products: the image is confirmation, the words are the specification. That holds for people too.

## 14.3 WHO GETS A REFERENCE

**Only characters who appear in two or more scenes.**

§3.7 rule 3 is the reason: a single-scene character has no consistency burden. They only need to be right once, they already get richer text description than a recurring character, and an image buys nothing. Spending one is waste.

Ordered by how many scenes they carry, capped per film. A film that hits the cap spends its references on the people doing the consistency work.

## 14.4 WHERE A REFERENCE GOES — AND WHERE IT MUST NOT

**A reference is attached ONLY to the scenes that character actually appears in.**

This is not an optimisation, it is a correctness rule. An attached reference tells the video model *put this in the frame*. A character sheet attached to a scene that character is not in is an instruction to put them there. If Binta appears only in scene 3, her reference belongs on scene 3 and nowhere else.

The same rule now governs the director's own uploads, which used to be attached to **every** scene indiscriminately:

- A **product** or **packaging** shot goes on the scenes where the product is in frame. Never elsewhere.
- A **logo** goes on the one or two scenes where the brand lands — normally the last. A logo on all nine scenes gets painted into all nine frames.
- A **place** goes only on scenes set there.
- A **person** goes only on scenes they are in.
- Anything genuinely unplaceable falls back to the product scenes. Over-attaching a reference the director deliberately uploaded is bad; silently dropping it is worse.

## 14.5 WHEN IT FAILS

Reference generation is **best-effort and never fatal**. A film with no reference sheets is the film this platform shipped for years: text-only consistency, which works. So a failed image degrades that one character to words alone, and a failed classification falls back to the product scenes. Neither costs the director their generation.
