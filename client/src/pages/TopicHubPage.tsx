import { useState } from "react";
import { Link, Redirect, useLocation, useParams } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import gitaData from "@/data/gitaData.json";
import type { GitaData } from "@/types/gita";
import { TOPIC_HUBS, type TopicHub } from "@/lib/seoKeywords";
import { getChapterDisplayNames, getChapterHeaderImage, getChapterVerses } from "@/lib/chapterContent";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import { useImageUrl } from "@/hooks/useImages";

const data = gitaData as unknown as GitaData;
const TOPIC_HUB_ICONS: Record<string, string> = {
  "anxiety-stress-mental-health": "/topics/topic-anxiety-stress-mental-health.png",
  "decision-making-dharma": "/topics/topic-decision-making-dharma.png",
  "focus-productivity-karma-yoga": "/topics/topic-focus-productivity-karma-yoga.png",
  "philosophy-spiritual-wisdom": "/topics/topic-philosophy-spiritual-wisdom.png",
};

function suggestedVerseLinksFromHub(hub: TopicHub): {
  chapterNum: number;
  verseNum: number;
  sanskrit: string;
  meaning: string;
  reflectionQuestions: string[];
  imageFallbackUrl: string;
}[] {
  return hub.suggestedVerses
    .map(({ chapter, verse }) => {
      const chapterMeta = data.chapters.find((c) => c.chapter === chapter);
      if (!chapterMeta) return null;
      const verses = getChapterVerses(data, chapterMeta);
      const verseRow = verses.find((v) => v.verse === verse);
      const sanskrit = verseRow?.sanskrit?.trim();
      const meaning = verseRow?.one_line_meaning?.trim();
      if (!sanskrit || !meaning) return null;
      const reflectionQuestions = (verseRow.reflection || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 2);
      return {
        chapterNum: chapter,
        verseNum: verse,
        sanskrit,
        meaning,
        reflectionQuestions,
        imageFallbackUrl: verseRow.images?.meaning?.url || "",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

function ShlokaImageButton({
  chapterNum,
  verseNum,
  fallbackUrl,
  onPreview,
}: {
  chapterNum: number;
  verseNum: number;
  fallbackUrl: string;
  onPreview: (url: string) => void;
}) {
  const imageUrl = useImageUrl(`ch${chapterNum}_v${verseNum}_meaning`, fallbackUrl);
  if (!imageUrl) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPreview(imageUrl);
      }}
      className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-orange-200 bg-orange-50 hover:border-orange-300 transition-colors"
      aria-label={`Open shloka image preview for ${chapterNum}.${verseNum}`}
      title="View shloka image"
    >
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </button>
  );
}

function ChapterCardImage({
  chapterNum,
  fallbackUrl,
  onPreview,
}: {
  chapterNum: number;
  fallbackUrl: string;
  onPreview: (url: string) => void;
}) {
  const imageUrl = useImageUrl(`ch${chapterNum}_v1_meaning`, fallbackUrl);
  if (!imageUrl) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPreview(imageUrl);
      }}
      className="w-full h-44 sm:h-auto sm:w-36 md:w-44 lg:w-52 xl:w-56 shrink-0 self-stretch bg-orange-50 block text-left"
      aria-label={`Open chapter ${chapterNum} image preview`}
      title="View chapter image"
    >
      <img
        src={imageUrl}
        alt=""
        className="h-full w-full object-contain sm:object-cover"
        loading="lazy"
        decoding="async"
      />
    </button>
  );
}

