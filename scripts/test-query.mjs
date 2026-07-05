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
  console.log("1. Testing db.collection('generations').limit(1).get()...");
  try {
    const snap = await db.collection("generations").limit(1).get();
    console.log(`Success! Found ${snap.size} documents.`);
    if (snap.size > 0) {
      console.log("Sample doc fields:", Object.keys(snap.docs[0].data()));
    }
  } catch (err) {
    console.error("Failed limit 1 query:", err.message);
  }

  console.log("\n2. Testing db.collection('generations').where('uid', '==', uid).limit(5).get()...");
  try {
    const snap = await db.collection("generations").where("uid", "==", uid).limit(5).get();
    console.log(`Success! Found ${snap.size} documents matching uid.`);
    snap.forEach(doc => {
      console.log(`  - Doc: ${doc.id}, type: ${doc.data().type}`);
    });
  } catch (err) {
    console.error("Failed filtered query:", err.message);
  }

  console.log("\n3. Testing Storage listing directly for uid...");
  try {
    const bucket = storage.bucket();
    const prefix = `generations/${uid}`;
    console.log(`Listing bucket files under ${prefix}...`);
    const [files] = await bucket.getFiles({ prefix, maxResults: 5 });
    console.log(`Success! Found ${files.length} files.`);
    files.forEach(file => {
      console.log(`  - ${file.name}`);
    });
  } catch (err) {
    console.error("Failed storage listing:", err.message);
  }
}

main();
