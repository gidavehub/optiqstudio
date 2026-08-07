// ─── OPTIQ SKILLS — CHARACTER REFERENCE IMAGES ───────────────────────────────
//
// Consistency by picture, not only by paragraph.
//
// WHAT CHANGED, AND WHY IT IS A REVERSAL
//
// Doctrine module 03 (§3.1) argues at length AGAINST attaching character images:
// they trip content classifiers, they fight the prompt, they drag their own
// background in, and two of them fuse into one person. §3.8 concludes "images are
// reserved for products only". Every one of those observations came from real
// production failures and none of them are wrong.
//
// The director has overridden that call deliberately: text-only consistency held
// a face across nine clips well enough to be impressive and not well enough to be
// invisible, and a generated reference is a far tighter contract than 200 words
// about cheekbones. So we now author the face in words AND render it once, and
// every scene that character appears in carries the picture.
//
// The doctrine's failure modes are real, so each is mitigated rather than ignored:
//
//   BACKGROUND CONTAMINATION — the reference is generated on a plain seamless
//     backdrop with no props and no location, so there is nothing to leak. This is
//     the single biggest win: the flyer-kitchen bleed that §3.8 warns about cannot
//     happen when the plate is empty.
//   IDENTITY FUSION — §3.8 rule 1 ("never two images"). Scenes are capped at
//     MAX_REFS_PER_SCENE, and when more than one rides along the prompt gets an
//     explicit clause naming which image is which person.
//   CLASSIFIERS — the reference prompt is a plain neutral portrait brief: no
//     emotion, no situation, no minors in any state that reads as anything but a
//     character sheet.
//   THE IMAGE IS NOT THE SPECIFICATION — §3.8 rule 3 already had this right for
//     products, and it holds here: the Locked Character Block stays in every
//     prompt verbatim. The picture confirms, the words specify. If the two ever
//     disagree, the words win.
//
// Nothing here calls Vertex. The pipeline does the generation; this module decides
// WHO needs a reference, WHICH scenes carry it, and WHAT the prompt says.

"use strict";

/**
 * A character earns a reference image once they have a consistency burden —
 * i.e. they have to look the same in more than one separately generated clip.
 *
 * Doctrine §3.7 rule 3 is the reason single-scene characters are excluded: they
 * have no burden, they only need to be right once, and they already get richer
 * text description than recurring ones. Spending an image on them buys nothing.
 */
const MIN_SCENES_FOR_REF = 2;

/**
 * How many character references may ride on one scene.
 *
 * Two is the honest ceiling. §3.8's fusion warning is real, and it gets worse
 * fast: three faces in one prompt and the model starts averaging them. A scene
 * with four characters carries its two most prominent and leans on text for the
 * rest, which is what the word budgets are for.
 */
const MAX_REFS_PER_SCENE = 2;

/** Cost control: no film needs more than this many distinct character sheets. */
const MAX_REFS_PER_FILM = 6;

/**
 * Which characters need a reference image.
 *
 * Ordered by how much consistency work they are doing — most scenes first — so a
 * film that hits MAX_REFS_PER_FILM spends its images on the people who carry it.
 */
function planCharacterRefs(registry, sceneBeats) {
  const characters = (registry?.characters || []).filter((c) => c && c.name);
  if (characters.length === 0) return [];

  // Where each character actually appears: the registry's own `scenes` list,
  // widened by any beat that names them. The two disagree often enough to matter
  // — a scene-builder trusts the beat, so the beat has to count.
  const byName = new Map();
  for (const character of characters) {
    byName.set(normalizeName(character.name), new Set((character.scenes || []).map(Number)));
  }
  for (const beat of sceneBeats || []) {
    for (const name of beat.charactersPresent || []) {
      const key = normalizeName(name);
      if (byName.has(key)) byName.get(key).add(Number(beat.sceneNumber));
    }
  }

  return characters
    .map((character) => {
      const scenes = [...(byName.get(normalizeName(character.name)) || [])]
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      return { character, scenes };
    })
    .filter(({ scenes }) => scenes.length >= MIN_SCENES_FOR_REF)
    .sort((a, b) => b.scenes.length - a.scenes.length)
    .slice(0, MAX_REFS_PER_FILM)
    .map(({ character, scenes }, order) => ({
      id: `char_${slug(character.name)}`,
      name: character.name,
      role: character.role || "",
      lcb: character.lcb || "",
      wardrobe: character.wardrobe || "",
      scenes,
      /** Lower is more prominent — used to pick which two ride a crowded scene. */
      prominence: order,
    }));
}

/**
 * The image prompt for one character sheet.
 *
 * A single full-length frame rather than a headshot plus a body shot: one image
 * that shows the face clearly AND the whole locked outfit is worth more than two
 * that each show half, and it halves the number of references a multi-character
 * scene has to carry.
 *
 * Everything about the plate is specified so nothing about the plate can leak:
 * seamless backdrop, flat even light, neutral stance, no props, no location.
 */
