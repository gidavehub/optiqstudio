# OPTIQ SKILLS KNOWLEDGE — PART II: THE PROMPT ARCHITECTURE (canonical 14-block order, length doctrine, copy-ready rule)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART II â€” THE PROMPT ARCHITECTURE

## 2.1 THE CANONICAL BLOCK ORDER

Every scene prompt is a single copy-paste block, in this exact order. The order is not cosmetic â€” models weight early tokens more heavily, so **identity comes first, always.**

```
1.  LOCKED CHARACTER BLOCK(S)      â† identity anchor. Verbatim. Non-negotiable.
2.  BUILD / WARDROBE / SKIN LINE   â† ~20 words. Attached to each character.
3.  WARDROBE (THIS SCENE)          â† only if it differs from the lock.
4.  STYLE                          â† the film's visual contract.
5.  ABSOLUTE RULES                 â† only when a hard constraint exists (no face, no cuts, no TV).
6.  THE SETTING / THE WORLD        â† the environment engine output (Part IV).
7.  THE PEOPLE (background)        â† every human in frame, described.
8.  THE SEQUENCE / ACTION          â† timestamped beats. The event. The heart.
9.  DIALOGUE                       â† in-scene lines with language tag.
10. CAMERA                         â† Part V.
11. LIGHTING                       â† Part V.
12. COLOR                          â† Part V.
13. SOUND (diegetic)               â† Part V. Always flagged "VO separate."
14. THE CLOSING RESTATEMENT        â† one paragraph re-asserting the non-negotiables.
```

## 2.2 BLOCK-BY-BLOCK SPECIFICATION

### BLOCK 1 â€” LOCKED CHARACTER BLOCK
See Part III. 50â€“100 words for the face. Repeated **verbatim** in every scene the character appears in. Never paraphrased, never trimmed, never "summarised because we already established it." The model has no memory between generations. Every prompt is the first prompt.

### BLOCK 2 â€” BUILD / WARDROBE / SKIN
~20 words. Height, build, skin tone, and the standing outfit.
> *"Tall and athletic, around 6'0", warm dark-brown skin; wears a fitted short-sleeve rust-orange shirt open over a white tee, slim navy chinos, white trainers."*

### BLOCK 3 â€” WARDROBE (THIS SCENE)
Only when it deviates. Used when a character changes clothes across days (school uniform vs home clothes), or has a scene-specific costume (graduation gown, corporate blazer, football kit).
**Rule:** if wardrobe changes, name **one constant** that persists (the flip-flops, the beaded bracelet, the wristwatch). See Â§3.4.

### BLOCK 4 â€” STYLE
The film's visual contract, ~60â€“100 words. It answers: what kind of film is this? It always contains:
- The register (`cinematic documentary-honest` / `ultra-premium food-commercial` / `supreme award-tier cinema` / `warm comedic feel-good`)
- The optical signature (`shallow depth of field, fine film grain, soft natural halation, anamorphic feel`)
- The motion policy (`camera moves with intent â€” never shaky, never static-dead`)
- The prohibitions (`no slow motion, no posing, no dramatic staring, no camera-staring`)
- The language tag (`Dialogue in WOLOF` / `in ENGLISH`)
- The text policy (`No on-screen text.`)

### BLOCK 5 â€” ABSOLUTE RULES
Deployed only when a constraint is load-bearing and the model will otherwise violate it. Written in imperative caps-flagged prose.

Examples from production:
```
=== ABSOLUTE RULES (follow strictly) ===
- The boy's FACE must NEVER be visible. He stays turned AWAY from camera,
  facing the goal, back to us, for the whole scene. No front-facing angle,
  no turn toward the lens, ever.
- The CAMERA stays on the SIDE of the pitch, framed so we see ONLY: the SIDE
  of the goalposts, the boy (from behind/side), and the ball.
```
```
=== IMPORTANT FRAMING NOTE ===
The TELEVISION is NOT visible in frame at any point â€” the camera stays ON HIM.
He watches a match on a TV that is OFF-SCREEN. We understand the match entirely
through his gaze off-frame, his reactions, and the commentary audio.
Never show the TV or its screen.
```

### BLOCK 6 â€” THE SETTING / THE WORLD
The environment engine. See Part IV. This is where a film lives or dies. Density here is the single highest-leverage investment in the whole prompt.

### BLOCK 7 â€” THE PEOPLE (background)
**Every human in frame gets described**: age, clothing (specific fabric/colour/garment), position in the scene, and *what they are doing*. Background people who are merely "a crowd" render as a smear of AI mannequins. Background people who are "a tailor at a foot-pedal sewing machine who glances up mid-stitch" render as a country.

### BLOCK 8 â€” THE SEQUENCE / ACTION
Timestamped. `[0.0â€“3.0s]`, `[3.0â€“6.5s]`, `[6.5â€“10.0s]`. Physical verbs only. This is the Prime Directive made concrete.

### BLOCK 9 â€” DIALOGUE
Character name, delivery note in parentheses, the line, and â€” if not English â€” the English meaning on the next line.
```
Neneh Fatou (warm, apologetic): "Waaw doomam, Ã±am bi jeex na."
â€” ("Sorry my son, the food is finished.")
```

### BLOCKS 10â€“13 â€” CRAFT
See Part V.

### BLOCK 14 â€” THE CLOSING RESTATEMENT
One paragraph, at the very bottom, restating the non-negotiables. Models weight the *end* of a prompt heavily too â€” this is the second-most-valuable real estate after the top. It exists to re-hammer the things most likely to drift.

> *"Hyper-realistic, cinematic, kinetic. The SAME man in the SAME open rust shirt, white tee and navy chinos sprints at full speed through a tight interior market lane â€” squeezing past shoppers, spilling a chilli basket, barreling into a woman's produce stall so tomatoes scatter as she throws her hands up shouting. English reactions. Warm dappled canopy light, rich saturated color, dynamic tight camera, real high-speed running throughout. No on-screen text."*

Note what it repeats: **identity, wardrobe, the key event, the light, the motion, the prohibition.** Everything that drifts.

## 2.3 LENGTH DOCTRINE

Prompt length is a function of **how much of the frame is under our authorship.**

| Scene type | Target length | Why |
|---|---|---|
| Single locked shot, one action, sparse set (candle study, penalty) | 400â€“700 words | Few elements. Over-writing invites drift. |
| Standard live-action scene, one location | 700â€“1,100 words | The house default. |
| Dense environment with crowds and interactions (market run, graduation) | **1,500â€“2,500 words** | Every person, every stall, every reaction must be authored or the model defaults to fake. |
| Product motion graphics | 600â€“1,000 words | Precision over volume. Exact labels, exact beats. |
| Multi-cut montage (3 locations in 10s) | 900â€“1,400 words | Each cut is a mini-scene. |

**The rule that matters:** length is never the goal. **Density of authored specifics** is the goal. A 2,000-word prompt full of adjectives about mood is worse than a 600-word prompt full of nouns and verbs. But a crowd scene *cannot* be authored in 600 words, so it gets 2,000.

## 2.4 THE COPY-READY RULE

> **The prompt is the deliverable. Not the discussion of the prompt.**

Character blocks, style, rules and craft all live **inside** the copy-paste block. Nothing that the model needs may sit outside it in commentary. This was learned the hard way: a character block presented "above" the prompt as reference material is a character block that never reaches the model.

The agent may write craft notes and production flags **after** the block, for the human. Never before, never inside.

