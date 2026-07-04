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

const EMAIL = "davelabs01@gmail.com";

async function main() {
  console.log(`Starting upgrade process for ${EMAIL}...`);
  try {
    let uid = null;
    let name = "Pro Creator";

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

    // 3. Update or create their profile in Firestore
    const userRef = db.collection("users").doc(uid);
    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    const updateData = {
      plan: "pro-monthly",
      planStatus: "active",
      planRenewsAt: renewsAt.toISOString(),
      credits: 10000, // Upgrade to Pro plan grant (10,000 credits)
      email: EMAIL,
      name: name,
      createdAt: new Date().toISOString(),
    };

    await userRef.set(updateData, { merge: true });
    console.log(`\n[SUCCESS] Successfully upgraded ${EMAIL} to the Pro Plan!`);
    console.log("Firestore document updated:");
    console.log(JSON.stringify(updateData, null, 2));
  } catch (err) {
    console.error(`Failed to upgrade user: ${err.message}`);
    process.exit(1);
  }
}

main();
