/**
 * Discovers which Google publisher models are available on Vertex AI for this
 * project/region. Used to find the exact IDs for the Omni video model and
 * Nano Banana 2 image model. Vertex only — never AI Studio.
 *
 * Run: node scripts/list-models.mjs [filter]
 */

import { GoogleAuth } from "google-auth-library";

const LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const filter = (process.argv[2] || "").toLowerCase();

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });

async function token() {
  const client = await auth.getClient();
  return (await client.getAccessToken()).token;
}

async function listPublisherModels() {
  const tok = await token();
  const results = [];
  // v1beta1 supports listing google publisher models
  let url = `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/publishers/google/models?pageSize=200&listAllVersions=true`;
  for (let page = 0; page < 10 && url; page++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tok}`, "x-goog-user-project": PROJECT },
    });
    if (!res.ok) {
      throw new Error(`list failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = await res.json();
    for (const m of data.publisherModels || []) {
      results.push({
        id: m.name?.replace("publishers/google/models/", ""),
        stage: m.launchStage,
        version: m.versionId,
      });
    }
    url = data.nextPageToken
      ? `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/publishers/google/models?pageSize=200&listAllVersions=true&pageToken=${data.nextPageToken}`
      : null;
  }
  return results;
}

const models = await listPublisherModels();
const interesting = models.filter((m) => {
  const id = (m.id || "").toLowerCase();
  if (filter) return id.includes(filter);
  return /omni|banana|veo|image|video|flash|tts|gemini-3/.test(id);
});

console.log(`${models.length} total publisher models in ${LOCATION}; matching:`);
for (const m of interesting.sort((a, b) => a.id.localeCompare(b.id))) {
  console.log(`  ${m.id}  [${m.stage || "?"}${m.version ? `, v=${m.version}` : ""}]`);
}
