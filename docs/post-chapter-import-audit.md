# Post–chapter import audit

**Audience:** Every developer who edits verse JSON after a chapter import. You only need Node/npm (same as the rest of the repo); Cursor is optional. Step-by-step import flow: `docs/new-chapter-content-import.md` §6.5.

Run this **after** merging a chapter’s verses (and `more_stories` / images) into `client/src/data/gitaData.json`, **before** you consider the import done.

## Command

```bash
npm run audit-chapter-import -- --chapter=<N>
```

Audit every chapter:

```bash
npm run audit-chapter-import -- --all
```

`--all` walks **all** `key_verses` in `gitaData.json`. If the repo already has legacy rows where `more_stories` and `images.more_stories` counts disagree, the command will exit with errors until those verses are fixed — that is expected. After importing a **single** chapter, use `--chapter=<N>` so you only gate what you changed.

Treat warnings as failures (CI / strict gate):

```bash
npm run audit-chapter-import -- --chapter=<N> --strict
```

Implementation: `scripts/audit-chapter-import.mjs` (same parsing rules as `client/src/pages/VersePage.tsx`).

## What it checks

### 1. `more_stories` vs `images.more_stories` (error)

The **More Stories** tab maps `images.more_stories[i]` to the *i*th segment produced by splitting `more_stories` on lines that look like numbered titles (`1. …`, `2. …`, with the same length rule as the app).

- **Error** if the number of parsed segments ≠ `images.more_stories.length`.

**Fix:** Add a missing `N. Title` line before a new story (e.g. Bharadvāja under Ch 3.15), remove a **duplicate** image entry, or fix accidental `N. ` prefixes inside dialogue.

### 2. Accidental numbered lines inside a story body (warning)

Any line in a story **body** matching `^\d+\.\s` with length &lt; 120 is flagged.

**Example:** `4. The fish asked, …` was parsed as a new story and broke image alignment for Ch 3.6.

**Fix:** Remove the number or rephrase so the line is not a fake “title” line.

### 3. Takeaway callout swallowing the narrative (warning)

`formatStoryWithTakeaway` uses `splitLeadingAndTakeawayParagraphs` (see `VersePage.tsx`): with **two or more** `\n\n`-separated blocks, only the **final** block becomes the amber “Connection to this shloka” callout; everything before it stays in the main narrative (main **Story** tab and each **More Stories** body). If there is only one `\n\n` split and it comes **too early**, the callout ends up containing almost the whole tale.

**Warning** when the computed lead is short (&lt; 280 chars) and the takeaway block is very long (&gt; 850 chars), matching the script’s mirror of that function.

**Fix:** Use a **single** `\n` between normal paragraphs; reserve `\n\n` for **one** short closing block (moral / link to the verse), as done for the Ch 3.6 Pañcatantra crane tale.

## Related docs

- Drive → JSON workflow: `docs/new-chapter-content-import.md`
- After audit: update topic hubs / SEO per that doc’s §10.

## Cursor agents

See `.cursor/rules/post-chapter-import-audit.mdc` — run this audit after chapter content lands in `gitaData.json`.
