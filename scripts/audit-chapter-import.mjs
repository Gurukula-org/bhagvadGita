#!/usr/bin/env node
/**
 * Post–chapter-import audit for gitaData.json.
 * Mirrors VersePage parsing so counts and warnings match what the UI does.
 *
 * Usage:
 *   node scripts/audit-chapter-import.mjs --chapter=3
 *   node scripts/audit-chapter-import.mjs --all
 *   node scripts/audit-chapter-import.mjs --chapter=3 --strict   # warnings → exit 1
 *
 * See: docs/post-chapter-import-audit.md
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GITA_PATH = path.join(ROOT, "client/src/data/gitaData.json");

/** Same rules as VersePage.tsx `parseMoreStories` */
function parseMoreStories(text) {
  if (!text) return [];
  const stories = [];
  const lines = text.split("\n");
  let current = null;
  for (const line of lines) {
    if (/^\d+\.\s/.test(line) && line.length < 120) {
      if (current) stories.push(current);
      current = { title: line.replace(/^\d+\.\s*/, "").trim(), body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  if (current) stories.push(current);
  return stories;
}

/** Same as VersePage.tsx `splitLeadingAndTakeawayParagraphs` */
function splitLeadingAndTakeawayParagraphs(text) {
  const normalized = text.trim();
  if (!normalized) return { lead: "", takeaway: null };

  const doubleBreakParts = normalized
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (doubleBreakParts.length >= 2) {
    const takeaway = doubleBreakParts[doubleBreakParts.length - 1];
    const lead = doubleBreakParts.slice(0, -1).join("\n\n");
    return { lead, takeaway };
  }

  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    const takeaway = lines[lines.length - 1];
    const lead = lines.slice(0, -1).join("\n");
    return { lead, takeaway };
  }

  return { lead: normalized, takeaway: null };
}

function getVerses(data, chapterNum) {
  const ch = data.chapters?.find((c) => c.chapter === chapterNum);
  if (!ch) return [];
  if (chapterNum === 6 && Array.isArray(data.chapter6_full) && data.chapter6_full.length > 0) {
    return data.chapter6_full;
  }
  return ch.key_verses || [];
}

function warnIfTakeawaySwallowsNarrative(warnings, prefix, label, body) {
  if (!body?.trim()) return;
  const { lead, takeaway } = splitLeadingAndTakeawayParagraphs(body);
  if (takeaway != null && lead.length < 280 && takeaway.length > 850) {
    warnings.push(
      `${prefix} ${label}: "Connection to this shloka" callout will show a very long block (${takeaway.length} chars) while the lead narrative is short (${lead.length} chars). Usually an early \\n\\n split — use single \\n between story paragraphs and reserve \\n\\n for the short closing moral only (see Ch 3.6 crane fix).`,
    );
  }
}

function auditVerse(chapterNum, verse, errors, warnings) {
  const v = verse.verse;
  const prefix = `Chapter ${chapterNum} verse ${v}`;

  if (verse.more_stories) {
    const parsed = parseMoreStories(verse.more_stories);
    const nImg = (verse.images?.more_stories || []).length;
    if (nImg > 0 && parsed.length !== nImg) {
      errors.push(
        `${prefix}: more_stories — parsed ${parsed.length} titled segment(s) but images.more_stories has ${nImg} (UI pairs by index; fix numbering or image list).`,
      );
    }

    for (const story of parsed) {
      const bodyLines = story.body.split("\n");
      for (const line of bodyLines) {
        const t = line.trim();
        if (/^\d+\.\s/.test(t) && t.length < 120) {
          warnings.push(
            `${prefix} more_stories "${story.title.slice(0, 50)}…": body contains a line that looks like a numbered story header (${t.slice(0, 70)}…). Dialogue like "4. The fish asked…" breaks the parser — remove the number or reword.`,
          );
        }
      }

      warnIfTakeawaySwallowsNarrative(
        warnings,
        prefix,
        `more_stories "${story.title.slice(0, 50)}…"`,
        story.body,
      );
    }
  }

  if (verse.story) {
    warnIfTakeawaySwallowsNarrative(warnings, prefix, "main story", verse.story);
  }
}

function parseArgs(argv) {
  let chapter = null;
  let all = false;
  let strict = false;
  for (const a of argv) {
    if (a === "--all") all = true;
    else if (a === "--strict") strict = true;
    else if (a.startsWith("--chapter=")) chapter = parseInt(a.slice("--chapter=".length), 10);
  }
  return { chapter, all, strict };
}

function main() {
  const { chapter, all, strict } = parseArgs(process.argv.slice(2));

  if (!all && (chapter == null || Number.isNaN(chapter))) {
    console.error(`Usage: node scripts/audit-chapter-import.mjs --chapter=<N> | --all [--strict]`);
    process.exit(1);
  }

  const raw = fs.readFileSync(GITA_PATH, "utf8");
  const data = JSON.parse(raw);

  const chaptersToRun = all
    ? (data.chapters || []).map((c) => c.chapter).sort((a, b) => a - b)
    : [chapter];

  const errors = [];
  const warnings = [];

  for (const chNum of chaptersToRun) {
    const verses = getVerses(data, chNum);
    for (const verse of verses) {
      auditVerse(chNum, verse, errors, warnings);
    }
  }

  for (const w of warnings) console.warn("WARN:", w);
  for (const e of errors) console.error("ERROR:", e);

  if (errors.length) {
    console.error(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
    process.exit(1);
  }
  if (strict && warnings.length) {
    console.error(`\n--strict: ${warnings.length} warning(s) treated as failure.`);
    process.exit(1);
  }

  console.log(
    all
      ? `Audit OK (all chapters): 0 errors${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`
      : `Audit OK (chapter ${chapter}): 0 errors${warnings.length ? `, ${warnings.length} warning(s)` : ""}.`,
  );
}

main();
