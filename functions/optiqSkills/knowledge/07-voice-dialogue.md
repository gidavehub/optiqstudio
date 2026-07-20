# OPTIQ SKILLS KNOWLEDGE — PART VII: DIALOGUE, VOICE PROFILES AND VO (separation principle, house voices, Wolof protocol, timing math)
(Internal operating doctrine for the Optiq Skills agent swarm. Extracted from the Optiq film system manual.)

# PART VII â€” DIALOGUE, VOICE PROFILES & VO

## 7.1 THE SEPARATION PRINCIPLE

> **Voiceover is generated separately. Always. The video prompt never contains VO.**

The video prompt's SOUND block is **diegetic only** â€” the sounds that exist in the world of the shot. It is always tagged:
```
SOUND (diegetic only; voiceover separate)
```

**Why:** VO generated inside a video model is uncontrollable, unmatched across clips, and usually wrong. VO is a separate craft with its own voice profile, its own transcript, and its own take. You lay it over the picture in the edit.

**In-scene dialogue is different.** If a character *speaks in the scene* (Neneh Fatou saying "the food is finished"), that dialogue goes in the prompt with a delivery note, because it's part of the performance.

## 7.2 THE VOICE PROFILE SPEC (8 FIELDS)

Every voice gets all eight. This is the casting brief and the generation brief in one.

1. **The feeling / who they are in sound** â€” the one-paragraph soul of the voice. Who is this person and what does hearing them feel like?
2. **Language & accent** â€” with *phonetic markers*, not just a label. (See Â§7.5.)
3. **Pitch & timbre** â€” register, weight, texture. `"Deep, low, resonant male register â€” chest-rich and full, with a smooth, slightly gravelly warmth in the low notes."`
4. **Pace** â€” and be exact, because this is the field that gets revised most. `normal, natural conversational pace â€” not slow, not drawn-out, not rushed.`
5. **Energy & dynamics** â€” the range. `"Low and even throughout. Minimal dynamic range â€” no swells, no emphasis spikes, no building toward a climax."`
6. **Tone arc across the film** â€” how it changes from scene 1 to scene 9. Or, deliberately: *"Barely moves â€” and that's the point."*
7. **Texture** â€” breaths, smile-in-the-voice, mic technique. `"Soft, audible natural breaths left in. Close-mic'd, dry, intimate studio sound, no baked-in music."`
8. **One-line summary** â€” the castable sentence. This is what you'd hand a voice agency.

## 7.3 THE HOUSE VOICES

**VOICE A â€” "The Wise Narrator" (British-Nigerian Morgan Freeman).**
> Deep, warm, resonant older male â€” refined British-Nigerian blend, low chest-rich timbre, slow and deliberate with measured gravitas, wise and reassuring, commanding but gentle â€” the voice of a trusted elder telling a truth.

Markers: polished rounded British diction on a warm melodic Nigerian foundation; crisp fully-enunciated consonants; rich rounded vowels; the diction of a seasoned broadcaster or statesman; mature (50sâ€“60s); a dignified rasp on quiet lines.
**Use for:** brand films, mission films, employer-side B2B, product narration, outros.

**VOICE B â€” "The Gambian Elder" (Wolof).**
The same gravitas in authentic Gambian Wolof. Deep, warm, resonant, proud. **Normal pace, not slow.**
**Use for:** local-market product films (Sidrah Salaam).

**VOICE C â€” "The Young Woman, First Person."**
> Relaxed, soft, low-energy young Gambian woman, mid-low warm register, gentle West-African lilt, normal conversational pace, quietly content â€” telling her own story calmly, never performed, never excited.

Markers: soft light "r"; clean lightly-dental "t"/"d"; pure rounded vowels; even syllable timing; gentle melodic intonation settling *down* at phrase ends, never up-talked; the musicality of English shaped by Mandinka/Wolof first-language rhythm.
**Use for:** personal-journey narratives (Nyima).
**Critical note:** this voice is defined by **restraint**. The instinct is to make it inspirational and passionate. Don't. `"The warmth is in the stillness, not in energy."`

