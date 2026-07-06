import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBP89Y8cwi8NiCLB7CmjnkQTlJ3pn2aDdI",
  authDomain: "davelabs-tools.firebaseapp.com",
  projectId: "davelabs-tools",
  storageBucket: "davelabs-tools",
  messagingSenderId: "951694748196",
  appId: "1:951694748196:web:c225fccb65cf80c75b06b1",
  measurementId: "G-DX5M7SJF4X",
  databaseURL: "https://davelabs-tools-default-rtdb.firebaseio.com"
};

// Initialize Firebase for Client-side
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable robust, high-performance offline persistence across multiple tabs (Client only)
const isBrowser = typeof window !== "undefined";
export const db = initializeFirestore(app, {
  localCache: isBrowser
    ? persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      })
    : memoryLocalCache(),
});

export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export default app;
