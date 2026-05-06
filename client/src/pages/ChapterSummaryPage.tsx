import { Link, useParams, Redirect, useLocation } from "wouter";
import { navigateWithViewTransition } from "@/lib/navigateWithViewTransition";
import Layout from "@/components/Layout";
import SEO from "@/components/SEO";
import gitaData from "@/data/gitaData.json";
import chapterSummaries from "@/data/chapterSummaries.json";
import type { GitaData } from "@/types/gita";
import { useChapterVisibility } from "@/contexts/ChapterVisibilityContext";
import { getChapterHeroImageUrl } from "@/lib/chapterHeroImage";
import { getChapterDisplayNames, getChapterVerses } from "@/lib/chapterContent";
import { ChevronLeft, ChevronRight } from "lucide-react";

const data = gitaData as unknown as GitaData;

type SummaryBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "img"; src: string };

type SummarySectionLegacy = {
  heading: string;
  body: string;
  image?: string;
};

type ChapterSummaryDoc =
  | { sourceDoc?: string; content: SummaryBlock[] }
  | { sections: SummarySectionLegacy[] };

function isContentFormat(doc: ChapterSummaryDoc): doc is { sourceDoc?: string; content: SummaryBlock[] } {
  return Array.isArray((doc as { content?: unknown }).content);
}

const summaries = chapterSummaries as Record<string, ChapterSummaryDoc>;

const sectionShells = [
  "bg-gradient-to-br from-rose-50 to-orange-50 border-rose-200",
  "bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200",
  "bg-gradient-to-br from-violet-50 to-fuchsia-50 border-violet-200",
  "bg-gradient-to-br from-sky-50 to-teal-50 border-sky-200",
  "bg-gradient-to-br from-emerald-50 to-lime-50 border-emerald-200",
  "bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-200",
];

function groupContentByHeading(blocks: SummaryBlock[]): { heading: string; blocks: SummaryBlock[] }[] {
  const runs: { heading: string; blocks: SummaryBlock[] }[] = [];
  let current: { heading: string; blocks: SummaryBlock[] } | null = null;

  for (const b of blocks) {
    if (b.type === "h2") {
      if (current) runs.push(current);
      current = { heading: b.text, blocks: [] };
    } else {
      if (!current) {
        current = { heading: "", blocks: [] };
      }
      current.blocks.push(b);
    }
  }
  if (current) runs.push(current);
  return runs;
}

