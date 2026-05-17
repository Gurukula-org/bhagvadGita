# New Chapter Content Import — Drive → App

Use this checklist whenever a new chapter's **shloka Word documents** and **MP3 audio files** are dropped into the Bhagavad Gītā Drive folder. It is the operational counterpart to `docs/new-chapter-rollout-checklist.md`: this file covers **bringing content in**; the rollout checklist is now reference-only for the post-import wiring (most of which is folded into §10 below).

> Companion docs:
>
> - Verse schema + "gold standard" → `CLAUDE.md` ("Content Schema — The Gold Standard") and Ch12 V1 in `client/src/data/gitaData.json`.
> - Chapter-level synopsis import (long-form summary, not verses) → `scripts/import-chapter-synopsis.md`.
> - Post-content rollout (general / new-hub creation) → `docs/new-chapter-rollout-checklist.md`.
> - Post–JSON audit (`more_stories` vs images, takeaway formatting) → `docs/post-chapter-import-audit.md`.

---

## 0. Hard gate — ALWAYS ask first

> **If the user has not given an explicit chapter number, the agent MUST stop and ask:**
> _"Which chapter do you want me to import?"_
>
> Do **not** start fetching, parsing, generating images, or editing any file until a single chapter number is confirmed. Never import multiple chapters in one run unless the user explicitly lists them.

After the user answers, repeat back: _"I will import only Chapter `<N>`. I will not modify any other chapter."_

## 1. Source of truth

- **Drive root:** https://drive.google.com/drive/folders/12eaLMBMDFMOwgMhtLtLi3NP6gHRuQEXq
- **Per-chapter subfolder:** `chapter00NN/` (four-digit zero-padded), e.g. `chapter0003`.
- **Per-shloka files inside that subfolder:**
  - Verse content Word doc named `N.V` (e.g. `3.1`, `3.2`, …).
  - Verse audio file named `N.V.mp3`.
  - Optional images companion doc named `N.V images` (Ch12 convention) containing explicit `Prompt:` + `Caption:` + section assignment for each generated illustration.
  - Optional `chapter00NN Synopsis` (chapter-level synopsis — handled by `scripts/import-chapter-synopsis.md`, not this doc).

## 2. Local cache (download/parse scratchpad ONLY — never committed, never read at runtime)

**Hard rules:**

- The agent MUST NOT create any permanent local file containing shloka prose, transliteration, audio, or images outside the three runtime sinks listed below.
- The runtime data plane is fixed:
  - **Verse content** → only `client/src/data/gitaData.json`.
  - **Audio** → only `gs://sample-f6f12.appspot.com/bhagvad-gita/audio/...`.
  - **Verse images** → only `gs://sample-f6f12.appspot.com/bhagvad-gita/images/...`. The existing `client/public/images/ch12/v1/` mirror is **frozen** at its current contents — do not extend that pattern to new chapters.
  - **Chapter synopsis images** (separate flow — see `scripts/import-chapter-synopsis.md`) are the only shloka-adjacent assets that live under `client/public/chapter-summaries/`.
- Drive downloads, doc text extracts, and parsed verse JSON used during an import are **temporary scratchpad** and live under:

  ```
  .cache/chapter-import/ch<N>/
    raw/                  # original Drive downloads
      3.1.docx
      3.1.mp3
      3.1 images.docx
      ...
    parsed/               # JSON the agent produced from the doc
      3.1.json            # full verse object matching types/gita.ts > Verse
      3.1.images.json     # ordered image prompts + slot assignments + captions
    status.json           # per-shloka status snapshot (see §3)
  ```

  This path is already covered by the repo's `.gitignore` (`.cache` and `.cache/` are matched on lines 85 and 95). The agent must verify this before writing.

- After a successful import, the agent should print a one-line note: _"Cache at `.cache/chapter-import/ch<N>/` is safe to delete — content is now sourced from `gitaData.json` and GCP."_ The cache exists only so a re-run knows what's already been done; it is never required at runtime.
- Do **not** introduce new top-level files like `chapter3.txt`, `shlokas.json`, `verse-source.md`, etc. There is exactly one source of truth per data type, and that's stated above.

Re-use rules:

