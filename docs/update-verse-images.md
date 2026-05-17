# Update verse section images (Drive → GCS → gitaData.json)

**Scope:** user-prompted image update only. Run this when the user explicitly asks to **update**, **replace**, or **import finished Drive PNGs** for specific shlokas.

**Not part of chapter import.** `docs/new-chapter-content-import.md` §8 already generates images from doc `Prompt:` strings and uploads to GCS. Do **not** run this doc during or after a chapter import unless the user requests it. Do **not** suggest it as a follow-up when `chapter00NN/images/<N>.<V>/` is empty on Drive.

Use this workflow when **finished PNG illustrations** exist in Google Drive and you need to upload them to Firebase Storage and sync `client/src/data/gitaData.json` for **one or many shlokas**.

**Automation (required):** `scripts/import-verse-images-from-drive.mjs`  
**Related:** full shloka import (prose + audio + generated images) → `docs/new-chapter-content-import.md`; post-import checks → `docs/post-chapter-import-audit.md`.

---

## Agent rules (mandatory)

1. **Confirm** chapter number and verse list with the user before downloading or uploading.
2. **MUST** run `scripts/import-verse-images-from-drive.mjs` to upload and update JSON (versioning is automatic). **Do not** hand-edit Storage URLs or reuse unversioned paths.
3. **MUST** set credentials via `GOOGLE_APPLICATION_CREDENTIALS` (see below). **Do not** paste key material into markdown, chat, or commits.
4. **MUST** download Drive PNGs into `.cache/chapter-import/` (gitignored) before import.
5. **MUST** run `npm run audit-chapter-import -- --chapter=<N>` after import when online (unless user says `--skip-images`).
6. **Do not** commit `sample-f6f12-0e67b9d712cf.json` or `.cache/`.

Optional: dry-run first (`--dry-run`) to print slot → version → object path without uploading.

---

## Credentials (local file, gitignored)

The service account JSON lives at the **repo root** as `sample-f6f12-0e67b9d712cf.json` (listed in `.gitignore`). Obtain it from your secure store; it is **not** in git.

In Cursor you may `@sample-f6f12-0e67b9d712cf.json` for **path context only** — never paste secrets.

Every upload session:

```bash
cd /path/to/bhagavadgitajourney
export GOOGLE_APPLICATION_CREDENTIALS="${PWD}/sample-f6f12-0e67b9d712cf.json"
test -f "$GOOGLE_APPLICATION_CREDENTIALS" || { echo "Missing sample-f6f12-0e67b9d712cf.json at repo root"; exit 1; }
```

---

## Google Drive layout (canonical)

