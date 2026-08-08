// ─── THE SHOT BOARD RUNNER ──────────────────────────────────────────────────
//
// Photographs a film before it is filmed. See optiqSkills/shotBoard.js for what
// a shot board IS and why it exists; this module is the machinery that builds
// one: the model calls, the storage, the ordering, and the part that survives
// running out of time.
//
// Shared by both storyboard systems, exactly like ./audioPost.js. The two boxes
// stay code-isolated where it counts — each supplies its own `brain`
// (optiqSkills/shotBoard.js or optiqStory/shotBoard.js), which owns every prompt
// and every rule. This file owns none of them; it only decides what to call and
// in what order.
//
// WHY IT IS ITS OWN JOB, AND NOT PART OF THE STORYBOARD PIPELINE
//
// Arithmetic. An 18-scene film is ~6 set plates + ~6 prop plates + ~54 frames,
// and the image quota is 8 per minute (see vertexQuota DEFAULT_CAPS). That is
// eight minutes of pictures on a function that gets nine, on top of a swarm that
// already spends most of them writing the film. Bolted onto the storyboard job it
// would time the storyboard out — and a stranded storyboard costs the director
// the whole generation, while a stranded shot board costs them some pictures.
//
// So the storyboard finishes and says "ready" at exactly the speed it always
// has, and this runs behind it. Everything here is best-effort in the same way
// character references are: a film with no shot board is the film this platform
// shipped last week.
//
// HOW IT SURVIVES THE CLOCK
//
// The runner takes a soft deadline and checks it between units of work. When it
// runs out it stops cleanly, returns what it finished and says `done: false`, and
// the caller enqueues a continuation. Because everything it has already made is
// on the project — plates in Storage, shots in the board — the next run reuses
// all of it and only builds what is missing. A 180-second film takes three passes
// and nobody has to watch it happen.

"use strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TEXT_MODEL = "gemini-3.5-flash";

/** Text calls are cheap and quota-light; images are neither. */
const DESIGN_CONCURRENCY = 3;
const IMAGE_CONCURRENCY = 2;

// ── A skill runner ──────────────────────────────────────────────────────────
// A local twin of the one inside each pipeline. Copied rather than imported, so
// this shared module never has to reach into one sandbox's pipeline and drag it
// into the other's runs.

function isRetryable(err) {
  const msg = String(err?.message || err);
  return /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded|deadline|invalid JSON|unterminated|unexpected (end|token)|returned empty|MAX_TOKENS|finishReason/i.test(
    msg
  );
}

function makeSkillRunner(vertexFetch) {
  return async function runSkill(name, systemPrompt, userParts, responseSchema) {
    const generationConfig = { temperature: 0.6, maxOutputTokens: 32768 };
    if (responseSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = responseSchema;
    }
    const backoffs = [4000, 10000, 22000];
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await vertexFetch(`/publishers/google/models/${TEXT_MODEL}:generateContent`, {
          contents: [{ role: "user", parts: userParts }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig,
        });
        const candidate = (response.candidates || [])[0];
        const finishReason = candidate?.finishReason;
        const text = candidate?.content?.parts?.map((p) => p.text || "").join("") || "";
        if (!text) {
          throw new Error(
            `shot-board skill "${name}" returned empty output (finishReason=${finishReason || "none"})`
          );
        }
        if (!responseSchema) return text.trim();
        try {
          return JSON.parse(text);
        } catch (parseErr) {
          throw new Error(
            `shot-board skill "${name}" returned invalid JSON (finishReason=${finishReason || "none"}): ${parseErr.message}`
          );
        }
      } catch (err) {
        if (attempt < backoffs.length && isRetryable(err)) {
          const wait = backoffs[attempt] + Math.floor(Math.random() * 1500);
          console.warn(`[shotboard] "${name}" failed (attempt ${attempt + 1}); retrying in ${wait}ms:`, String(err.message || err).slice(0, 180));
          await sleep(wait);
          continue;
        }
        throw err;
      }
    }
  };
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ── The run ─────────────────────────────────────────────────────────────────

