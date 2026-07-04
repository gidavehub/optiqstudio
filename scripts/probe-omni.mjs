/** Prints full publisher metadata for a model to learn its API surface. */
import { GoogleAuth } from "google-auth-library";

const LOCATION = process.env.VERTEX_LOCATION || "us-central1";
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
const MODEL = process.argv[2] || "gemini-omni-flash-preview";

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const tok = (await client.getAccessToken()).token;

const res = await fetch(
  `https://${LOCATION}-aiplatform.googleapis.com/v1beta1/publishers/google/models/${MODEL}`,
  { headers: { Authorization: `Bearer ${tok}`, "x-goog-user-project": PROJECT } }
);
console.log(res.status);
console.log(JSON.stringify(await res.json(), null, 2).slice(0, 4000));
