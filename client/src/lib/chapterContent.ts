import type { ChapterMeta, GitaData, Verse } from "@/types/gita";

export interface ChapterDisplayNames {
  iastName: string;
  devanagariName: string;
}

export function getChapterVerses(data: GitaData, chapter: ChapterMeta): Verse[] {
  return chapter.chapter === 6 ? data.chapter6_full : chapter.key_verses;
}

export function getChapterDisplayNames(chapter: ChapterMeta): ChapterDisplayNames {
  return {
    iastName: chapter.iast_name || chapter.name,
    devanagariName: chapter.devanagari_name || chapter.name_hindi,
  };
}

export function getChapterSynopsis(chapter: ChapterMeta): string {
  return (chapter.generated_description || chapter.summary || "").trim();
}

export function hasGeneratedChapterSynopsis(chapter: ChapterMeta): boolean {
  return (chapter.generated_description || "").trim().length > 0;
}

/** Meaning image used in chapter hero / SEO (Ch12 uses verse 2; others use first key verse). */
export function getChapterHeaderMeaningImage(
  data: GitaData,
  chapter: ChapterMeta,
): { url: string; imageKey: string } | null {
  const verses = getChapterVerses(data, chapter);
  const ch = chapter.chapter;
  if (ch === 12) {
    const verse2 = verses.find((v) => v.verse === 2);
    if (verse2?.images?.meaning?.url) {
      return { url: verse2.images.meaning.url, imageKey: "ch12_v2_meaning" };
    }
  }
  const first = verses[0];
  if (first?.images?.meaning?.url) {
    return {
      url: first.images.meaning.url,
      imageKey: `ch${ch}_v${first.verse}_meaning`,
    };
  }
  return null;
}

export function getChapterHeaderImage(data: GitaData, chapter: ChapterMeta): string | null {
  return getChapterHeaderMeaningImage(data, chapter)?.url ?? null;
}

