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

async function upload() {
  const localFile = resolve(home, "Downloads/12.1.mp3");
  const destination = "bhagvad-gita/audio/ch12_v1.mp3";

  console.log(`Uploading ${localFile} → gs://${bucket.name}/${destination}`);

  await bucket.upload(localFile, {
    destination,
    metadata: {
      contentType: "audio/mpeg",
      cacheControl: "public, max-age=31536000",
    },
  });

  const file = bucket.file(destination);
  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
  console.log(`\nPublic URL:\n${publicUrl}`);
}

upload().catch((err) => {
  console.error("Upload failed:", err);
  process.exit(1);
});
