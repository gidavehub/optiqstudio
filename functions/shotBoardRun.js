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
// ════════════════════════════════════════════════════════════════════════════
// THE ORDER IS THE FEATURE
// ════════════════════════════════════════════════════════════════════════════
//
// The brain describes a HIERARCHY: places, then the arrangements inside them,
// then the states each of those passes through, then the frames. Every tier is
// generated FROM the picture of the tier above rather than from a fresh reading
// of the same paragraph, because a picture cannot be interpreted two ways and a
// paragraph always is.
//
// That makes this file's job almost entirely about DEPENDENCY ORDER. Nothing
// here is clever; it is just strict:
//
//   1. the world pass, one text call, which decides everything the film agrees on
//   2. environment base plates          ← from words, because something has to be
//   3. environment second angles        ← from the base plate
//   4. object base plates               ← from words (or the client's own photo)
//   5. setting base plates              ← from the environment plate + the objects
//   6. every state plate, in chain order ← each from the state before it
//   7. frames                           ← from the setting/environment plate + cast
//   8. end frames                       ← from their own first frame
//   9. framed prompts                   ← the short render prompt, per photographed scene
//
// Get step 6 out of order and a state is built from a plate that does not exist
// yet, which silently degrades to "built from words" — the exact failure the
// hierarchy exists to remove. `stateChain()` in the brain is what fixes the
// order; this file just walks it serially per thing, and runs different things
// in parallel.
//
// WHY IT IS ITS OWN JOB, AND NOT PART OF THE STORYBOARD PIPELINE
//
// Arithmetic. An 18-scene film is now ~10 environment and setting plates, ~8
// object plates, ~50 frames and a dozen end frames, and the image quota is 8 per
// minute (see vertexQuota DEFAULT_CAPS). That is well over an hour of pictures on
// a function that gets nine minutes, on top of a swarm that already spends most
// of them writing the film. Bolted onto the storyboard job it would time the
// storyboard out — and a stranded storyboard costs the director the whole
// generation, while a stranded shot board costs them some pictures.
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
// all of it and only builds what is missing. A long film takes several passes and
// nobody has to watch it happen.

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

// ── Why a picture failed, and what can be done about it ─────────────────────
//
// These three outcomes want three different responses, and treating them alike
// is how a pipeline burns money learning nothing:
//
//   TRANSIENT  the service was busy or slow. The prompt is fine. Wait and ask
//              again — this is the only case where an identical retry is right.
//   BLOCKED    a classifier refused the prompt. Asking again produces the
//              identical refusal, so the prompt is REWRITTEN before the retry.
//   EMPTY      a 200 with no picture in it. In practice this is a silent refusal,
//              so it is treated as blocked; if a rewrite does not fix it, the
//              later attempts fall through to plain retries anyway.

const TRANSIENT_FAILURE =
  /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|rate.?limit|quota|UNAVAILABLE|overloaded|deadline|timed? ?out|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|network|internal error|try again/i;

const BLOCKED_FAILURE =
  /SAFETY|PROHIBITED|BLOCK(ED|_REASON)?|IMAGE_SAFETY|RECITATION|responsible ?ai|\bRAI\b|content (policy|filter)|policy violation|violat|refus|not allowed|cannot generate|unable to generate/i;

const EMPTY_FAILURE = /returned no image|no image (was )?returned|empty (output|response|image)/i;

function failureKind(err) {
  const msg = String(err?.message || err);
  // Blocked is checked first: a refusal often arrives WITH an empty payload, and
  // the refusal is the more actionable of the two facts.
  if (BLOCKED_FAILURE.test(msg)) return "blocked";
  if (TRANSIENT_FAILURE.test(msg)) return "transient";
  if (EMPTY_FAILURE.test(msg)) return "empty";
  return "unknown";
}

/** Total tries for one picture, across every kind of healing. */
const MAX_IMAGE_ATTEMPTS = 4;

/** How many times one prompt may be rewritten before we accept the refusal. */
const MAX_PROMPT_REWRITES = 2;

const IMAGE_BACKOFFS = [3000, 9000, 20000];

// ── Plate identity ──────────────────────────────────────────────────────────

/**
 * One plate is one (tier, thing, state). All three are needed: the same table in
 * its laid state and its cleared state are two different photographs of the same
 * key, and a cache that ignores the state hands scene 9 the untouched meal.
 */
