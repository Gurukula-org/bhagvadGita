#!/usr/bin/env node
/**
 * Upload verse MP3 to Firebase Storage (canonical path: bhagvad-gita/audio/ch<N>/<N>.<V>.mp3)
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./sample-f6f12-0e67b9d712cf.json \
 *   node scripts/upload-chapter-audio.mjs --chapter 15 --verse 1 \
 *     --file .cache/chapter-import/ch15/raw/15.1.mp3
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const GITA_PATH = resolve(ROOT, "client/src/data/gitaData.json");
const BUCKET = "sample-f6f12.appspot.com";

function parseArgs(argv) {
  const out = { chapter: null, verse: null, file: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chapter") out.chapter = Number(argv[++i]);
    else if (a === "--verse") out.verse = Number(argv[++i]);
    else if (a === "--file") out.file = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function initAdmin() {
  if (getApps().length > 0) return;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath || !existsSync(keyPath)) {
    console.error("Set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON path.");
    process.exit(1);
  }
  initializeApp({
    credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))),
    storageBucket: BUCKET,
  });
}

const args = parseArgs(process.argv);
const { chapter, verse, file, dryRun } = args;
if (!chapter || !verse || !file) {
  console.error(
    "Usage: node scripts/upload-chapter-audio.mjs --chapter <n> --verse <v> --file <local.mp3>",
  );
  process.exit(1);
}

const absFile = resolve(ROOT, file);
if (!existsSync(absFile)) {
  console.error(`File not found: ${absFile}`);
  process.exit(1);
}

const destination = `bhagvad-gita/audio/ch${chapter}/${chapter}.${verse}.mp3`;
const publicUrl = `https://storage.googleapis.com/${BUCKET}/${destination}`;

if (dryRun) {
  console.log(`Would upload ${absFile} → gs://${BUCKET}/${destination}`);
  console.log(`audio_url: ${publicUrl}`);
  process.exit(0);
}

initAdmin();
const bucket = getStorage().bucket();
console.log(`Uploading ${absFile} → gs://${bucket.name}/${destination}`);
await bucket.upload(absFile, {
  destination,
  metadata: {
    contentType: "audio/mpeg",
    cacheControl: "public, max-age=31536000",
  },
});
const gcsFile = bucket.file(destination);
await gcsFile.makePublic();
console.log(`Public URL: ${publicUrl}`);

const data = JSON.parse(readFileSync(GITA_PATH, "utf8"));
const ch = data.chapters.find((c) => c.chapter === chapter);
const kv = ch?.key_verses?.find((v) => v.verse === verse);
if (!kv) {
  console.error(`Verse ${chapter}.${verse} not found in gitaData.json`);
  process.exit(1);
}
kv.audio_url = publicUrl;
writeFileSync(GITA_PATH, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Updated gitaData.json audio_url for ${chapter}.${verse}`);