export default function TopicHubPage() {
  const params = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const slug = params.slug || "";
  const hub = TOPIC_HUBS.find((item) => item.slug === slug);

  if (!hub) return <Redirect to="/topics" />;

  const chapters = hub.chapterNumbers
    .map((chapterNum) => data.chapters.find((chapter) => chapter.chapter === chapterNum))
    .filter((chapter): chapter is GitaData["chapters"][number] => !!chapter);

  const verseLinks = suggestedVerseLinksFromHub(hub);

  return (
    <Layout>
      <SEO
        title={hub.title}
        description={`${hub.shortDescription} Explore key chapters and verses with practical meaning.`}
        path={`/topics/${hub.slug}`}
        type="article"
      />

      <div className="px-4 lg:px-6 py-8">
        <div className="mb-6">
          <Link
            href="/topics"
            className="text-sm text-orange-700 hover:underline"
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation("/topics"));
            }}
          >
            ← All Topics
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPreviewImage(TOPIC_HUB_ICONS[hub.slug] || null)}
              className="h-14 w-14 lg:h-16 lg:w-16 shrink-0 rounded-xl overflow-hidden border border-orange-200 bg-orange-50 block text-left hover:border-orange-300 transition-colors"
              aria-label={`Open ${hub.title} image preview`}
              title="View topic image"
            >
              <img
                src={TOPIC_HUB_ICONS[hub.slug]}
                alt={`${hub.title} icon`}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
            <h1 className="font-display text-3xl lg:text-4xl text-red-950">{hub.title}</h1>
          </div>
          <p className="text-foreground/80 max-w-3xl mt-2">{hub.shortDescription}</p>
        </div>

        <section className="mb-8">
          <h2 className="font-display text-xl text-red-950 mb-3">Top related chapters</h2>
          <div className="grid grid-cols-1 gap-3 w-full">
            {chapters.map((chapter) => {
              const names = getChapterDisplayNames(chapter);
              return (
                <Link
                  key={chapter.chapter}
                  href={`/chapter/${chapter.chapter}`}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateWithViewTransition(() => setLocation(`/chapter/${chapter.chapter}`));
                  }}
                >
                  <article className="rounded-lg border border-orange-200 bg-white overflow-hidden h-full flex flex-col sm:flex-row hover:border-orange-300 transition-colors">
                    <ChapterCardImage
                      chapterNum={chapter.chapter}
                      fallbackUrl={getChapterHeaderImage(data, chapter) || ""}
                      onPreview={(url) => setPreviewImage(url)}
                    />
                    <div className="p-4 min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p className="text-xs text-orange-600 font-semibold whitespace-nowrap">Chapter {chapter.chapter}</p>
                        <p className="font-devanagari text-lg text-red-900 whitespace-nowrap">{names.devanagariName}</p>
                        <p className="text-sm italic text-foreground/80 whitespace-nowrap">{names.iastName}</p>
                      </div>
                      <p className="text-sm text-foreground/80 mt-2 break-words">
                        {chapter.generated_description || chapter.summary}
                      </p>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-red-950 mb-3">Suggested shlokas</h2>
          <div className="space-y-3">
            {verseLinks.map((item) => (
              <Link
                key={`${item.chapterNum}-${item.verseNum}`}
                href={`/chapter/${item.chapterNum}/verse/${item.verseNum}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateWithViewTransition(() => setLocation(`/chapter/${item.chapterNum}/verse/${item.verseNum}`));
                }}
              >
                <div className="rounded-xl border-2 border-orange-200 bg-white px-3.5 py-3 shadow-sm hover:border-orange-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2">
                    <ShlokaImageButton
                      chapterNum={item.chapterNum}
                      verseNum={item.verseNum}
                      fallbackUrl={item.imageFallbackUrl}
                      onPreview={(url) => setPreviewImage(url)}
                    />
                    <span className="block text-2xl font-bold leading-none tracking-tight text-red-950 tabular-nums">
                      {item.chapterNum}.{item.verseNum}
                    </span>
                  </div>
                  <p className="font-devanagari text-base text-red-900 leading-relaxed mt-2 whitespace-pre-line break-words">
                    {item.sanskrit}
                  </p>
                  <p className="text-sm text-foreground/90 mt-2 break-words">{item.meaning}</p>
                  {item.reflectionQuestions.length > 0 && (
                    <div className="mt-2 rounded-md border border-violet-200 bg-violet-50 px-2.5 py-2">
                      <p className="text-xs font-semibold text-violet-600 mb-1">Reflection</p>
                      <div className="space-y-1">
                        {item.reflectionQuestions.map((q, i) => (
                          <p key={i} className="text-xs text-violet-900/90 leading-relaxed flex gap-1.5">
                            <span className="text-violet-400 flex-shrink-0">◈</span>
                            <span className="break-words">{q}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 p-4 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Shloka icon preview"
        >
          <div
            className="relative max-w-3xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white text-red-900 font-bold shadow-md"
              aria-label="Close image preview"
            >
              ×
            </button>
            <img
              src={previewImage}
              alt="Shloka icon full preview"
              className="w-full max-h-[80vh] object-contain rounded-xl border border-white/20"
            />
          </div>
        </div>
      )}
    </Layout>
  );
}

