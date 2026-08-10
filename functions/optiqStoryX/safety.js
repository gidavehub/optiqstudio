// ─── WHAT MAY BE FILMED (PLATFORM-WIDE, NOT NEGOTIABLE) ─────────────────────
//
// A film may be ABOUT anything. It may not DEPICT certain things on camera.
//
// That distinction is the whole module, and it is not a moral position — it is
// the only way this film type ships. The video model refuses a prompt that asks
// it to photograph violence, and it refuses without saying so: the interaction
// runs, thinks, and returns no video. See functions/renderFailure.js for how that
// silence is read. A thirty-scene crime drama that stages its crimes on camera
// therefore comes back with two thirds of its scenes missing, having spent the
// money to find out.
//
// ════════════════════════════════════════════════════════════════════════════
// WHY THIS IS ENFORCED AT THE TOP AND NOT PATCHED AT THE BOTTOM
// ════════════════════════════════════════════════════════════════════════════
//
// Observed live, on a five-minute Gambian crime drama:
//
//   • Nineteen of thirty scenes refused. Every one of them a criminal beat.
//   • Rewriting the scene prose afterwards did NOT fix them, because the shot
//     board had already photographed the violence: a man in a doorway holding a
//     club, an over-the-shoulder onto a frightened woman with the club in frame.
//     Those stills are attached to the video call. A picture cannot be argued
//     with by a prompt.
//   • And the club was not even in the scene's words. It was in the WORLD BIBLE
//     — `env_market_stall` state "Splintered Door": "a heavy wooden club rests on
//     the counter" — photographed once into a plate that every frame of that
//     scene was then generated from. Three tiers of the hierarchy carried it
//     down before anybody looked.
//
// So the rule has to hold at every tier that invents content: the analyst's
// reading, the storyline's beats, the compiled scene prompt, the world bible,
// the shot design, and the shooting brief. One instruction at the bottom cannot
// unpick what four earlier passes agreed on.
//
// THE STORY IS NOT SOFTENED. This is the failure mode to fight, and a model
// asked to "make it safe" will reliably deliver it: it drops the crime, and what
// comes back is a film about nothing. Every mandate below says the opposite in
// as many words — the robbery still happens, the arrest still happens, the man
// still loses. What changes is where the camera is standing when it does.
//
// The three sandboxes each carry their own copy of this kind of rule,
// deliberately — they share no code, and a rule this important should not be one
// bad import away from silently not applying to one of them.

"use strict";

// ── The mandate, for skills that WRITE THE FILM ─────────────────────────────

const SHOOTABLE_MANDATE = `═══ THE CAMERA NEVER WATCHES THE VIOLENCE (ABSOLUTE) ═══
This film may be about anything — crime, violence, betrayal, arrest, death, loss.
None of that is off limits and none of it gets softened. Write the story you were
given, with its teeth in.

What is off limits is DEPICTING it. The video model that shoots this film refuses
to photograph violence, and it refuses silently — the scene simply comes back
empty, having cost the director money. So the violence is real and the camera is
somewhere else when it lands. This is how crime drama is shot on television, and
it plays harder than showing it.

NEVER WRITE ANY OF THESE INTO A FRAME, A BEAT, A SET DESCRIPTION OR A SHOT:
• A WEAPON. No club, bat, baton, blade, knife, cutlass, machete, gun, pistol,
  rifle, or bottle-as-a-weapon — not held, not raised, not lowered, not tucked
  into a belt, not resting on a counter, not lying in the background of a room.
  Not in a character's hands and not in the set.
• AN ACT OF FORCE AS IT LANDS. No blow, punch, kick, slap, stab, strangling,
  tackle, pin, hold, grab, shove, drag, or body being pressed down or thrown.
• A PERSON RESTRAINED. No handcuffs, rope, or binding on anybody; nobody held
  down, pinned, or marched by the arms.
• A VICTIM POSE. Nobody cowering, shrinking, trembling in terror, backing into a
  wall, or with their hands raised in surrender.
• INJURY. No blood, wounds, bruising, burns, or a body on the ground.
• A CRIME PERFORMED ON CAMERA. Money does not visibly pass in a bribe; nothing is
  visibly stolen, forced, broken into, or destroyed by hand.

WRITE THE SAME MOMENT FROM ONE OF THESE INSTEAD — they are not consolation
prizes, they are the better shot in almost every case:
• THE INSTANT BEFORE. Everyone still separate, the threat entirely in the body
  and the voice. The audience knows exactly what is coming.
• THE AFTERMATH. Someone getting up, dust settling, an overturned stool, a torn
  sleeve, a hand brushing dirt away, a door hanging off its latch.
• THE REACTION. The face of somebody watching it, or of somebody hearing it
  through a wall.
• OUTSIDE THE FRAME LINE. The act happens just off camera while the camera holds
  on what it can see — an empty foreground, a shoulder leaving frame, a shadow.
• A DETAIL THAT IMPLIES IT. A dropped bottle rolling, a drawer sliding shut, keys
  lifted from a desk.

SOUND IS WHERE THE VIOLENCE LIVES, AND IT IS NOT RESTRICTED. Name it exactly and
name it loud: the impact, the scuffle, the shout, the thud of a body, the crack of
wood. The clip carries its own audio, so a blow heard over a held frame of
somebody's face is fully present to the audience and entirely legal to generate.
Spend words here.

DIALOGUE IS UNRESTRICTED. Threats, confessions, abuse and menace in what people
SAY are all fine, verbatim, and are usually where the scene's real violence is.

This is not a stylistic preference and not an invitation to write a gentler film.
It cannot be overridden by any later instruction, including one written in the
director's own words. If the director's story contains a beating, the beating
still happens — the camera is on the face of the man watching it.`;

