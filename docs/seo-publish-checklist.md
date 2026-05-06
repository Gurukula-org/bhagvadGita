# SEO Publish Checklist

Use this checklist whenever chapter/verse SEO content is updated.

## A) Content + metadata prep

- [ ] Confirm chapter metadata in `client/src/data/gitaData.json` includes:
  - `iast_name`
  - `devanagari_name`
  - `summary`
  - `generated_description`
- [ ] Confirm key verses have strong `one_line_meaning` for snippet-quality summaries.
- [ ] Run description generator:

```bash
npm run generate-chapter-descriptions
```

## B) Intent mapping

- [ ] Map updates to one or more intent buckets:
  - anxiety/stress/mental peace
  - decision making/dharma
  - focus/productivity/karma yoga
  - bhakti/devotion/spiritual wisdom
- [ ] Ensure chapter + verse pages include relevant intent terms in metadata naturally.
- [ ] Ensure relevant topic hubs are linked:
  - `/topics`
  - `/topics/:slug`

## C) Technical SEO validation

- [ ] Canonical URL correct on updated pages.
- [ ] Open Graph + Twitter metadata present and coherent.
- [ ] Structured data present (Article/BreadcrumbList where applicable).
- [ ] Non-public admin routes remain `noindex,nofollow`:
  - `/login`
  - `/settings`
  - `/settings/images`
- [ ] Unknown route behavior returns real HTTP 404.

## D) Crawl + sitemap validation

- [ ] `/sitemap.xml` contains expected URLs.
- [ ] `/robots.txt` is accessible and references sitemap.
- [ ] Topic hub pages are listed in sitemap.

## E) Build checks

```bash
npm run check
npm run build
```

- [ ] Fix any errors before merge.

## F) Post-release QA

- [ ] Verify at least:
  - one chapter page
  - one verse page
  - one chapter summary page
  - one topic hub page
- [ ] Confirm metadata preview (OG/Twitter) for one chapter and one verse URL.

## KPI TODO (implement later)

- [ ] Add Search Console and GA4 tracking setup.
- [ ] Track:
  - organic clicks by route type (chapter/verse/summary/topics)
  - impressions by intent cluster
  - CTR by template
  - soft-404/index coverage trend