**Content root:** [Bhagavad Gita Journey Content](https://drive.google.com/drive/folders/12eaLMBMDFMOwgMhtLtLi3NP6gHRuQEXq)

```text
12eaLMBMDFMOwgMhtLtLi3NP6gHRuQEXq/
  chapter0003/                    # four-digit chapter: chapter + NN zero-padded to 4
    3.1, 3.2, …                   # prose/audio docs (NOT finished PNG tabs)
    audio/
    images/                       # finished section PNGs for this chapter
      3.19/
        3.19-image-01-3-meaning.png
        …
      3.20/
        …
  chapter0012/
    images/
      12.1/
        …
```

| User says | Drive path |
|-----------|------------|
| Chapter `3`, verse `20` | `chapter0003/images/3.20/` |
| Chapter `12`, verse `1` | `chapter0012/images/12.1/` |

**Chapter folder name:** `chapter` + chapter number zero-padded to **4 digits** (e.g. `3` → `chapter0003`, `12` → `chapter0012`).

**Import `--root-dir`:** must be the local `images/` folder whose **immediate subfolders** are `N.V` (e.g. `.cache/.../chapter0003/images`), **not** `chapter0003` itself and not the Drive content root.

### Phase 0 — verify before first import (once per chapter)

After a selective `gdown` pull, confirm:

```bash
ls .cache/chapter-import/ch3-images/3.20/*.png | head
# Expect: 3.20-image-01-3-meaning.png, …
```

If `images/` is missing under `chapter00NN`, or shloka folders are empty, stop and ask the user — do not invent paths.

---

## Local cache layout (after download)

```text
.cache/chapter-import/ch<N>-images/    # gitignored
  3.19/
    3.19-image-01-3-meaning.png
    …
  3.20/
    …
```

- Subfolder name: **`<chapter>.<verse>`** (e.g. `3.19`, `12.1`).
- PNG only for the batch importer.
- Skip files with `panel-summary` in the name (handled by `npm run import-panel-summary`).

### Panel summary (12-panel composite)

**Filename:** `<chapter>.<verse>-panel-summary.png` (same Drive folder as tab PNGs)

**GCS:** `bhagvad-gita/images/ch<N>/v<V>/ch<N>v<V>-panel-summary-v<version>.png`

**JSON:** `verse.images.panel_summary` → `{ url, caption }`

**Import:**

```bash
export GOOGLE_APPLICATION_CREDENTIALS="${PWD}/sample-f6f12-0e67b9d712cf.json"
npm run import-panel-summary -- --chapter 3 --root-dir .cache/chapter-import/_drive_root/chapter0003/images --verses 19,20,21
npm run import-panel-summary -- --chapter 15 --verses 1,2
```

The verse page shows a hero block above tabs only when `panel_summary.url` is set.

### Filename pattern

```text
<chapter>.<verse>-image-<seq>-<section>-<sectionname>[-<description>].png
```

| Section # | Tab / content | JSON path | Storage slot suffix |
|-----------|---------------|-----------|---------------------|
| 3 | Meaning | `images.meaning` | `meaning` |
| 4 | Story | `images.story[]` | `story-1`, `story-2`, … (order by `seq`) |
| 5 | Impact on current life | `images.modern_life` | `modern-life` |
| 7 | Kids | `images.kids_explain`, `images.kids_story` | 1st → `kids-explain`, 2nd → `kids-story` |
| 8 | Detailed meaning | `images.detailed_meaning` | `detailed-meaning` |
| 10 | More stories | `images.more_stories[]` | `more-stories-1` … (order by `seq`) |

The **description** slug becomes the caption in JSON.

---

## GCS layout and CDN cache busting

Bucket: `gs://sample-f6f12.appspot.com`  
Prefix: `bhagvad-gita/images/`

**Every import uses a new version suffix** (do not overwrite the same object name):

```text
bhagvad-gita/images/ch<N>/v<V>/ch<N>v<V>-<slot>-v<version>.png
```

| Current URL in `gitaData.json` | Next upload |
|----------------------------------|-------------|
| (empty) | `…-v1.png` |
| Legacy `…-meaning.png` (no `-vN`) | `…-meaning-v2.png` |
| `…-meaning-v2.png` | `…-meaning-v3.png` |

The importer reads each slot’s current URL, computes the next version (`scripts/lib/verse-image-version.mjs`), uploads, and writes the new URL into `gitaData.json`.

---

## Step-by-step

### 1. Download from Drive

Install `gdown` if needed. Pull **only** the chapter you need (full content root is large).

**Option A — entire content root** (slow; use `--remaining-ok`):

```bash
python3 -m pip install gdown
python3 -m gdown --folder \
  "https://drive.google.com/drive/folders/12eaLMBMDFMOwgMhtLtLi3NP6gHRuQEXq" \
  -O .cache/chapter-import/_drive_root --remaining-ok
```

Then use as `--root-dir`:

```text
.cache/chapter-import/_drive_root/chapter0003/images
```

After a Phase 0–style full pull, the same tree may exist at:

```text
.cache/chapter-import/_phase0-verify/drive-root/chapter0003/images
```

Optional short symlink (from `.cache/chapter-import/`):

```bash
ln -sfn _phase0-verify/drive-root/chapter0003/images ch3-images-drive
# Then: --root-dir .cache/chapter-import/ch3-images-drive
```

**Note:** `--root-dir` must be the `images/` folder (children are `3.19`, `3.20`, …), not `chapter0003` itself.

**Option B — only `images/` for one chapter** (preferred when you have the folder link):  
`gdown --folder` that folder into `.cache/chapter-import/ch<N>-images/` so `3.19`, `3.20`, … sit directly under it.

### 2. Credentials

```bash
export GOOGLE_APPLICATION_CREDENTIALS="${PWD}/sample-f6f12-0e67b9d712cf.json"
test -f "$GOOGLE_APPLICATION_CREDENTIALS"
```

### 3. Dry-run (recommended)

```bash
npm run import-verse-images -- \
  --chapter 3 \
  --root-dir .cache/chapter-import/ch3-images-drive \
  --verses 19,20,21 \
  --dry-run
```

Check: each line shows `slot`, `vN`, and object path ending in `-vN.png`.

### 4. Import (required — run Node, do not skip)

```bash
npm run import-verse-images -- \
  --chapter 3 \
  --root-dir .cache/chapter-import/ch3-images \
  --verses 19,20,21
```

Single shloka:

```bash
node scripts/import-verse-images-from-drive.mjs \
  --chapter 3 --verse 19 \
  --dir .cache/chapter-import/ch3-images/3.19
```

The script uploads all PNGs and writes **`gitaData.json` once** (batch) or per verse (single).

### 5. Image captions (required when missing or minimal)

The batch importer may set a **placeholder** caption from the Drive filename. After upload, **always review** `images.*.caption` in `gitaData.json`.

**Rewrite the caption** when it is missing, empty, a filename slug, or otherwise minimal — including any text ending with `— illustrating the teaching of verse <N>.<V>`.

Write captions the same way as chapter import §8d in `docs/new-chapter-content-import.md`:

- 1–3 sentences from the **prose directly above that image** in the verse (the tab’s `meaning_detail`, `story`, `more_stories` segment, etc.).
- Concrete scene description; no verse-number boilerplate at the end.
- For `more_stories[i]`, summarize the key moment of the **i-th numbered story**, not only character names.

**Example (15.1, first `more_stories`):**

> Prajāpati instructed Indra and Virocana. While Virocana was satisfied with the first answer, Indra dug deep until he understood fully.

**Preserve** existing captions that already meet §8d (the importer skips overwriting non-minimal captions).

### 6. Prose alignment (manual, when needed)

Import updates **`images.*.url`** and **`images.*.caption`** (caption only when missing/minimal — see §5) — not `story`, `more_stories`, or other prose fields. Align narrative copy separately if art and text differ.

### 7. Verify

```bash
npm run check
npm run audit-chapter-import -- --chapter=3
```

Spot-check: `/chapter/3/verse/19` (all image tabs).

### 8. Commit (when asked)

Commit `gitaData.json` (and doc changes if any). **Never** commit credentials or `.cache/`.

---

## What to send the agent

1. **Chapter number** (e.g. `3`).
2. **Verse list** (e.g. `19–24` or `19,20,21`).
3. **Scope** — images only, or also update `story` / `more_stories` text.
4. Confirm `sample-f6f12-0e67b9d712cf.json` exists on the machine running the import.

The agent should: verify Drive path → download → dry-run → **run import script** → audit → report caption/prose mismatches.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Missing credentials file | Add `sample-f6f12-0e67b9d712cf.json` at repo root (gitignored). |
| `Verse N.V not found in key_verses` | Import prose first (`new-chapter-content-import.md`), then images. |
| Wrong `--root-dir` | Point at `chapter00NN/images`, not `chapter00NN` (prose files live at chapter root). |
| File skipped / unknown slot | Fix Drive filename to `N.V-image-SEQ-SECTION-...` pattern. |
| Users see old art after deploy | JSON must use a **new** `-vN` URL; re-run import to bump version. |
| Audit: more_stories count mismatch | Fix numbered `more_stories` text or image count — see `post-chapter-import-audit.md`. |
| `gdown` fails | Check Drive link sharing; try smaller folder scope. |

---

## Single-file upload (escape hatch)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="${PWD}/sample-f6f12-0e67b9d712cf.json"
node scripts/push-verse-image-to-storage.mjs \
  --chapter 3 --verse 19 --slot meaning \
  --file path/to/local-meaning.png
```

Prints the next versioned URL; copy into `gitaData.json` or prefer the batch importer.