- If `parsed/N.V.json` already exists and matches the latest doc's mtime/hash, **do not re-parse** the docx. Reuse the cached JSON.
- If `raw/N.V.docx` already exists with the same Drive `modifiedTime`, **do not re-download**.
- The agent must update `status.json` after every action so a future session can resume without re-doing work.

## 3. Pre-flight inventory (BEFORE downloading or generating anything)

Before any download or edit, build a per-shloka status grid for chapter `<N>`. The chapter-card scaffold (name, subtitle, summary, theme, color, icon, iast_name, devanagari_name, placeholder generated_description) **already exists for all 18 chapters** as part of the original app scaffolding — so a new chapter import is purely a **`key_verses` population** task plus the hub/SEO follow-ups in §10. The import must NOT rewrite the scaffold (see §6).

Build the status grid from three sources:

| Status field        | Source                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `inJson`            | `key_verses[]` in `client/src/data/gitaData.json` for chapter `<N>` (and `chapter6_full[]` if `<N>` == 6)                           |
| `richFields`        | true only if every required field in CLAUDE.md's gold standard is non-empty for that verse                                          |
| `audioInJson`       | `audio_url` present and resolves under `bhagvad-gita/audio/ch<N>/<N>.<V>.mp3`                                                       |
| `imagesInJson`      | `images.{meaning, story[], modern_life, kids_explain, kids_story, detailed_meaning, more_stories[], grammar}` populated as expected |
| `docInDrive`        | shloka's `N.V` Word doc exists in Drive                                                                                             |
| `audioInDrive`      | shloka's `N.V.mp3` exists in Drive                                                                                                  |
| `imagesDocInDrive`  | shloka's `N.V images` doc exists in Drive                                                                                           |
| `scaffoldUntouched` | true if the chapter's top-level metadata block (name, subtitle, summary, theme, color, icon) matches what's already in JSON         |

Print this table to the user before any writes. Then derive the **action set**:

- **SKIP** any shloka whose row is fully populated (`richFields` + `audioInJson` + `imagesInJson`), unless the user explicitly says "redo verse `<V>`".
- **CREATE** rich content only for shlokas where `docInDrive == true` AND `richFields == false`.
- **UPLOAD AUDIO** only for shlokas where `audioInDrive == true` AND `audioInJson == false`.
- **GENERATE IMAGES** only for slots where the slot URL is missing in JSON AND the shloka source supplies image prompts (in the main `N.V` Word doc — e.g. “Image Prompts” — and/or a separate `N.V images` doc). **Do not** wait for or require `chapter00NN/images/<N>.<V>/` PNG folders on Drive; that path is for the optional **image-update** workflow only (see below).
- **DEFER** any shloka whose Drive Word doc is missing — list it under "Awaiting source" and continue with the rest. Never fabricate content for a missing shloka.
- **NEVER** mutate the chapter scaffold during a content import (see §6).

## 4. Download phase (selective)

Use the same `gdown`-based pattern as `scripts/import-chapter-synopsis.md`, but scope it to chapter `<N>` and to the shlokas in the **CREATE / UPLOAD / GENERATE** lists from §3.

```bash
python3 -m pip install gdown
python3 -m gdown --folder \
  "https://drive.google.com/drive/folders/12eaLMBMDFMOwgMhtLtLi3NP6gHRuQEXq" \
  -O .cache/chapter-import/_drive_root --remaining-ok
```

Then copy only the relevant files (verse doc + mp3 + images doc) for shlokas in the action set into `.cache/chapter-import/ch<N>/raw/`. Convert `.docx` to text on macOS with:

```bash
textutil -convert txt ".cache/chapter-import/ch<N>/raw/<N>.<V>.docx" \
  -output ".cache/chapter-import/ch<N>/raw/<N>.<V>.txt"
```

## 5. Parse each shloka Word doc → verse JSON

For each `N.V.docx` in the action set, produce `parsed/N.V.json` matching `Verse` in `client/src/types/gita.ts` and the gold-standard fields in `CLAUDE.md`:

Required: `verse`, `chapter`, `title`, `sanskrit`, `transliteration`, `one_line_meaning`, `concise_journey`, `meaning_detail`, `story`, `real_life_example`, `reflection`, `kids_content.{explanation_script, story, reflection}`, `detailed_meaning`, `more_stories`, `rich_grammar.{padacchedah, pratipadarthah, anvayah, sandhi, samasa, other}`, `final_takeaway`.

