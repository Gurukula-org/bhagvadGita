# Post–Chapter Import Checks

**Run this checklist after every chapter import**, once verses have landed in `gitaData.json` and the existing audit (`npm run audit-chapter-import -- --chapter=<N>`) has passed.

These checks catch **deployment and runtime issues** that the JSON-level audit does not cover: visibility gating, caching, routing, SEO, and smoke-test regressions.

> Companion docs:
>
> - JSON-level audit (more_stories alignment, image URLs, takeaway formatting) → `docs/post-chapter-import-audit.md`
> - Full import workflow (Drive → JSON) → `docs/new-chapter-content-import.md`
> - Rollout checklist (topic hubs, SEO, synopsis) → `docs/new-chapter-rollout-checklist.md`

---

## 1. Chapter visibility in Firestore

**What can go wrong:** The chapter page and verse pages redirect to `/` if the chapter is not in the Firestore visibility list. This manifests as: reload `/chapter/<N>` → immediate redirect to home.

**Root cause:** `ChapterVisibilityContext` defaults to `Set([12])` on mount and fetches the real list from `/api/chapter-visibility` asynchronously. Pages that call `isChapterVisible(N)` before the fetch completes will redirect any chapter not in the default set.

### Check

- [ ] Open the **Settings** page (`/settings`) as an admin.
- [ ] Confirm chapter `<N>` is toggled **visible** in the chapter visibility list. If not, toggle it on (this writes to Firestore `gita_config/chapter_visibility`).
- [ ] Verify the API returns the chapter:

```bash
curl -s https://gita.gurukula.com/api/chapter-visibility | python3 -m json.tool
```

Confirm `<N>` appears in the `"visible"` array.

### Smoke test

- [ ] In an **incognito / logged-out** browser window, navigate to `https://gita.gurukula.com/chapter/<N>`. The chapter page must load — **not** redirect to `/`.
- [ ] Reload the page (Cmd+R / Ctrl+R). It must stay on the chapter page.
- [ ] Navigate to `https://gita.gurukula.com/chapter/<N>/verse/1`. The verse page must load. Reload and confirm it stays.

### Why this happens

`ChapterPage`, `VersePage`, and `ChapterSummaryPage` all check `isChapterVisible()` before rendering but do not wait for the `loading` state to resolve. During the brief window between mount and API response, any chapter outside `DEFAULT_VISIBLE` (currently only chapter 12) gets redirected. Once the API returns and includes the chapter, the race window closes — but a logged-out user hitting the URL on first load will still be redirected if the fetch hasn't completed.

---

## 2. Image cache invalidation

**What can go wrong:** Chapter card images on the home page (and verse page images) don't load until a force refresh (Ctrl+Shift+R). The old cached response (404 or stale image) persists.

**Root cause:** Firebase Storage objects are served with `Cache-Control: public, max-age=31536000` (1-year cache). If the browser previously fetched the URL when the image didn't exist (404) or had different content, it caches that response and won't re-check for up to a year. There is no cache-busting query parameter on image URLs.

### Check

- [ ] After uploading/importing images, verify each image URL returns HTTP 200:

```bash
# Check the chapter card image (first verse's meaning image)
curl -sI "https://storage.googleapis.com/sample-f6f12.appspot.com/bhagvad-gita/images/ch<N>/v1/ch<N>v1-meaning.png" | head -5
```

- [ ] If images were **re-uploaded** to the same path (replacing old content), add a cache-busting query parameter to the URL in `gitaData.json`:

```
"url": "https://storage.googleapis.com/.../ch3v1-meaning.png?v=2"
```

- [ ] Alternatively, use a new unique path (timestamp-based) for replacement images — the admin upload UI already does this via `/api/upload`.

### Smoke test

- [ ] Open the home page in an **incognito** window. The chapter `<N>` card image should load on first visit.
- [ ] If it doesn't, the image URL is either wrong (404) or the GCS object has bad metadata. Check with:

```bash
gsutil stat gs://sample-f6f12.appspot.com/bhagvad-gita/images/ch<N>/v1/ch<N>v1-meaning.png
```

### Fixing stale caches for existing users

If users are already seeing stale cached images, the options are:

1. **Rename the file** in GCS and update the URL in `gitaData.json` — new URL = cache miss = fresh fetch.
2. **Set `Cache-Control: no-cache`** on the GCS object so browsers revalidate via ETag:

```bash
gsutil setmeta -h "Cache-Control:public, no-cache" \
  gs://sample-f6f12.appspot.com/bhagvad-gita/images/ch<N>/v1/ch<N>v1-meaning.png
```

