# OPTIQ SKILLS KNOWLEDGE — PART XII: CASTING VARIETY (the anti-monochrome doctrine)
(Internal operating doctrine for the Optiq Skills agent swarm. Added after a production failure, not extracted from the original manual.)

# PART XII — CASTING VARIETY

> Part III teaches you how to make one face survive nine clips. This part exists because we got too good at it: we started making the same face survive nine *films*.

## 12.1 THE FAILURE

Observed in production across many finished ads: every film starred effectively the same person. Same complexion. Same hairstyle. Same build. Same age. Different brand, different story, same cast. The platform began to look like it had one actor on retainer.

**This was not the swarm disobeying instructions. It was the swarm obeying them exactly.** Three things pointed the same way:

1. **The prompt rule.** The mandatory rules used to demand every person be described with "rich, deep dark skin tone." That is one instruction, applied to every human being in every film. It worked.
2. **The doctrine's worked examples.** §3.2's canonical Locked Character Block is Nyima — *"deep warm dark-brown skin… soft oval face… neat medium-length black box braids."* §3.4's wardrobe lock example is the man in the rust camp-collar shirt. These exist to teach the **shape** of a character block. A language model reads a worked example as the answer.
3. **Identical inputs.** The casting skill received the same doctrine and the same exemplar on every run. A sampler handed identical context lands in the same place. "Be more varied" does not change that; it produces the same cast with more adjectives.

## 12.2 WHAT DID NOT CHANGE

**Casting is still Black and still Gambian, and the literal keyword "Black" is still mandatory in every prompt, for every person, lead and background alike.**

That rule is not a stylistic preference and it is not what caused the failure. It exists because under-described people have been rendered as other ethnicities entirely — the model's default, not ours. Removing it would break the films. It stays.

The variety is a spread **across the real range of Black Gambian people**. It is not a licence to cast someone else.

## 12.3 THE RANGE IS REAL

Any actual Gambian street contains complexions from very deep blue-black through deep ebony, dark brown, warm brown, medium chestnut, golden brown, light copper, to fair caramel-brown. It contains box braids and bald heads and locs and bantu knots and headwraps and fades and TWAs. It contains eight-year-olds and sixty-eight-year-olds. It contains petite and heavy-set and wiry and tall.

Writing every character as one point in that space is not "consistent." It is **under-observed**, and it is the same failure mode as generic stock Africa — the failure §4 (the environment engine) exists to prevent. Every unspecified element is a vote for the cliché; a complexion you defaulted to instead of choosing is an unspecified element.

## 12.4 THE RULES

**V1 — One look per person, per film.** No two characters in the same film share a complexion, a hairstyle, or a build. Five characters means five distinct looks.

**V2 — Spread the ages, from 18 upward.** A cast clustered entirely in its twenties is a failed cast. Young adults, working adults in their thirties and forties, people in their fifties, elders — as the film allows. **Nobody under 18 ever appears in an Optiq film**, in any role, foreground or background; the youngest person you may write is 18, and when you write one that young, state the age plainly.

**V3 — The doctrine's examples are format, never cast.** "Box braids", "deep warm dark-brown skin", "soft oval face", "naturally thick eyebrows", and the rust/camp-collar shirt are teaching aids. Reproducing them is the failure this part exists to stop. Learn the shape; write new people.

**V4 — One distinguishing marker per character, always.** A gap between the front teeth. A mole on a cheekbone. Reading glasses. A scar through an eyebrow. Tribal facial marks. Counter-intuitively this is the highest-value field in the whole block: one specific buildable oddity separates two people more decisively than any amount of adjective-shuffling on skin and hair. It is also, unlike a vibe, something the model can actually render consistently.

**V5 — Wardrobe colours differ per character too**, and none of them is rust. Two people in the same palette read as the same person in a wide shot.

**V6 — Background crowds follow the same spread.** A market where every stallholder is the same tone and the same age is exactly the generic-Africa render we author backgrounds to avoid. Vary them explicitly, in words, or the model will not.

**V7 — Variety never costs consistency.** Everything in Part III still holds without exception: whatever a character's look is, that Locked Character Block is pasted **verbatim** in every prompt they appear in. Varying the cast *between* characters and *between* films is the goal. Varying one character *within* a film is still the cardinal sin.

## 12.5 HOW IT IS ENFORCED

Doctrine alone did not fix this, because doctrine is another identical input. So the swarm carries two mechanical enforcements:

1. **A casting palette, drawn fresh per film** (`casting.js` → `castingDirective`), handed to the casting-registry skill as a binding casting call. Different text on every film means the skill cannot converge the way it did.
2. **A JS gate** (`castingViolations`) that inspects the finished registry before any scene is built, and fails it for: a character lifted off the doctrine's examples, a missing "Black" keyword, two characters sharing complexion *and* hairstyle, or a whole cast on one complexion. A failing registry goes through one `casting-director` re-cast pass.

The gate runs **before** the scene-builders, because the registry is the thing every scene pastes verbatim. Caught there it is one repair; caught later it is the whole film.
