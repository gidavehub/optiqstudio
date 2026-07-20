# OPTIQ SKILLS KNOWLEDGE — PART VIII: BRAND, PRODUCT AND TEXT RENDERING (text reality, one-logo rule, product hero grammar, motion graphics)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART VIII â€” BRAND, PRODUCT & TEXT RENDERING

## 8.1 THE TEXT REALITY

**On-screen text garbles.** Certificates, banners, trophy plates, ledger handwriting, signage, scorelines, packaging fine print â€” all of it comes back as gibberish lettering in most generations. This is universal.

**The doctrine:**
1. **Treat text objects as props, not information.** A certificate folder *reads as* "certificate." Let it. Don't fight for legibility.
2. **Let the VO carry the fact.** The paper says "results"; the narrator says "nine A's."
3. **Keep required strings SHORT and EXACT.** `"OH TIJAN BANK INTERNATIONAL"` wobbles; `"OH TIJAN BANK"` holds. Every string you require, you require *precisely*: `"Connekt"`, `"Merit"`, `"Strong Match"`, `"Cash flow: healthy"`, `"Balance Sheet"`, `"Send Invoice"`.
4. **Composite in post when it must be perfect.** The final logo lockup, a legible certificate, a real UI â€” these are After Effects jobs, not generation jobs.
5. **When the model IS strong at text** (newer generations), feed it the exact strings and trust it â€” but keep them short anyway.

## 8.2 THE ONE-LOGO RULE

> **One brand image per prompt. Never more.**

Four wallet logos (Wave + APS + Afrimoney) plus a SWIPE logo in one prompt = fusion, garble, disaster. The professional solve:

**The screen-replacement plate:**
```
>>> PHONE SCREEN: shoot this as a SCREEN-REPLACEMENT PLATE. The phone displays a
flat solid teal screen (or a tracking-marker screen) â€” do NOT attempt to render the
app UI in-camera. The Connekt interface is composited on in post. Keep the phone
steady in her grip and clearly framed so the screen tracks cleanly. <<<
```
Then spec the UI separately as a comp brief. This guarantees pixel-perfect branding and sidesteps the multi-image problem entirely.

**When to use the plate:** mandatory for multi-logo screens; recommended for any UI you need legible; optional when the model renders UI well and there's one logo.

## 8.3 PRODUCT HERO GRAMMAR

**The beats:**
1. **The approach** â€” a slow orbit or push toward the product
2. **The shine** â€” `a soft clean shine sweeps across the label and lid`
3. **The hold** â€” a confident, still hero frame

**The setting:** plain seamless white/light studio space. **Explicitly quarantine the reference image's background** (Â§3.8).

**The lighting:** `bright, clean, even, high-end studio product lighting â€” soft key, gentle wraparound fill, a soft top/rim giving glossy speculars, no harsh shadows, no warm cast.`

**Food-product motion (the money shots):**
- peanuts **tumbling** and a shell **cracking open** in slow motion
- kernels **breaking apart, fracturing, crumbling** in mid-air
- crumbs **releasing oil, turning glossy, melding** into paste â€” **gradually, visibly** (the transition IS the content)
- paste **swirling upward** in a rotating ribbon, a peak forming and folding
- paste **pouring down**, swirling, **slowing at the centre**, filling the tub
- a lid **descending and pressing** with a clean snap and a puff of freshness â€” **no hands**

**The cardinal sin:** instant transformation. `"the groundnut just disappeared and the paste came out of nowhere"` = failure. **Show the process.** Nuts â†’ fragments â†’ oily grit â†’ satiny paste. Every stage on screen.

**The floating rule:** for pure product motion, the subject is **suspended in mid-air, rotating, not resting on any surface**, on a plain white background. This is what makes it read as premium graphics rather than a table-top shot.

## 8.4 MOTION-GRAPHICS GRAMMAR

**The house style: Apple "Liquid Glass" Ã— Google Material motion.**

```
Apple "Liquid Glass" aesthetic: translucent frosted-glass panels and pills with real
depth, soft drop shadows, bright specular highlights sliding across the glass,
continuous-curvature rounded corners, subtle refraction and light bloom. Combined with
Google Material fluid motion â€” springy, weighted, organic easing; elements that morph,
expand and settle with momentum rather than cutting. Everything floats and flows.

THEME: light theme. Soft off-white / pale cool-grey background with a faint animated
mesh-gradient glow drifting beneath the glass. PRIMARY COLOR: teal. ACCENT: amber/gold.
Generous clean negative space. Crisp modern sans-serif typography, perfectly legible.

MOTION: Spring physics everywhere â€” overshoot-and-settle, weighted momentum, fluid
morphs instead of hard cuts. Soft motion blur on fast moves, gentle floating idle on
resting elements, specular light streaks tracking across glass, tasteful depth-of-field
bloom. Smooth 60fps-feel. Premium, confident, restrained â€” Apple-keynote energy, never
cluttered or gaudy.

SOUND: Clean premium UI sound design â€” soft glassy taps and whooshes, a gentle rising
shimmer on the scan, light springy pops as cards lock in, a satisfying soft chime on
the stamp, an airy bloom on the final logo. Minimal, expensive, Apple-like.
```

**The four-beat structure** (every motion-graphics scene):
1. **Assembly** â€” elements gather, headline states the premise
2. **The process** â€” a scan/sweep, connective lines, rings filling, the AI "thinking"
3. **The resolution** â€” cards settle into an answer, the accent colour blooms
4. **The takeaway** â€” consolidate to one line + a checkmark

**The sub-beat split:** if a 10s motion scene comes back cluttered, generate the four beats **separately** and cut them. They're self-contained by design.

**Brand colours (house):** CONNEKT & SWIPE both = **teal primary, amber accent, light theme**.

## 8.5 THE LOGO OUTRO PATTERNS

**Pattern A â€” The Dissolve Lockup.**
Scene blooms/dissolves into clean light â†’ logo settles centre with a glassy bloom â†’ wordmark resolves â†’ tagline fades in below â†’ hold.

**Pattern B â€” The Zoom-Out Handoff** (the house favourite).
A locked or slow shot performs a **continuous zoom-out**, the subject becoming small in their world â†’ the scene dissolves â†’ the logo fades in and holds ~4â€“6s.
> *Used in: Nyima at her desk; the SWIPE thriving business; the boy's drone celebration.*

**Pattern C â€” The Drone Rise.**
One continuous aerial: subject celebrating â†’ the drone climbs, higher and higher â†’ the whole neighbourhood revealed â†’ dissolve â†’ logo. **No cuts, no ground shots.**

**The lockup contents:**
```
â€¢ the LOGO (mark + wordmark)
â€¢ the product/sub-brand line
â€¢ the TAGLINE
â€¢ the CONTACT: "WhatsApp 3044486" / "@sidrah.salaam"
```

**The split-generation note:** if the zoom-out-into-logo handoff comes back rough, generate the **live action** and the **logo outro** as two pieces and butt-join them in the edit. Cleaner control of the final hold, and you can drop in the *real* animated logo.

**House taglines of record:**
| Brand | Tagline |
|---|---|
| CONNEKT | **Scale Beyond Yourself** |
| Sidrah Salaam | **The Taste That Brings Us Together** |
| DEX | **We Carry More Than Packages** |
| SWIPE | *(open â€” candidates: "Your money, in control." / "Business, simplified.")* |

