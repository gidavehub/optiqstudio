import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";

let credential;
const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (saJson) {
  try {
    const parsed = JSON.parse(saJson.startsWith("{") ? saJson : Buffer.from(saJson, "base64").toString("utf-8"));
    credential = cert(parsed);
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env:", e);
  }
}

// Initialize Firebase Admin using default ADC or FIREBASE_SERVICE_ACCOUNT if provided
const app = getApps().length === 0
  ? initializeApp({
      projectId: PROJECT_ID,
      ...(credential ? { credential } : {}),
    })
  : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

// Known hardcoded UIDs for quick fallback
const KNOWN_UIDS = {
  "davelabs01@gmail.com": "0UKyj7haD1R6PA315WlraeQoszn1",
};

const EMAIL = process.argv[2] || "davelabs01@gmail.com";
const RAW_ARG3 = process.argv[3] || "50000";
const IS_ADD_MODE = RAW_ARG3.startsWith("+");
const ARG_CREDITS = parseFloat(RAW_ARG3.replace("+", "")) || 50000;

async function main() {
  console.log(`Starting credit balance update process for ${EMAIL}...`);
  try {
    let uid = KNOWN_UIDS[EMAIL] || null;
    let name = "DaveLabs User";

    if (!uid) {
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
    } else {
      console.log(`Using UID: ${uid}`);
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
      name = data.name || name;
      console.log(`Current Firestore credit balance for user: ${currentCredits}`);
    } else {
      console.log(`No existing Firestore document found for UID: ${uid}. Creating a new profile.`);
    }

    const TARGET_CREDITS = IS_ADD_MODE ? (currentCredits + ARG_CREDITS) : ARG_CREDITS;
    const delta = TARGET_CREDITS - currentCredits;
    console.log(`Updating credit balance to ${TARGET_CREDITS} (Delta: ${delta >= 0 ? '+' : ''}${delta})`);

    // 4. Update/merge Firestore user document
    const updateData = {
      credits: TARGET_CREDITS,
      email: EMAIL,
      name: name,
    };

    if (!exists) {
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
      reason: `Admin update: set credit balance to ${TARGET_CREDITS}`,
      at: new Date().toISOString(),
    });

    console.log(`\n[SUCCESS] Successfully updated ${EMAIL} to ${TARGET_CREDITS} credits!`);
    console.log("Ledger transaction added.");
  } catch (err) {
    console.error(`Failed to update user credit balance: ${err.message}`);
    process.exit(1);
  }
}

main();
