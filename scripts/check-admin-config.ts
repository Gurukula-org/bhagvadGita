import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const home = homedir();
const serviceAccount = JSON.parse(
  readFileSync(resolve(home, "Downloads/sample-f6f12-firebase-adminsdk.json"), "utf-8")
);

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);

async function check() {
  const snap = await db.collection("gita_config").doc("admin_emails").get();
  if (!snap.exists) {
    console.log("Document gita_config/admin_emails does NOT exist!");
  } else {
    console.log("Document data:", JSON.stringify(snap.data(), null, 2));
  }
}

check().catch(console.error);
