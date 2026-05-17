# CLAUDE.md — Bhagavad Gita App Instructions

## Project Overview

This is a **Bhagavad Gita Interactive Learning App** — a full-stack React + Express web app (Vite, TypeScript, Firebase). All verse content lives in a single JSON file:

```
client/src/data/gitaData.json
```

TypeScript types for the data are in:

```
client/src/types/gita.ts
```

**Local dev:** `.env.development` (optional) can set `VITE_DEV_VISIBLE_CHAPTERS` so the Home chapter grid matches what you are working on when `/api/chapter-visibility` is unavailable; production builds do not load this file. See `client/src/contexts/ChapterVisibilityContext.tsx`.

## Canonical chapter metadata + generated description

Chapter metadata now has a **single canonical source** in:

```
client/src/data/gitaData.json
```

Do not keep duplicate chapter title maps in app code (client or server). Chapter display fields must come from `chapters[]` (for example: `name`, `name_hindi`, `devanagari_name`, `iast_name`, `summary`, `generated_description`).

### Generated chapter description workflow

The chapter header synopsis is **persisted in JSON** via script, not generated in runtime UI code.

When adding a new chapter (or updating chapter key-verse one-line meanings), run:

```bash
npm run generate-chapter-descriptions
```

This script:
- Generates `generated_description` for each chapter from chapter verses.
- Syncs `iast_name` and `devanagari_name` chapter metadata.
- Writes updates back to `client/src/data/gitaData.json`.
- Supports scoped regeneration: `npm run generate-chapter-descriptions -- --chapter=<n>`.
- Is deterministic/idempotent for unchanged source data.

If `generated_description` is missing/empty during chapter retrieval, `ChapterPage` logs a developer warning and shows a dev-only on-page reminder to run the generator.

## SEO wave policy (traffic-first)

Use the following phased rollout model for SEO work:

1. **Wave 1 (quick wins)**: optimize existing chapter/verse/summary templates and technical SEO.
2. **Wave 2 (expansion)**: add problem-intent topic hubs and strengthen internal linking.
3. **Wave 3 (scale)**: long-tail expansion, localization strategy, and crawl/performance maturity.

Primary traffic focus is:
- USA first
- India second
- Other countries next

Priority pages:
- `client/src/pages/ChapterPage.tsx`
- `client/src/pages/VersePage.tsx`

## Keyword-intent mapping workflow

When applying keyword datasets:

1. Cluster keywords by intent:
   - chapter/verse lookup
   - anxiety/stress/mental peace
   - decision making/dharma
   - focus/productivity/karma yoga
   - bhakti/devotion/spirituality
2. Map each cluster to the right template:
   - chapter and verse pages first
   - then `/topics` and `/topics/:slug` hubs
3. Update metadata and headings with intent terms naturally (no stuffing).
4. Add internal links between topic hubs and related chapter/verse URLs.
5. Verify sitemap and meta consistency after updates.

Reference implementation files:
- `client/src/lib/seoKeywords.ts`
- `client/src/pages/TopicsPage.tsx`
- `client/src/pages/TopicHubPage.tsx`
- `server/seo.ts`

### SEO route-status and indexing hygiene

- Keep admin pages functional (HTTP 200) while non-indexable:
  - `/login`
  - `/settings`
  - `/settings/images`
- These pages should always return `noindex, nofollow` metadata.
- Unknown routes should return true HTTP 404 status from server rendering logic.

### Topic hub source-of-truth rule

- Topic slugs are defined canonically in `client/src/lib/seoKeywords.ts` (`TOPIC_HUBS`).
- Each hub’s **Suggested verses** list is curated via `TOPIC_HUBS[].suggestedVerses` (`{ chapter, verse }`), so life-topic pages do not all show the same default slice of verses.
- **New chapter rollout:** whenever a chapter gains (or updates) rich verse copy, remap affected `suggestedVerses` using each verse’s **`meaning_detail`**, **`reflection`**, and **`detailed_meaning`** in `gitaData.json` (not title-only or first-verse defaults). Overlap across hubs is fine when the fit is genuine. Full step list: `docs/new-chapter-rollout-checklist.md` (sections 3–4).
- Server SEO code (`server/seo.ts`) must validate `/topics/:slug` against `TOPIC_HUBS` (not regex-only allow).
- Sitemap topic entries must be generated from `TOPIC_HUBS` (no hardcoded topic URL list).

