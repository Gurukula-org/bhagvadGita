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

export function getChapterHeaderImage(data: GitaData, chapter: ChapterMeta): string | null {
  const verses = getChapterVerses(data, chapter);
  if (chapter.chapter === 12) {
    const verse2 = verses.find((verse) => verse.verse === 2);
    if (verse2?.images?.meaning?.url) return verse2.images.meaning.url;
  }
  return verses[0]?.images?.meaning?.url || null;
}

