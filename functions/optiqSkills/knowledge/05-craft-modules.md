# OPTIQ SKILLS KNOWLEDGE — PART V: CRAFT MODULES (camera, lighting, color, sound, style header)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART V â€” CRAFT MODULES

## 5.1 CAMERA

**The governing principle (Law 2):** the camera is a witness. It has intent but no opinions.

**The house vocabulary:**

| Register | Language |
|---|---|
| Documentary-honest | `handheld, documentary â€” present but steady, no shaky-cam` |
| Observational | `steady and observational, letting the action read clearly â€” no flashy moves` |
| Kinetic / chase | `dynamic and kinetic â€” fast tracking shots alongside him, low wheel-level angles, a quick whip-pan, motion blur` |
| Supreme cinema | `slow, deliberate, elegant â€” anamorphic framing, gentle moves, no shake` |
| Product | `smooth, elegant studio motion â€” a slow orbit, gentle push-ins on texture` |

**Focal-length shorthand** (models respond to it):
- `~35mm` â€” crowd immersion, environment, walking with
- `~40mm` â€” general moving coverage
- `~50mm` â€” the house default for faces and intimacy
- `~100mm macro` â€” product/food texture

**The angle library:**
- `over-the-shoulder` â€” the phone/screen grammar (Part VIII)
- `three-quarter profile` â€” the house default for faces. **Never frontal.**
- `low hero angle from near the dirt` â€” power
- `reverse master from behind the head table` â€” for finding a non-obvious angle in a covered event
- `high, slightly overhead` â€” the shared-bowl meal; the library page turn
- `locked-off sideline` â€” the penalty; the commute

**Prohibitions, stated in every prompt:**
```
no slow motion, no zoom punches, no dramatic staring, no camera-staring,
never frontal, never to the lens
```

**Slow-motion policy:** permitted **only** for product/food beauty (peanuts tumbling, a shell cracking, paste folding). **Never** for people. People in slow motion is the single fastest way to make an ad look like a 2009 charity appeal.

## 5.2 LIGHTING

**The doctrine:** all light is *motivated* and *named*. Never "cinematic lighting." Always "the light from *that* window / *that* fire / *that* candle / *that* phone screen."

**The house patterns:**

| Situation | The prescription |
|---|---|
| Working day, honest | `flat, natural, bright but slightly hazy/overcast, fairly neutral and even â€” NOT golden hour. Soft realistic shadows.` |
| Outdoor kitchen | `warm late-afternoon daylight as key (sun 3/4 behind/side), soft ambient bounce off the sandy ground as fill, a faint warm under-glow on her hands from the fire` |
| Interior, modest | `soft daylight from a doorway/window â€” cooler and dimmer than outside, a shaft falling across the floor, honest interior exposure with real shadow` |
| Poverty, night | `single-source candlelight ONLY. Warm, low, flickering key close to her face, carving soft-edged shadow; everything beyond the small pool falls to deep black. No fill, no rim â€” the darkness is part of the truth.` |
| Under a canopy/event | `soft diffused shade with hot bright daylight ripping in at the open edges, gentle flares, a warm rim on hair and shoulders; the stage cooler and contrastier against a near-blown-out background` |
| Phone/screen | `the screen casts a soft cool glow lifting her face from the front` (+ the room's warm key = the warm/cool contrast that sells "clarity arriving") |
| Product studio | `bright, clean, even, high-end studio product lighting â€” soft key with gentle wraparound fill, a soft top/rim giving glossy speculars, no harsh shadows, no warm cast` |
| Dawn | `deep pre-dawn blue-grey ambient as the base, warming to the first golden amber low on the horizon â€” a cool-to-warm gradient. A single doorway bulb as a small warm practical.` |

**The tell:** if you can't name where the light comes from, you haven't designed the shot.

## 5.3 COLOR

**Always contains two things: the palette, and the prohibition.**

```
COLOR: Warm, earthy, lightly desaturated â€” sandy browns, the black pot, the print of
her wrapper. Documentary-real. NOT a teal-and-orange ad grade.
```

**The house grades:**
- **Working/domestic:** `warm, earthy, lightly desaturated`
- **Celebration:** `the richest, most saturated grade in the film â€” let the marigold and indigo, the balloons, the mango green and the hard blue sky all sing`
- **Institutional/grind:** `more muted and focused â€” institutional creams, pale blues, worn wood, a touch of fatigue in it`
- **Poverty/night:** `very warm and low-key â€” deep amber and gold in the candle pool against near-total black`
- **Corporate payoff:** `bright, clean and aspirational â€” crisp glass, navy tailoring, soft neutral office tones`
- **Food/product:** `warm and golden â€” honey-gold paste, toasted browns, the reddish peanut skins`

**The Single Accent technique (brand films):** grade the world naturally, and let the **brand colour be the only vivid thing in frame.**
> *"the DEX TEAL of the box and jacket standing out as the single vivid accent"* in a blue-grey dawn.
This is how you make a logo-less shot still feel like the brand's shot.

## 5.4 SOUND

**Always labelled `SOUND (diegetic only; voiceover separate)`.** This flag is load-bearing â€” see Â§7.1.

**Structure:** ambience â†’ the specific event sounds â†’ the human sounds.

```
SOUND (diegetic only; voiceover separate): Bubble/sizzle of the pot, scrape of the
wooden spoon, soft crackle of firewood, a few birds chirping lightly from the
compound tree, faint distant compound ambience. Her quick inhale and "oy!" on the burn.
```

**The rule:** every physical event in the ACTION block should have a corresponding sound. The burn has an inhale. The lid has a snap. The bus has a squeal and a scraping door. The ball has a strike and a thud into the net. **Sound is where the model proves it understood the event.**

**Never** specify music. Score is laid in post, always.

## 5.5 THE STYLE HEADER

The compressed contract. Assemble from: register + optics + motion + prohibitions + language + text policy.

**Template:**
```
=== STYLE ===
[REGISTER: cinematic documentary-true / ultra-premium food-commercial / supreme
award-tier cinema / warm comedic feel-good], grounded and [honest/premium].
[OPTICS: shallow depth of field, gentle film grain, soft natural halation, warm
filmic color, anamorphic feel]. [MOTION: camera moves with intent â€” smooth
tracking, slow pushes â€” never shaky, never static-dead]. NO character ever looks
into the lens; eyelines are on [X]. Hyper-realistic performances, natural human
behavior, no posing, no slow motion, no dramatic stares. [SETTING ONE-LINER].
Dialogue in [LANGUAGE]. No on-screen text.
```

