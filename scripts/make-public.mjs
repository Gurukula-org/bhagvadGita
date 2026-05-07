import { initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";
import { resolve } from "path";

const HOME = process.env.HOME;
const cred = JSON.parse(
  readFileSync(resolve(HOME, "Downloads/sample-f6f12-0e67b9d712cf.json"), "utf8")
);

const app = initializeApp({
  credential: cert(cred),
  storageBucket: "sample-f6f12.appspot.com",
});

const bucket = getStorage(app).bucket();
const FOLDER = "bhagvad-gita/";

async function main() {
  console.log(`Listing all files under gs://sample-f6f12.appspot.com/${FOLDER}...\n`);

  const [files] = await bucket.getFiles({ prefix: FOLDER });
  const realFiles = files.filter((f) => !f.name.endsWith("/"));

  console.log(`Found ${realFiles.length} files. Making each public...\n`);

  let success = 0;
  let failed = 0;

  for (const file of realFiles) {
    try {
      await file.makePublic();
      success++;
      if (success % 25 === 0) console.log(`  ... ${success}/${realFiles.length} done`);
    } catch (err) {
      console.log(`  ✗ ${file.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✓ Done. ${success} public, ${failed} failed out of ${realFiles.length} files.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