Editorial rules (mirror Ch12):

- Sanskrit: closing `॥` only on the last line; do **not** paste `॥N.V॥` on every line.
- IAST: full diacritics; `|` for half-verse, `||` for full; the runtime stripper in `client/src/lib/transliterationDisplay.ts` will remove trailing `N.V॥` if present, but don't rely on that — emit clean source.
- `more_stories`: numbered (`1. Title\nBody…\n\n2. Title\nBody…`) — the renderer in `VersePage.tsx` (around line 1198) and `ImageManagerPage.tsx > parseMoreStoryTitles` (line 15) parse this format with `/^\d+\.\s/`.
- `rich_grammar.padaparicayah` (optional but present in Ch12) is an array of `{ word, anta, linga, vibhakti, vacanam, type, dhatu, lakara }`. Include it when the source doc supplies parts-of-speech analysis.

If the source doc does not contain a field, **leave it empty** — never invent prose, stories, or grammar.

## 6. Insert verses into `client/src/data/gitaData.json`

For each shloka in the CREATE list, in **verse-number order**:

1. Locate `chapters[]` entry where `chapter == <N>`.
2. Insert (or replace if already present as a stub) the verse object inside `key_verses[]`, keeping it sorted by `verse`.
3. Validate the file is valid JSON after every insertion:

   ```bash
   node -e 'JSON.parse(require("fs").readFileSync("client/src/data/gitaData.json","utf8"))'
   ```

4. **Never** modify any other chapter's data, and on chapter `<N>` itself never modify any of these scaffold fields during a content import: `name`, `name_hindi`, `subtitle`, `theme`, `color`, `icon`, `verses_count`, or `summary`. The only chapter-level fields a content import may rewrite are `iast_name`, `devanagari_name`, and `generated_description`, and those are written **only** by `npm run generate-chapter-descriptions -- --chapter=<N>` in §10.1, not by hand.

> **Special case for Chapter 6:** verses also live in `chapter6_full[]` with `full_journey_text` + `grammar_notes`. If importing Ch6, also keep the legacy fields and add the rich fields alongside, per `CLAUDE.md` ("For Chapter 6 Conversion").

## 6.5 Post-import audit (before audio / manual QA)

**Required for all contributors** (any editor / IDE). After `gitaData.json` edits for the chapter are complete, run:

```bash
npm run audit-chapter-import -- --chapter=<N>
```

This catches **mis-counted `more_stories` segments vs `images.more_stories`**, **accidental `N. ` lines inside story bodies**, **`\n\n` splits that put almost the whole narrative into the amber takeaway callout**, and **every `images.*.url` in that chapter** (local file on disk + HTTP HEAD for remote URLs). Use **`--skip-images`** only when offline. Details and fixes: **`docs/post-chapter-import-audit.md`**.

## 7. Audio upload

For each shloka in the UPLOAD AUDIO list:

1. Upload the mp3 to Firebase Storage at:

   ```
   gs://sample-f6f12.appspot.com/bhagvad-gita/audio/ch<N>/<N>.<V>.mp3
   ```

2. Set `audio_url` on the verse to:

   ```
   https://storage.googleapis.com/sample-f6f12.appspot.com/bhagvad-gita/audio/ch<N>/<N>.<V>.mp3
   ```

3. Cache-control: `public, max-age=31536000`; content-type: `audio/mpeg`; make public.
4. Use a parametrised version of `scripts/upload-audio.ts`. The version checked in is hard-coded for `12.1` and uses the older `ch12_v1.mp3` path — do not blindly copy it; the canonical path is `ch<N>/<N>.<V>.mp3`, which is already used by Chapter 12 verses 1–10 in `gitaData.json`.
5. Never overwrite an existing `audio_url` in JSON unless the user explicitly says "re-upload audio for `<N>.<V>`".

## 8. Image generation (Chapter 12 model) — **included in every chapter import**

Image generation is **part of chapter import**, not a separate follow-up task. For each shloka in scope, generate illustrations from the **`Prompt:`** strings in the source doc, upload to Firebase Storage (§8b), and write `images.*` in `gitaData.json` (§8c). An empty or missing `chapter00NN/images/<N>.<V>/` folder on Drive is **normal** and does **not** block import.

