import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const isServer = typeof window === "undefined";

const firebaseConfig = isServer
  ? { apiKey: "", projectId: "" }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAJNEAO7xMvbn5wTD6_DP5P41CLxDAryFc",
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "hindu-voter-awareness.firebaseapp.com",
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "hindu-voter-awareness",
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "hindu-voter-awareness.firebasestorage.app",
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "670582271859",
      appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:670582271859:web:6cee76c7e6affc10421f06",
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
