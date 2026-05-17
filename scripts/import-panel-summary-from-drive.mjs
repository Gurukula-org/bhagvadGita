#!/usr/bin/env node
/**
 * Upload verse panel-summary PNG to GCS and set gitaData.json images.panel_summary.
 *
 * Filename: <chapter>.<verse>-panel-summary.png
 * GCS: bhagvad-gita/images/ch<N>/v<V>/ch<N>v<V>-panel-summary-v<version>.png
 *
 *   node scripts/import-panel-summary-from-drive.mjs --chapter 3 --verse 19 --dir .cache/.../3.19
 *   node scripts/import-panel-summary-from-drive.mjs --chapter 3 --root-dir .cache/.../chapter0003/images [--verses 19,20,21]
 *
 * See docs/update-verse-images.md (panel summary section).
 */

import {
  createReadStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
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
const STORAGE_SLOT = "panel-summary";
const DEFAULT_CAPTION = "Twelve-panel visual summary of this shloka journey";

function parseArgs(argv) {
  const out = {
    chapter: null,
    verse: null,
    dir: null,
    file: null,
    rootDir: null,
    verses: null,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chapter") out.chapter = Number(argv[++i]);
    else if (a === "--verse") out.verse = Number(argv[++i]);
    else if (a === "--dir") out.dir = argv[++i];
    else if (a === "--file") out.file = argv[++i];
    else if (a === "--root-dir") out.rootDir = argv[++i];
    else if (a === "--verses") {
      out.verses = argv[++i]
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => !Number.isNaN(n));
    } else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

function chapterFolder(chapter) {
  return `chapter${String(chapter).padStart(4, "0")}`;
}

function panelFilename(chapter, verse) {
  return `${chapter}.${verse}-panel-summary.png`;
}

/** Resolve local panel PNG from explicit path, verse dir, or known cache layouts. */
function resolvePanelPath(chapter, verse, { dir, file }) {
  if (file) {
    const abs = resolve(ROOT, file);
    if (existsSync(abs)) return abs;
    throw new Error(`Panel file not found: ${abs}`);
  }
  const name = panelFilename(chapter, verse);
  if (dir) {
    const abs = resolve(ROOT, dir, name);
    if (existsSync(abs)) return abs;
    const absDirOnly = resolve(ROOT, dir);
    if (existsSync(absDirOnly) && absDirOnly.endsWith(name)) return absDirOnly;
    throw new Error(`Expected ${name} in ${absDirOnly}`);
  }
  const cf = chapterFolder(chapter);
  const candidates = [
    resolve(ROOT, `.cache/chapter-import/_drive_root/${cf}/images/${chapter}.${verse}/${name}`),
    resolve(ROOT, `.cache/chapter-import/${cf}/images/${chapter}.${verse}/${name}`),
    resolve(ROOT, `.cache/chapter-import/ch${chapter}-images/${chapter}.${verse}/${name}`),
    resolve(ROOT, `.cache/chapter-import/ch${chapter}-images-dl/${chapter}.${verse}/${name}`),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function initAdmin() {
  if (getApps().length > 0) return;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath && existsSync(keyPath)) {
    initializeApp({
      credential: cert(JSON.parse(readFileSync(keyPath, "utf8"))),
      storageBucket: BUCKET,
    });
    return;
  }
  initializeApp({ credential: applicationDefault(), storageBucket: BUCKET });
}

async function uploadFile(localPath, objectName) {
  const bucket = getStorage().bucket();
  const dest = bucket.file(objectName);
  await new Promise((resolvePromise, reject) => {
    createReadStream(localPath)
      .pipe(
        dest.createWriteStream({
          metadata: { contentType: "image/png", cacheControl: "public, max-age=31536000" },
          resumable: false,
        }),
      )
      .on("finish", resolvePromise)
      .on("error", reject);
  });
  await dest.makePublic();
  return publicUrl(objectName, BUCKET);
}

function discoverVerseDirs(chapter, rootAbs, verseFilter) {
  const dirs = [];
  for (const name of readdirSync(rootAbs)) {
    const full = resolve(rootAbs, name);
    if (!statSync(full).isDirectory()) continue;
    const m = name.match(/^(\d+)\.(\d+)$/);
    if (!m) continue;
    const ch = Number(m[1]);
    const v = Number(m[2]);
    if (ch !== chapter) continue;
    if (verseFilter?.length && !verseFilter.includes(v)) continue;
    const panelPath = resolve(full, panelFilename(ch, v));
    if (existsSync(panelPath)) dirs.push({ verse: v, panelPath });
  }
  dirs.sort((a, b) => a.verse - b.verse);
  return dirs;
}

function assertCredentials(dryRun) {
  if (dryRun) return;
  const defaultPath = resolve(ROOT, "sample-f6f12-0e67b9d712cf.json");
  const path =
    process.env.GOOGLE_APPLICATION_CREDENTIALS && existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      ? process.env.GOOGLE_APPLICATION_CREDENTIALS
      : defaultPath;
  if (!existsSync(path)) {
    console.error("Missing GOOGLE_APPLICATION_CREDENTIALS / sample-f6f12-0e67b9d712cf.json");
    process.exit(1);
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  }
}

async function importPanelForVerse({ chapter, verse, panelPath, dryRun, data }) {
  const ch = data.chapters.find((c) => c.chapter === chapter);
  const kv = ch?.key_verses?.find((v) => v.verse === verse);
  if (!ch || !kv) throw new Error(`Verse ${chapter}.${verse} not found in key_verses`);

  const version = nextVersionForSlot(kv, chapter, verse, STORAGE_SLOT);
  const objectName = versionedObjectName(chapter, verse, STORAGE_SLOT, version);

  console.log(`\n=== ${chapter}.${verse} panel-summary ===`);
  console.log(`  ${panelPath}`);
  console.log(`  -> v${version} (${objectName})`);

  if (dryRun) return;

  const url = await uploadFile(panelPath, objectName);
  if (!kv.images) kv.images = {};
  const existingCaption = kv.images.panel_summary?.caption;
  kv.images.panel_summary = {
    url,
    caption: existingCaption?.trim() ? existingCaption : DEFAULT_CAPTION,
  };
  console.log("Uploaded:", url);
}

function printUsage() {
  console.error(`Usage:
  Single:
    node scripts/import-panel-summary-from-drive.mjs --chapter <n> --verse <v> [--dir <folder> | --file <path>] [--dry-run]

  Batch:
    node scripts/import-panel-summary-from-drive.mjs --chapter <n> --root-dir <images-root> [--verses 19,20] [--dry-run]

Panel file must be named <n>.<v>-panel-summary.png`);
}

async function main() {
  const args = parseArgs(process.argv);
  const { chapter, verse, dir, file, rootDir, verses: verseFilter, dryRun } = args;

  if (!chapter) {
    printUsage();
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(GITA_PATH, "utf8"));
  assertCredentials(dryRun);
  if (!dryRun) initAdmin();

  if (rootDir) {
    const rootAbs = resolve(ROOT, rootDir);
    if (!existsSync(rootAbs)) {
      console.error(`Root not found: ${rootAbs}`);
      process.exit(1);
    }
    const items = discoverVerseDirs(chapter, rootAbs, verseFilter);
    if (items.length === 0) {
      console.error(`No *-panel-summary.png under ${rootAbs}`);
      process.exit(1);
    }
    for (const { verse: v, panelPath } of items) {
      await importPanelForVerse({ chapter, verse: v, panelPath, dryRun, data });
    }
  } else if (verse) {
    const panelPath = resolvePanelPath(chapter, verse, { dir, file });
    if (!panelPath) {
      console.error(`Panel not found for ${chapter}.${verse}. Use --dir or --file.`);
      process.exit(1);
    }
    await importPanelForVerse({ chapter, verse, panelPath, dryRun, data });
  } else if (verseFilter?.length) {
    for (const v of verseFilter) {
      const panelPath = resolvePanelPath(chapter, v, { dir, file });
      if (!panelPath) {
        console.error(`Panel not found for ${chapter}.${v}. Use --dir or --file.`);
        process.exit(1);
      }
      await importPanelForVerse({ chapter, verse: v, panelPath, dryRun, data });
    }
  } else {
    printUsage();
    process.exit(1);
  }

  if (!dryRun) {
    writeFileSync(GITA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`\nUpdated ${GITA_PATH}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
