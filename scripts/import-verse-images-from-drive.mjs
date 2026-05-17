#!/usr/bin/env node
/**
 * Import verse section images from Drive-style filenames into Firebase Storage + gitaData.json.
 *
 * Filename pattern:
 *   <N>.<V>-image-<seq>-<section>-<sectionname>[-<description>].png
 *
 * Section numbers (doc convention):
 *   3 = meaning, 4 = story, 5 = impact (modern_life), 7 = kids, 8 = detailed_meaning, 10 = more_stories
 *
 * Single shloka:
 *   GOOGLE_APPLICATION_CREDENTIALS=./sample-f6f12-0e67b9d712cf.json \
 *   node scripts/import-verse-images-from-drive.mjs --chapter 3 --verse 19 \
 *     --dir .cache/chapter-import/ch3-images/3.19
 *
 * Chapter batch (all subfolders N.V under root):
 *   node scripts/import-verse-images-from-drive.mjs --chapter 3 \
 *     --root-dir .cache/chapter-import/ch3-images [--verses 19,20,21]
 *
 * See docs/update-verse-images.md
 */

import {
  createReadStream,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
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
const BASE_URL = `https://storage.googleapis.com/${BUCKET}`;

function parseArgs(argv) {
  const out = {
    chapter: null,
    verse: null,
    dir: null,
    rootDir: null,
    verses: null,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--chapter") out.chapter = Number(argv[++i]);
    else if (a === "--verse") out.verse = Number(argv[++i]);
    else if (a === "--dir") out.dir = argv[++i];
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

function titleCaseSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Placeholder from Drive filename slug only — replace in JSON per docs/new-chapter-content-import.md §8d. */
function captionFromDescription(desc) {
  if (!desc) return "";
  return titleCaseSlug(desc);
}

function isMinimalCaption(caption) {
  if (!caption || !String(caption).trim()) return true;
  if (/illustrating the teaching of verse/i.test(caption)) return true;
  return false;
}

function resolveCaption(existingCaption, description) {
  if (!isMinimalCaption(existingCaption)) return existingCaption;
  return captionFromDescription(description);
}

function parseFilename(name) {
  const base = name.replace(/\.png\.png$/i, ".png").replace(/\.png$/i, "");
  const m = base.match(/^(\d+)\.(\d+)-image-(\d+)-(\d+)-(.+)$/);
  if (!m) return null;
  const [, chapter, verse, seq, section, rest] = m;
  const parts = rest.split("-");
  let sectionName;
  let description;
  if (section === "10" && parts[0] === "more" && parts[1] === "stories") {
    sectionName = "more-stories";
    description = parts.slice(2).join("-");
  } else if (section === "5" && parts[0] === "impact") {
    sectionName = "impact";
    description = parts.slice(1).join("-");
  } else if (section === "7" && parts[0] === "how") {
    sectionName = "kids";
    description = parts.join("-");
  } else if (section === "8" && parts[0] === "detailed") {
    sectionName = "detailed-meaning";
    description = parts.slice(1).join("-");
  } else if (section === "4" && parts[0] === "story") {
    sectionName = "story";
    description = parts.slice(1).join("-");
  } else {
    sectionName = parts[0];
    description = parts.slice(1).join("-");
  }
  return {
    chapter: Number(chapter),
    verse: Number(verse),
    seq: Number(seq),
    section: Number(section),
    sectionName,
    description,
  };
}

function storageSlotFor(parsed, counters) {
  const { section, sectionName } = parsed;
  if (section === 3 || sectionName === "meaning") return "meaning";
  if (section === 4 || sectionName === "story") {
    counters.story += 1;
    return `story-${counters.story}`;
  }
  if (section === 5 || sectionName === "impact") return "modern-life";
  if (section === 7 || sectionName === "kids") {
    counters.kids += 1;
    return counters.kids === 1 ? "kids-explain" : "kids-story";
  }
  if (section === 8 || sectionName === "detailed") return "detailed-meaning";
  if (section === 10 || sectionName === "more-stories") {
    counters.more += 1;
    return `more-stories-${counters.more}`;
  }
  return null;
}

async function uploadFile(localPath, objectName) {
  const bucket = getStorage().bucket();
  const dest = bucket.file(objectName);
  const ext = extname(localPath).slice(1).toLowerCase();
  const contentType = ext === "png" ? "image/png" : "application/octet-stream";
  await new Promise((resolvePromise, reject) => {
    createReadStream(localPath)
      .pipe(
        dest.createWriteStream({
          metadata: { contentType, cacheControl: "public, max-age=31536000" },
          resumable: false,
        }),
      )
      .on("finish", resolvePromise)
      .on("error", reject);
  });
  await dest.makePublic();
  return publicUrl(objectName, BUCKET);
}

function jsonSlotKey(storageSlot) {
  if (storageSlot === "modern-life") return "modern_life";
  if (storageSlot === "kids-explain") return "kids_explain";
  if (storageSlot === "kids-story") return "kids_story";
  if (storageSlot === "detailed-meaning") return "detailed_meaning";
  if (storageSlot.startsWith("story-")) return "story";
  if (storageSlot.startsWith("more-stories-")) return "more_stories";
  return storageSlot;
}

function applyToVerse(verse, uploads, _chapter, _verseNum) {
  if (!verse.images) verse.images = {};

  for (const u of uploads) {
    const url = u.url;
    const key = jsonSlotKey(u.storageSlot);

    if (key === "story") {
      const idx = Number(u.storageSlot.split("-")[1]) - 1;
      if (!Array.isArray(verse.images.story)) verse.images.story = [];
      while (verse.images.story.length <= idx) verse.images.story.push({ url: "", caption: "" });
      const existing = verse.images.story[idx];
      verse.images.story[idx] = {
        url,
        caption: resolveCaption(existing?.caption, u.description),
      };
    } else if (key === "more_stories") {
      const idx = Number(u.storageSlot.split("-")[2]) - 1;
      if (!Array.isArray(verse.images.more_stories)) verse.images.more_stories = [];
      while (verse.images.more_stories.length <= idx)
        verse.images.more_stories.push({ url: "", caption: "" });
      const existing = verse.images.more_stories[idx];
      verse.images.more_stories[idx] = {
        url,
        caption: resolveCaption(existing?.caption, u.description),
      };
    } else {
      const existing = verse.images[key];
      verse.images[key] = {
        url,
        caption: resolveCaption(existing?.caption, u.description),
      };
    }
  }
}

function buildPlan(chapter, verse, absDir, kv) {
  const files = readdirSync(absDir)
    .filter((f) => /\.png$/i.test(f) && !f.includes("panel-summary"))
    .sort();

  const parsedList = files.map((f) => ({ file: f, parsed: parseFilename(f) })).filter((x) => x.parsed);
  parsedList.sort((a, b) => a.parsed.seq - b.parsed.seq);

  const counters = { story: 0, kids: 0, more: 0 };
  const plan = [];

  for (const { file, parsed } of parsedList) {
    if (parsed.chapter !== chapter || parsed.verse !== verse) continue;
    const storageSlot = storageSlotFor(parsed, counters);
    if (!storageSlot) {
      console.warn("Skip (unknown slot):", file);
      continue;
    }
    const version = nextVersionForSlot(kv ?? {}, chapter, verse, storageSlot);
    const objectName = versionedObjectName(chapter, verse, storageSlot, version);
    plan.push({
      file,
      localPath: resolve(absDir, file),
      storageSlot,
      objectName,
      version,
      description: parsed.description,
    });
  }

  return plan;
}

async function importVerseImages({ chapter, verse, absDir, dryRun, data }) {
  const ch = data?.chapters?.find((c) => c.chapter === chapter);
  const kv = ch?.key_verses?.find((v) => v.verse === verse) ?? {};
  if (data && !ch) throw new Error(`Chapter ${chapter} not found`);
  if (data && ch && !ch.key_verses.find((v) => v.verse === verse)) {
    throw new Error(`Verse ${chapter}.${verse} not found in key_verses`);
  }

  const plan = buildPlan(chapter, verse, absDir, kv);
  console.log(`\n=== ${chapter}.${verse} — ${plan.length} images ===`);
  for (const p of plan) {
    console.log(`  ${p.file} -> ${p.storageSlot} v${p.version} (${p.objectName})`);
  }
  if (plan.length === 0) {
    console.warn(`No images planned for ${chapter}.${verse} in ${absDir}`);
    return { chapter, verse, uploads: [] };
  }
  if (dryRun) return { chapter, verse, uploads: [] };

  const uploads = [];
  for (const p of plan) {
    const url = await uploadFile(p.localPath, p.objectName);
    uploads.push({ ...p, url });
    console.log("Uploaded:", p.storageSlot, `v${p.version}`, url);
  }

  applyToVerse(kv, uploads, chapter, verse);
  return { chapter, verse, uploads };
}

function discoverVerseDirs(chapter, rootAbs, verseFilter) {
  const entries = readdirSync(rootAbs);
  const dirs = [];
  for (const name of entries) {
    const full = resolve(rootAbs, name);
    if (!statSync(full).isDirectory()) continue;
    const m = name.match(/^(\d+)\.(\d+)$/);
    if (!m) continue;
    const ch = Number(m[1]);
    const v = Number(m[2]);
    if (ch !== chapter) continue;
    if (verseFilter && !verseFilter.includes(v)) continue;
    dirs.push({ verse: v, absDir: full });
  }
  dirs.sort((a, b) => a.verse - b.verse);
  return dirs;
}

function assertCredentials(dryRun) {
  if (dryRun) return;
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const defaultPath = resolve(ROOT, "sample-f6f12-0e67b9d712cf.json");
  const path = keyPath && existsSync(keyPath) ? keyPath : defaultPath;
  if (!existsSync(path)) {
    console.error(
      "Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS or place sample-f6f12-0e67b9d712cf.json at repo root.",
    );
    console.error("See docs/update-verse-images.md");
    process.exit(1);
  }
  if (!keyPath) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = path;
  }
}

function printUsage() {
  console.error(`Usage:
  Single shloka:
    node scripts/import-verse-images-from-drive.mjs --chapter <n> --verse <v> --dir <folder> [--dry-run]

  Chapter batch:
    node scripts/import-verse-images-from-drive.mjs --chapter <n> --root-dir <chapter-root> [--verses 19,20] [--dry-run]

See docs/update-verse-images.md`);
}

async function main() {
  const args = parseArgs(process.argv);
  const { chapter, verse, dir, rootDir, verses: verseFilter, dryRun } = args;

  if (!chapter) {
    printUsage();
    process.exit(1);
  }

  const batchMode = Boolean(rootDir);
  const singleMode = Boolean(dir && verse);

  if (batchMode === singleMode) {
    printUsage();
    process.exit(1);
  }

  if (singleMode) {
    const absDir = resolve(ROOT, dir);
    if (!existsSync(absDir)) {
      console.error(`Directory not found: ${absDir}`);
      process.exit(1);
    }
    const data = JSON.parse(readFileSync(GITA_PATH, "utf8"));
    assertCredentials(dryRun);
    if (!dryRun) initAdmin();
    await importVerseImages({ chapter, verse, absDir, dryRun, data });
    if (!dryRun) {
      writeFileSync(GITA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
      console.log(`Updated ${GITA_PATH} for ${chapter}.${verse}`);
    }
    return;
  }

  const rootAbs = resolve(ROOT, rootDir);
  if (!existsSync(rootAbs)) {
    console.error(`Root directory not found: ${rootAbs}`);
    process.exit(1);
  }

  const verseDirs = discoverVerseDirs(chapter, rootAbs, verseFilter);
  if (verseDirs.length === 0) {
    console.error(
      `No subfolders matching ${chapter}.<verse> under ${rootAbs}${verseFilter ? ` (filter: ${verseFilter.join(",")})` : ""}`,
    );
    process.exit(1);
  }

  console.log(
    `Batch: chapter ${chapter}, ${verseDirs.length} shloka(s): ${verseDirs.map((d) => d.verse).join(", ")}`,
  );

  const data = JSON.parse(readFileSync(GITA_PATH, "utf8"));
  assertCredentials(dryRun);
  if (!dryRun) initAdmin();

  const results = [];
  for (const { verse: v, absDir } of verseDirs) {
    const r = await importVerseImages({ chapter, verse: v, absDir, dryRun, data });
    results.push(r);
  }

  if (!dryRun) {
    writeFileSync(GITA_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
    const updated = results.filter((r) => r.uploads.length > 0).map((r) => `${r.chapter}.${r.verse}`);
    console.log(`\nUpdated ${GITA_PATH} for: ${updated.join(", ") || "(none)"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
