import { GoogleAuth } from "google-auth-library";

const PROJECT = "davelabs-tools";

const auth = new GoogleAuth({ scopes: "https://www.googleapis.com/auth/cloud-platform" });
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;

async function testTTS(url, payload) {
  console.log(`Testing URL: ${url}`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`  status: ${res.status}`);
    if (res.ok) {
      const data = JSON.parse(text);
      const hasAudio = !!data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      console.log(`  success! Has audio part: ${hasAudio}`);
      return true;
    } else {
      console.log(`  failed: ${text}`);
      return false;
    }
  } catch (err) {
    console.error(`  error: ${err.message}`);
    return false;
  }
}

async function run() {
  const model = "gemini-3.1-flash-tts";
  const body = {
    contents: [{ role: "user", parts: [{ text: "Hello from The Gambia. Today we talk about Giga." }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" },
        },
      },
    },
  };

  // 1. Try global v1beta1
  const urlGlobalBeta = `https://aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/global/publishers/google/models/${model}:generateContent`;
  let ok = await testTTS(urlGlobalBeta, body);

  if (!ok) {
    // 2. Try us-central1 v1beta1
    const urlCentralBeta = `https://us-central1-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/us-central1/publishers/google/models/${model}:generateContent`;
    ok = await testTTS(urlCentralBeta, body);
  }

  if (!ok) {
    // 3. Try us-east4 v1beta1
    const urlEastBeta = `https://us-east4-aiplatform.googleapis.com/v1beta1/projects/${PROJECT}/locations/us-east4/publishers/google/models/${model}:generateContent`;
    ok = await testTTS(urlEastBeta, body);
  }
}

run();
