# New Chapter Rollout Checklist

Use this checklist every time a new chapter is added beyond Chapter 12.

## 1) Content

- Add/update chapter verse content in `client/src/data/gitaData.json`.
- Keep the verse schema aligned with the rich-content format.

## 2) Generated Chapter Synopsis

- Run:
  - `npm run generate-chapter-descriptions -- --chapter=<n>`
- Confirm `generated_description` is populated for chapter `<n>`.

## 3) Topic Hubs — chapter linkage (Required)

- Update `client/src/lib/seoKeywords.ts`:
  - Add chapter `<n>` to relevant `TOPIC_HUBS[].chapterNumbers`.
  - Add/update `CHAPTER_INTENT_TERMS[<n>]`.

Without this step, `/topics` and `/topics/:slug` will not surface the new chapter in **Top related chapters**.

## 4) Topic Hubs — suggested verses from editorial copy (Required)

After the new chapter’s verses are written (or when revising hub picks), curate **Suggested verses** for **Explore by life situation**:

- For each candidate verse in chapter `<n>`, read in `gitaData.json`: **`meaning_detail`**, **`reflection`**, and **`detailed_meaning`** (use **`one_line_meaning`** for consistency checks).
- Assign verses to the right `TOPIC_HUBS[].suggestedVerses` entries (`{ chapter, verse }`) by **thematic fit** from that full copy—not from titles alone or verse order.
- **Overlap across hubs is allowed** when the same śloka genuinely serves more than one life intent; do not force artificial uniqueness.
- Optionally add a short comment above each hub’s `suggestedVerses` in `seoKeywords.ts` documenting why those verses were chosen (helps the next editor).

If this step is skipped, topic pages may show generic or misleading verse lists for the new chapter.

## 5) SEO Checks (Required)

- Ensure SEO metadata behavior remains correct:
  - `server/seo.ts` chapter/verse/topic handling
  - sitemap coverage for expected routes
  - canonical/meta consistency
- Keep admin pages non-indexable:
  - `/login`
  - `/settings`
  - `/settings/images`

## 6) Optional Chapter Summary Content

If long-form chapter summary is available:

- Add/update `client/src/data/chapterSummaries.json`.
- Add chapter summary images under `client/public/chapter-summaries/`.
- Verify `/chapter/<n>/summary`.

## 7) Validation

- Run:
  - `npm run check`
  - `npm run build`

## 8) Manual Smoke Test

- Verify:
  - `/chapter/<n>`
  - one or two `/chapter/<n>/verse/<v>` pages
  - `/topics`
  - relevant `/topics/<slug>` pages