function plateId(tier, key, stateKey) {
  return `${tier}::${key}::${stateKey || "base"}`;
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
 * @param {object|null} o.scope      { scenes:[0-based], rebuildWorld, keepDesign } — a targeted re-roll
 * @param {number}   o.deadlineAt    epoch ms; work stops cleanly after this
 * @param {Function} o.onStage       (stage, meta) => Promise
 * @param {Function|null} o.regenerateCharacterRef  async (ref) => { path, url, base64, mimeType }
 *        Re-takes a character sheet whose stored file has gone missing. Optional:
 *        without it a missing sheet is reported and the frames go on without it.
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
  regenerateCharacterRef = null,
}) {
  const runSkill = makeSkillRunner(vertexFetch);
  const scenes = project.scenes || [];
  const aspectRatio = project.aspectRatio || "16:9";
  const styleHeader = project.styleHeader || "";
  // Shallow-copied, because `withBytes` caches downloaded bytes onto the object
  // it is handed. Caching is deliberate — a sheet rides along with every frame
  // its character is in, and re-downloading it per frame is the same megabyte a
  // dozen times — but doing it to the caller's own document is not: it leaves
  // base64 hanging off the project object after the run, where the next thing to
  // read it has no idea whether those bytes are current.
  const characterRefs = (project.characterRefs || []).map((ref) => ({ ...ref }));
  const notes = [];
  const violations = [];
  /** What the run had to repair to get here. Surfaced to the director, not hidden. */
  const healed = [];

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
  const reuseWorld = !scope?.rebuildWorld && (previous?.world?.environments || []).length > 0;

  // Which scenes this pass is responsible for. A re-roll names them; otherwise
  // it is every scene that has no frames yet.
  const targetIndexes =
    scope?.scenes?.length
      ? scope.scenes.filter((i) => i >= 0 && i < scenes.length)
      : scenes
          .map((_, i) => i)
          .filter((i) => !(previous?.scenes?.[i]?.shots || previous?.scenes?.[String(i)]?.shots || []).some((s) => s.url));

  // ── 1. THE WORLD BIBLE ────────────────────────────────────────────────────

  await report("designing", { step: "world" });

  let world;
  if (reuseWorld) {
    world = previous.world;
    notes.push(
      `Reused the film's existing world: ${world.environments.length} place(s), ${(world.settings || []).length} arrangement(s).`
    );
  } else {
    const characterNames = characterRefs.map((r) => r.name).filter(Boolean);
    const system = brain.worldDirective({
      numScenes: scenes.length,
      branded: !!project.brandName,
    });
    const brief = brain.worldBrief({
      scenes,
      registry: project.consistencyRegistry || null,
      characterNames,
      brandName: project.brandName,
      product: project.product,
    });

    world = await runSkill("world", system, [{ text: brief }], brain.WORLD_SCHEMA);

    const faults = brain.worldViolations(world, scenes);
    if (faults.length > 0) {
      console.warn(`[shotboard ${projectId}] world produced ${faults.length} violation(s); repairing`);
      try {
        const repaired = await runSkill(
          "world-repair",
          `${system}

═══ THIS IS A REPAIR PASS ═══
Your previous world bible failed the house gates. Fix EVERY violation below and
change nothing else — the same places, the same arrangements, the same keys, the
same states, the same scene mapping, unless a violation names them. Return the
COMPLETE document.`,
          [
            {
              text: `VIOLATIONS TO FIX:
${faults.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE DOCUMENT TO REPAIR:
${JSON.stringify(world, null, 2)}

${brief}`,
            },
          ],
          brain.WORLD_SCHEMA
        );
        if ((repaired?.environments || []).length > 0) {
          const remaining = brain.worldViolations(repaired, scenes);
          console.log(`[shotboard ${projectId}] world ${faults.length} → ${remaining.length} violation(s)`);
          world = repaired;
          violations.push(...remaining);
        } else {
          violations.push(...faults);
        }
      } catch (err) {
        console.error("[shotboard] world repair failed; keeping the original:", String(err?.message || err).slice(0, 180));
        violations.push(...faults);
      }
    }
  }

  const environments = brain.selectEnvironments(world.environments);
  const environmentKeys = new Set(environments.map((e) => e.key));
  const settings = brain.selectSettings(world.settings, { environmentKeys });
  const objects = brain.selectObjects(world.objects);

  const environmentByKey = new Map(environments.map((e) => [e.key, e]));
  const settingByKey = new Map(settings.map((s) => [s.key, s]));
  const objectByKey = new Map(objects.map((o) => [o.key, o]));

  const sceneEnvironmentKey = new Map(
    (world.sceneWorld || []).map((m) => [Number(m.sceneNumber), m.environmentKey])
  );
  const sceneSettingKeys = new Map(
    (world.sceneWorld || []).map((m) => [Number(m.sceneNumber), m.settingKeys || []])
  );
  const sceneObjectKeys = new Map(
    (world.sceneWorld || []).map((m) => [Number(m.sceneNumber), m.objectKeys || []])
  );

  // ── The plate store ───────────────────────────────────────────────────────
  //
  // Flat and keyed by (tier, key, state), so a continuation pass can look up
  // exactly what it already owns. Bytes live here too for the duration of the
  // run — a plate is the parent of several other pictures, and re-downloading it
  // per child would be the same bytes a dozen times over.

  const plates = new Map();
  for (const plate of previous?.plates || []) {
    plates.set(plateId(plate.tier, plate.key, plate.stateKey), { ...plate });
  }

  const platePath = (tier, key, stateKey) =>
    `users/${uid}/projects/${projectId}/shotboard/${tier}-${brain.slug(key)}-${brain.slug(stateKey || "base")}-${Date.now().toString(36)}${randomSuffix()}.png`;

  /**
   * A stored picture with its bytes in hand, or null if it is not really there.
   *
   * This is the VERIFICATION step, and it is the reason nothing in this file
   * trusts a `url` on its own. A row in Firestore saying a plate exists is not
   * the same claim as the file existing: an upload can half-fail, a storage
   * lifecycle rule can sweep it, a generation delete can take a shared file with
   * it, and a previous pass can have been killed between generating and storing.
   * Every one of those leaves a plate that looks fine in the document and is gone
   * on disk — and the cost of believing it is silent, because the child picture
   * still comes back, just built from words instead of from its parent.
   */
  const withBytes = async (plate) => {
    if (!plate) return null;
    if (plate.base64) return plate;
    if (!plate.path || !loadImage) return null;
    try {
      const base64 = await loadImage(plate.path);
      if (!base64) return null;
      plate.base64 = base64;
      return plate;
    } catch (err) {
      console.error(`[shotboard] could not read ${plate.path}:`, String(err?.message || err).slice(0, 140));
      return null;
    }
  };

  const getPlate = async (tier, key, stateKey) => withBytes(plates.get(plateId(tier, key, stateKey)));

  /**
   * Rewrites a prompt the image model refused, so the retry is a different ask.
   *
   * Returns the new prompt, or null when the doctor could not be reached — in
   * which case the caller falls back to plain retries and then gives up, which is
   * still better than looping on a prompt that will never be answered.
   */
  const healPrompt = async (label, prompt, reason, kind, attempt) => {
    try {
      const result = await runSkill(
        `unblock-${label}`,
        brain.unblockDirective({ kind }),
        [{ text: brain.unblockBrief({ prompt, reason, attempt }) }],
        brain.UNBLOCK_SCHEMA
      );
      if (!result?.prompt || result.prompt.length < 200) return null;
      healed.push(`${label}: ${result.whatChanged || "the prompt was rephrased"}`);
      console.log(`[shotboard ${projectId}] rewrote a refused prompt for ${label}: ${String(result.whatChanged || "").slice(0, 140)}`);
      return result.prompt;
    } catch (err) {
      console.error(`[shotboard] could not rewrite the prompt for ${label}:`, String(err?.message || err).slice(0, 160));
      return null;
    }
  };

  /**
   * Generates ONE picture, and heals what can be healed.
   *
   * Everything that draws in this file goes through here, so the self-healing is
   * uniform: plates, states, frames and end frames all get the same treatment,
   * and none of them can accidentally be the one that quietly gives up first.
   */
  const generateHealed = async (label, prompt, options = {}) => {
    let current = prompt;
    let rewrites = 0;
    let lastError = null;

    for (let attempt = 0; attempt < MAX_IMAGE_ATTEMPTS; attempt++) {
      if (outOfTime()) break;
      try {
        const image = await generateImage(current, options);
        // A "successful" call that carries no bytes is the silent-refusal shape,
        // and storing it would put a broken reference into the cascade.
        if (!image?.base64) throw new Error(`the image model returned no image for ${label}`);
        return image;
      } catch (err) {
        lastError = err;
        const kind = failureKind(err);
        const attemptsLeft = MAX_IMAGE_ATTEMPTS - attempt - 1;
        if (attemptsLeft <= 0) break;

        if (kind === "transient") {
          const wait = IMAGE_BACKOFFS[Math.min(attempt, IMAGE_BACKOFFS.length - 1)] + Math.floor(Math.random() * 1500);
          console.warn(`[shotboard] ${label} hit a transient failure; retrying in ${wait}ms`);
          await sleep(wait);
          continue;
        }

        if ((kind === "blocked" || kind === "empty") && rewrites < MAX_PROMPT_REWRITES) {
          const rewritten = await healPrompt(label, current, String(err?.message || err), kind, rewrites + 1);
          if (rewritten) {
            current = rewritten;
            rewrites += 1;
            continue;
          }
          break;
        }

        // Something unrecognised. Worth exactly one plain retry — half of these
        // are a transient dressed in an unfamiliar message — and no more.
        if (kind === "unknown" && attempt === 0) {
          await sleep(IMAGE_BACKOFFS[0]);
          continue;
        }
        break;
      }
    }
    throw lastError || new Error(`${label} could not be photographed`);
  };

  /**
   * Makes one plate, unless it already exists AND is still really there.
   *
   * Every image in the cascade goes through here, which is what makes the whole
   * run resumable: a verified plate is a no-op, a failed plate is a note rather
   * than an exception, and the deadline is honoured between every single picture.
   */
  const makePlate = async (tier, thing, stateKey, prompt, { images, aspect, label } = {}) => {
    const id = plateId(tier, thing.key, stateKey);
    const existing = plates.get(id);
    if (existing?.url) {
      const verified = await withBytes(existing);
      if (verified?.base64) return verified;
      // The document says this exists and the file does not. Forget it and shoot
      // it again — the alternative is every picture below it being built from
      // prose while the board still reports itself complete.
      plates.delete(id);
      notes.push(
        `The stored picture of "${thing.name}"${label ? ` (${label})` : ""} was missing, so it was photographed again.`
      );
      console.warn(`[shotboard ${projectId}] plate ${id} was gone from storage; re-shooting`);
    }
    if (outOfTime()) return null;

    try {
      const image = await generateHealed(
        `${tier} plate "${thing.name}"${label ? ` (${label})` : ""}`,
        prompt,
        { aspectRatio: aspect || aspectRatio, images }
      );
      const stored = await storeImage(platePath(tier, thing.key, stateKey), image.base64, image.mimeType);
      const plate = {
        tier,
        key: thing.key,
        stateKey: stateKey || "base",
        name: thing.name,
        stateName: label || "",
        scenes: thing.scenes || [],
        detail: thing.detail || "",
        geometry: thing.geometry || "",
        layout: thing.layout || "",
        kind: thing.kind || "",
        vehicle: !!thing.vehicle,
        environmentKey: thing.environmentKey || "",
        path: stored.path,
        url: stored.url,
        mimeType: image.mimeType,
        base64: image.base64,
        builtAt: new Date().toISOString(),
      };
      plates.set(id, plate);
      return plate;
    } catch (err) {
      console.error(`[shotboard] ${tier} plate "${thing.key}/${stateKey}" failed:`, String(err?.message || err).slice(0, 200));
      notes.push(`The ${tier} plate for "${thing.name}"${label ? ` (${label})` : ""} could not be made; anything built on it falls back to the written description.`);
      return null;
    }
  };

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

  const asAttachment = (plate) => ({ base64: plate.base64, mimeType: plate.mimeType || "image/png" });

  // ── Character sheets, verified the same way the plates are ────────────────
  //
  // A character sheet is a reference like any other, and it goes missing the same
  // ways. When it does, the failure is invisible in the worst way: the frames
  // still come back, they just quietly stop holding the face — which is the exact
  // thing this platform added character references to fix. So the sheet is
  // verified before it is attached, and re-taken when it is gone.
  //
  // The prompt for one lives in each sandbox's characterRefs.js, not here, so the
  // caller supplies the re-take as a callback and this file stays prompt-free.

  const repairedRefs = new Map();

  const characterBytes = async (ref) => {
    const loaded = await withBytes(ref);
    if (loaded?.base64) return loaded;

    const id = ref.id || ref.name;
    if (repairedRefs.has(id)) return repairedRefs.get(id);
    if (!regenerateCharacterRef) return null;
    if (outOfTime()) return null;

    try {
      const made = await regenerateCharacterRef(ref);
      if (!made?.base64) throw new Error("no image came back");
      const healedRef = { ...ref, ...made };
      repairedRefs.set(id, healedRef);
      healed.push(`${ref.name}'s reference photograph was missing and was taken again.`);
      console.warn(`[shotboard ${projectId}] character sheet for ${ref.name} was gone; re-shot`);
      return healedRef;
    } catch (err) {
      console.error(`[shotboard] could not re-shoot ${ref.name}'s sheet:`, String(err?.message || err).slice(0, 160));
      notes.push(`${ref.name}'s reference photograph is missing and could not be replaced, so their frames lean on the written description.`);
      repairedRefs.set(id, null);
      return null;
    }
  };

  // ── 2. THE PLATE CASCADE ──────────────────────────────────────────────────
  //
  // Tiers 1 and 2 in dependency order, each thing's states walked serially
  // because state N is photographed FROM state N-1. Different things run in
  // parallel; the states of one thing never do.

  const platesPlanned =
    environments.reduce((n, e) => n + brain.stateChain(e).length + (e.needsSecondAngle ? 1 : 0), 0) +
    objects.reduce((n, o) => n + brain.stateChain(o).length, 0) +
    settings.reduce((n, s) => n + brain.stateChain(s).length, 0);

  let platesDone = 0;
  const platesAlready = [...plates.values()].filter((p) => p.url).length;

  const tickPlate = async () => {
    platesDone += 1;
    await report("plating", { platesDone: Math.min(platesDone, platesPlanned), platesTotal: platesPlanned });
  };

  await report("plating", { platesDone: Math.min(platesAlready, platesPlanned), platesTotal: platesPlanned });

  /**
   * Walks one thing's state chain, photographing each state from the one before.
   *
   * `first` builds the base state however that tier builds it; every state after
   * it is the generic "same thing, later, only this changed" prompt with the
   * previous plate attached. If the base fails, the chain stops — there is
   * nothing to descend from, and generating state 2 from words would quietly
   * reintroduce the drift this whole design removes.
   */
  const walkStates = async (tier, thing, first) => {
    const chain = brain.stateChain(thing);
    if (chain.length === 0) return;

    let parent = await first(chain[0]);
    await tickPlate();
    if (!parent) return;

    for (const state of chain.slice(1)) {
      if (outOfTime()) return;
      const prompt = brain.statePlatePrompt(thing, state, {
        tier,
        environment: tier === "setting" ? environmentByKey.get(thing.environmentKey) : null,
        aspectRatio: tier === "object" ? "1:1" : aspectRatio,
        styleHeader,
      });
      const made = await makePlate(tier, thing, state.key, prompt, {
        images: [asAttachment(parent)],
        aspect: tier === "object" ? "1:1" : aspectRatio,
        label: state.name,
      });
      await tickPlate();
      if (!made) return;
      parent = made;
    }
  };

  const buildEnvironments = () =>
    mapWithConcurrency(environments, IMAGE_CONCURRENCY, async (environment) => {
      await walkStates("environment", environment, (base) =>
        makePlate(
          "environment",
          environment,
          base.key,
          brain.environmentPlatePrompt(environment, { aspectRatio, styleHeader }),
          { label: base.name }
        )
      );

      // The second covering angle, once the master exists to descend from. Base
      // state only: a film that needs the reverse of every state is asking for
      // twice the plates to fix a wall that is behind the camera.
      if (!environment.needsSecondAngle || outOfTime()) return;
      const chain = brain.stateChain(environment);
      const master = chain[0] ? await getPlate("environment", environment.key, chain[0].key) : null;
      if (!master?.base64) return;
      await makePlate(
        "environment-reverse",
        environment,
        chain[0].key,
        brain.environmentCoveragePrompt(environment, { aspectRatio, styleHeader }),
        { images: [asAttachment(master)], label: "second angle" }
      );
      await tickPlate();
    });

  const buildObjects = () =>
    mapWithConcurrency(objects, IMAGE_CONCURRENCY, async (object) => {
      await walkStates("object", object, (base) => {
        // The client's own photograph of their product is ground truth, and this
        // is the one place it can enter the pictures: the product plate descends
        // from the real thing, every setting and frame descends from the plate,
        // and the clip descends from the frames. Without this the product is a
        // generated approximation of a written description of a real object —
        // which is how a label ends up nearly right in every single shot.
        const usesClientPhoto =
          (object.kind === "packaging" || object.kind === "product") && productImages.length > 0;
        return makePlate(
          "object",
          object,
          base.key,
          brain.objectPlatePrompt(object, { aspectRatio: "1:1", hasReference: usesClientPhoto }),
          {
            images: usesClientPhoto ? productImages.slice(0, 2) : undefined,
            aspect: "1:1",
            label: base.name,
          }
        );
      });
    });

  /**
   * Settings come last of the plates, because a setting plate is generated ON TOP
   * of its environment's plate and the object plates that live in it. That is the
   * join that stops the room and the things in it from being two separate
   * interpretations of the same film.
   */
  const buildSettings = () =>
    mapWithConcurrency(settings, IMAGE_CONCURRENCY, async (setting) => {
      const environment = environmentByKey.get(setting.environmentKey) || null;
      await walkStates("setting", setting, async (base) => {
        const inputs = [];
        const images = [];

        // Which state of the place this arrangement is dressed into: the one true
        // for the earliest scene the arrangement appears in.
        const firstScene = (setting.scenes || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b)[0];
        if (environment) {
          const environmentState = brain.resolveState(environment, firstScene);
          const plate = await getPlate("environment", environment.key, environmentState?.key);
          if (plate?.base64) {
            inputs.push({ role: "environment", name: environment.name });
            images.push(asAttachment(plate));
          }
        }

        const settingObjects = (setting.objectKeys || []).map((k) => objectByKey.get(k)).filter(Boolean);
        for (const object of settingObjects) {
          if (images.length >= brain.MAX_INPUTS_PER_FRAME) break;
          const objectState = brain.resolveState(object, firstScene);
          const plate = await getPlate("object", object.key, objectState?.key);
          if (!plate?.base64) continue;
          inputs.push({ role: "object", name: object.name, detail: object.detail });
          images.push(asAttachment(plate));
        }

        return makePlate(
          "setting",
          setting,
          base.key,
          brain.settingPlatePrompt(setting, {
            environment,
            objects: settingObjects,
            inputs,
            aspectRatio,
            styleHeader,
          }),
          { images: images.length ? images : undefined, label: base.name }
        );
      });
    });

  // ── 3. SHOT DESIGN ────────────────────────────────────────────────────────
  //
  // Text calls, so they run alongside the plates on purpose: the two draw on
  // different per-minute quota buckets and serialising them would leave one idle
  // for minutes at a time on a long film.

  const designed = new Map(); // sceneIndex → { coverage, shots }

  /** Everything one scene's design and frames need to know about the world. */
  const worldForScene = (number) => {
    const environment = environmentByKey.get(sceneEnvironmentKey.get(number)) || null;
    const environmentState = environment ? brain.resolveState(environment, number) : null;

    const sceneSettings = (sceneSettingKeys.get(number) || [])
      .map((k) => settingByKey.get(k))
      .filter(Boolean)
      .map((setting) => ({ setting, state: brain.resolveState(setting, number) }));

    const sceneObjects = (sceneObjectKeys.get(number) || [])
      .map((k) => objectByKey.get(k))
      .filter(Boolean)
      .map((object) => ({ object, state: brain.resolveState(object, number) }));

    return { environment, environmentState, sceneSettings, sceneObjects };
  };

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
      const { environment, environmentState, sceneSettings, sceneObjects } = worldForScene(number);
      const sceneCharacters = charactersInScene(characterRefs, number);

      // The state's `change` rides along with the thing itself, so the designer
      // is told the table is cleared BY THIS SCENE rather than being handed the
      // laid table and left to guess.
      const environmentForBrief = environment
        ? { ...environment, stateChange: environmentState?.isBase ? "" : environmentState?.change || "" }
        : null;
      const settingsForBrief = sceneSettings.map(({ setting, state }) => ({
        ...setting,
        stateChange: state?.isBase ? "" : state?.change || "",
      }));
      const objectsForBrief = sceneObjects.map(({ object, state }) => ({
        ...object,
        stateChange: state?.isBase ? "" : state?.change || "",
      }));

      const settingKeySet = new Set(settingsForBrief.map((s) => s.key));

      try {
        const system = brain.shotDesignDirective({ environment: environmentForBrief, settings: settingsForBrief });
        const brief = brain.shotDesignBrief({
          scene: { ...scene, sceneNumber: number },
          environment: environmentForBrief,
          settings: settingsForBrief,
          objects: objectsForBrief,
          characters: sceneCharacters,
          aspectRatio,
        });
        let plan = await runSkill(`shot-design-${number}`, system, [{ text: brief }], brain.SHOT_SCHEMA);

        const faults = brain.shotPlanViolations(plan, { settingKeys: settingKeySet });
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
              const remaining = brain.shotPlanViolations(repaired, { settingKeys: settingKeySet });
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

  // Environments and objects have no dependency on each other, so they race;
  // settings wait for both, because a setting plate is built ON them. The design
  // pass is independent of all three and runs the whole time.
  await Promise.all([
    (async () => {
      await Promise.all([buildEnvironments(), buildObjects()]);
      await buildSettings();
    })(),
    designShots(),
  ]);

  // ── 4. FRAMES, THEN END FRAMES ────────────────────────────────────────────
  //
  // An end frame is generated FROM its own first frame, so the two are done in
  // one unit of work per setup rather than in two passes — the first frame's
  // bytes are already in hand at exactly the moment the end frame needs them.

  const frameJobs = [];
  for (const index of targetIndexes) {
    const design = designed.get(index);
    if (!design) continue;
    const scene = scenes[index];
    const number = Number(scene.sceneNumber ?? index + 1);
    const endFrames = brain.allocateEndFrames(design.shots);
    for (const shot of design.shots) {
      frameJobs.push({ index, number, shot, wantsEnd: endFrames.has(shot.order) });
    }
  }

  const framesTotal = frameJobs.reduce((n, job) => n + (job.wantsEnd ? 2 : 1), 0);
  let framesDone = 0;
  await report("framing", { framesDone: 0, framesTotal });

  const framesByScene = new Map();
  await mapWithConcurrency(frameJobs, IMAGE_CONCURRENCY, async (job) => {
    if (outOfTime()) return;
    const { index, number, shot, wantsEnd } = job;
    const { environment, environmentState, sceneSettings, sceneObjects } = worldForScene(number);
    const sceneCharacters = charactersInScene(characterRefs, number);

    // The anchor: the arrangement this setup looks at, in the state this scene
    // finds it in. Falling back to the place itself — and to its second angle
    // when the setup shoots back the other way and the place is still as the
    // master photographed it.
    const settingEntry = shot.settingKey
      ? sceneSettings.find(({ setting }) => setting.key === shot.settingKey)
      : null;
    const settingPlate = settingEntry
      ? await getPlate("setting", settingEntry.setting.key, settingEntry.state?.key)
      : null;

    let environmentPlate = null;
    if (environment) {
      if (shot.reverseAngle && environmentState?.isBase) {
        environmentPlate = await getPlate("environment-reverse", environment.key, environmentState?.key);
      }
      if (!environmentPlate) {
        environmentPlate = await getPlate("environment", environment.key, environmentState?.key);
      }
    }

    const refBytes = [];
    for (const ref of sceneCharacters) {
      const loaded = await characterBytes(ref);
      if (loaded?.base64) refBytes.push(loaded);
    }

    const objectPlates = [];
    for (const key of shot.objectKeys || shot.propKeys || []) {
      const entry = sceneObjects.find(({ object }) => object.key === key);
      if (!entry) continue;
      const plate = await getPlate("object", entry.object.key, entry.state?.key);
      if (plate?.base64) objectPlates.push(plate);
    }

    const environmentForPrompt = environment
      ? {
          ...environment,
          lock: environmentState?.isBase
            ? environment.lock
            : `${environment.lock}\n\nBY THIS POINT IN THE FILM: ${environmentState?.change || ""}`,
        }
      : null;
    const settingForPrompt = settingEntry
      ? {
          ...settingEntry.setting,
          layout: settingEntry.state?.isBase
            ? settingEntry.setting.layout
            : `${settingEntry.setting.layout}\n\nBY THIS POINT IN THE FILM: ${settingEntry.state?.change || ""}`,
        }
      : null;

    const inputs = brain.frameInputPlan(shot, {
      settingPlate,
      environmentPlate,
      characterRefs: refBytes,
      objectPlates,
    });

    const record = { ...stripImageFields(shot), id: `s${number}_${shot.order + 1}` };
    let firstFramePlate = null;

    try {
      const prompt = brain.framePrompt(shot, {
        environment: environmentForPrompt,
        setting: settingForPrompt,
        characters: sceneCharacters,
        inputs,
        aspectRatio,
        styleHeader,
      });
      const image = await generateHealed(`frame ${number}.${shot.order + 1}`, prompt, {
        aspectRatio,
        images: inputs
          .map((i) => i.ref)
          .filter((r) => r?.base64)
          .map((r) => ({ base64: r.base64, mimeType: r.mimeType || "image/png" })),
      });
      const path = `users/${uid}/projects/${projectId}/shotboard/frame-s${number}-${shot.order + 1}-${Date.now().toString(36)}${randomSuffix()}.png`;
      const stored = await storeImage(path, image.base64, image.mimeType);
      record.path = stored.path;
      record.url = stored.url;
      record.mimeType = image.mimeType;
      record.renderedAt = new Date().toISOString();
      firstFramePlate = { base64: image.base64, mimeType: image.mimeType };
    } catch (err) {
      console.error(`[shotboard] frame ${number}.${shot.order + 1} failed:`, String(err?.message || err).slice(0, 200));
      notes.push(`Setup ${shot.order + 1} of scene ${number} could not be photographed.`);
    } finally {
      framesDone += 1;
      await report("framing", { framesDone, framesTotal });
    }

    // Where this setup arrives. Only for setups the budget granted one to, and
    // only once the frame it descends from actually exists.
    if (wantsEnd && firstFramePlate && !outOfTime()) {
      try {
        const endInputs = brain.endFrameInputPlan(shot, {
          firstFrame: firstFramePlate,
          characterRefs: refBytes,
        });
        const prompt = brain.endFramePrompt(shot, {
          environment: environmentForPrompt,
          setting: settingForPrompt,
          characters: sceneCharacters,
          inputs: endInputs,
          aspectRatio,
          styleHeader,
        });
        const image = await generateHealed(`end frame ${number}.${shot.order + 1}`, prompt, {
          aspectRatio,
          images: endInputs
            .map((i) => i.ref)
            .filter((r) => r?.base64)
            .map((r) => ({ base64: r.base64, mimeType: r.mimeType || "image/png" })),
        });
        const path = `users/${uid}/projects/${projectId}/shotboard/frame-s${number}-${shot.order + 1}-end-${Date.now().toString(36)}${randomSuffix()}.png`;
        const stored = await storeImage(path, image.base64, image.mimeType);
        record.end = {
          path: stored.path,
          url: stored.url,
          mimeType: image.mimeType,
          renderedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.error(`[shotboard] end frame ${number}.${shot.order + 1} failed:`, String(err?.message || err).slice(0, 200));
        notes.push(`The closing frame of setup ${shot.order + 1} in scene ${number} could not be photographed; the setup renders from its opening frame alone.`);
      } finally {
        framesDone += 1;
        await report("framing", { framesDone, framesTotal });
      }
    }

    if (!framesByScene.has(index)) framesByScene.set(index, []);
    framesByScene.get(index).push(record);
  });

  // ── 5. THE FRAMED PROMPTS ─────────────────────────────────────────────────
  //
  // The pay-off tier. A scene that now has frames no longer has to describe how
  // anything looks, so it renders from a few hundred words of what HAPPENS
  // instead of two thousand words of what things look like. Text calls, and the
  // last thing done, because a scene has to be photographed before it can be
  // compressed.

  const framedPrompts = new Map(); // sceneIndex → string

  const compressPrompts = async () => {
    const jobs = [...framesByScene.entries()]
      .filter(([, frames]) => frames.some((f) => f.url))
      .map(([index]) => index);
    if (jobs.length === 0) return;

    let done = 0;
    await report("briefing", { briefsDone: 0, briefsTotal: jobs.length });

    await mapWithConcurrency(jobs, DESIGN_CONCURRENCY, async (index) => {
      if (outOfTime()) return;
      const scene = scenes[index];
      const number = Number(scene.sceneNumber ?? index + 1);
      const shots = (framesByScene.get(index) || []).filter((f) => f.url);

      try {
        const system = brain.framedPromptDirective({});
        // The board clause is stripped first: it is re-appended to the framed
        // prompt afterwards by the caller, and leaving it in the source would
        // have the compressor summarising instructions about attachments that
        // are about to be restated underneath it, verbatim and correctly.
        const bare = brain.stripShotBoardClause(scene.fullPrompt);
        const brief = brain.framedPromptBrief({ scene: { ...scene, fullPrompt: bare }, shots });

        let result = await runSkill(`framed-prompt-${number}`, system, [{ text: brief }], brain.FRAMED_PROMPT_SCHEMA);
        let text = result?.framedPrompt || "";

        const faults = brain.framedPromptViolations(text, { fullPrompt: bare });
        if (faults.length > 0) {
          try {
            const repaired = await runSkill(
              `framed-prompt-repair-${number}`,
              `${system}

═══ THIS IS A REPAIR PASS ═══
Your shooting brief failed the house gates. Fix EVERY violation below and change
nothing else. Return the COMPLETE brief.`,
              [
                {
                  text: `VIOLATIONS TO FIX:
${faults.map((v, i) => `${i + 1}. ${v}`).join("\n")}

THE BRIEF TO REPAIR:
${text}

${brief}`,
                },
              ],
              brain.FRAMED_PROMPT_SCHEMA
            );
            const repairedText = repaired?.framedPrompt || "";
            const remaining = repairedText ? brain.framedPromptViolations(repairedText, { fullPrompt: bare }) : faults;
            if (repairedText && remaining.length < faults.length) {
              console.log(`[shotboard ${projectId}] scene ${number} brief ${faults.length} → ${remaining.length} violation(s)`);
              text = repairedText;
              violations.push(...remaining.map((v) => `Scene ${number} brief: ${v}`));
            } else {
              violations.push(...faults.map((v) => `Scene ${number} brief: ${v}`));
            }
          } catch (err) {
            console.error(`[shotboard] scene ${number} brief repair failed:`, String(err?.message || err).slice(0, 180));
            violations.push(...faults.map((v) => `Scene ${number} brief: ${v}`));
          }
        }

        // A brief that STILL loses a line of dialogue is not used. Losing a line
        // is not a degradation the director can see coming, and the full prompt
        // renders a correct film — just a longer-winded one.
        const fatal = brain
          .framedPromptViolations(text, { fullPrompt: bare })
          .filter((v) => /spoken line|NO MUSIC|names music/i.test(v));
        if (text && fatal.length === 0) {
          framedPrompts.set(index, text);
        } else if (text) {
          notes.push(`Scene ${number} keeps its full prompt: the shortened brief dropped something it had to keep.`);
        }
      } catch (err) {
        console.error(`[shotboard] scene ${number} brief failed:`, String(err?.message || err).slice(0, 200));
        notes.push(`Scene ${number} keeps its full prompt; the shortened brief could not be written.`);
      } finally {
        done += 1;
        await report("briefing", { briefsDone: done, briefsTotal: jobs.length });
      }
    });
  };

  await compressPrompts();

  // ── 6. ASSEMBLE ───────────────────────────────────────────────────────────

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
      environmentKey: sceneEnvironmentKey.get(number) || null,
      coverage: design.coverage,
      shots: frames,
      framedPrompt: framedPrompts.get(index) || boardScenes[index]?.framedPrompt || "",
      builtAt: new Date().toISOString(),
    };
    if (frames.some((f) => f.url)) completed.push(index);
  }

  const remaining = targetIndexes.filter((i) => !completed.includes(i));
  const storedPlates = [...plates.values()].filter((p) => p.url).map(stripBytes);

  return {
    world: {
      environments: world.environments || [],
      settings: world.settings || [],
      objects: world.objects || [],
      sceneWorld: world.sceneWorld || [],
    },
    plates: storedPlates,
    scenes: boardScenes,
    framedPrompts: Object.fromEntries(framedPrompts),
    completed,
    remaining,
    done: remaining.length === 0,
    framesRendered: framesDone,
    violations,
    notes,
    // What the run had to fix to get here. Kept separate from notes because a
    // note is something the director may want to act on and this is something
    // that has already been dealt with — but hiding it entirely is how a
    // pipeline that quietly rewrites prompts becomes impossible to debug.
    healed,
    // Only when a sheet was actually re-taken. The caller persists these; the
    // runner does not write the project.
    // stripBytes on EVERY entry, not just the mended ones. The unmended refs are
    // this run's own working copies, and `withBytes` has been caching downloaded
    // base64 onto them all pass — handing those straight back would put a PNG
    // into a Firestore document that is capped at a megabyte.
    characterRefs: repairedRefs.size
      ? characterRefs.map((ref) => stripBytes(repairedRefs.get(ref.id || ref.name) || ref))
      : null,
    builtAt: new Date().toISOString(),
  };
}

