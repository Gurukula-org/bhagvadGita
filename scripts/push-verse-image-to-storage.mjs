#!/usr/bin/env node
/**
 * Upload a local verse illustration to Firebase Storage (canonical path) and print the public URL.
 *
 * Prerequisites (one of):
 *   - `gcloud auth application-default login`, or
 *   - `export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json` (Storage write on sample-f6f12.appspot.com)
 *
 * Usage:
 *   node scripts/push-verse-image-to-storage.mjs --chapter 3 --verse 42 --slot meaning --file client/public/images/ch3/v42/ch3v42-meaning.png
 *
 * Object path matches docs/new-chapter-content-import.md:
 *   bhagvad-gita/images/ch<N>/v<V>/ch<N>v<V>-<slot>.<ext>
 */

import { createReadStream, existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");

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
      storageBucket: "sample-f6f12.appspot.com",
    });
    return;
  }
  initializeApp({
    credential: applicationDefault(),
    storageBucket: "sample-f6f12.appspot.com",
  });
}

const args = parseArgs(process.argv);
const { chapter, verse, slot, file } = args;

if (!chapter || !verse || !slot || !file) {
  console.error(
    "Usage: node scripts/push-verse-image-to-storage.mjs --chapter <n> --verse <v> --slot <meaning|...> --file <local-path>",
  );
  process.exit(1);
}

const absFile = resolve(ROOT, file);
if (!existsSync(absFile)) {
  console.error(`File not found: ${absFile}`);
  process.exit(1);
}

const ext = extname(absFile).slice(1) || "png";
const objectName = `bhagvad-gita/images/ch${chapter}/v${verse}/ch${chapter}v${verse}-${slot}.${ext}`;

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
const publicUrl = `https://storage.googleapis.com/sample-f6f12.appspot.com/${objectName}`;
const imageKey = `ch${chapter}_v${verse}_${slot}`;
console.log("Uploaded:", objectName);
console.log("Public URL:", publicUrl);
console.log("\nFirestore override key (if used):", imageKey);
console.log(
  "Deploy rules: npx firebase-tools deploy --only firestore:rules,storage --project sample-f6f12",
);
