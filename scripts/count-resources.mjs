import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const PROJECT_ID = "davelabs-tools";

const app = initializeApp({
  projectId: PROJECT_ID,
  storageBucket: PROJECT_ID,
});

const db = getFirestore(app);
const storage = getStorage(app);
const uid = "DeOD9jnsbsgxhOu8tJRNmUB7e5G3";

async function main() {
  console.log(`Starting scan for UID: ${uid}...`);

  // 1. Count characters
  try {
    const charsSnap = await db.collection("characters").where("uid", "==", uid).get();
    console.log(`Firestore 'characters': found ${charsSnap.size} documents.`);
    charsSnap.forEach(doc => {
      console.log(`  - Doc ID: ${doc.id}, Name: ${doc.data().name}`);
    });
  } catch (err) {
    console.error("Failed counting characters:", err);
  }

  // 2. Count generations
  try {
    console.log("Fetching all Firestore 'generations' documents...");
    const gensSnap = await db.collection("generations").where("uid", "==", uid).get();
    console.log(`Firestore 'generations': found ${gensSnap.size} documents.`);
    // Let's count types
    const types = {};
    gensSnap.forEach(doc => {
      const type = doc.data().type || "unknown";
      types[type] = (types[type] || 0) + 1;
    });
    console.log("Generations by type:", types);
  } catch (err) {
    console.error("Failed counting generations:", err);
  }

  // 3. Count API Keys
  try {
    const keysSnap = await db.collection("api_keys").where("uid", "==", uid).get();
    console.log(`Firestore 'api_keys': found ${keysSnap.size} documents.`);
  } catch (err) {
    console.error("Failed counting api_keys:", err);
  }

  // 4. List Cloud Storage files
  try {
    const bucket = storage.bucket();
    const prefixes = [`generations/${uid}/`, `characters/${uid}/`];
    for (const prefix of prefixes) {
      console.log(`Listing Cloud Storage files with prefix '${prefix}'...`);
      const [files] = await bucket.getFiles({ prefix });
      console.log(`Found ${files.length} files under prefix '${prefix}'.`);
      files.forEach(f => {
        console.log(`  - ${f.name} (${f.metadata.size} bytes)`);
      });
    }
  } catch (err) {
    console.error("Failed listing storage files:", err);
  }
}

main();