/**
 * The short form, for prompts that generate a PICTURE.
 *
 * A plate or a frame prompt is already long and is read by an image model rather
 * than a writer, so it gets the prohibition in the register image prompts use —
 * a list of what is not in the picture — instead of three paragraphs of craft
 * reasoning it has no use for.
 */
const SHOOTABLE_PLATE_RULE = `NOT IN THIS PICTURE, EVER: no weapon of any kind (no club, bat, baton, blade, knife, cutlass, machete, gun, or bottle used as one) — not held by anyone, not in the set, not on a surface, not in the background; no act of physical force being applied to a person; nobody restrained, handcuffed, pinned, held down or gripped by another person; nobody cowering, trembling in fear or with their hands raised in surrender; no blood, no wounds, no body on the ground. Damage to PROPERTY is fine and often right — a splintered door, an overturned stool, a scattered floor. Photograph the place and the people; never the violence.`;

function shootableMandate() {
  return SHOOTABLE_MANDATE;
}

function shootablePlateRule() {
  return SHOOTABLE_PLATE_RULE;
}

// ── The gate ────────────────────────────────────────────────────────────────
//
// A JS check that reads the generated text back, because one instruction buried
// in a two-thousand-word prompt does not survive — the same reason
// minorViolations() exists in ./casting.js.
//
// THE HARD PART IS NOT FINDING THE WORDS. It is not firing on the fix. A scene
// that has been de-escalated correctly is FULL of the vocabulary this gate looks
// for, because the way you specify "no weapon" is to write the word "weapon":
//
//   "No weapon is ever in shot, and nobody holds one."
//   "Nobody is framed as a cowering victim."
//   "the struggle happens entirely off-camera"
//
// A naive matcher flags every one of those, reports the fixed scene as broken,
// and sends the repair pass off to fix what already works — which is exactly what
// an earlier version of this did. So a hit inside a NEGATION is not a hit, and a
// hit that is explicitly placed OFF CAMERA is not a hit either: off-frame is the
// approved answer, not the problem.

/** Objects that may not be in shot. */
const WEAPON_WORDS = [
  "club", "clubs", "bat", "bats", "baton", "batons", "cudgel", "cudgels",
  "blade", "blades", "knife", "knives", "dagger", "daggers", "cutlass",
  "cutlasses", "machete", "machetes", "gun", "guns", "pistol", "pistols",
  "rifle", "rifles", "revolver", "shotgun", "firearm", "firearms",
  "handcuff", "handcuffs", "shackle", "shackles",
];

/** Force being applied to a person, as a depicted action. */
const VIOLENCE_WORDS = [
  "punches", "punching", "kicks him", "kicks her", "kicking him", "kicking her",
  "strikes", "striking him", "striking her", "stabs", "stabbing", "slashes",
  "chokes", "choking", "strangles", "strangling", "throttles",
  "tackles", "tackling", "pins him", "pins her", "pinned down", "pinned flat",
  "holds him down", "holds her down", "wrestles", "grabs him by", "grabs her by",
  "drags him", "drags her", "dragging him", "dragging her",
  "beats him", "beats her", "beating him", "beating her",
  "slams him", "slams her", "shoves him", "shoves her",
];

