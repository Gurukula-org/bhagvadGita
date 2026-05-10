#!/usr/bin/env node
/**
 * Post–chapter-import audit for gitaData.json.
 * Mirrors VersePage parsing so counts and warnings match what the UI does.
 * Optionally verifies every `images.*.url` in scope: local files under `client/public`,
 * remote URLs via HTTP HEAD (200 / 3xx / 304).
 *
 * Usage:
 *   node scripts/audit-chapter-import.mjs --chapter=3
 *   node scripts/audit-chapter-import.mjs --all
 *   node scripts/audit-chapter-import.mjs --chapter=3 --strict   # warnings → exit 1
 *   node scripts/audit-chapter-import.mjs --chapter=3 --skip-images   # no network / local file checks
 *
 * See: docs/post-chapter-import-audit.md
 */

import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const GITA_PATH = path.join(ROOT, "client/src/data/gitaData.json");
const PUBLIC_DIR = path.join(ROOT, "client/public");

const HEAD_TIMEOUT_MS = 15000;
const REMOTE_CHECK_CONCURRENCY = 12;

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

/**
 * Collect image URL refs from a verse (same slots as `types/gita.ts` > Verse.images).
 * @param {number} chapterNum
 * @param {object} verse
 * @param {{ ch: number; v: number; slot: string; url: string }[]} out
 * @param {string[]} errors
 */
function collectImageRefs(chapterNum, verse, out, errors) {
  const v = verse.verse;
  const prefix = `Chapter ${chapterNum} verse ${v}`;
  const img = verse.images;
  if (!img) return;

  const push = (slot, url) => {
    if (url == null || typeof url !== "string") return;
    const u = url.trim();
    if (!u) return;
    if (!u.startsWith("/") && !u.startsWith("http://") && !u.startsWith("https://")) {
      errors.push(
        `${prefix}: images.${slot} — unsupported URL (use site path starting with / or https://): ${u.slice(0, 100)}${u.length > 100 ? "…" : ""}`,
      );
      return;
    }
    out.push({ ch: chapterNum, v, slot, url: u });
  };

  if (img.meaning?.url) push("meaning", img.meaning.url);
  if (img.detailed_meaning?.url) push("detailed_meaning", img.detailed_meaning.url);
  if (img.modern_life?.url) push("modern_life", img.modern_life.url);
  if (img.kids_explain?.url) push("kids_explain", img.kids_explain.url);
  if (img.kids_story?.url) push("kids_story", img.kids_story.url);
  if (img.grammar?.url) push("grammar", img.grammar.url);
  if (Array.isArray(img.story)) {
    img.story.forEach((s, i) => {
      if (s?.url) push(`story[${i}]`, s.url);
    });
  }
  if (Array.isArray(img.more_stories)) {
    img.more_stories.forEach((s, i) => {
      if (s?.url) push(`more_stories[${i}]`, s.url);
    });
  }
}

/** @returns {Promise<{ ok: boolean; detail?: string }>} */
function checkRemoteUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(
      url,
      { method: "HEAD", timeout: HEAD_TIMEOUT_MS },
      (res) => {
        const code = res.statusCode ?? 0;
        const ok = code === 200 || code === 301 || code === 302 || code === 304;
        res.resume();
        if (ok) resolve({ ok: true });
        else resolve({ ok: false, detail: `HTTP ${code}` });
      },
    );
    req.on("error", (e) => resolve({ ok: false, detail: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, detail: "timeout" });
    });
    req.end();
  });
}

function checkLocalPath(url) {
  const rel = url.startsWith("/") ? url.slice(1) : url;
  const disk = path.join(PUBLIC_DIR, rel);
  if (!fs.existsSync(disk)) {
    return { ok: false, detail: "file missing under client/public" };
  }
  return { ok: true };
}

/**
 * @param {Map<string, { ch: number; v: number; slot: string }[]>} byUrl
 * @param {string[]} errors
 */
async function auditImageUrls(byUrl, errors) {
  const entries = [...byUrl.entries()];
  const remote = [];
  for (const [url, refs] of entries) {
    if (url.startsWith("/")) {
      const r = checkLocalPath(url);
      if (!r.ok) {
        const locs = refs.map((x) => `${x.ch}.${x.v} ${x.slot}`).slice(0, 6);
        const more = refs.length > 6 ? ` (+${refs.length - 6} more)` : "";
        errors.push(`Image ${r.detail}: ${url}\n  Used in: ${locs.join("; ")}${more}`);
      }
    } else {
      remote.push([url, refs]);
    }
  }

  let idx = 0;
  async function worker() {
    while (idx < remote.length) {
      const i = idx++;
      const [url, refs] = remote[i];
      const r = await checkRemoteUrl(url);
      if (!r.ok) {
        const locs = refs.map((x) => `${x.ch}.${x.v} ${x.slot}`).slice(0, 6);
        const more = refs.length > 6 ? ` (+${refs.length - 6} more)` : "";
        errors.push(`Image not loadable (${r.detail}): ${url}\n  Used in: ${locs.join("; ")}${more}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(REMOTE_CHECK_CONCURRENCY, remote.length) }, () => worker()));
}

function parseArgs(argv) {
  let chapter = null;
  let all = false;
  let strict = false;
  let skipImages = false;
  for (const a of argv) {
    if (a === "--all") all = true;
    else if (a === "--strict") strict = true;
    else if (a === "--skip-images") skipImages = true;
    else if (a.startsWith("--chapter=")) chapter = parseInt(a.slice("--chapter=".length), 10);
  }
  return { chapter, all, strict, skipImages };
}

async function main() {
  const { chapter, all, strict, skipImages } = parseArgs(process.argv.slice(2));

  if (!all && (chapter == null || Number.isNaN(chapter))) {
    console.error(
      `Usage: node scripts/audit-chapter-import.mjs --chapter=<N> | --all [--strict] [--skip-images]`,
    );
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

  if (!skipImages) {
    /** @type {{ ch: number; v: number; slot: string; url: string }[]} */
    const imageRefs = [];
    for (const chNum of chaptersToRun) {
      const verses = getVerses(data, chNum);
      for (const verse of verses) {
        collectImageRefs(chNum, verse, imageRefs, errors);
      }
    }
    const byUrl = new Map();
    for (const ref of imageRefs) {
      if (!byUrl.has(ref.url)) byUrl.set(ref.url, []);
      byUrl.get(ref.url).push({ ch: ref.ch, v: ref.v, slot: ref.slot });
    }
    console.log(`Checking ${byUrl.size} unique image URL(s) (local files + HTTP HEAD for remote)…`);
    await auditImageUrls(byUrl, errors);
  } else {
    console.log("Skipping image URL checks (--skip-images).");
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

  const imgNote = skipImages ? " (images skipped)" : "";
  console.log(
    all
      ? `Audit OK (all chapters): 0 errors${warnings.length ? `, ${warnings.length} warning(s)` : ""}${imgNote}.`
      : `Audit OK (chapter ${chapter}): 0 errors${warnings.length ? `, ${warnings.length} warning(s)` : ""}${imgNote}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