3. **Append a version query param** (e.g., `?v=<timestamp>`) to the URL in `gitaData.json`. Browsers treat different query strings as different resources.

---

## 3. Generated chapter description

- [ ] Run:

```bash
npm run generate-chapter-descriptions -- --chapter=<N>
```

- [ ] Confirm `generated_description` is populated for the chapter in `gitaData.json`.
- [ ] If `generated_description` is missing, `ChapterPage` logs a console warning and shows a dev-only reminder.

---

## 4. Topic hubs and SEO wiring

- [ ] Update `client/src/lib/seoKeywords.ts`:
  - Add chapter `<N>` to relevant `TOPIC_HUBS[].chapterNumbers`.
  - Add/update `CHAPTER_INTENT_TERMS[<N>]`.
  - Curate `suggestedVerses` based on `meaning_detail`, `reflection`, and `detailed_meaning` content (not titles alone).
- [ ] Verify `server/seo.ts` generates correct meta tags for `/chapter/<N>` and `/chapter/<N>/verse/<V>`.
- [ ] Confirm sitemap includes routes for the new chapter:

```bash
curl -s https://gita.gurukula.com/sitemap.xml | grep "chapter/<N>"
```

---

## 5. Build and type check

```bash
npm run check
npm run build
```

Both must pass cleanly. Fix any TypeScript or JSON errors before deploying.

---

## 6. JSON-level audit

```bash
npm run audit-chapter-import -- --chapter=<N>
```

This validates `more_stories` vs `images.more_stories` alignment, takeaway formatting, and image URL accessibility. See `docs/post-chapter-import-audit.md` for details.

Strict mode (treat warnings as errors):

```bash
npm run audit-chapter-import -- --chapter=<N> --strict
```

---

## 7. Full smoke test (manual)

Perform these in a **logged-out incognito** browser to simulate a regular user:

### Chapter page

- [ ] `https://gita.gurukula.com/chapter/<N>` — loads without redirect
- [ ] Reload the page — stays on chapter page
- [ ] Chapter card image visible in the header
- [ ] Chapter synopsis/description text is present
- [ ] Verse list is populated and clickable

### Verse pages

- [ ] `https://gita.gurukula.com/chapter/<N>/verse/1` — loads without redirect
- [ ] Reload the page — stays on verse page
- [ ] All tabs load: Meaning, Story, Kids, Grammar, etc.
- [ ] Images load within each tab (no broken images)
- [ ] Prev/Next navigation works and preserves the active tab
- [ ] Audio plays (if audio was imported)

### Home page

- [ ] `https://gita.gurukula.com/` — chapter `<N>` card is visible
- [ ] Chapter `<N>` card image loads (not broken/missing)
- [ ] Clicking the card navigates to `/chapter/<N>`

### Topic pages

- [ ] `/topics` — chapter `<N>` appears in relevant topic hubs
- [ ] At least one `/topics/<slug>` shows verses from chapter `<N>`

### Chapter summary (if imported)

- [ ] `/chapter/<N>/summary` — loads the summary page
- [ ] Summary images render correctly

---

## 8. Common post-import issues and fixes

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| Chapter page redirects to `/` on reload | Chapter not in Firestore visibility list | Toggle visible in Settings (`/settings`) |
| Chapter page redirects to `/` briefly then fixes | Race: visibility API slower than render | Known issue — `DEFAULT_VISIBLE` only has chapter 12; guard with `loading` state |
| Home page chapter image doesn't load | Browser cached 404 from before import | Add `?v=2` to image URL or use new path |
| Images load in incognito but not normal browser | Stale browser cache from previous visit | Force refresh or append version param |
| "Chapter not found" instead of redirect | Chapter scaffold missing from `gitaData.json` | Ensure chapter entry exists in `chapters[]` |
| Console warning about `generated_description` | Forgot to run generator script | Run `npm run generate-chapter-descriptions -- --chapter=<N>` |
| Topic hub doesn't show new chapter | `seoKeywords.ts` not updated | Add chapter to `TOPIC_HUBS[].chapterNumbers` |
| Sitemap missing new chapter URLs | Server SEO not picking up the chapter | Check `server/seo.ts` and redeploy |

---

## Automation

To run the automated checks (JSON audit + build) in one command:

```bash
npm run audit-chapter-import -- --chapter=<N> && npm run check && npm run build
```

The manual smoke tests (sections 1, 2, 7) cannot be fully automated and require a browser. Prioritize the incognito logged-out tests — admin sessions bypass visibility checks and mask issues.