/**
 * @param {object}   o
 * @param {Function} o.vertexFetch   the project's Vertex caller
 * @param {Function} o.generateImage async (prompt, { aspectRatio, images }) => { base64, mimeType }
 * @param {Function} o.storeImage    async (path, base64, mimeType) => { path, url }
 * @param {Function} o.loadImage     async (path) => base64 — rehydrates a stored plate
 * @param {object}   o.brain         the sandbox's shotBoard module
 * @param {object}   o.project       the project doc
 * @param {string}   o.projectId
 * @param {string}   o.uid
 * @param {object|null} o.scope      { scenes:[0-based], rebuildContinuity:boolean } — a targeted re-roll
 * @param {number}   o.deadlineAt    epoch ms; work stops cleanly after this
 * @param {Function} o.onStage       (stage, meta) => Promise
 */
async function runShotBoard({
  vertexFetch,
  generateImage,
  storeImage,
  loadImage,
  brain,
  project,
  projectId,
  uid,
  scope = null,
  deadlineAt = Date.now() + 7 * 60 * 1000,
  onStage,
}) {
  const runSkill = makeSkillRunner(vertexFetch);
  const scenes = project.scenes || [];
  const aspectRatio = project.aspectRatio || "16:9";
  const styleHeader = project.styleHeader || "";
  const characterRefs = project.characterRefs || [];
  const notes = [];
  const violations = [];

  if (scenes.length === 0) throw new Error("This project has no scenes yet.");

  const report = async (stage, meta) => {
    if (!onStage) return;
    try {
      await onStage(stage, meta);
    } catch (err) {
      console.warn("[shotboard] stage report failed (non-fatal):", String(err?.message || err).slice(0, 120));
    }
  };
  const outOfTime = () => Date.now() > deadlineAt;

  // Everything already built for this film. A continuation pass reuses all of it
  // and only makes what is missing — which is the whole reason a long film can
  // finish across several invocations without paying for the same plate twice.
  const previous = project.shotBoard || null;
  const reuseContinuity = !scope?.rebuildContinuity && previous?.continuity?.locations?.length > 0;

  // Which scenes this pass is responsible for. A re-roll names them; otherwise
  // it is every scene that has no frames yet.
  const targetIndexes =
    scope?.scenes?.length
      ? scope.scenes.filter((i) => i >= 0 && i < scenes.length)
      : scenes
          .map((_, i) => i)
          .filter((i) => !(previous?.scenes?.[i]?.shots || previous?.scenes?.[String(i)]?.shots || []).some((s) => s.url));

  // ── 1. CONTINUITY ─────────────────────────────────────────────────────────
  await report("designing", { step: "continuity" });

  let continuity;
  if (reuseContinuity) {
    continuity = previous.continuity;
    notes.push(`Reused the film's existing continuity: ${continuity.locations.length} location(s).`);
  } else {
    const characterNames = characterRefs.map((r) => r.name).filter(Boolean);
    const system = brain.continuityDirective({
      numScenes: scenes.length,
      branded: !!project.brandName,
    });
    const brief = brain.continuityBrief({
      scenes,
      registry: project.consistencyRegistry || null,
      characterNames,
      brandName: project.brandName,
      product: project.product,
    });

    continuity = await runSkill("continuity", system, [{ text: brief }], brain.CONTINUITY_SCHEMA);

    const faults = brain.continuityViolations(continuity, scenes);
    if (faults.length > 0) {
      console.warn(`[shotboard ${projectId}] continuity produced ${faults.length} violation(s); repairing`);
      try {
        const repaired = await runSkill(
          "continuity-repair",
          `${system}

═══ THIS IS A REPAIR PASS ═══
Your previous continuity document failed the house gates. Fix EVERY violation
below and change nothing else — the same locations, the same keys, the same scene
mapping, unless a violation names them. Return the COMPLETE document.`,
          [
            {
              text: `VIOLATIONS TO FIX:
${faults.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE DOCUMENT TO REPAIR:
${JSON.stringify(continuity, null, 2)}

${brief}`,
            },
          ],
          brain.CONTINUITY_SCHEMA
        );
        if ((repaired?.locations || []).length > 0) {
          const remaining = brain.continuityViolations(repaired, scenes);
          console.log(`[shotboard ${projectId}] continuity ${faults.length} → ${remaining.length} violation(s)`);
          continuity = repaired;
          violations.push(...remaining);
        } else {
          violations.push(...faults);
        }
      } catch (err) {
        console.error("[shotboard] continuity repair failed; keeping the original:", String(err?.message || err).slice(0, 180));
        violations.push(...faults);
      }
    }
  }

  const locations = brain.selectSetPlates(continuity.locations);
  const props = brain.selectPropPlates(continuity.props);
  const locationByKey = new Map(locations.map((l) => [l.key, l]));
  const propByKey = new Map(props.map((p) => [p.key, p]));
  const sceneLocationKey = new Map(
    (continuity.sceneLocations || []).map((m) => [Number(m.sceneNumber), m.locationKey])
  );
  const scenePropKeys = new Map(
    (continuity.sceneLocations || []).map((m) => [Number(m.sceneNumber), m.propKeys || []])
  );

  // ── 2. PLATES AND SHOT DESIGN, TOGETHER ───────────────────────────────────
  //
  // Run in parallel on purpose: plates are image calls and shot design is text
  // calls, so they draw on two different per-minute quota buckets. Serialising
  // them would leave one bucket idle for minutes at a time on a long film.

  const platesFrom = (list) => new Map((list || []).map((p) => [p.key, p]));
  const existingSetPlates = platesFrom(previous?.setPlates);
  const existingPropPlates = platesFrom(previous?.propPlates);

  // The director's own uploads, for the product plate to be built from. Two at
  // most: past that they stop being one object photographed twice and start
  // being several things for the model to average.
  const productImages = [];
  for (const material of (project.materials || []).filter((m) => (m.mimeType || "").startsWith("image/")).slice(0, 2)) {
    if (!material.path || !loadImage) continue;
    try {
      productImages.push({ base64: await loadImage(material.path), mimeType: material.mimeType });
    } catch (err) {
      console.error(`[shotboard] could not read material ${material.path}:`, String(err?.message || err).slice(0, 140));
    }
  }

  const platePath = (kind, key) =>
    `users/${uid}/projects/${projectId}/shotboard/${kind}-${brain.slug(key)}-${Date.now().toString(36)}${randomSuffix()}.png`;

  const renderPlates = async () => {
    const setJobs = locations.filter((l) => !existingSetPlates.get(l.key)?.url);
    const propJobs = props.filter((p) => !existingPropPlates.get(p.key)?.url);
    const total = setJobs.length + propJobs.length;
    if (total === 0) return;

    let done = 0;
    await report("plating", { platesDone: 0, platesTotal: total });

    const runOne = async (kind, item, prompt, images) => {
      if (outOfTime()) return null;
      try {
        const image = await generateImage(prompt, {
          aspectRatio: kind === "set" ? aspectRatio : "1:1",
          images,
        });
        const stored = await storeImage(platePath(kind, item.key), image.base64, image.mimeType);
        return { ...stored, mimeType: image.mimeType, base64: image.base64 };
      } catch (err) {
        console.error(`[shotboard] ${kind} plate "${item.key}" failed:`, String(err?.message || err).slice(0, 200));
        notes.push(`The ${kind === "set" ? "location" : "object"} plate for "${item.name}" could not be made; its frames fall back to the written description.`);
        return null;
      } finally {
        done += 1;
        await report("plating", { platesDone: done, platesTotal: total });
      }
    };

    await mapWithConcurrency(setJobs, IMAGE_CONCURRENCY, async (location) => {
      const made = await runOne("set", location, brain.setPlatePrompt(location, { aspectRatio, styleHeader }));
      if (made) existingSetPlates.set(location.key, { ...location, ...made });
    });
    await mapWithConcurrency(propJobs, IMAGE_CONCURRENCY, async (prop) => {
      // The client's own photograph of their product is ground truth, and this is
      // the one place it can enter the pictures: the product plate descends from
      // the real thing, every frame descends from the plate, and the clip
      // descends from the frames. Without this the product is a generated
      // approximation of a written description of a real object — which is how
      // a label ends up nearly right in every single shot.
      const usesClientPhoto = (prop.kind === "packaging" || prop.kind === "product") && productImages.length > 0;
      const made = await runOne(
        "prop",
        prop,
        brain.propPlatePrompt(prop, { aspectRatio: "1:1", hasReference: usesClientPhoto }),
        usesClientPhoto ? productImages.slice(0, 2) : undefined
      );
      if (made) existingPropPlates.set(prop.key, { ...prop, ...made });
    });
  };

  const designed = new Map(); // sceneIndex → { coverage, shots }

  const designShots = async () => {
    // A scene keeps its existing design when only its pictures are being
    // re-rolled: the director approved that shot list, and quietly re-cutting it
    // underneath them is not a re-roll.
    const jobs = targetIndexes.filter((i) => {
      const kept = previous?.scenes?.[i] || previous?.scenes?.[String(i)];
      if (scope?.keepDesign && kept?.shots?.length) {
        designed.set(i, { coverage: kept.coverage, shots: kept.shots.map(stripImageFields) });
        return false;
      }
      return true;
    });
    if (jobs.length === 0) return;

    let done = 0;
    await report("designing", { scenesDone: 0, scenesTotal: jobs.length });

    await mapWithConcurrency(jobs, DESIGN_CONCURRENCY, async (index) => {
      if (outOfTime()) return;
      const scene = scenes[index];
      const number = Number(scene.sceneNumber ?? index + 1);
      const location = locationByKey.get(sceneLocationKey.get(number)) || null;
      const sceneProps = (scenePropKeys.get(number) || []).map((k) => propByKey.get(k)).filter(Boolean);
      const sceneCharacters = charactersInScene(characterRefs, number);

      try {
        const system = brain.shotDesignDirective({ location });
        const brief = brain.shotDesignBrief({
          scene: { ...scene, sceneNumber: number },
          location,
          props: sceneProps,
          characters: sceneCharacters,
          aspectRatio,
        });
        let plan = await runSkill(`shot-design-${number}`, system, [{ text: brief }], brain.SHOT_SCHEMA);

        const faults = brain.shotPlanViolations(plan);
        if (faults.length > 0) {
          try {
            const repaired = await runSkill(
              `shot-design-repair-${number}`,
              `${system}

═══ THIS IS A REPAIR PASS ═══
Your setups failed the house gates. Fix EVERY violation below and change nothing
else — the same coverage, the same angles, the same intent. Return the COMPLETE
setup list in order.`,
              [
                {
                  text: `VIOLATIONS TO FIX:
${faults.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE SETUPS TO REPAIR:
${JSON.stringify(plan, null, 2)}

${brief}`,
                },
              ],
              brain.SHOT_SCHEMA
            );
            if ((repaired?.shots || []).length > 0) {
              const remaining = brain.shotPlanViolations(repaired);
              console.log(`[shotboard ${projectId}] scene ${number} shots ${faults.length} → ${remaining.length} violation(s)`);
              plan = repaired;
              violations.push(...remaining.map((v) => `Scene ${number}: ${v}`));
            } else {
              violations.push(...faults.map((v) => `Scene ${number}: ${v}`));
            }
          } catch (err) {
            console.error(`[shotboard] scene ${number} shot repair failed:`, String(err?.message || err).slice(0, 180));
            violations.push(...faults.map((v) => `Scene ${number}: ${v}`));
          }
        }

        designed.set(index, {
          coverage: plan.coverage || "",
          shots: (plan.shots || [])
            .slice(0, brain.MAX_SHOTS_PER_SCENE)
            .map((shot, order) => ({ ...shot, order })),
        });
      } catch (err) {
        console.error(`[shotboard] scene ${number} shot design failed:`, String(err?.message || err).slice(0, 200));
        notes.push(`Scene ${number} could not be broken into setups; it renders from its prompt alone.`);
      } finally {
        done += 1;
        await report("designing", { scenesDone: done, scenesTotal: jobs.length });
      }
    });
  };

  await Promise.all([renderPlates(), designShots()]);

  const setPlates = [...existingSetPlates.values()];
  const propPlates = [...existingPropPlates.values()];

  // ── 3. FRAMES ─────────────────────────────────────────────────────────────
  //
  // Every plate this pass did not make itself is rehydrated from Storage once and
  // held in memory — a plate rides along with every frame shot in its location,
  // so downloading it per frame would be the same bytes fifty times over.

  const withBytes = async (plate) => {
    if (!plate) return null;
    if (plate.base64) return plate;
    if (!plate.path || !loadImage) return null;
    try {
      return { ...plate, base64: await loadImage(plate.path) };
    } catch (err) {
      console.error(`[shotboard] could not read plate ${plate.path}:`, String(err?.message || err).slice(0, 140));
      return null;
    }
  };

  const frameJobs = [];
  for (const index of targetIndexes) {
    const design = designed.get(index);
    if (!design) continue;
    const scene = scenes[index];
    const number = Number(scene.sceneNumber ?? index + 1);
    for (const shot of design.shots) {
      frameJobs.push({ index, number, shot });
    }
  }

  const framesTotal = frameJobs.length;
  let framesDone = 0;
  await report("framing", { framesDone: 0, framesTotal });

  // Loaded lazily and once each, keyed by path.
  const bytesCache = new Map();
  const cached = async (plate) => {
    if (!plate?.path) return null;
    if (!bytesCache.has(plate.path)) bytesCache.set(plate.path, await withBytes(plate));
    return bytesCache.get(plate.path);
  };

  const framesByScene = new Map();
  await mapWithConcurrency(frameJobs, IMAGE_CONCURRENCY, async (job) => {
    if (outOfTime()) return;
    const { index, number, shot } = job;
    const location = locationByKey.get(sceneLocationKey.get(number)) || null;
    const setPlate = location ? await cached(existingSetPlates.get(location.key)) : null;
    const sceneCharacters = charactersInScene(characterRefs, number);

    const refBytes = [];
    for (const ref of sceneCharacters) {
      const loaded = await cached(ref);
      if (loaded?.base64) refBytes.push(loaded);
    }
    const plateBytes = [];
    for (const key of shot.propKeys || []) {
      const loaded = await cached(existingPropPlates.get(key));
      if (loaded?.base64) plateBytes.push(loaded);
    }

    const inputs = brain.frameInputPlan(shot, {
      setPlate,
      characterRefs: refBytes,
      propPlates: plateBytes,
    });

    try {
      const prompt = brain.framePrompt(shot, {
        location,
        characters: sceneCharacters,
        inputs,
        aspectRatio,
        styleHeader,
      });
      const image = await generateImage(prompt, {
        aspectRatio,
        images: inputs
          .map((i) => i.ref)
          .filter((r) => r?.base64)
          .map((r) => ({ base64: r.base64, mimeType: r.mimeType || "image/png" })),
      });
      const path = `users/${uid}/projects/${projectId}/shotboard/frame-s${number}-${shot.order + 1}-${Date.now().toString(36)}${randomSuffix()}.png`;
      const stored = await storeImage(path, image.base64, image.mimeType);
      if (!framesByScene.has(index)) framesByScene.set(index, []);
      framesByScene.get(index).push({
        ...stripImageFields(shot),
        id: `s${number}_${shot.order + 1}`,
        path: stored.path,
        url: stored.url,
        mimeType: image.mimeType,
        renderedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`[shotboard] frame ${number}.${shot.order + 1} failed:`, String(err?.message || err).slice(0, 200));
      notes.push(`Setup ${shot.order + 1} of scene ${number} could not be photographed.`);
      if (!framesByScene.has(index)) framesByScene.set(index, []);
      framesByScene.get(index).push({ ...stripImageFields(shot), id: `s${number}_${shot.order + 1}` });
    } finally {
      framesDone += 1;
      await report("framing", { framesDone, framesTotal });
    }
  });

  // ── 4. ASSEMBLE ───────────────────────────────────────────────────────────

  const boardScenes = { ...(previous?.scenes || {}) };
  const completed = [];

  for (const index of targetIndexes) {
    const design = designed.get(index);
    const frames = (framesByScene.get(index) || []).sort((a, b) => a.order - b.order);
    if (!design || frames.length === 0) continue;
    const scene = scenes[index];
    const number = Number(scene.sceneNumber ?? index + 1);

    // A scene whose pictures all failed still keeps its design. That is what
    // lets a continuation re-shoot the frames without re-cutting the scene —
    // and the clause is applied by the caller from the frames that HAVE a url,
    // so a board full of url-less setups changes no prompt.
    boardScenes[index] = {
      sceneNumber: number,
      locationKey: sceneLocationKey.get(number) || null,
      coverage: design.coverage,
      shots: frames,
      builtAt: new Date().toISOString(),
    };
    if (frames.some((f) => f.url)) completed.push(index);
  }

  const remaining = targetIndexes.filter((i) => !completed.includes(i));

  return {
    continuity: {
      locations: continuity.locations || [],
      props: continuity.props || [],
      sceneLocations: continuity.sceneLocations || [],
    },
    setPlates: setPlates.map(stripBytes),
    propPlates: propPlates.map(stripBytes),
    scenes: boardScenes,
    completed,
    remaining,
    done: remaining.length === 0,
    framesRendered: framesDone,
    violations,
    notes,
    builtAt: new Date().toISOString(),
  };
}

// ── What a scene's render actually attaches ─────────────────────────────────

/**
 * The images that ride along with one scene's video render, in order.
 *
 * THE FRAMES REPLACE EVERYTHING ELSE. When a scene has been photographed, its
 * frames are the only attachments it gets — no character sheets, no product
 * plate, no uploads. Three reasons, and all three matter:
 *
 *   The frames already contain all of it. They were generated FROM the character
 *   sheets, the set plate and the product plate, so everything those references
 *   carried is in them already, in the right room and the right light.
 *
 *   The character sheet actively hurts here. It is a studio portrait on a grey
 *   backdrop, and it needs a whole quarantine clause to stop that grey following
 *   the person into the scene. A frame needs no quarantine — it IS the scene.
 *
 *   The count is a hard constraint. Four frames plus two sheets plus an upload is
 *   seven images on one video call, and §3.8's fusion warning does not care that
 *   some of them are frames.
 *
 * A scene with no frames falls back to exactly what it attached before this
 * feature existed. Both halves of this rule are mirrored in the client's
 * app/dashboard/_flow/shotBoard.ts — change one, change the other.
 *
 * @param {object} project     the project doc
 * @param {number} sceneIndex  0-based
 * @returns {Array<{name,path,url,mimeType}>}
 */
function renderAttachments(project, sceneIndex) {
  const board = project?.shotBoard?.scenes || {};
  const entry = board[sceneIndex] ?? board[String(sceneIndex)];
  const frames = (entry?.shots || [])
    .filter((shot) => shot.url && shot.path)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (frames.length > 0) {
    return frames.map((shot, i) => ({
      name: `Frame ${i + 1}${shot.time ? ` · ${shot.time}` : ""}${shot.label ? ` — ${shot.label}` : ""}`,
      path: shot.path,
      url: shot.url,
      mimeType: shot.mimeType || "image/png",
    }));
  }

  const fallback = project?.sceneImages || {};
  return fallback[sceneIndex] ?? fallback[String(sceneIndex)] ?? [];
}

// ── helpers ─────────────────────────────────────────────────────────────────

/** The people a scene's own character sheets cover. `scenes` on a ref is 1-based. */
function charactersInScene(characterRefs, sceneNumber) {
  return (characterRefs || []).filter((ref) => (ref.scenes || []).map(Number).includes(Number(sceneNumber)));
}

/** Bytes never reach Firestore — a doc is capped at 1MB and one PNG clears it. */
function stripBytes(plate) {
  const { base64, ...rest } = plate || {};
  return rest;
}

/** A designed shot, without whatever a previous render hung on it. */
function stripImageFields(shot) {
  const { path, url, mimeType, renderedAt, id, ...rest } = shot || {};
  return rest;
}

/** Storage caches generated media immutably, so every render needs a fresh path. */
function randomSuffix() {
  return Math.random().toString(36).slice(2, 7);
}

module.exports = { runShotBoard, renderAttachments };