**Do not** run `docs/update-verse-images.md` / `npm run import-verse-images` during or after chapter import unless the user **explicitly** asks to update or replace images with finished Drive PNGs. Do **not** suggest “re-import images when PNGs land in Drive” as an implicit next step.

**User-prompted image update only** (finished Drive PNGs under `chapter00NN/images/<N>.<V>/`, filenames `N.V-image-SEQ-SECTION-…`, without re-importing prose): **`docs/update-verse-images.md`** → `scripts/import-verse-images-from-drive.mjs` (versioned GCS paths).

This is the most error-prone section. The Ch12 V1 implementation is the reference (see `gitaData.json` lines ~370–423 and `client/public/images/ch12/v1/…`).

### 8a. Image-slot vocabulary (must match `Verse.images` in `types/gita.ts`)

| Slot key                     | Cardinality                  | Where it renders                              |
| ---------------------------- | ---------------------------- | --------------------------------------------- |
| `meaning`                    | 1                            | Meaning tab (float-wrap layout)               |
| `story[0]`, `story[1]`       | up to 2                      | Story tab (one above paragraph, one below)    |
| `modern_life`                | 1                            | Impact-on-life tab                            |
| `kids_explain`               | 1                            | Kids Corner — explanation block               |
| `kids_story`                 | 1                            | Kids Corner — story block                     |
| `detailed_meaning`           | 1                            | Detailed Meaning tab                          |
| `more_stories[i]`            | 1 per `more_stories` entry   | Aligned with `more_stories` story `i`         |
| `grammar`                    | 0–1                          | Optional grammar tab illustration             |

The image companion doc (`N.V images`) for each shloka must explicitly assign each prompt to one of these slots **and** to a specific `more_stories` story title when the slot is `more_stories[i]`. Do not guess alignment — if the doc is ambiguous, mark the shloka as deferred and ask.

### 8b. Storage + URL convention

Firebase Storage (primary):

```
gs://sample-f6f12.appspot.com/bhagvad-gita/images/ch<N>/v<V>/ch<N>v<V>-<slot>-v<version>.<ext>
```

For **replacing** existing art after import (user-requested image update only), increment `version` (see **`docs/update-verse-images.md`**) — do not overwrite the same object path (CDN cache).

Examples (Ch12 V1 — some legacy objects omit `-vN`; new uploads should use versioning):

- `…/ch12/v1/ch12v1-meaning.webp`
- `…/ch12/v1/ch12v1-story-bhishma.webp` (descriptive suffix is allowed for `story` and `more_stories`)
- `…/ch12/v1/ch12v1-more-stories-3-hanuman.png`

Public URL goes into `images.<slot>.url`.

Local fallback (only for the existing Ch12 V1 mirror): `client/public/images/ch12/v1/<filename>.png`. Do **not** add new local copies for new chapters.

### 8c. Generation rules

**Default image workflow (per verse):** follow **§8c.2** — one **`meaning`** preview for user approval, then generate all remaining slots automatically. The user does **not** approve each image in the app; in Cursor they may need to allow batched `GenerateImage` tool calls once after the preview is accepted.

For each missing image slot in the GENERATE IMAGES list:

