# Import a chapter synopsis from Google Drive

## Source layout (convention)

- Portal folder (shared): contains subfolders named **`chapter00NN`** (four digits), e.g. `chapter0012` for Chapter 12.
- Inside each subfolder, the synopsis Word file is named **`chapter00NN Synopsis`** (no `.docx` extension in Drive export names; locally treat as `.docx`).

## Download the portal folder (one-time or refresh)

Requires Python 3 and `gdown`:

```bash
python3 -m pip install gdown
python3 -m gdown --folder "https://drive.google.com/drive/folders/12eaLMBMDFMOwgMhtLtLi3NP6gHRuQEXq" -O /tmp/gita_drive_root --remaining-ok
```

## Extract text (macOS)

```bash
textutil -convert txt "/tmp/gita_drive_root/chapter0012/chapter0012 Synopsis" -output /tmp/ch12_synopsis_full.txt
```

## Build `chapterSummaries.json` entry

Chapter 12 used this mapping from **source paragraph numbers** to **image order** (derived from the “Placement: Place after Paragraph *N*” lines in the doc):

`3→1, 6→2, 8→3, 13→4, 17→5, 19→6, 21→7, 23→8, 27→9, 33→10, 35→11, 37→12, 42→13, 44→14, 49→15`

**Chapter 3:** `2→1, 8→2, 19→3, 29→4, 24→5, 33→6, 38→7, 40→8, 43→9, 49→10` (10 images). Build JSON with:

```bash
node scripts/build-chapter-synopsis-from-txt.mjs --chapter 3 \
  --txt .cache/chapter-import/ch3-synopsis/chapter0003-synopsis.txt
```

For a **new chapter**, re-derive this map from that chapter’s synopsis “Image Prompts” section: each image’s Placement line gives the paragraph number after which the image appears.

The app expects:

- **No** “Paragraph *N*” labels in displayed text.
- **`content`** array: `{ "type": "h2" | "p" | "img", ... }` in reading order.
- Image assets under `client/public/chapter-summaries/` with paths referenced in JSON (e.g. `/chapter-summaries/ch12-synopsis-img01.png`).
- Generate images using **only** the exact “Prompt:” strings from the source document.

After updating JSON, run `npm run check` and `npm run build`.
