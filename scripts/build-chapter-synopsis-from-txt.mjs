#!/usr/bin/env node
/**
 * Build chapterSummaries.json entry from extracted synopsis .txt
 * Usage: node scripts/build-chapter-synopsis-from-txt.mjs --chapter 3 --txt .cache/.../chapter0003-synopsis.txt
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GITA_SUMMARIES = resolve(ROOT, "client/src/data/chapterSummaries.json");

function parseArgs(argv) {
  const out = { chapter: null, txt: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--chapter") out.chapter = Number(argv[++i]);
    else if (argv[i] === "--txt") out.txt = argv[++i];
  }
  return out;
}

/** placement paragraph → image index (from doc Image Prompts section) */
const CH3_IMAGE_AFTER = {
  2: 1,
  8: 2,
  19: 3,
  29: 4,
  24: 5,
  33: 6,
  38: 7,
  40: 8,
  43: 9,
  49: 10,
};

function getImageMap(chapter) {
  if (chapter === 3) return CH3_IMAGE_AFTER;
  throw new Error(`No image placement map for chapter ${chapter}`);
}

function isH2Line(line) {
  if (line.startsWith("Paragraph ")) return false;
  if (line.startsWith("Image ")) return false;
  if (/^Prompt:/i.test(line)) return false;
  if (/^Placement:/i.test(line)) return false;
  if (line === "Image Prompts") return false;
  if (/^Chapter \d+ Synopsis$/i.test(line)) return false;
  return true;
}

function parseSynopsisText(text, chapter) {
  const imageAfter = getImageMap(chapter);
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const content = [];
  let inImageSection = false;

  for (const line of lines) {
    if (line === "Image Prompts" || line.startsWith("Image 1")) {
      inImageSection = true;
      break;
    }
    if (/^Chapter \d+ Synopsis$/i.test(line)) continue;

    const pm = line.match(/^Paragraph (\d+)\s*(.*)$/u);
    if (pm) {
      const n = Number(pm[1]);
      let body = pm[2].replace(/\u2028/g, " ").trim();
      if (body) content.push({ type: "p", text: body });
      if (imageAfter[n]) {
        const idx = imageAfter[n];
        content.push({
          type: "img",
          src: `/chapter-summaries/ch${chapter}-synopsis-img${String(idx).padStart(2, "0")}.png`,
        });
      }
      continue;
    }

    if (isH2Line(line)) {
      content.push({ type: "h2", text: line });
    }
  }

  return {
    sourceDoc: `chapter${String(chapter).padStart(4, "0")} Synopsis (Google Drive)`,
    content,
  };
}

const { chapter, txt } = parseArgs(process.argv);
if (!chapter || !txt) {
  console.error("Usage: node scripts/build-chapter-synopsis-from-txt.mjs --chapter 3 --txt <path>");
  process.exit(1);
}

const absTxt = resolve(ROOT, txt);
const text = readFileSync(absTxt, "utf8");
const entry = parseSynopsisText(text, chapter);

const all = JSON.parse(readFileSync(GITA_SUMMARIES, "utf8"));
all[String(chapter)] = entry;
writeFileSync(GITA_SUMMARIES, JSON.stringify(all, null, 2) + "\n", "utf8");

console.log(`Wrote chapter ${chapter}: ${entry.content.length} blocks`);
console.log(`Images: ${entry.content.filter((b) => b.type === "img").length}`);
