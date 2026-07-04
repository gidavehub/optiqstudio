import { getApps, initializeApp, getApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { getAuth, Auth } from "firebase-admin/auth";
import { getStorage, Storage } from "firebase-admin/storage";

/**
 * Firebase Admin bootstrap for the davelabs-tools project.
 *
 * Credentials come from Application Default Credentials (the
 * davelabs01@gmail.com login or GOOGLE_APPLICATION_CREDENTIALS key file).
 * Initialization itself never needs credentials — individual calls fail with
 * a clear auth error if ADC is missing, which surfaces in API route errors.
 */

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "davelabs-tools";
export const STORAGE_BUCKET = `${PROJECT_ID}.firebasestorage.app`;

const app: App = getApps().length
  ? getApp()
  : initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });

export const adminDb: Firestore = getFirestore(app);
export const adminAuth: Auth = getAuth(app);
export const adminStorage: Storage = getStorage(app);
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
  const token = crypto.randomUUID();
  const file = adminStorage.bucket().file(path);
  await file.save(Buffer.from(base64, "base64"), {
    contentType,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    resumable: false,
  });
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(
    path
  )}?alt=media&token=${token}`;
}
