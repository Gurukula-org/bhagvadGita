import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const isServer = typeof window === "undefined";

const firebaseConfig = isServer
  ? { apiKey: "", projectId: "" }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD01v7-u3GNm_KMJL5L_88bWLFKCMv9Kg8",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sample-f6f12.firebaseapp.com",
      databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://sample-f6f12.firebaseio.com",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sample-f6f12",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sample-f6f12.appspot.com",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "891299235543",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:891299235543:web:34faa622959864b55f5292",
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-T4S6J23NVM",
    };

const isConfigured = !isServer && !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  db = getFirestore(app);
  storage = getStorage(app);
}

export { auth, googleProvider, db, storage, isConfigured };