1. **Phase A (§8c.2):** generate only `meaning`, show the user, wait for style approval.
2. **Phase B (§8c.2):** generate every other slot in batches (same §8c.1 assembly per slot) without pausing for per-image approval unless the tool environment blocks progress.
3. Build each generation input per **§8c.1** (exact doc `Prompt:` + standard append block — never a shortened rewrite).
4. Name files for `scripts/import-verse-images-from-drive.mjs`, e.g. `<N>.<V>-image-<seq>-<section>-<slug>.png` (see Ch15.2 in `.cache/chapter-import/ch15-images/15.2/` for a full-verse example), copy into `.cache/chapter-import/ch<N>-images/<N>.<V>/`, and run the importer for that verse.
5. Upload lands at the Storage path in §8b (importer handles upload + `images.*.url`). Set `cacheControl: public, max-age=31536000` via the script.
6. **Replace importer stub captions** with editorial captions per **§8d** (the importer may write filename slugs from the PNG name; those are not shippable).
7. Keep `story` / `more_stories` array order **identical** to numbered story order in prose — `more_stories[i]` image must depict story `i+1`.
8. **Never** invent a Storage URL. If you skip generation for any reason, leave the slot key out entirely (don't emit a placeholder URL).
9. If the slot already has a URL in JSON, **skip** unless the user says "regenerate images for `<N>.<V>`" (or specifies a slot).

### 8c.1. Generation prompt assembly (required)

Each Drive image entry is a line starting with `Prompt:` in the shloka Word doc (section **Image Prompts**, usually `Image 1`, `Image 2`, … in prompt order).

**Do not** replace that text with a new shortened prompt. The doc already includes Pixar-style, kid-friendly, and “avoid full shloka / too many words” rules. Paraphrasing often causes the model to add Sanskrit, verse numbers, or long on-image text.

**Assembly (every image):**

```
<exact Prompt: text from the doc, including everything after "Prompt:" on that image row>

Additional generation rules: Use bright, saturated, cheerful colors (not dull or muted). Keep strict Pixar-style 3D cartoon rendering throughout—no watercolor, painterly, or soft-wash look on any element. On-image text: very minimal only (short labels explicitly named in the prompt above, or none); no Sanskrit, shloka lines, verse numbers, or long captions.
```

Rules for the append block:

- **Always** append it verbatim (same wording every time). Do not weaken or omit it.
- **Bright / saturated** — avoids dull, muted, “watercolor haze” outputs.
- **Strict 3D cartoon** — no part of the image should look like a watercolor or painterly illustration.
- **Minimal text** — the doc may allow a few short labels (e.g. “higher lokas,” “desire,” “action”); do not add paragraphs, shloka lines, or extra labels beyond what the doc prompt names.
- The doc footer already says not to place full shloka text; the append block reinforces that for the generator.

Extract prompts from the docx programmatically when possible (e.g. parse `word/document.xml` or `textutil -convert txt`) and cache under `.cache/chapter-import/ch<N>/parsed/<N>.<V>.prompts.json` so re-runs stay consistent.

### 8c.2. Meaning-image preview, then batch the rest (default)

Use this **every time** you generate images for a verse during chapter import (unless the user explicitly says to skip the preview and generate all slots at once).

**Phase A — one approval (style check)**

1. Generate **only** the `meaning` slot (first `Prompt:` / `Image 1` → `…-image-01-3-meaning-…` filename) using §8c.1.
2. Show the preview to the user (do not upload to GCP or write JSON for the full verse set until style is accepted, unless you are only replacing `meaning`).
3. Wait for explicit approval (e.g. “looks good”, “proceed”, “do the rest”). If they request changes, regenerate `meaning` only until approved.

**Phase B — automatic for remaining slots**

4. After approval, generate **all other** image slots for that verse using the **same** §8c.1 assembly (exact doc `Prompt:` + append block per slot). Run generations in parallel batches (e.g. 3–4 at a time) without asking the user to review each file.
5. The user should **not** need to click Generate in the Bhagavad Gita app. In Cursor, they may see tool-approval prompts depending on IDE settings; batch as many calls as the environment allows after Phase A is done.
6. Then upload via `import-verse-images-from-drive.mjs`, write URLs, and replace captions per §8d.

**Skip Phase A** only if the user explicitly says to generate all images without a meaning preview (e.g. regenerating a single slot, or repeating a verse whose style was already approved in the same session).

### 8d. Image captions (required — same standard as Ch3)

Every `images.<slot>.caption` is a **short editorial description** of what the illustration shows, written from the **prose directly above that image** in the verse (not from the image `Prompt:` alone).

Rules:

- **1–3 sentences**, present tense, concrete who/what is happening (match the tone of Ch3 captions in `gitaData.json`).
- Tie the caption to the **tab content it sits under**: `meaning` / `detailed_meaning` / `story` / `modern_life` / `kids_explain` / `kids_story` / the matching numbered `more_stories` entry.
- For `more_stories[i]`, read the **i-th numbered story** title and body; the caption should summarize the key moment that image depicts (often the turning point), not just name characters.
- **Do not** end with boilerplate such as `— illustrating the teaching of verse <N>.<V>` or `Illustration for verse …`.
- **Do not** use filename slugs, section labels, or title-case stubs as the final caption (e.g. `Samsara Tree`, `Modern Life`).

**Example (15.1, first `more_stories` image):** story title *Indra Returns Again and Again to Prajāpati for the True Self* → acceptable caption:

> Prajāpati instructed Indra and Virocana. While Virocana was satisfied with the first answer, Indra dug deep until he understood fully.

**Reference:** Chapter 3 `key_verses` image captions (e.g. 3.1 `meaning`, `story[]`, `more_stories[]`) in `client/src/data/gitaData.json`.

### 8e. Caption-to-image alignment audit (must run before commit)

After insertion, verify per shloka:

- `images.story.length` ≤ 2.
- `images.more_stories.length` == number of numbered entries parsed from `more_stories` text by `/^\d+\.\s/` (the same regex the UI uses in `ImageManagerPage.tsx > parseMoreStoryTitles`).
- Each `more_stories[i].caption` references the same character/episode as the i-th story title and reads like a real scene description (not a stub or verse boilerplate).
- Every populated `images.*.caption` passes the rules in §8d.
- All Storage URLs return HTTP 200 (sanity check, optional but recommended).

## 9. Local persistence (don't re-open Drive on every page load)

The shipped app reads only from `client/src/data/gitaData.json` and Firebase. Once §6 + §7 + §8 are done for a shloka, no Drive access is ever needed at runtime — that requirement is satisfied by the existing architecture. The only thing the **agent** must persist between sessions is `.cache/chapter-import/ch<N>/` (raw + parsed + status), so a re-run knows what is already done.

## 10. SEO, Topic Hubs, and the "Gita by Life Situation" page

This section is **inside** the import workflow, not deferred. After §6–§9 are complete for chapter `<N>`, do every step below in order. Skip a step only if its precondition is already true.

### 10.1 Regenerate chapter-level descriptions and Devanagari/IAST sync

```bash
npm run generate-chapter-descriptions -- --chapter=<N>
```

What this does (per `CLAUDE.md`):

- Replaces the **scaffolded** `generated_description` for chapter `<N>` with a fresh one synthesized from the newly imported `key_verses[].one_line_meaning`.
- Re-syncs `iast_name` and `devanagari_name` for chapter `<N>`.

Verify after running:

- `chapters[N-1].generated_description` no longer matches the original scaffolded placeholder.
- `iast_name` and `devanagari_name` look correct.

> **What the import process MUST NOT modify on the chapter scaffold:** `name`, `name_hindi`, `subtitle`, `theme`, `color`, `icon`, `verses_count`, `summary`. These are editorial. `summary` in particular is the SEO description fallback for `/chapter/<N>` — leave it as-is unless the user explicitly says "rewrite Chapter `<N>` summary".

### 10.2 Server-rendered SEO meta — no code edit, just verify

`server/seo.ts` is **fully data-driven** for chapters and verses. Once `key_verses` is populated and §10.1 has run, these become correct automatically:

- `/chapter/<N>` → title `Gita Chapter <N> — <iast_name>`, description from `generated_description` (fallback `summary`), `og:image` from the first verse with `images.meaning.url` (or `images.detailed_meaning.url`).
- `/chapter/<N>/verse/<V>` → title `Gita <N>.<V> — <iast_name>`, description from `verse.one_line_meaning` (fallback `concise_journey`), `og:image` from `verse.images.meaning.url` (with the `getVerseImage` fallback chain in `seo.ts` lines 49–60).
- `/chapter/<N>/summary` → only meaningful if a chapter-level synopsis is added later (see `scripts/import-chapter-synopsis.md`).

Verification:

```bash
npm run build
# then start the server and:
curl -s http://localhost:<port>/chapter/<N>/verse/1 | grep '<meta name="description"'
```

The description should be the verse's `one_line_meaning`, not the default fallback string.

### 10.3 Sitemap — no code edit, just verify

`generateSitemap` in `server/seo.ts` (lines 378–417) iterates `data.chapters`, `data.chapter6_full`, and `TOPIC_HUBS`. It auto-emits one entry per imported verse and chapter, so:

```bash
curl -s http://localhost:<port>/sitemap.xml | grep "/chapter/<N>/verse/" | wc -l
```

Should equal the number of `key_verses` you imported. If counts don't match, a verse failed to insert.

### 10.4 Public-route gating — no code edit

`isKnownPublicRoute` in `server/seo.ts` (lines 100–134) checks `key_verses` membership before accepting a `/chapter/<N>/verse/<V>` URL. So:

- Imported verses → HTTP 200 with full SEO.
- Not-yet-imported verses (e.g. you only finished verses 1–10 of 43) → HTTP 404 with `noindex, nofollow`. This is the **correct** behaviour — do not work around it. Search engines should not see partial-content URLs.

### 10.5 Topic-hub mapping — `chapterNumbers` (Required edit)

File: `client/src/lib/seoKeywords.ts`. For each hub in `TOPIC_HUBS` whose theme genuinely matches chapter `<N>`'s teachings, add `<N>` to that hub's `chapterNumbers` array. The four current hubs and their thematic anchors:

| Hub slug                        | Thematic anchor                                         | When to map a new chapter to this hub                                                       |
| ------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `anxiety-stress-mental-health`  | calmness, resilience, freedom from fear                 | chapter has verses on equanimity, freedom from fear, or steadiness in pain/pleasure         |
| `decision-making-dharma`        | duty, ethics, sama-buddhi in action                     | chapter has verses on dharma, choice, action without rāga-dveṣa                             |
| `focus-productivity-karma-yoga` | action without anxiety, abhyāsa, dedication             | chapter has verses on karma-yoga, dedicated action, niṣkāma karma                           |
| `philosophy-spiritual-wisdom`   | metaphysical / nirguṇa-saguṇa / Self / brahman          | chapter has verses on the nature of reality, Self, ātman                                    |

The agent should **propose** the mapping back to the user with one-sentence reasoning per hub before editing the array, then write the change.

### 10.6 Topic-hub Suggested Verses — the "Gita by life situation" curation (Required edit)

This is the **editorial heart** of the topic hubs. File: `client/src/lib/seoKeywords.ts`, the `suggestedVerses: TopicSuggestedVerse[]` array on each hub.

Why it matters: `TopicHubPage.tsx` (`suggestedVerseLinksFromHub`, lines 20–53) renders **exactly** the `{ chapter, verse }` pairs you list here, pulling each verse's `sanskrit`, `one_line_meaning`, first two `reflection` lines, and `images.meaning.url` directly from `gitaData.json`. So if a verse is mis-curated here, the life-situation page will show a thematically wrong shloka.

Procedure (per `docs/new-chapter-rollout-checklist.md` §4 and `CLAUDE.md` "Topic hub source-of-truth rule"):

1. For chapter `<N>`, read each newly imported verse's **`meaning_detail`**, **`reflection`**, and **`detailed_meaning`** (NOT just `title` or `one_line_meaning`).
2. For each hub `<N>` was added to in §10.5, decide which 1–4 verses from chapter `<N>` genuinely fit that hub's intent. **Overlap across hubs is allowed** if the verse legitimately serves more than one life-intent.
3. Insert those `{ chapter: <N>, verse: <V> }` entries into the hub's `suggestedVerses`. You can either append (preserving existing picks from other chapters) or, if the user asks, rebalance by removing some — that's an editorial call to confirm with the user.
4. Above each `suggestedVerses` block, add a one-line comment explaining **why** those verses were chosen (the existing Ch12 comments are the model — see lines 31–38, 52–60, 73–79, 93–100 of `seoKeywords.ts`).

The agent must **propose** each new pick to the user with one-sentence reasoning per verse before writing — these are user-visible editorial choices.

### 10.7 Topic-hub icons — usually no change

`client/src/pages/TopicHubPage.tsx` lines 13–18 map hub slugs to `/topics/topic-<slug>.png`. New chapters do **not** add new icons; they just add `chapterNumbers` to existing hubs. Only add a new icon if §10.5 needs a brand-new hub (rare; coordinate with user first, and follow `docs/new-chapter-rollout-checklist.md` for new-hub creation).

### 10.8 `CHAPTER_INTENT_TERMS[<N>]` review — Optional edit

File: `client/src/lib/seoKeywords.ts` lines 107–126. There's already a five-term placeholder for every chapter. After import:

- Scan the new `meaning_detail` and `reflection` text for chapter `<N>`.
- If the imported content emphasises terms that are missing or oversells terms that are weak, refine the array.

### 10.9 Internal linking — no code edit

`VersePage.tsx`, `ChapterPage.tsx`, and `TopicsPage.tsx` already cross-link automatically based on `chapterNumbers` and `suggestedVerses`. Once §10.5 and §10.6 are done, the new chapter's verses appear in:

- `/topics/<slug>` "Suggested verses" panels.
- `/topics/<slug>` "Top related chapters" panels.
- `/topics` index hub cards (showing chapter counts).

### 10.10 robots / canonical / noindex — no change

The admin pages (`/login`, `/settings`, `/settings/images`) remain `noindex, nofollow` (`server/seo.ts` line 159). New chapter pages remain default `index, follow`. No change required.

### 10.11 Validation gate

```bash
npm run check
npm run build
```

Plus a manual smoke test of:

- `/chapter/<N>` (chapter card grid + first verse links).
- `/chapter/<N>/verse/<V>` for at least the **first**, **middle**, and **last** imported verse.
- `/topics` (chapter `<N>` should now appear in the relevant hubs' related-chapter counts).
- Each `/topics/<slug>` whose `chapterNumbers` was updated in §10.5 (the new verse picks from §10.6 must render with sanskrit, meaning, reflections, and the meaning image).
- View-source on each of the above and confirm `<title>`, `<meta name="description">`, `og:image` look right.

### 10.12 What this section deliberately does not cover

- **Chapter-level synopsis import.** Out of scope here — see `scripts/import-chapter-synopsis.md`.
- **Adding a new topic hub.** Out of scope — see `docs/new-chapter-rollout-checklist.md`. By default, content imports update existing hubs only.

## 11. Hard never-do list

- **Never** start without a confirmed chapter number (see §0).
- **Never** import or touch any chapter other than the one the user named.
- **Never** create a permanent local file containing shloka prose, transliteration, audio, or images outside `gitaData.json`, GCP audio, GCP images, and (for synopsis only) `client/public/chapter-summaries/`. The `.cache/chapter-import/` scratchpad is the only allowed local landing zone, and it is gitignored.
- **Never** re-download a Drive file already cached unchanged in `.cache/chapter-import/`.
- **Never** re-parse a Word doc whose cached JSON is already current.
- **Never** re-generate an image whose `images.<slot>.url` is already populated in JSON, unless the user explicitly opts in.
- **Never** paraphrase or shorten Drive `Prompt:` text for image generation — use §8c.1 (exact doc prompt + standard append block).
- **Never** run **`docs/update-verse-images.md`** or suggest Drive PNG re-import as part of or after chapter import; that workflow is **only** when the user explicitly asks to update/replace verse images.
- **Never** treat a missing `chapter00NN/images/<N>.<V>/` Drive folder as a reason to defer chapter import — generate from doc prompts in §8 instead.
- **Never** ship image captions that are filename stubs or end with `— illustrating the teaching of verse <N>.<V>` — write editorial captions per §8d (replace any stubs left by `import-verse-images-from-drive.mjs`).
- **Never** invent a Storage URL, audio URL, image, story, or grammar field. Missing source ⇒ deferred shloka, reported back to the user.
- **Never** edit chapter scaffold fields (`name`, `name_hindi`, `subtitle`, `summary`, `theme`, `color`, `icon`, `verses_count`) during a content import. The only chapter-level mutations allowed are `iast_name`, `devanagari_name`, and `generated_description`, and only via `npm run generate-chapter-descriptions -- --chapter=<N>`.
- **Never** commit unless the user asked for a commit (per repo policy).

## 12. Suggested commit message

When the user does ask to commit (per `CLAUDE.md`):

```
Import Chapter <N> verses <V1>, <V2>, … from Drive

- Add rich content for verses <V1>–<Vn> following Ch12.1 template.
- Upload audio to bhagvad-gita/audio/ch<N>/<N>.<V>.mp3.
- Generate per-section images aligned with Ch12 image model.
- Update topic hub mappings and suggested verses in seoKeywords.ts.
- Skipped: <list of shlokas with missing source / already complete>.
```
