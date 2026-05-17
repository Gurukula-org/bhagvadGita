/**
 * Versioned GCS object names for verse section images (CDN cache busting).
 *
 * Pattern: ch<N>v<V>-<slot>-v<version>.png
 * Legacy (no -vN): treated as version 1; next upload is -v2.
 */

export function slotBasename(chapter, verse, storageSlot) {
  return `ch${chapter}v${verse}-${storageSlot}`;
}

export function versionedObjectName(chapter, verse, storageSlot, version) {
  const base = slotBasename(chapter, verse, storageSlot);
  return `bhagvad-gita/images/ch${chapter}/v${verse}/${base}-v${version}.png`;
}

export function publicUrl(objectName, bucket = "sample-f6f12.appspot.com") {
  return `https://storage.googleapis.com/${bucket}/${objectName}`;
}

/** @returns {number} 0 = no prior image; 1+ = last version in use */
export function parseVersionFromUrl(url, basename) {
  if (!url) return 0;
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const versioned = new RegExp(`${escaped}-v(\\d+)\\.png`, "i");
  const m = url.match(versioned);
  if (m) return Number(m[1]);
  const unversioned = new RegExp(`${escaped}\\.png`, "i");
  if (unversioned.test(url)) return 1;
  return 0;
}

export function getImageUrlForSlot(verse, storageSlot) {
  if (!verse?.images) return "";
  if (storageSlot.startsWith("story-")) {
    const idx = Number(storageSlot.split("-")[1]) - 1;
    return verse.images.story?.[idx]?.url ?? "";
  }
  if (storageSlot.startsWith("more-stories-")) {
    const idx = Number(storageSlot.split("-")[2]) - 1;
    return verse.images.more_stories?.[idx]?.url ?? "";
  }
  const keyBySlot = {
    meaning: "meaning",
    "modern-life": "modern_life",
    "kids-explain": "kids_explain",
    "kids-story": "kids_story",
    "detailed-meaning": "detailed_meaning",
  };
  const key = keyBySlot[storageSlot] ?? storageSlot;
  const entry = verse.images[key];
  return entry?.url ?? "";
}

export function nextVersionForSlot(verse, chapter, verseNum, storageSlot) {
  const basename = slotBasename(chapter, verseNum, storageSlot);
  const current = parseVersionFromUrl(getImageUrlForSlot(verse, storageSlot), basename);
  return current + 1;
}
