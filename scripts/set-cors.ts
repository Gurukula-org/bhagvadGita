import { initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

const home = homedir();

const serviceAccount = JSON.parse(
  readFileSync(resolve(home, "Downloads/sample-f6f12-firebase-adminsdk.json"), "utf-8")
);

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "sample-f6f12.appspot.com",
});

const bucket = getStorage(app).bucket();

async function setCors() {
  await bucket.setCorsConfiguration([
    {
      origin: ["*"],
      method: ["GET", "HEAD", "PUT", "POST", "OPTIONS", "DELETE"],
      responseHeader: [
        "Content-Type",
        "Content-Length",
        "Content-Range",
        "Accept-Ranges",
        "Authorization",
        "X-Goog-Resumable",
        "X-Firebase-Storage-Version",
      ],
      maxAgeSeconds: 86400,
    },
  ]);
  console.log("CORS configuration set on bucket:", bucket.name);
}

setCors().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
