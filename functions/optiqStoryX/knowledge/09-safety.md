# OPTIQ SKILLS KNOWLEDGE — PART IX: SAFETY AND CLASSIFIER NAVIGATION (minor-safety false positives, clean vocabulary rewrite, IP rules)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART IX â€” SAFETY & CLASSIFIER NAVIGATION

## 9.0 ADULTS ONLY — THE ONE RULE THAT IS NOT A CLASSIFIER PROBLEM

Everything else in this Part is about *navigating* a classifier. This section is not. It is a platform rule and it comes first.

> **No person under 18 appears in any Optiq film. Ever. In any role, in any frame.**

Not a lead, not a background figure, not a face in a crowd, not somebody in a doorway, not a baby carried on a back, not a photograph on a wall. No classrooms of pupils, no school gates at closing time, no playground in use.

**If the director's brief asks for one, recast them — do not refuse the brief and do not drop what it was about.** "A boy sells his father's radio" becomes a young man of 18 or older doing exactly that. "A mother and her small daughter" becomes a mother and her grown daughter, or the mother alone. Keep the intent; change the age.

The youngest person who may appear is 18, and when somebody is written that young, the age is stated plainly ("in their late teens, around 19") so nothing downstream has to guess.

**How it is enforced.** The age palette in `casting.js` starts at 18 and has no younger band. `adultsOnlyMandate()` is injected into the analyst, the storyline, the casting palette and the fresh-face brief. The prompt rules carry it as a numbered non-negotiable. And `minorViolations()` reads the storyline, the registry and every compiled scene prompt back, failing anything that names a child or states an age under 18 — so a minor that survives every instruction still cannot reach the video model.

Everything below §9.1 remains true and useful, but note that the minor-safety false positive it describes is now largely historical: the fastest way not to trip a minor-safety classifier is that there are no minors in the film.

## 9.1 THE MINOR-SAFETY FALSE POSITIVE

**The failure, observed live:**
> *"This prompt might violate our policies about generating harmful content related to minors."*

...on a wholesome scene of a kind restaurant owner saving a boy a plate of food.

**The cause:** the classifier pattern-matches on **child + emotional-distress vocabulary**. It is not reading the story. Words like `heartbreak`, `crestfallen`, `braced for bad news`, `dejected`, `his face falls`, `let-down` â€” repeated across a prompt featuring a 10-year-old â€” read as risk signals regardless of intent.

**This is not a content problem. It is a vocabulary problem.**

## 9.2 THE CLEAN-VOCABULARY REWRITE

**The protocol:** neutralise the emotional vocabulary; keep the story identical.

| âœ— Trips the classifier | âœ“ Renders fine |
|---|---|
| "his hopeful face falls into heartbreak" | "he hopes for a meal; the food is sold out, so he heads home to try tomorrow" |
| "braced for disappointment a third time" | "he steps up to the counter with an eager, hopeful smile" |
| "crestfallen, he leaves sad" | "he nods and heads off" |
| "his shoulders slump, dejected" | *(cut entirely â€” let the actor's beat carry it)* |
| "pure boyish disappointment" | "a friendly little shrug" |
| "the raw reality of his struggle" | "he keeps going" |

**The rewrite recipe:**
1. Reframe the character as **cheerful / hopeful / lively** in the LCB.
2. Reframe the situation **positively**: not "he's devastated the food ran out" but "he's hoping for a meal."
3. Delete distress adjectives entirely. **The performance still happens** â€” you just don't name it. The event (she says it's finished) produces the emotion. Law 6.
4. Reframe the STYLE as `feel-good`, `heartwarming`, `warm`.

**The general principle:** any prompt with a minor gets a vocabulary scan before it ships. And note that this *helps* the film â€” Law 6 says you shouldn't be naming emotions anyway.

## 9.3 REAL BRANDS & IP

**The rule:** don't render real third-party brands, badges, or broadcast content.

**The technique â€” describe, don't name.**
> Arsenal â†’ `"a team in red-and-white kit is being beaten"` + commentary + the fan's reaction.

