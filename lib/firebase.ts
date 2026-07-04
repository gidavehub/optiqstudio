import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBP89Y8cwi8NiCLB7CmjnkQTlJ3pn2aDdI",
  authDomain: "davelabs-tools.firebaseapp.com",
  projectId: "davelabs-tools",
  storageBucket: "davelabs-tools",
  messagingSenderId: "951694748196",
  appId: "1:951694748196:web:c225fccb65cf80c75b06b1",
  measurementId: "G-DX5M7SJF4X"
};

// Initialize Firebase for Client-side
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