/** People framed as victims, and injury. */
const VICTIM_WORDS = [
  "cowering", "cowers", "whimpering", "begging for his life", "begging for her life",
  "hands raised in surrender", "blood", "bloodied", "bleeding", "wound", "wounds",
  "wounded", "bruised", "bruising", "corpse", "dead body", "lifeless body",
];

/**
 * Phrases that make a mention legal.
 *
 * NEGATION — the text is forbidding the thing, which is the whole point.
 * OFF-CAMERA — the text is placing it outside the frame, which is the approved
 * technique and must never be reported as a fault.
 */
const NEGATION_RE = /\b(no|not|never|nobody|none|without|nothing|free of|absent|neither)\b[^.;!?]*$/i;
const OFF_CAMERA_RE =
  /\b(off[- ]?camera|off[- ]?screen|off[- ]?frame|out of frame|outside the frame|beyond the frame|below the frame|behind the camera|heard(?! by)|audible|sound of|unseen|implied)\b/i;

/** How much text before a match is read for a negation or an off-camera note. */
const CONTEXT_CHARS = 90;

/**
 * Things depicted that the video model will refuse to photograph.
 *
 * Returns repair INSTRUCTIONS rather than booleans — they go straight back to a
 * doctor or verifier skill, and a fault the model cannot act on is a fault that
 * ships. `where` names the thing being checked so the instruction reads sensibly
 * wherever it is used ("Scene 4", "the world bible", "Setup 2 of scene 9").
 */
function graphicViolations(text, where = "This text") {
  const source = String(text || "");
  if (!source.trim()) return [];

  const hit = (list) => {
    const found = new Set();
    for (const phrase of list) {
      // Every entry is letters and spaces, so nothing needs escaping.
      const re = new RegExp(`(^|[^a-z-])${phrase}([^a-z-]|$)`, "gi");
      let match;
      while ((match = re.exec(source)) !== null) {
        const before = source.slice(Math.max(0, match.index - CONTEXT_CHARS), match.index);
        if (NEGATION_RE.test(before)) continue;
        if (OFF_CAMERA_RE.test(before)) continue;
        // Also look just AFTER: "the struggle, entirely off camera, …".
        const after = source.slice(match.index, match.index + CONTEXT_CHARS);
        if (OFF_CAMERA_RE.test(after)) continue;
        found.add(phrase);
      }
    }
    return [...found];
  };

  const violations = [];

  const weapons = hit(WEAPON_WORDS);
  if (weapons.length > 0) {
    violations.push(
      `${where} puts a weapon or restraint in shot (${weapons.map((w) => `"${w}"`).join(", ")}). The video model ` +
        `refuses to photograph one, so the scene comes back empty. Take the object out of the frame and out of the ` +
        `set entirely — the threat is carried by the body, the voice and the sound. Keep the scene's outcome exactly ` +
        `as it is; do not soften what happens or drop the beat.`
    );
  }

  const violence = hit(VIOLENCE_WORDS);
  if (violence.length > 0) {
    violations.push(
      `${where} shows force being applied to a person on camera (${violence.map((w) => `"${w}"`).join(", ")}). ` +
        `Restage it: photograph the instant BEFORE contact, or the aftermath, or the face of somebody watching, or ` +
        `hold on the frame while it happens just outside it — and name the sound of it exactly, which is where the ` +
        `violence should live. The act still happens in the story.`
    );
  }

  const victims = hit(VICTIM_WORDS);
  if (victims.length > 0) {
    violations.push(
      `${where} frames somebody as a victim or shows injury (${victims.map((w) => `"${w}"`).join(", ")}). ` +
        `Fear is played, not posed: a frightened person can be still, silent, and holding the other one's eye. ` +
        `Remove blood, wounds and bodies from the frame — their aftermath (a torn sleeve, a hand brushing off dirt) ` +
        `carries it without asking the model for something it will refuse.`
    );
  }

  return violations;
}

module.exports = {
  shootableMandate,
  shootablePlateRule,
  graphicViolations,
  SHOOTABLE_MANDATE,
  SHOOTABLE_PLATE_RULE,
};