// ── What a scene's render actually attaches ─────────────────────────────────

/**
 * The stills a scene's setups flatten to, in the order they are attached.
 *
 * One entry per attached image — a setup that moves contributes two, its start
 * and its end. This ordering IS the numbering the shot-board clause hands the
 * video model ("ATTACHED IMAGE 2 is where this setup ends"), so this function and
 * `stillRoll` in each brain must produce the same sequence or the model is told
 * an image is something it is not.
 */
function sceneStills(entry) {
  const stills = [];
  for (const shot of [...(entry?.shots || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    if (shot.url && shot.path) {
      stills.push({
        name: `${shot.time ? `${shot.time} · ` : ""}${shot.label || `Setup ${(shot.order ?? 0) + 1}`}`,
        path: shot.path,
        url: shot.url,
        mimeType: shot.mimeType || "image/png",
      });
      if (shot.end?.url && shot.end?.path) {
        stills.push({
          name: `${shot.label || `Setup ${(shot.order ?? 0) + 1}`} — ends on`,
          path: shot.end.path,
          url: shot.end.url,
          mimeType: shot.end.mimeType || "image/png",
        });
      }
    }
  }
  return stills;
}

/**
 * The images that ride along with one scene's video render, in order.
 *
 * THE FRAMES REPLACE EVERYTHING ELSE. When a scene has been photographed, its
 * frames are the only attachments it gets — no character sheets, no product
 * plate, no uploads. Three reasons, and all three matter:
 *
 *   The frames already contain all of it. They were generated FROM the character
 *   sheets, the environment and setting plates and the object plates, so
 *   everything those references carried is in them already, in the right place
 *   and the right light.
 *
 *   The character sheet actively hurts here. It is a studio portrait on a grey
 *   backdrop, and it needs a whole quarantine clause to stop that grey following
 *   the person into the scene. A frame needs no quarantine — it IS the scene.
 *
 *   The count is a hard constraint. Five frames plus two sheets plus an upload is
 *   eight images on one video call, and §3.8's fusion warning does not care that
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
  const stills = sceneStills(entry);
  if (stills.length > 0) return stills;

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
  const { path, url, mimeType, renderedAt, id, end, ...rest } = shot || {};
  return rest;
}

/** Storage caches generated media immutably, so every render needs a fresh path. */
function randomSuffix() {
  return Math.random().toString(36).slice(2, 7);
}

module.exports = { runShotBoard, renderAttachments, sceneStills };