**VOICE D â€” "The Market Woman."**
> Loud, chesty, theatrically aggrieved Gambian woman in her late forties â€” a voice that cuts across a noisy market, sharp and animated and scolding, softened by the musicality of Wolof. Comically outraged, not truly angry.

**VOICE E â€” "The Driver."**
> Deep, rough, gravelly Gambian man in his fifties â€” loud, blunt, hardened by the road. A short-tempered bark out of a window. Comically furious.

**VOICE F â€” "The Everyman Lead."**
> Clear, friendly, expressive mid-range male, youthful and energetic, natural warmth and easy charm, Gambian-accented English. Emotions read instantly.
**Note:** this voice must be specified with its **arc** â€” relaxed on the couch, flustered when bluffing, breathless during the run, overjoyed at the payoff.

## 7.4 TRANSCRIPT FORMATS

**Format 1 â€” Tagged (for engines that read delivery cues: ElevenLabs v3 etc.)**
```
[relaxed] [breathes] My name is Nyima. [pause] I come from a small village,
where every single day begins with work.
```
Tags: `[wise] [calm] [relaxed] [thoughtful] [reflective] [warm] [hopeful] [breathes] [pause]`

**Format 2 â€” Clean (for engines that read tags aloud â€” most of them)**
```
My name is Nyima. I come from a small village, where every single day begins with work.
```
Pauses carried by **ellipses and line breaks**. This is the safer default; always offer it.

**Format 3 â€” Bilingual (Wolof)**
```
"Waaw doomam, Ã±am bi jeex na."
â€” ("Sorry my son, the food is finished.")
```

**Format 4 â€” The scene map** (the deliverable that prevents chaos):

| Scene | Character A | Character B | VO |
|---|---|---|---|
| 1 | "â€¦food is finished." | (optional) "Is there food?" | â€” |
| 4 | **Nutrient VO** | (reacts) | âœ“ |
| 5 | â€” | â€” | â€” |

## 7.5 WOLOF PROTOCOL

**The standing rule, on every Wolof deliverable:**
> These lines are a faithful guide â€” have a **native Gambian Wolof speaker** confirm the exact phrasing and natural register before recording, or let your actors say them naturally in their own words. Each line is provided with its English meaning so it can be checked.

**Why this is non-negotiable:** Wolof orthography varies; Gambian Wolof differs from Senegalese; loan words (*proteÅ‹, vitamin, pÃ«stisid, fresh*) need a native ear; and a wise-elder register is a performance choice a native speaker will land better than a transliteration.

**The two service models:**
- **(a) Wolof lines + English meanings** â€” the default. Gives the talent something to work from.
- **(b) English only, translated live by the narrator** â€” often *more* authentic. Offer it.

**Pronunciation flags to always include:**
- `Connekt` â†’ tell the engine **"Connect"** so it doesn't spell out the K.
- Brand names get a phonetic note on first use.

**The working Wolof lexicon from production:**
| Wolof | English |
|---|---|
| *Ã±am bi jeex na* | the food is finished |
| *waaw doomam* | yes/sorry my son |
| *dÃ©nk naa la benn assiet* | I kept a plate for you |
| *am na Ã±am?* | is there food? |
| *lu taxâ€¦?* | whyâ€¦? |
| *doole* | strength / energy |
| *tigadege* | groundnut paste |
| *bu set* | clean / pure |
| *bu bees* | fresh / new |
| *njariÃ±* | goodness / benefit |
| *sunu bopp* | our own selves |
| *benn ndab, benn njaboot* | one bowl, one family |
| *xanaa dafa dof?* | is he mad? |
| *foo jÃ«m?* | where are you going? |

## 7.6 TIMING MATH

**The rates (measured in production):**
- Wise narrator, measured gravitas: **~7â€“9s** per line
- Relaxed first-person, normal pace: **~6â€“8s** per line
- Same, slow pace: **~7â€“9s** per line

**The rule:** a line must **sit inside** its clip with air, not fill it. A 10s clip wants a **6â€“8s** line. If a line is tight, trim the *second sentence*, never the first â€” the first carries the idea.

**The one-line-per-clip discipline:** for brand films, one sentence per scene, plus the tagline at the end. It is always stronger than two. When in doubt, cut.