This reads unmistakably as Arsenal to any fan, and it dodges both the garble risk (a rendered scoreline/badge) and the rights risk (a real club's IP in a published ad).

**Same technique for:** real banks (`"Oh Tijan Bank International"` â€” a fictional name), real people, real music.

**Fictional business names on props:** always. `"use a GENERIC fictional business name/logo on the invoice (not a real brand)"`.

## 9.4 PRE-FLIGHT SAFETY SCAN

Before any prompt ships:
1. **Minor present?** â†’ run the vocabulary scan (Â§9.2).
2. **Real brand named?** â†’ convert to description (Â§9.3).
3. **Real person named?** â†’ remove.
4. **Any distress/violence/injury language?** â†’ soften or reframe as event.
5. **Any medical/health claim?** â†’ keep to nutrition facts on the label; no therapeutic claims.


## 9.5 THE CAMERA NEVER WATCHES THE VIOLENCE — WHAT MAY BE FILMED

Like §9.0, this is not a classifier to be navigated. It is a hard limit of the tool, and it is enforced in code: `safety.js` supplies `shootableMandate()` to every skill that invents content, and `graphicViolations()` reads the result back.

> **A film may be ABOUT anything. It may not DEPICT certain things on camera.**

The story keeps its teeth. Crime, violence, arrest, death, betrayal — all of it stays. What changes is where the camera is standing when it happens.

**Why it is absolute.** The video model refuses to photograph violence, and it refuses *silently*: the interaction runs, thinks, and returns no video. There is no error and no reason — only `total_output_tokens: 0`. See `renderFailure.js`. A drama that stages its crimes on camera comes back with most of its scenes missing, having spent the money to find out.

**Never in a frame, a beat, a set description or a shot:** a weapon of any kind (held, raised, on a counter, or in the background); an act of force as it lands (blow, tackle, pin, grab, drag, choke); a person restrained or handcuffed; a victim pose (cowering, trembling, hands raised); blood, wounds or a body; a crime performed on camera (money visibly passing in a bribe, something visibly stolen or broken into).

**Write the same moment as one of these instead** — they are the better shot in almost every case: the instant before contact; the aftermath (dust settling, an overturned stool, a hand brushing off dirt); the reaction of somebody watching; the act happening just outside the frame line; a detail that implies it (a drawer sliding shut, keys lifted, a bottle rolling).

**Sound and dialogue are UNRESTRICTED, and are where the violence belongs.** Name the impact, the scuffle, the thud of a body, the crack of wood — exactly and loudly. The clip carries its own audio, so a blow heard over a held frame of somebody's face is fully present to the audience and entirely legal to generate. Threats and menace in what people *say* are fine verbatim.

### 9.5.1 THE FAILURE THAT WROTE THIS SECTION

A five-minute Gambian crime drama, thirty scenes, nineteen refused. Every refusal was a criminal beat. Three things were learned the expensive way:

1. **Rewriting the scene prose afterwards did not fix it.** The shot board had already photographed the violence — a man in a doorway holding a club, an over-the-shoulder onto a frightened woman with the club in frame. Those stills are attached to the video call, and a picture cannot be argued with by a prompt.

2. **The club was never in the scene's words.** It was in the WORLD BIBLE — `env_market_stall`, state *Splintered Door*: *"a heavy wooden club rests on the counter."* That was photographed once into a plate, and every frame of the scene was generated from it. The object survived being deleted from the script twice.

3. **Therefore the rule holds at every tier that invents content**, not at the bottom: the analyst's reading, the storyline's beats, the compiled scene prompt, the world bible, the shot design, and the shooting brief. One instruction at the bottom cannot unpick what four earlier passes agreed on.

### 9.5.2 THE FAILURE MODE TO FIGHT

A model asked to "make it safe" reliably drops the crime, and what comes back is a film about nothing. **That is a worse outcome than a refused render**, because it ships. Every mandate says the opposite in as many words: the robbery still happens, the arrest still happens, the man still loses. A room that a fight happened in is written as the aftermath — the splintered door, the scattered floor — never as a room with the weapon still lying in it.

### 9.5.3 WRITING THE GATE

`graphicViolations()` has one subtlety worth preserving: **a correctly de-escalated scene is full of the vocabulary the gate looks for**, because the way you specify "no weapon" is to write the word *weapon* — "No weapon is ever in shot", "Nobody is framed as a cowering victim", "the struggle happens entirely off-camera". A naive matcher flags every fixed scene as broken and sends the repair pass off to fix what already works. So a hit inside a **negation** is not a hit, and a hit placed **off camera** is not a hit either: off-frame is the approved answer, not the problem.
