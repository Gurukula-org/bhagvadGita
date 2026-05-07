import { Link, Redirect, useLocation, useParams } from "wouter";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import gitaData from "@/data/gitaData.json";
import type { GitaData } from "@/types/gita";
import { TOPIC_HUBS, type TopicHub } from "@/lib/seoKeywords";
import { getChapterDisplayNames, getChapterVerses } from "@/lib/chapterContent";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";

const data = gitaData as unknown as GitaData;

function suggestedVerseLinksFromHub(hub: TopicHub): { chapterNum: number; verseNum: number; label: string }[] {
  return hub.suggestedVerses
    .map(({ chapter, verse }) => {
      const chapterMeta = data.chapters.find((c) => c.chapter === chapter);
      if (!chapterMeta) return null;
      const verses = getChapterVerses(data, chapterMeta);
      const verseRow = verses.find((v) => v.verse === verse);
      const label = verseRow?.one_line_meaning?.trim();
      if (!label) return null;
      return { chapterNum: chapter, verseNum: verse, label };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export default function TopicHubPage() {
  const params = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
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
          <h1 className="font-display text-3xl lg:text-4xl text-red-950 mt-2">{hub.title}</h1>
          <p className="text-foreground/80 max-w-3xl mt-2">{hub.shortDescription}</p>
        </div>

        <section className="mb-8">
          <h2 className="font-display text-xl text-red-950 mb-3">Top related chapters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <article className="rounded-lg border border-orange-200 bg-white p-4 hover:border-orange-300 transition-colors">
                    <p className="text-xs text-orange-600 font-semibold">Chapter {chapter.chapter}</p>
                    <p className="font-devanagari text-lg text-red-900">{names.devanagariName}</p>
                    <p className="text-sm italic text-foreground/80">{names.iastName}</p>
                    <p className="text-sm text-foreground/80 mt-2 line-clamp-2">
                      {chapter.generated_description || chapter.summary}
                    </p>
                  </article>
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-red-950 mb-3">Suggested verses</h2>
          <div className="space-y-2">
            {verseLinks.map((item) => (
              <Link
                key={`${item.chapterNum}-${item.verseNum}`}
                href={`/chapter/${item.chapterNum}/verse/${item.verseNum}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateWithViewTransition(() => setLocation(`/chapter/${item.chapterNum}/verse/${item.verseNum}`));
                }}
              >
                <div className="rounded-lg border border-orange-200 bg-orange-50/50 px-3 py-2 hover:bg-orange-100/70 transition-colors">
                  <span className="text-xs font-semibold text-orange-700">
                    {item.chapterNum}.{item.verseNum}
                  </span>
                  <p className="text-sm text-foreground/90 line-clamp-1">{item.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}

