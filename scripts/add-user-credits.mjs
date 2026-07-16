import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "davelabs-tools";

// Initialize Firebase Admin using Application Default Credentials
const app = initializeApp({
  projectId: PROJECT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

const EMAIL = "virtualteacherprojectgm@gmail.com";
const TARGET_CREDITS = 30000;

async function main() {
  console.log(`Starting credit update process for ${EMAIL}...`);
  try {
    let uid = null;
    let name = "Virtual Teacher";

    try {
      // 1. Look up user in Firebase Auth
      const userRecord = await auth.getUserByEmail(EMAIL);
      uid = userRecord.uid;
      name = userRecord.displayName || name;
      console.log(`Found Auth User: UID = ${uid}, Name = ${name}`);
    } catch (authErr) {
      console.warn(`Could not find user in Firebase Auth by email: ${authErr.message}`);
      
      // 2. Fallback: Query Firestore by email field
      console.log("Searching Firestore 'users' collection by email...");
      const usersSnap = await db.collection("users").where("email", "==", EMAIL).limit(1).get();
      if (!usersSnap.empty) {
        const doc = usersSnap.docs[0];
        uid = doc.id;
        name = doc.data().name || name;
        console.log(`Found Firestore Document matching email: Doc ID (UID) = ${uid}`);
      } else {
        console.error(`\n[ERROR] User ${EMAIL} does not exist in Firebase Auth or Firestore yet.\nPlease register/login on the app first so the user account is created!`);
        process.exit(1);
      }
    }

    // 3. Get current Firestore document details to know current balance
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    let currentCredits = 0;
    let exists = false;

    if (userSnap.exists) {
      exists = true;
      const data = userSnap.data();
      currentCredits = data.credits || 0;
      console.log(`Current Firestore credits for user: ${currentCredits}`);
    } else {
      console.log(`No existing Firestore document found for UID: ${uid}. Creating a new profile.`);
    }

    const delta = TARGET_CREDITS - currentCredits;
    console.log(`Updating credit balance to ${TARGET_CREDITS} (Delta: ${delta >= 0 ? '+' : ''}${delta})`);

    // 4. Update/merge Firestore user document
    const updateData = {
      credits: TARGET_CREDITS,
      email: EMAIL,
      name: name,
    };

    if (!exists) {
      // If document doesn't exist, set default structure
      updateData.plan = null;
      updateData.planStatus = "none";
      updateData.planRenewsAt = null;
      updateData.createdAt = new Date().toISOString();
    }

    await userRef.set(updateData, { merge: true });

    // 5. Add ledger entry for traceability
    const ledgerRef = userRef.collection("ledger");
    await ledgerRef.add({
      delta: delta,
      reason: `Admin update: set credits to ${TARGET_CREDITS}`,
      at: new Date().toISOString(),
    });

    console.log(`\n[SUCCESS] Successfully updated ${EMAIL} to ${TARGET_CREDITS} credits!`);
    console.log("Ledger transaction added.");
  } catch (err) {
    console.error(`Failed to update user credits: ${err.message}`);
    process.exit(1);
  }
}

main();