The UI that renders verse content is in:

```
client/src/pages/VersePage.tsx
```

The home page (hero, chapter cards, feature chips / dialogs) is in:

```
client/src/pages/Home.tsx
client/src/data/heroFeatureLabels.json
```

Edit `heroFeatureLabels.json` to change chip labels, descriptions, and chip styling tokens (`chipClass`) without touching layout logic in `Home.tsx` unless needed.

**Chapter-level synopses** (long-form summaries with optional images, separate from `gitaData.json` verses) use:

```
client/src/data/chapterSummaries.json
client/src/pages/ChapterSummaryPage.tsx
client/src/lib/chapterHeroImage.ts
client/public/chapter-summaries/
```

## Chapter summaries (Drive-backed)

These are **not** stored inside `gitaData.json`. They are imported from editorial sources (e.g. Google Drive) into JSON and ship with static images under `client/public/`.

### Files and responsibilities

| Piece | Path |
|-------|------|
| Data | `client/src/data/chapterSummaries.json` — object keyed by chapter number as a string (`"12"`, …). Prefer the **block** format: `content` array of `{ type: "h2" \| "p" \| "img", text?: string, src?: string }`, optional `sourceDoc`. A legacy `sections` shape is still supported by the page. |
| Page | `client/src/pages/ChapterSummaryPage.tsx` — renders blocks, hero, breadcrumbs, fallback when no JSON entry exists (points to the import doc). |
| Hero image helper | `client/src/lib/chapterHeroImage.ts` — `getChapterHeroImageUrl` for SEO/header (uses verse thumbnails where available). |
| Public images | `client/public/chapter-summaries/*.png` — reference in JSON as site-root paths, e.g. `/chapter-summaries/ch12-synopsis-img01.png`. Vite serves `client/public` from `/` in dev and copies it into `dist/public` on build. |
| Import / provenance | `scripts/import-chapter-synopsis.md` — workflow for turning Drive exports into JSON + assets. Optional source binaries under `docs/source/` (e.g. synopsis `.docx`). Drive naming aligns with folders like `chapter0012` and synopsis filenames. |

### Routing and SEO (do not regress)

- **`client/src/App.tsx`**: Import `ChapterSummaryPage` (not a duplicate summary component). Register **`/chapter/:chapterNum/summary` before `/chapter/:chapterNum`** — in wouter, the first matching route wins; the generic chapter route must come last among chapter routes.
- **`client/src/pages/ChapterPage.tsx`**: Keep the chapter-summary CTA link to `/chapter/${chapterNum}/summary` so every chapter can open the summary route (rich content when present, friendly fallback otherwise).
- **`server/seo.ts`**: Keep `summaryMatch` for `/chapter/(\\d+)/summary` in `getMetaForUrl`, and include **`/chapter/{n}/summary` in the sitemap** for each chapter (not gated on optional `synopsis_content` in `gitaData`).

There must be **one** summary implementation: **`ChapterSummaryPage` + `chapterSummaries.json`**. Do not revive a separate page that only reads `synopsis_content` from `gitaData` without the JSON pipeline.

### Images for chapter summaries

- Unlike Firebase-backed verse images, synopsis illustrations are **checked into** `client/public/chapter-summaries/`. Do not invent URLs; add real files and reference them in `chapterSummaries.json`.

## Update verse section images (Drive PNGs → GCS → gitaData.json) — user prompt only

**Not implicit in chapter import.** New chapter import already generates per-tab images from doc prompts and uploads to GCS (`docs/new-chapter-content-import.md` §8). Use the workflow below **only** when the user explicitly asks to update/replace images with finished Drive PNGs.

When the user asks to **update verse tab images**, import illustrations from Drive, or refresh cached CDN images for specific shlokas:

