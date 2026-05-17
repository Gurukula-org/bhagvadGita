#!/usr/bin/env node
/**
 * Upload a local verse illustration to Firebase Storage (versioned path) and print the public URL.
 *
 * Each upload uses a new object name: ch<N>v<V>-<slot>-v<version>.png (increments from gitaData.json).
 * See docs/update-verse-images.md
 *
 * Usage:
 *   node scripts/push-verse-image-to-storage.mjs --chapter 3 --verse 42 --slot meaning --file path/to/image.png
 */

import { createReadStream, existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import {
  nextVersionForSlot,
  publicUrl,
  versionedObjectName,
} from "./lib/verse-image-version.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const GITA_PATH = resolve(ROOT, "client/src/data/gitaData.json");
const BUCKET = "sample-f6f12.appspot.com";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chapter") out.chapter = Number(argv[++i]);
    else if (a === "--verse") out.verse = Number(argv[++i]);
    else if (a === "--slot") out.slot = argv[++i];
    else if (a === "--file") out.file = argv[++i];
  }
  return out;
}

function initAdmin() {
  if (getApps().length > 0) return;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath && existsSync(keyPath)) {
    const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
    initializeApp({
      credential: cert(serviceAccount),
      storageBucket: BUCKET,
    });
    return;
  }
  initializeApp({
    credential: applicationDefault(),
    storageBucket: BUCKET,
  });
}

const args = parseArgs(process.argv);
const { chapter, verse, slot, file } = args;

if (!chapter || !verse || !slot || !file) {
  console.error(
    "Usage: node scripts/push-verse-image-to-storage.mjs --chapter <n> --verse <v> --slot <meaning|story-1|...> --file <local-path>",
  );
  process.exit(1);
}

const absFile = resolve(ROOT, file);
if (!existsSync(absFile)) {
  console.error(`File not found: ${absFile}`);
  process.exit(1);
}

const data = JSON.parse(readFileSync(GITA_PATH, "utf8"));
const ch = data.chapters.find((c) => c.chapter === chapter);
const kv = ch?.key_verses?.find((v) => v.verse === verse);
if (!kv) {
  console.error(`Verse ${chapter}.${verse} not found in gitaData.json`);
  process.exit(1);
}

const version = nextVersionForSlot(kv, chapter, verse, slot);
const ext = extname(absFile).slice(1) || "png";
if (ext !== "png") {
  console.warn("Warning: versioned naming expects .png; uploading with given extension in object path.");
}
const objectName = versionedObjectName(chapter, verse, slot, version).replace(/\.png$/, `.${ext}`);

initAdmin();

const bucket = getStorage().bucket();
const dest = bucket.file(objectName);

await new Promise((resolvePromise, reject) => {
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "application/octet-stream";
  createReadStream(absFile)
    .pipe(
      dest.createWriteStream({
        metadata: {
          contentType,
          cacheControl: "public, max-age=31536000",
        },
        resumable: false,
      }),
    )
    .on("finish", resolvePromise)
    .on("error", reject);
});

await dest.makePublic();
const publicUrlOut = publicUrl(objectName, BUCKET);
const imageKey = `ch${chapter}_v${verse}_${slot}`;
console.log("Uploaded:", objectName, `(v${version})`);
console.log("Public URL:", publicUrlOut);
console.log("\nUpdate gitaData.json images.*.url for this slot to the URL above.");
console.log("Firestore override key (if used):", imageKey);
console.log(
  "Deploy rules: npx firebase-tools deploy --only firestore:rules,storage --project sample-f6f12",
);
