# OPTIQ SKILLS KNOWLEDGE — PART XI: THE AGENT OPERATING PROCEDURE (state machine, build loop, revision protocol)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART XI â€” THE AGENT OPERATING PROCEDURE

> This part turns the doctrine into a machine. Follow it literally and you can run this system from a cold start, on any client, forever.

## 11.1 THE STATE MACHINE

```
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  S0  INTAKE  â”‚  Gather brief. Never build yet.
   â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
          â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  S1  CONCEPT â”‚  Propose the IDEA. Get approval. Never build yet.
   â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
          â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  S2  OUTLINE â”‚  Scene-by-scene bird's-eye. Get approval. STILL never build.
   â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
          â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  S3  CASTING â”‚  Write + approve the Locked Character Blocks.
   â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
          â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  S4  BUILD   â”‚â—„â”€â”  ONE SCENE AT A TIME. Wait for "next".
   â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
          â–¼          â”‚
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
   â”‚  S5  REVISE  â”‚â”€â”€â”˜  Diagnose â†’ structural fix â†’ re-issue.
   â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
          â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  S6  VOICE   â”‚  Voice profiles + transcripts.
   â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
          â–¼
   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
   â”‚  S7  CONTROL â”‚  The single production control doc.
   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**The cardinal procedural rule: NEVER SKIP TO S4.**
Every disaster in the production history traces to building scenes before the concept and outline were agreed. Building a 2,000-word prompt for a scene the client doesn't want is worse than useless â€” it burns credits, burns trust, and anchors the work in the wrong direction.

## 11.2 PHASE GATES

Each gate has an explicit question that must be answered before advancing.

| Gate | The question that must be answered |
|---|---|
| S0 â†’ S1 | Do I know the brand, the product, the audience, the language, and the format? |
| S1 â†’ S2 | Has the client said yes to **the idea**? |
| S2 â†’ S3 | Has the client said yes to **the scene list**? |
| S3 â†’ S4 | Are the character blocks approved, and do I know every character's wardrobe? |
| S4 â†’ S4 | Has the client said "next"? (One scene per turn. Always.) |
| S4 â†’ S6 | Are all scenes built and approved? |
| S6 â†’ S7 | Are all voices and transcripts locked, including the tagline? |

## 11.3 THE INTAKE INTERVIEW (S0)

Ask only what you cannot infer. Every question you ask that the brief already answered is friction.

**Must know:**
1. **Brand + product.** What is it, literally? What does it do?
2. **The one thing.** If the audience remembers one sentence, what is it?
3. **Audience.** Consumer? Business? Investors in a room?
4. **Format.** Scene count Ã— duration. (Default: 6 Ã— 10s.)
5. **Language.** Dialogue language, VO language, or wordless.
6. **Assets.** Logo? Product photo? Anything else? (Products only â€” never faces.)
7. **Tagline.** Have one, or should you propose?

**Infer, don't ask:**
- The setting is Gambian unless stated otherwise.
- The register is cinematic-documentary unless it's a product film.
- VO is separate. Always.
- Character consistency is text-based. Always.

**Offer, don't impose:**
- If they haven't said, propose the format and the tagline as options with a recommendation.

## 11.4 THE BUILD LOOP (S4)

**Per scene, in order:**

1. **Retrieve the locks.** LCB(s), wardrobe lock, recurring set block. Paste them verbatim.
2. **Write the STYLE header.** Assemble from the film's register.
3. **Deploy ABSOLUTE RULES** if a hard constraint applies (no face / no cuts / no TV / hands-off).
4. **Build the SETTING** using the Specificity Ladder. Climb to Rung 4 minimum.
5. **Populate THE PEOPLE.** Every human: age, clothing, position, action.
6. **Write THE SEQUENCE.** Timestamped. Physical verbs. Run the Verb Count.
7. **Write the craft blocks.** Camera â†’ Lighting â†’ Color â†’ Sound.
8. **Write the CLOSING RESTATEMENT.** Identity + wardrobe + key event + light + prohibitions.
9. **Run the checks:**
   - [ ] Is This Dead? test (Â§1.4)
   - [ ] Banned vocabulary scan (Â§1.3)
   - [ ] Pre-flight safety scan (Â§9.4)
   - [ ] Copy-Ready rule â€” is everything inside the block? (Â§2.4)
10. **Ship the block.** Then, *below* it: the VO line, and any production flags.
11. **Stop. Wait for "next."**

**The production flags to append (only when true):**
- Split-generation recommendation (if the scene has internal cuts)
- Text-garble warning (if the scene has props with lettering)
- One-image reminder (if the scene needs a product asset)
- The Wolof native-speaker note (if there are Wolof lines)

## 11.5 THE REVISION PROTOCOL (S5)

When the client says it came back wrong:

1. **Ask for the frame if you don't have it.** A still tells you more than a description.
2. **Diagnose against the Failure Catalog (Â§10.1).** Name the failure.
3. **Reach for the STRUCTURAL fix first.** (Lesson 3.) Change the geometry, the location, the cut count, or delete a description â€” before you touch adjectives.
4. **Re-issue the WHOLE prompt.** Never a patch, never a diff. The client copies one block; give them one block.
5. **Fold the lesson into the locks.** If a wardrobe drifted, the wardrobe lock gets stronger *for every subsequent scene*, not just this one.
6. **State what changed, briefly, above the block.** One or two lines. Not an essay.

**The revision tells, learned in production:**
| Client says | It means | Do this |
|---|---|---|
| "it looks scripted / terrible" | Mood, not moment | Rewrite as events |
| "it's dead / static" | No verbs | Verb Count |
| "too fake" | Landscape or Rung-0 setting | Relocate + photoreal escalation |
| "wrong outfit" | Wardrobe lock too weak | Caps the colour, name the garment, restate |
| "his face shows" | You described the face | Strip the features |
| "the shot gets fucked up" | Cuts broke the geometry | Lock the camera |
| "you wasted my credits" | You shipped without a check | Run all four checks, every time |

## 11.6 THE CONTROL DOC (S7)

The single-page reference the production team shoots from. Contents:

1. **The film:** brand, format, runtime, register, language.
2. **The locks:** every LCB verbatim; every wardrobe lock; every recurring set block.
3. **The scene table:** number | title | duration | cuts | location | key event | VO line | assets needed.
4. **The constants:** the recurring prop (bracelet / flip-flops / backpack), the brand colours, the tagline.
5. **The text strings:** every exact on-screen string, quoted.
6. **The assets:** which image attaches to which scene, and the quarantine clause.
7. **The voice:** each profile's one-line summary + the full transcript, mapped scene by scene.
8. **The split-generation map:** which scenes generate as one clip and which split into cuts.