export default function ChapterSummaryPage() {
  const params = useParams<{ chapterNum: string }>();
  const chapterNum = parseInt(params.chapterNum || "1", 10);
  const [, setLocation] = useLocation();
  const { isChapterVisible } = useChapterVisibility();
  const chapter = data.chapters.find((c) => c.chapter === chapterNum);

  if (!chapter) return <div className="p-8 text-center">Chapter not found</div>;
  if (!isChapterVisible(chapterNum)) return <Redirect to="/" />;

  const verses = getChapterVerses(data, chapter);
  const heroImage = getChapterHeroImageUrl(chapterNum, verses);
  const rich = summaries[String(chapterNum)];

  const { devanagariName, iastName } = getChapterDisplayNames(chapter);

  const title = `Chapter ${chapterNum} Summary`;
  const description =
    chapter.summary ||
    `Overview of Bhagavad Gita Chapter ${chapterNum} (${iastName}) — themes and orientation before reading the ślokas.`;

  const contentRuns =
    rich && isContentFormat(rich) ? groupContentByHeading(rich.content) : null;
  const legacySections = rich && !isContentFormat(rich) ? rich.sections : null;

  return (
    <Layout>
      <SEO
        title={`${title} — ${iastName || chapter.name}`}
        description={description}
        path={`/chapter/${chapterNum}/summary`}
        image={heroImage || undefined}
        type="article"
        structuredData={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Article",
              name: `${title} — ${iastName || chapter.name}`,
              description,
              url: `https://gita.gurukula.com/chapter/${chapterNum}/summary`,
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: "https://gita.gurukula.com/",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: `Chapter ${chapterNum}`,
                  item: `https://gita.gurukula.com/chapter/${chapterNum}`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: "Summary",
                  item: `https://gita.gurukula.com/chapter/${chapterNum}/summary`,
                },
              ],
            },
          ],
        }}
      />

      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/70 to-red-900/95 z-[1]" />
        {heroImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-25"
            style={{ backgroundImage: `url(${heroImage})` }}
          />
        )}
        <div className="relative z-10 px-4 lg:px-6 py-8">
          <div className="flex items-center gap-2 text-red-200 text-sm mb-4">
            <Link
              href="/"
              className="hover:text-orange-200 transition-colors touch-manipulation"
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation("/"));
              }}
            >
              Home
            </Link>
            <ChevronRight size={14} />
            <Link
              href={`/chapter/${chapterNum}`}
              className="hover:text-orange-200 transition-colors touch-manipulation"
              onClick={(e) => {
                e.preventDefault();
                navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}`));
              }}
            >
              Chapter {chapterNum}
            </Link>
            <ChevronRight size={14} />
            <span className="text-orange-200">Summary</span>
          </div>
          <h1 className="text-white font-display text-3xl lg:text-4xl font-bold">
            {title}
          </h1>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-2">
            <p className="text-orange-200 font-devanagari text-2xl lg:text-3xl font-semibold leading-tight">
              {devanagariName}
            </p>
            <p className="text-orange-100/95 italic text-xl lg:text-2xl font-medium">{iastName}</p>
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-6 py-8 space-y-6 max-w-6xl w-full">
        {contentRuns ? (
          contentRuns.map((run, i) => (
            <section
              key={i}
              className={`rounded-2xl border-2 p-5 lg:p-7 shadow-sm ${sectionShells[i % sectionShells.length]}`}
            >
              {run.heading && (
                <h2 className="font-display text-xl lg:text-2xl font-bold text-red-950 mb-4">
                  {run.heading}
                </h2>
              )}
              {run.blocks
                .filter((b): b is Extract<SummaryBlock, { type: "img" }> => b.type === "img")
                .map((b, j) => (
                  <img
                    key={`img-${j}`}
                    src={b.src}
                    alt=""
                    className="w-full max-h-80 object-cover rounded-xl border border-white/60 shadow mb-4"
                  />
                ))}
              <div className="space-y-4">
                {run.blocks
                  .filter((b): b is Extract<SummaryBlock, { type: "p" }> => b.type === "p")
                  .map((b, j) => (
                    <p key={`p-${j}`} className="text-foreground/90 text-base leading-relaxed">
                      {b.text}
                    </p>
                  ))}
              </div>
            </section>
          ))
        ) : legacySections ? (
          legacySections.map((sec, i) => (
            <section
              key={i}
              className={`rounded-2xl border-2 p-5 lg:p-7 shadow-sm ${sectionShells[i % sectionShells.length]}`}
            >
              <h2 className="font-display text-xl lg:text-2xl font-bold text-red-950 mb-4">
                {sec.heading}
              </h2>
              {sec.image && (
                <img
                  src={sec.image}
                  alt=""
                  className="w-full max-h-64 object-cover rounded-xl mb-4 border border-white/60 shadow"
                />
              )}
              <div className="text-foreground/90 text-base leading-relaxed space-y-3">
                {sec.body.split(/\n\n+/).map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="rounded-2xl border-2 border-orange-200 bg-orange-50/50 p-6">
            <h2 className="font-display text-xl font-bold text-red-950 mb-3">Chapter overview</h2>
            <p className="text-foreground/90 text-base leading-relaxed">{chapter.summary}</p>
            <p className="text-muted-foreground text-sm mt-4">
              A chapter synopsis from Drive (folder{" "}
              <code className="text-xs">chapter{String(chapterNum).padStart(4, "0")}</code>, file{" "}
              <code className="text-xs">chapter{String(chapterNum).padStart(4, "0")} Synopsis</code>) has not been
              imported into <code className="text-xs">chapterSummaries.json</code> yet. See{" "}
              <code className="text-xs">scripts/import-chapter-synopsis.md</code>.
            </p>
          </section>
        )}

        <div className="flex justify-between pt-4">
          <Link
            href={`/chapter/${chapterNum}`}
            onClick={(e) => {
              e.preventDefault();
              navigateWithViewTransition(() => setLocation(`/chapter/${chapterNum}`));
            }}
          >
            <span className="inline-flex items-center gap-2 text-red-800 font-semibold hover:text-orange-600 cursor-pointer touch-manipulation">
              <ChevronLeft size={18} />
              Back to chapter
            </span>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