function characterRefPrompt(ref) {
  return `A photorealistic full-length CHARACTER REFERENCE SHEET of one person, for film production continuity.

WHO THIS PERSON IS — build them to this description exactly:
${ref.lcb}

WHAT THEY ARE WEARING — exactly this outfit, head to toe:
${ref.wardrobe}

HOW THE REFERENCE MUST BE SHOT:
- One person only. Nobody else in frame, no reflections of anyone else.
- Full length, head to feet, standing squarely facing the camera, arms relaxed at their sides.
- The FACE IS SHARP, evenly lit and clearly readable — this image exists to fix their face and their clothes.
- Neutral, relaxed expression. Not smiling broadly, not posing, not acting, no emotion to read.
- Plain seamless mid-grey studio backdrop. Absolutely NOTHING else in frame: no furniture, no props, no plants, no doorway, no location, no scenery, no text, no logo, no watermark.
- Flat, even, soft studio lighting from the front. No dramatic shadow, no coloured gel, no rim light, no lens flare, no vignette.
- Sharp focus throughout, no shallow depth of field, no film grain, no filter, no stylisation, no grade.
- Natural skin texture. Not retouched, not airbrushed, not glamorised.
- Photographic realism. Not an illustration, not a painting, not 3D, not a cartoon.

This is a wardrobe-and-casting continuity still, the kind a production keeps on file so the same person can be filmed again weeks later. Make it plain, accurate and useful — not beautiful.`;
}

/**
 * Which references a given scene carries.
 *
 * A scene only ever gets the people who are actually IN it. This is the whole
 * point: attaching every character's face to every scene is how a reference for
 * scene 3 ends up dragging that person into scene 1, and it is exactly what the
 * old blanket-attach behaviour did with uploaded materials.
 */
function refsForScene(refs, beat, sceneNumber) {
  const number = Number(sceneNumber ?? beat?.sceneNumber);
  const named = new Set((beat?.charactersPresent || []).map(normalizeName));
  return (refs || [])
    .filter((ref) => ref.scenes.includes(number) || named.has(normalizeName(ref.name)))
    .sort((a, b) => a.prominence - b.prominence)
    .slice(0, MAX_REFS_PER_SCENE);
}

/**
 * The clause that goes in the prompt alongside the attached references.
 *
 * Two jobs, both load-bearing. It quarantines the plate (§3.8 rule 2) so the grey
 * backdrop and the flat lighting cannot follow the person into the scene. And when
 * two references ride together it says which image is which person, because
 * without that the model averages them into one face.
 */
function refClause(sceneRefs) {
  if (!sceneRefs || sceneRefs.length === 0) return "";
  const single = sceneRefs.length === 1;
  const roll = sceneRefs
    .map((ref, i) => `Attached image ${i + 1} is ${ref.name.toUpperCase()}${ref.role ? ` (${ref.role})` : ""}.`)
    .join(" ");

  return `=== ATTACHED CHARACTER REFERENCE${single ? "" : "S"} ===
${roll}
Match ${single ? "this person's" : "each person's"} FACE, SKIN TONE, HAIR and OUTFIT to the attached reference exactly — this is the same person appearing across several clips and they must be recognisably identical in every one.

TAKE ONLY THE PERSON. The reference is a studio continuity still shot against a plain grey backdrop under flat lighting, in a neutral standing pose. Do NOT carry over ANY of that: not the grey backdrop, not the studio lighting, not the flat frontal angle, not the neutral pose, not the full-length framing. Nothing about the reference's setting, light, mood or composition belongs in this scene. This scene has its own location, its own light, its own camera and its own action, all described below, and they override the reference completely.${
    single
      ? ""
      : `\n\nThese are ${sceneRefs.length} DIFFERENT people. Keep them distinct: do not blend, merge, average or swap their faces, and do not give one person another's hair, skin tone or clothes.`
  }

The written character block${single ? "" : "s"} below remain${single ? "s" : ""} the specification. Where the reference and the words disagree, the WORDS WIN.`;
}

// ── Placing the director's own uploads ──────────────────────────────────────

/**
 * Where an uploaded material belongs, given what a model said it is.
 *
 * The old behaviour put every uploaded image on every scene, which is wrong in
 * both directions: a product shot has no business in a scene the product isn't
 * in, and a logo pasted onto all nine scenes invites the model to paint it into
 * every frame.
 *
 * `classification` is per-material: { index, kind, scenes }. Anything the
 * classifier is unsure about falls back to the scenes where the product appears,
 * and failing that to every scene — the previous behaviour, which is wrong but
 * never worse than dropping a reference the director deliberately uploaded.
 */
function placeMaterials(materials, classifications, storyline) {
  const list = materials || [];
  if (list.length === 0) return {};

  const productScenes = (storyline?.sceneBeats || [])
    .filter((b) => b.productPresent)
    .map((b) => Number(b.sceneNumber))
    .filter(Number.isFinite);
  const allScenes = (storyline?.sceneBeats || []).map((b) => Number(b.sceneNumber)).filter(Number.isFinite);

  const byIndex = new Map((classifications || []).map((c) => [Number(c.index), c]));
  const placement = {};

  list.forEach((material, index) => {
    const verdict = byIndex.get(index);
    let scenes = (verdict?.scenes || []).map(Number).filter((n) => allScenes.includes(n));

    if (scenes.length === 0) {
      // A logo belongs where the brand lands, which is the end of the film — not
      // smeared across every scene.
      if (verdict?.kind === "logo") {
        scenes = allScenes.slice(-1);
      } else if (verdict?.kind === "product") {
        scenes = productScenes.length > 0 ? productScenes : allScenes;
      } else {
        scenes = productScenes.length > 0 ? productScenes : allScenes;
      }
    }

    for (const sceneNumber of scenes) {
      const key = sceneNumber - 1; // sceneImages is keyed by 0-based index
      if (!placement[key]) placement[key] = [];
      placement[key].push(index);
    }
  });

  return placement;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function normalizeName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function slug(name) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "unnamed"
  );
}

module.exports = {
  planCharacterRefs,
  characterRefPrompt,
  refsForScene,
  refClause,
  placeMaterials,
  MIN_SCENES_FOR_REF,
  MAX_REFS_PER_SCENE,
  MAX_REFS_PER_FILM,
};
