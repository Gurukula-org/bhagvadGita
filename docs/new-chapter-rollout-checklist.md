# New Chapter Rollout Checklist

Use this checklist every time a new chapter is added beyond Chapter 12.

## 1) Content

- Add/update chapter verse content in `client/src/data/gitaData.json`.
- Keep the verse schema aligned with the rich-content format.

## 2) Generated Chapter Synopsis

- Run:
  - `npm run generate-chapter-descriptions -- --chapter=<n>`
- Confirm `generated_description` is populated for chapter `<n>`.

## 3) Topic Hubs (Required)

- Update `client/src/lib/seoKeywords.ts`:
  - Add chapter `<n>` to relevant `TOPIC_HUBS[].chapterNumbers`.
  - Add/update `CHAPTER_INTENT_TERMS[<n>]`.

Without this step, `/topics` and `/topics/:slug` will not surface the new chapter correctly.

## 4) SEO Checks (Required)

- Ensure SEO metadata behavior remains correct:
  - `server/seo.ts` chapter/verse/topic handling
  - sitemap coverage for expected routes
  - canonical/meta consistency
- Keep admin pages non-indexable:
  - `/login`
  - `/settings`
  - `/settings/images`

## 5) Optional Chapter Summary Content

If long-form chapter summary is available:

- Add/update `client/src/data/chapterSummaries.json`.
- Add chapter summary images under `client/public/chapter-summaries/`.
- Verify `/chapter/<n>/summary`.

## 6) Validation

- Run:
  - `npm run check`
  - `npm run build`

## 7) Manual Smoke Test

- Verify:
  - `/chapter/<n>`
  - one or two `/chapter/<n>/verse/<v>` pages
  - `/topics`
  - relevant `/topics/<slug>` pages

