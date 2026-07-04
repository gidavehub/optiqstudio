import { getApps, initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

/**
 * Firebase Admin bootstrap for the davelabs-tools project.
 *
 * Credentials come from:
 * 1. FIREBASE_SERVICE_ACCOUNT env (for production servers like Vercel).
 * 2. GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials (for local development).
 */

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
export const STORAGE_BUCKET = PROJECT_ID;

let app;
if (getApps().length === 0) {
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

  app = initializeApp({
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
    ...(credential ? { credential } : {}),
  });
} else {
  app = getApp();
}

export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app);
export default app;

/**
 * Uploads a base64 payload to Firebase Storage and returns a permanent
 * tokenized download URL (works regardless of storage security rules).
 */
export async function uploadBase64(
  base64: string,
  path: string,
  contentType: string
): Promise<string> {
  const file = adminStorage.bucket().file(path);
  await file.save(Buffer.from(base64, "base64"), {
    contentType,
    resumable: false,
  });
  return `https://storage.googleapis.com/${STORAGE_BUCKET}/${path}`;
}
