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

const EMAIL = "virtualteacherprojectgm@gmail.com";
const UID = "DeOD9jnsbsgxhOu8tJRNmUB7e5G3";

async function deleteCollectionInBatches(collectionName, fieldName, value, batchSize = 100) {
  console.log(`\nDeleting documents from '${collectionName}' where ${fieldName} == ${value}...`);
  let totalDeleted = 0;
  
  while (true) {
    const snap = await db.collection(collectionName).where(fieldName, "==", value).limit(batchSize).get();
    if (snap.empty) {
      console.log(`No more documents found in '${collectionName}'.`);
      break;
    }

    console.log(`Found ${snap.size} documents in current batch. Deleting...`);
    const batch = db.batch();
    snap.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snap.size;
    console.log(`Deleted ${snap.size} documents. Total deleted from '${collectionName}' so far: ${totalDeleted}`);
    
    // Safety sleep to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return totalDeleted;
}

async function deleteStorageFilesByPrefix(prefix) {
  console.log(`\nScanning Cloud Storage files under prefix: "${prefix}"...`);
  const bucket = storage.bucket();
  let deletedCount = 0;

  try {
    const [files] = await bucket.getFiles({ prefix });
    console.log(`Found ${files.length} files under "${prefix}". Starting deletion...`);
    
    for (const file of files) {
      console.log(`  Deleting file: ${file.name}`);
      await file.delete();
      deletedCount++;
    }
    console.log(`Successfully deleted ${deletedCount} files from Cloud Storage.`);
  } catch (err) {
    console.error(`Error deleting storage files for prefix ${prefix}: ${err.message}`);
  }
  
  return deletedCount;
}

async function main() {
  console.log("====================================================");
  console.log(`STARTING DELETION PROCESS FOR USER: ${EMAIL}`);
  console.log(`UID: ${UID}`);
  console.log("====================================================");

  try {
    // 1. Delete characters
    const deletedCharacters = await deleteCollectionInBatches("characters", "uid", UID);

    // 2. Delete generations (videos, images, audio)
    const deletedGenerations = await deleteCollectionInBatches("generations", "uid", UID);

    // 3. Delete api_keys
    const deletedApiKeys = await deleteCollectionInBatches("api_keys", "uid", UID);

    // 4. Delete Cloud Storage files
    const prefixes = [`generations/${UID}/`, `characters/${UID}/`];
    let totalStorageFilesDeleted = 0;
    
    for (const prefix of prefixes) {
      totalStorageFilesDeleted += await deleteStorageFilesByPrefix(prefix);
    }

    console.log("\n====================================================");
    console.log("DELETION PROCESS COMPLETED SUCCESSFULLY!");
    console.log(`- Firestore Characters Deleted: ${deletedCharacters}`);
    console.log(`- Firestore Generations Deleted: ${deletedGenerations}`);
    console.log(`- Firestore API Keys Deleted: ${deletedApiKeys}`);
    console.log(`- Cloud Storage Files Deleted: ${totalStorageFilesDeleted}`);
    console.log("====================================================");

  } catch (err) {
    console.error(`\n[FATAL ERROR] Deletion failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
