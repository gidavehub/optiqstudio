import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const PROJECT_ID = "davelabs-tools";

console.log("Initializing Firebase Admin SDK...");
// Initialize Firebase Admin
const app = initializeApp({
  projectId: PROJECT_ID,
  storageBucket: PROJECT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const EMAIL = process.argv[2] || "virtualteacherprojectgm@gmail.com";

async function main() {
  console.log(`Searching for all data associated with ${EMAIL}...`);
  try {
    let uid = null;
    let authUser = null;

    try {
      console.log("Querying Auth User by email...");
      authUser = await auth.getUserByEmail(EMAIL);
      uid = authUser.uid;
      console.log(`[AUTH] Found Auth User: UID = ${uid}, Name = ${authUser.displayName}`);
    } catch (authErr) {
      console.warn(`[AUTH] Could not find user in Firebase Auth: ${authErr.message}`);
    }

    console.log("Querying Firestore 'users' collection by email...");
    const usersSnap = await db.collection("users").where("email", "==", EMAIL).get();
    if (!usersSnap.empty) {
      const doc = usersSnap.docs[0];
      const userData = doc.data();
      console.log(`[FIRESTORE] Found user document: Doc ID = ${doc.id}`);
      if (!uid) {
        uid = doc.id;
        console.log(`[INFO] Setting UID to Firestore Doc ID: ${uid}`);
      }
    } else {
      console.log("[FIRESTORE] No document in 'users' collection with that email.");
    }

    if (!uid) {
      console.error(`\n[ERROR] User ${EMAIL} could not be found by email in Auth or Firestore!`);
      process.exit(1);
    }

    console.log(`\nUsing UID: ${uid} to find all records...`);

    console.log("Fetching ledger records...");
    const ledgerSnap = await db.collection("users").doc(uid).collection("ledger").get();
    console.log(`[FIRESTORE] Found ${ledgerSnap.size} ledger records.`);

    console.log("Fetching character records...");
    const charsSnap = await db.collection("characters").where("uid", "==", uid).get();
    console.log(`[FIRESTORE] Found ${charsSnap.size} character records.`);
    charsSnap.forEach(doc => {
      console.log(`  - Character doc ID: ${doc.id}, name: ${doc.data().name}`);
    });

    console.log("Fetching generation records...");
    const gensSnap = await db.collection("generations").where("uid", "==", uid).get();
    console.log(`[FIRESTORE] Found ${gensSnap.size} generation records.`);
    gensSnap.forEach(doc => {
      console.log(`  - Generation doc ID: ${doc.id}, type: ${doc.data().type}, url: ${doc.data().url || doc.data().videoUrl || doc.data().voiceUrl}`);
    });

    console.log("Fetching API key records...");
    const keysSnap = await db.collection("api_keys").where("uid", "==", uid).get();
    console.log(`[FIRESTORE] Found ${keysSnap.size} API keys.`);
    keysSnap.forEach(doc => {
      console.log(`  - API Key doc ID: ${doc.id}, name: ${doc.data().name}`);
    });

    console.log("Fetching transaction records...");
    const txSnap = await db.collection("transactions").where("uid", "==", uid).get();
    console.log(`[FIRESTORE] Found ${txSnap.size} transaction records.`);

    console.log("Fetching payment records...");
    const paySnap = await db.collection("payments").where("uid", "==", uid).get();
    console.log(`[FIRESTORE] Found ${paySnap.size} payment records.`);

    console.log("\n[STORAGE] Listing files in Cloud Storage bucket...");
    const bucket = storage.bucket();
    
    // We can fetch files with prefixes
    const prefixes = [`generations/${uid}`, `characters/${uid}`];
    let totalFilesCount = 0;

    for (const prefix of prefixes) {
      console.log(`Listing files under prefix: "${prefix}"...`);
      const [files] = await bucket.getFiles({ prefix });
      console.log(`Found ${files.length} files under "${prefix}".`);
      files.forEach(file => {
        console.log(`  - ${file.name} (${file.metadata.size} bytes)`);
        totalFilesCount++;
      });
    }

    console.log(`\nSearch finished. Total files found in Cloud Storage: ${totalFilesCount}`);

  } catch (err) {
    console.error(`\n[FATAL ERROR] Search failed: ${err.message}`);
    console.error(err.stack);
  }
}

main();
