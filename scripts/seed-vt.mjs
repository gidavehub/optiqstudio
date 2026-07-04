import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "davelabs-tools";

// Initialize Firebase Admin
const app = initializeApp({
  projectId: PROJECT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

const EMAIL = "virtualteacherprojectgm@gmail.com";

async function main() {
  console.log(`Starting database seed process for ${EMAIL}...`);
  try {
    let uid = null;
    let name = "Virtual Teacher Project";

    try {
      // 1. Look up user in Firebase Auth
      const userRecord = await auth.getUserByEmail(EMAIL);
      uid = userRecord.uid;
      name = userRecord.displayName || name;
      console.log(`Found Auth User in Firebase Auth: UID = ${uid}, Name = ${name}`);
    } catch (authErr) {
      console.warn(`Could not find user in Firebase Auth: ${authErr.message}`);
      
      // 2. Fallback: Query Firestore by email
      console.log("Searching Firestore 'users' collection by email...");
      const usersSnap = await db.collection("users").where("email", "==", EMAIL).limit(1).get();
      if (!usersSnap.empty) {
        const doc = usersSnap.docs[0];
        uid = doc.id;
        name = doc.data().name || name;
        console.log(`Found Firestore Document: Doc ID (UID) = ${uid}`);
      } else {
        console.log(`User ${EMAIL} does not exist in Auth/Firestore yet. Creating dynamic placeholder doc ID...`);
        uid = "vt-project-placeholder-uid";
      }
    }

    // 3. Update or create their profile in Firestore
    const userRef = db.collection("users").doc(uid);
    const renewsAt = new Date();
    renewsAt.setMonth(renewsAt.getMonth() + 1);

    const updateData = {
      plan: "studio-monthly",
      planStatus: "active",
      planRenewsAt: renewsAt.toISOString(),
      credits: 17000, // 10,000 subscription + 7,000 top-up = 17,000 credits ($170.00 value)
      email: EMAIL,
      name: name,
      updatedAt: new Date().toISOString(),
    };

    await userRef.set(updateData, { merge: true });
    console.log(`\n[SUCCESS] Successfully seeded user ${EMAIL} in Firestore!`);
    console.log("Firestore document updated:");
    console.log(JSON.stringify(updateData, null, 2));
  } catch (err) {
    console.error(`Failed to seed user: ${err.message}`);
    process.exit(1);
  }
}

main();
