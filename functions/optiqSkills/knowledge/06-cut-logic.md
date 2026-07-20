# OPTIQ SKILLS KNOWLEDGE — PART VI: CUT LOGIC AND SCENE STRUCTURE (cut decision tree, locked shots, split generation, runtime math)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART VI â€” CUT LOGIC & SCENE STRUCTURE

## 6.1 THE CUT DECISION TREE

```
Is the scene ONE continuous physical action with cause and effect?
   (a penalty, a bus flag-down, a candle-lit study, a chair pulled in and typing)
        â”‚
        â”œâ”€â”€ YES â†’ SINGLE LOCKED SHOT. No cuts. Â§6.2
        â”‚         Cutting will break the geometry and the model will lose the ball,
        â”‚         the keeper, the bus, or the hands.
        â”‚
        â””â”€â”€ NO â†’ Is it multiple distinct moments in one time-block?
                   (kitchen + floor; walk + class + library; weed + wash + carry)
                        â”‚
                        â”œâ”€â”€ YES â†’ MULTI-CUT BLOCK. 2â€“3 cuts. Â§6.3
                        â”‚         Then GENERATE EACH CUT SEPARATELY. Â§6.4
                        â”‚
                        â””â”€â”€ NO â†’ It's probably a single shot with camera movement.
                                  Default to one setup with a slow push.
```

## 6.2 SINGLE LOCKED SHOT

**When:** any action where physical continuity *is* the content. The camera holds one position and the event plays out inside the frame.

**Why it works:** by never cutting or moving, the model cannot lose the geometry. It cannot forget where the ball was, which side the bus is on, or where the goalkeeper stands. **The locked frame is a constraint that produces coherence.**

**The wording:**
```
ONE single continuous locked-off shot â€” the camera is on a tripod and DOES NOT move,
pan, zoom, cut, or change perspective for the entire 10 seconds; the whole action
plays out within the fixed frame.

=== FRAMING (fixed for the whole shot) ===
A single static WIDE shot from the SIDELINE, side-on, taking in [element A], [element
B], and [element C] all within the one frame â€” so we see the full action without any
cut or camera move. The frame never changes.
```

**Production proof:** the penalty scene broke repeatedly with cuts and perspective changes. Locked to one sideline frame, it held.

## 6.3 MULTI-CUT BLOCKS

**When:** a 10s scene needs to cover multiple moments or locations. The house patterns:

| Pattern | Split | Use |
|---|---|---|
| 2-cut | 5s + 5s | Two moments, one theme (kitchen burn + floor scrub) |
| 3-cut | 3s + 3s + 4s | Three locations, one idea (campus walk + lecture hand + library page) |
| 3-cut dramatic | 4s + 3s + 3s | A beat with a build (award + laugh + family photo) |

**The rule:** each cut is a **complete moment**, not a fragment. A cut that is "part of" an action is a cut that fails. Each cut has its own verb.

## 6.4 THE SPLIT-GENERATION RULE

> **A 10s prompt containing two internal hard cuts will drift. Generate each cut as its own clip and assemble in post.**

This is not a compromise; it is the professional workflow. You are cutting in the edit anyway.

**How:**
- Each cut gets the **full LCB + wardrobe line** on top.
- Each cut gets its own compact prompt (its own setting, action, camera, light, sound).
- Assemble in the edit.

**Benefits:** each cut holds; each angle stays distinct; the character stays anchored by the LCB in all of them.

**When to keep it as one generation anyway:** when the "cut" is really one continuous action (the chair-drag into typing into the zoom-out), or when the internal cut is a single hard cut between two static setups and the model is strong.

## 6.5 SCENE COUNTS & RUNTIME MATH

**The house formats:**

| Format | Math | Used for |
|---|---|---|
| 6 Ã— 10s | 60s | **The default.** Enough for a full arc. |
| 6 Ã— 8s | 48s | Tight brand films (Connekt employer) |
| 7 Ã— 10s | 70s | Story films with a setup + payoff (the Run) |
| 8 Ã— 10s | 80s | Feature-scale brand story (DEX) |
| 6 Ã— 8s + 2 Ã— 10s | 68s | Mixed: 10s reserved for motion-graphics + logo |
| 9 Ã— 10s | 90s | Long-form narrative (Nyima) |

**The reservation rule:** motion-graphics scenes and logo outros want **10s**, always. They need the breathing room to assemble, land, and hold.

**The arc, regardless of count:**
1. **Hook / problem** (the event that starts it)
2. **Escalation** (it gets worse / the journey)
3. **The turn** (the product enters)
4. **The proof** (what the product does)
5. **The payoff** (the human result)
6. **The brand** (logo + tagline + contact)