1. Follow **`docs/update-verse-images.md`** (canonical runbook).
2. **Gate:** confirm **chapter number** and **verse list** before any download or upload.
3. **Drive root:** [Bhagavad Gita Journey Content](https://drive.google.com/drive/folders/12eaLMBMDFMOwgMhtLtLi3NP6gHRuQEXq) → `chapter00NN/images/<N>.<V>/` (e.g. chapter `3`, verse `20` → `chapter0003/images/3.20/`). Finished PNGs live under `images/` only (prose/audio docs sit at the chapter folder root).
4. **Download** with `gdown` into `.cache/chapter-import/` (gitignored). Local `--root-dir` must be the folder whose **direct children** are `3.19`, `3.20`, … (the `images/` directory), not `chapter0003` itself.
5. **Credentials:** repo-root `sample-f6f12-0e67b9d712cf.json` (gitignored). Cursor may `@sample-f6f12-0e67b9d712cf.json` for path context only — never paste key material into chat, markdown, or commits.

   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="${PWD}/sample-f6f12-0e67b9d712cf.json"
   test -f "$GOOGLE_APPLICATION_CREDENTIALS"
   ```

6. **MUST** run the importer (versioned CDN busting + JSON update). Do not hand-edit Storage URLs or overwrite an existing object path in place.

   ```bash
   npm run import-verse-images -- \
     --chapter 3 \
     --root-dir .cache/chapter-import/ch3-images-drive \
     --verses 19,20,21
   ```

   - Script: `scripts/import-verse-images-from-drive.mjs` (version logic: `scripts/lib/verse-image-version.mjs`).
   - Each upload uses a **new** object name: `ch<N>v<V>-<slot>-v<version>.png` (legacy unversioned URL in JSON → next import is `-v2`, then `-v3`, …).
   - Optional: `--dry-run` first to print the plan without uploading.
   - Updates `images.*.url` and `images.*.caption` only — **not** `story`, `more_stories`, or other prose.
7. After import: `npm run check` and `npm run audit-chapter-import -- --chapter=<N>` when online.

## New chapter content import (Drive → app)

When the user provides a new chapter's shloka Word docs + MP3s in Drive, follow the dedicated workflow in **`docs/new-chapter-content-import.md`**. After verses land in JSON, run **`npm run audit-chapter-import -- --chapter=<N>`** per **`docs/post-chapter-import-audit.md`**.

That doc enforces three things this main file deliberately delegates:

- The **gate question** ("Which chapter?") before any download, parse, or edit.
- **Per-shloka, per-image idempotency** so already-built shlokas/images are never redone during import (§8 generates from doc prompts). **Replace with Drive PNGs** only when the user explicitly requests it — then use **`docs/update-verse-images.md`** (`-vN` bump, not overwrite).
- The **Chapter 12 image model** (slot keys, Storage paths, caption→image alignment) and **in-import image generation** from doc `Prompt:` strings (§8 — not `import-verse-images`).
- Post-import verification including **image loadability checks** (`/images/...` existence under `client/public` + HTTP HEAD for remote URLs). Use `--skip-images` only when offline.

Important context the workflow relies on:

- `client/src/data/gitaData.json` already contains a **chapter-card scaffold** (name, subtitle, summary, theme, color, icon, iast_name, devanagari_name, placeholder generated_description) for **all 18 chapters**. **Chapters 3 and 12** currently have **full gold-standard** `key_verses` for every verse in those chapters’ curated lists; other chapters may still use sparse stubs until imported. Re-scan the file before assuming only one chapter is “done.” A new chapter import is purely a `key_verses` population task and must NOT rewrite the scaffold (only `iast_name`, `devanagari_name`, `generated_description` may be regenerated, and only via `npm run generate-chapter-descriptions -- --chapter=<n>`).
- Runtime data sinks are fixed: verse content → `gitaData.json`; audio → `gs://sample-f6f12.appspot.com/bhagvad-gita/audio/ch<n>/<n>.<v>.mp3`; verse images → `gs://sample-f6f12.appspot.com/bhagvad-gita/images/ch<n>/v<v>/ch<n>v<v>-<slot>-v<version>.png` (increment version on replace — see **`docs/update-verse-images.md`**). No new permanent local shloka files anywhere else.
- SEO, sitemap, and `/topics/...` "Gita by life situation" wiring is covered end-to-end in `docs/new-chapter-content-import.md` §10. `docs/new-chapter-rollout-checklist.md` remains reference-only for new-topic-hub creation and chapter-synopsis flows.

## Fix New Issue (Google Sheets)

**Master issue list (canonical):**  
[https://docs.google.com/spreadsheets/d/1cCdjUu3Vx6i8NHewUy6OktW-b3fzPv0TpK_MStzuy_o/edit?gid=0#gid=0](https://docs.google.com/spreadsheets/d/1cCdjUu3Vx6i8NHewUy6OktW-b3fzPv0TpK_MStzuy_o/edit?gid=0#gid=0)

When the user says **Fix New Issue** (same intent, any reasonable casing):

1. **Always fetch the latest sheet live from Google first** (canonical URL above) and read the issue list (Status column). Do **not** rely on previously downloaded/local copies if live fetch is available.
2. **Work only on rows** whose status is **New Issue** or **Not Fixed** (match the sheet’s labels).
3. **Skip** rows whose status is **Completed** (or clearly equivalent “done” state).
4. Implement fixes **in sheet order** unless the user specifies otherwise.
5. **Do not** add repo-local Excel files, npm scripts, or dependencies for this workflow. If the live sheet is not fetchable, use a **user-provided export** or pasted rows as fallback.
6. After fixing, the user may mark rows **Completed** in the sheet (the repo does not store sheet edits).

Cursor agents may also load `.cursor/rules/fix-new-issue.mdc` when it exists locally; it is **not** checked into this repo (unlike `.cursor/rules/post-chapter-import-audit.mdc`). This `CLAUDE.md` section is the canonical description for all contributors.

## Your Task

**Populate the next verse with rich content, following the Chapter 12 Verse 1 gold standard.**

**Chapters 3 and 12:** every `key_verse` in `gitaData.json` is fully enriched (same field set as the template). **Other chapters** still have sparse `key_verses` (basic fields only) until you fill them. Your job is to bring the **next** verse up to that depth (see scan steps below).

### How to determine which verse to work on

1. Open `client/src/data/gitaData.json`.
2. Walk `chapters` in **chapter order** (ascending `chapter`). Within each chapter, consider `key_verses` in **verse number order**.
3. The **next** verse to enrich is the first `key_verse` missing **any** of: `meaning_detail`, `kids_content`, `detailed_meaning`, `more_stories`, `rich_grammar`.
4. Also check `chapter6_full[]` for Chapter 6: those entries still need the rich fields (and Chapter 6–specific conversion rules below).
5. If the user specifies a verse (e.g., "do 12.2" or "enrich 2.11"), work on that one instead.
6. Re-scan the file before editing—another commit may have filled the next gap.

### Reference verse (gold standard)

Use **Chapter 12 Verse 1** as the structural reference: in `gitaData.json`, find the chapter block with `"chapter": 12`, then the `key_verses` entry with `"verse": 1`. Do not rely on fixed line numbers; they shift as JSON grows.

## Content Schema — The Gold Standard

Every fully populated verse MUST have ALL of these fields. Use **Chapter 12 Verse 1** in `gitaData.json` as your reference (see above).

### Required Fields

```typescript
{
  "verse": number,              // verse number
  "chapter": number,            // chapter number
  "title": string,              // short evocative title (e.g., "The Question of Two Paths")
  "sanskrit": string,           // Devanagari śloka; closing ॥ on the last line (see editorial convention above)
  "transliteration": string,    // IAST transliteration with diacritics
  "one_line_meaning": string,   // single sentence English meaning
  "concise_journey": string,    // 2-3 sentence summary paragraph
  "meaning_detail": string,     // 2-4 paragraphs of detailed explanation (use \n\n between paragraphs)
  "story": string,              // a story from Mahabharata/Ramayana/Puranas illustrating the verse (3-5 paragraphs)
  "real_life_example": string,  // modern life application (2-3 paragraphs)
  "reflection": string,         // 2-3 contemplation questions (separated by \n)
  "kids_content": {
    "explanation_script": string,  // explain to a 6-10 year old (simple, friendly)
    "story": string,               // a simple parable/story a child can understand
    "reflection": string           // 2-3 questions for kids (separated by \n)
  },
  "detailed_meaning": string,   // step-by-step breakdown (Step 1, Step 2, etc.)
  "more_stories": string,       // 2-3 numbered stories: "1. Story Title\nBody...\n\n2. Story Title\nBody..."
  "rich_grammar": {
    "padacchedah": string,       // word separation in Devanagari
    "pratipadarthah": string,    // word meanings: "word1 = meaning1 | word2 = meaning2 | ..."
    "anvayah": string,           // prose order reconstruction in Devanagari
    "sandhi": string,            // sandhi analysis: "word1 + word2 → combined | ..." (pipe-separated)
    "samasa": string,            // compound word analysis (pipe-separated)
    "other": string              // other grammar notes (pipe-separated)
  },
  "final_takeaway": string      // 2-3 sentence takeaway
}
```

### Optional Fields (add when applicable)

```typescript
{
  "audio_url": string,          // only if audio file exists in Firebase Storage
  "images": { ... }             // only if images exist — DO NOT fabricate image URLs
}
```

### Important Rules for Images

- **DO NOT** create or fabricate image URLs
- **DO NOT** add the `images` field unless real images already exist
- **Batch upload from Drive:** use **`npm run import-verse-images`** per **`docs/update-verse-images.md`** (not manual URL edits). Admin UI upload is an alternative for single slots.
- Leave the `images` field out entirely for new verses until real assets exist
- **Replacing art:** always bump GCS object version (`-v2`, `-v3`, …) via the importer — never reuse the same Storage path (CDN cache)

## Content Quality Guidelines

### Sanskrit & Transliteration
- Sanskrit MUST be accurate Devanagari. Follow the **in-repo convention**: do not paste `॥ch.v॥`-style labels on every line; the śloka closes with `॥` on the **last** line only (see existing Chapter 12 entries).
- IAST transliteration MUST use proper diacritical marks: ā, ī, ū, ṛ, ṭ, ḍ, ṇ, ś, ṣ, ṁ, ḥ
- Use `|` for half-verse break and `||` for full verse break in transliteration
- **Display:** `VersePage` strips trailing `chapter.verse॥` fragments from each transliteration line via `client/src/lib/transliterationDisplay.ts` so the visible IAST matches the Sanskrit line breaks without duplicating verse numbers on every line

### meaning_detail
- 2-4 substantive paragraphs separated by `\n\n`
- Explain the philosophical context, what Arjuna/Krishna is saying, and why it matters
- Reference previous chapters/verses for continuity

### story
- Use authentic stories from Mahabharata, Ramayana, Puranas, or Upanishads
- 3-5 paragraphs with narrative flow
- End with connection to the verse's teaching

### real_life_example
- Modern, relatable scenario (school, work, family, daily life)
- Show how the verse's teaching applies practically
- 2-3 paragraphs

### kids_content
- `explanation_script`: talk directly to the child ("You know how..."), use simple words
- `story`: a simple parable with concrete imagery (animals, children, everyday objects)
- `reflection`: 2-3 simple questions a child can think about

### detailed_meaning
- Format: "Step 1 — Topic (Sanskrit phrase):\nExplanation...\n\nStep 2 — ..."
- 4-6 steps breaking down each part of the verse
- Include Sanskrit terms with English explanations

### more_stories
- Format: "1. Story Title\nStory body...\n\n2. Story Title\nStory body..."
- 2-3 stories from different traditions (Panchatantra, saints' lives, Upanishadic insights)
- Each story should illustrate the verse from a different angle

### rich_grammar
- `padacchedah`: split compound words, show each word separately in Devanagari
- Optional **`padaparicayah`**: array of `{ word, anta, linga, vibhakti, vacanam, type, dhatu, lakara }` when the source supplies full pada analysis (Chapter 12 pattern); see `docs/new-chapter-content-import.md` and Ch12 verses in `gitaData.json`.
- `pratipadarthah`: pipe-separated word-by-word meanings: `"word = meaning | word = meaning"`
- `anvayah`: reconstruct the verse in prose word order (Devanagari)
- `sandhi`: show phonetic combinations: `"word + word → combined"` (pipe-separated)
- `samasa`: identify compound types: `"compound → type"` (pipe-separated)
- `other`: verb forms, participles, etc. (pipe-separated)

## How to Edit gitaData.json

1. **Find the target verse** in the `chapters[].key_verses[]` array (or `chapter6_full[]`)
2. **If the verse exists** with basic fields, REPLACE it with the full rich version
3. **If the verse doesn't exist** as a key_verse, ADD it to the appropriate chapter's `key_verses` array in verse-number order
4. **Preserve all other data** — do not modify any other verses or chapters
5. **Validate JSON** — ensure the file is valid JSON after editing

### Bulk transliteration cleanup

To strip trailing `chapter.verse॥` suffixes from **all** `transliteration` fields in `key_verses` and `chapter6_full` (after a bad import or paste), from the repo root:

```bash
npm run strip-translit
```

This runs `scripts/strip-transliteration-json.mjs`. Review the diff before committing.

### For Chapter 6 Conversion

Chapter 6 verses already have `full_journey_text` and `grammar_notes` as flat text. When enriching these:
- Keep `full_journey_text` as-is (the UI renders it)
- ALSO add the new rich fields (`meaning_detail`, `kids_content`, `detailed_meaning`, `more_stories`, `rich_grammar`)
- Convert `grammar_notes` content into the structured `rich_grammar` format
- The `rich_grammar` structured format takes precedence in the UI over `grammar_notes`

## Reference Sources for Content

Use these authoritative sources for Bhagavad Gita content:
- Swami Paramarthananda's commentaries (Advaita Vedanta tradition)
- Adi Shankaracharya's Bhashya
- Swami Mukundananda's commentary (holy-bhagavad-gita.org)
- Swami Chinmayananda's commentary
- Mahabharata stories from Vyasa's original text

## Build & Verify

From the project root, after editing `gitaData.json`, `chapterSummaries.json`, or TypeScript:

```bash
# if chapter metadata / one_line_meaning changed
npm run generate-chapter-descriptions

npm run check
npm run build
```

This validates TypeScript and ensures JSON bundles correctly. Fix any errors before committing. After changing chapter summary images, confirm `/chapter/<n>/summary` in dev or preview and that image paths under `/chapter-summaries/` load.

Other useful scripts: `npm run strip-translit` (see above), `npm run generate-chapter-descriptions`, `npm run import-verse-images` (Drive PNGs → versioned GCS + `gitaData.json`; see `docs/update-verse-images.md`), `npm run audit-chapter-import` (after chapter JSON landings; see `docs/post-chapter-import-audit.md`), `npm run format` (Prettier).

### Verse page interaction notes (do not regress)

- `VersePage` keeps the active tab in the URL query (`?tab=<id>`) so reload restores the same tab.
- Prev/Next shloka navigation preserves the current tab in the target URL when possible.
- If the target verse does not support that tab, `VersePage` falls back to `meaning` and normalizes the URL.
- On verse change, keep the user at the top header area; do not auto-scroll down to the tab strip.

## Commit Convention

```
Add rich content for Chapter X Verse Y

Populate verse X.Y with detailed meaning, stories, kids content,
grammar analysis, and reflection following the Ch12.1 template.
```

Chapter summary / synopsis changes (JSON, `ChapterSummaryPage`, `public/chapter-summaries`, import docs):

```
Add chapter N synopsis to chapterSummaries.json

Import Drive-backed blocks and images; update chapterHeroImage if needed.
```
